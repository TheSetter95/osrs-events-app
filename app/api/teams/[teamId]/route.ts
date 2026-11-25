import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const { error } = await supabase.from('teams').delete().eq('id', params.teamId)

  if (error) {
    return NextResponse.json({ error: 'Verwijderen mislukt.' }, { status: 403 })
  }

  return NextResponse.json({ success: true })
}

export async function PATCH(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const { can_roll } = await request.json()

  if (typeof can_roll !== 'boolean') {
    return NextResponse.json({ error: 'Ongeldige waarde.' }, { status: 400 })
  }

  const { data: before } = await supabase
    .from('teams')
    .select('id, event_id, can_roll')
    .eq('id', params.teamId)
    .single()

  const { data: team, error } = await supabase
    .from('teams')
    .update({ can_roll })
    .eq('id', params.teamId)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Wijzigen mislukt. Alleen owners/organizers mogen dit.' },
      { status: 403 }
    )
  }

  // Elke wijziging van de vrijgave komt zichtbaar in de geschiedenis.
  if (before && before.can_roll !== can_roll) {
    await supabase.from('progress_updates').insert({
      event_id: before.event_id,
      participant_id: null,
      data: { team_id: before.id, method: 'vrijgave_gewijzigd', can_roll },
      source: 'web',
      created_by: user.id,
    })
  }

  return NextResponse.json({ team })
}
