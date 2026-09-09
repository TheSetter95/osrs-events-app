import { createAdminClient } from './supabase/admin'
import { findEarliestQualifier } from './raceWinnerLogic'

export async function recomputeRaceStatus(raceId: string) {
  const supabaseAdmin = createAdminClient()

  const { data: race } = await supabaseAdmin
    .from('drop_races')
    .select('id, mode, required_quantity, status')
    .eq('id', raceId)
    .single()

  if (!race) return

  const { data: submissions } = await supabaseAdmin
    .from('drop_race_submissions')
    .select('id, team_id, participant_id, quantity, status, created_at')
    .eq('race_id', raceId)

  const racerKeyField = race.mode === 'team' ? 'team_id' : 'participant_id'
  const leader = findEarliestQualifier((submissions ?? []) as any, race.required_quantity, racerKeyField)

  if (!leader) {
    // Niemand (meer) gekwalificeerd -> race staat weer volledig open
    if (race.status !== 'open') {
      await supabaseAdmin
        .from('drop_races')
        .update({ status: 'open', winning_team_id: null, winning_participant_id: null, claimed_at: null })
        .eq('id', raceId)
    }
    return
  }

  const updates: Record<string, unknown> = {
    status: leader.isConfirmed ? 'completed' : 'pending_claim',
    claimed_at: leader.reachedAt,
    winning_team_id: race.mode === 'team' ? leader.racerId : null,
    winning_participant_id: race.mode === 'individual' ? leader.racerId : null,
  }

  await supabaseAdmin.from('drop_races').update(updates).eq('id', raceId)
}
