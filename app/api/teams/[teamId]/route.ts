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

  return NextResponse.json({ team })
}
