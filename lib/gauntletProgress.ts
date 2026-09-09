import { createAdminClient } from './supabase/admin'
import { findEarliestQualifier } from './raceWinnerLogic'

// Geeft het stapnummer terug waar deze racer nu aan mag werken (1 = eerste stap).
// Dat is: aantal opeenvolgend voltooide stappen (vanaf stap 1) + 1.
export async function getCurrentStageOrder(
  eventId: string,
  racerId: string,
  mode: 'team' | 'individual'
) {
  const supabaseAdmin = createAdminClient()
  const racerKeyField = mode === 'team' ? 'team_id' : 'participant_id'

  const { data: stages } = await supabaseAdmin
    .from('gauntlet_stages')
    .select('id, stage_order, required_quantity')
    .eq('event_id', eventId)
    .order('stage_order', { ascending: true })

  let currentOrder = 1

  for (const stage of stages ?? []) {
    const { data: submissions } = await supabaseAdmin
      .from('gauntlet_submissions')
      .select('id, team_id, participant_id, quantity, status, created_at')
      .eq('stage_id', stage.id)

    const qualifier = findEarliestQualifier(
      (submissions ?? []) as any,
      stage.required_quantity,
      racerKeyField
    )

    const thisRacerQualifies = qualifier?.racerId === racerId

    if (thisRacerQualifies) {
      currentOrder = stage.stage_order + 1
    } else {
      break
    }
  }

  return currentOrder
}
