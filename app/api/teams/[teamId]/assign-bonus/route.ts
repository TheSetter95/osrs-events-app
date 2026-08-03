import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
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

  const { data: team } = await supabase
    .from('teams')
    .select('id, name, event_id')
    .eq('id', params.teamId)
    .single()

  if (!team) {
    return NextResponse.json({ error: 'Team niet gevonden.' }, { status: 404 })
  }

  // Team vrijgeven voor een extra (normale, voorwaartse) worp.
  // Geen pending_penalty nodig: een normale worp gaat toch al vooruit.
  const { error } = await supabase
    .from('teams')
    .update({ can_roll: true })
    .eq('id', team.id)

  if (error) {
    return NextResponse.json(
      { error: 'Toewijzen mislukt. Ben je organizer/owner van deze community?' },
      { status: 403 }
    )
  }

  await supabase.from('progress_updates').insert({
    event_id: team.event_id,
    participant_id: null,
    data: { team_id: team.id, method: 'bonus_toegewezen' },
    source: 'web',
    created_by: user.id,
  })

  return NextResponse.json({ assigned: true })
}
