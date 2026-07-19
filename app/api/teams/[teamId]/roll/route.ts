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
    .select('id, event_id, board_position, pending_penalty')
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

  const roll = Math.floor(Math.random() * 6) + 1
  const isPenaltyRoll = team.pending_penalty

  const newPosition = isPenaltyRoll
    ? Math.max(team.board_position - roll, 0)
    : Math.min(team.board_position + roll, boardSize)

  const updates: Record<string, unknown> = { board_position: newPosition }
  if (isPenaltyRoll) {
    updates.pending_penalty = false
  }

  // RLS bepaalt of dit mag: organizer/owner altijd, of een teamlid van een
  // team met can_roll = true (zie Stap 7-SQL). Geen match -> 0 rijen bijgewerkt.
  const { data: updatedTeam, error: updateError } = await supabase
    .from('teams')
    .update(updates)
    .eq('id', team.id)
    .select()
    .single()

  if (updateError || !updatedTeam) {
    return NextResponse.json(
      { error: 'Je hebt geen toestemming om voor dit team te gooien.' },
      { status: 403 }
    )
  }

  // Log deze zet in de geschiedenis
  await supabase.from('progress_updates').insert({
    event_id: team.event_id,
    participant_id: null,
    data: {
      team_id: team.id,
      roll,
      from: team.board_position,
      to: newPosition,
      method: isPenaltyRoll ? 'straf_zelf' : 'dobbelsteen',
    },
    source: 'web',
    created_by: user.id,
  })

  // Bij een strafworp checken we geen vakje-opdracht (voorkomt kettingreacties)
  if (isPenaltyRoll) {
    return NextResponse.json({ roll, position: newPosition, penaltyRoll: true, tile: null })
  }

  // Check of het nieuwe vakje een opdracht heeft
  const { data: tile } = await supabase
    .from('board_tiles')
    .select('*')
    .eq('event_id', team.event_id)
    .eq('tile_number', newPosition)
    .maybeSingle()

  return NextResponse.json({ roll, position: newPosition, penaltyRoll: false, tile: tile ?? null })
}
