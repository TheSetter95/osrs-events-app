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

  const { type, value } = await request.json()

  const { data: team } = await supabase
    .from('teams')
    .select('id, name, event_id, board_position')
    .eq('id', params.teamId)
    .single()

  if (!team) {
    return NextResponse.json({ error: 'Team niet gevonden.' }, { status: 404 })
  }

  let roll: number | null = null
  let steps = 0

  if (type === 'terug_dobbelsteen') {
    roll = Math.floor(Math.random() * 6) + 1
    steps = roll
  } else if (type === 'terug_vast') {
    steps = typeof value === 'number' ? value : 0
  } else {
    return NextResponse.json({ error: 'Ongeldig strafType.' }, { status: 400 })
  }

  const newPosition = Math.max(team.board_position - steps, 0)

  const { error } = await supabase
    .from('teams')
    .update({ board_position: newPosition })
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
    data: {
      team_id: team.id,
      roll,
      steps,
      from: team.board_position,
      to: newPosition,
      method: 'straf',
    },
    source: 'web',
    created_by: user.id,
  })

  return NextResponse.json({ roll, position: newPosition })
}
