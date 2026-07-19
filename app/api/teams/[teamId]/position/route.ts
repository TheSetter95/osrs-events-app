import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

  const { position } = await request.json()

  if (typeof position !== 'number' || position < 0) {
    return NextResponse.json({ error: 'Ongeldige positie.' }, { status: 400 })
  }

  const { data: team } = await supabase
    .from('teams')
    .select('id, event_id, board_position')
    .eq('id', params.teamId)
    .single()

  if (!team) {
    return NextResponse.json({ error: 'Team niet gevonden.' }, { status: 404 })
  }

  const { data: event } = await supabase
    .from('events')
    .select('config')
    .eq('id', team.event_id)
    .single()

  const boardSize = (event?.config as any)?.boardSize ?? 63
  const clamped = Math.min(Math.max(position, 0), boardSize)

  const { error } = await supabase
    .from('teams')
    .update({ board_position: clamped })
    .eq('id', team.id)

  if (error) {
    return NextResponse.json(
      { error: 'Bijwerken mislukt. Ben je organizer/owner van deze community?' },
      { status: 403 }
    )
  }

  await supabase.from('progress_updates').insert({
    event_id: team.event_id,
    participant_id: null,
    data: { team_id: team.id, from: team.board_position, to: clamped, method: 'handmatig' },
    source: 'web',
    created_by: user.id,
  })

  return NextResponse.json({ position: clamped })
}
