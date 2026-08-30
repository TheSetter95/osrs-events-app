import { createAdminClient } from './supabase/admin'

export async function getBingoSubmissionTotal(requirementId: string, teamId: string) {
  const supabaseAdmin = createAdminClient()

  const { data } = await supabaseAdmin
    .from('bingo_item_submissions')
    .select('quantity')
    .eq('requirement_id', requirementId)
    .eq('team_id', teamId)
    .neq('status', 'rejected')

  return (data ?? []).reduce((sum, row) => sum + row.quantity, 0)
}

// Checkt of alle doelen van een Bingo-vakje voor dit team compleet zijn, en zorgt dat
// bingo_completions daarmee in sync blijft (voegt toe of haalt weg naargelang nodig).
export async function syncBingoTileCompletion(tileId: string, teamId: string) {
  const supabaseAdmin = createAdminClient()

  const { data: requirements } = await supabaseAdmin
    .from('bingo_tile_requirements')
    .select('id, required_quantity')
    .eq('tile_id', tileId)

  if (!requirements || requirements.length === 0) return

  let allComplete = true
  for (const req of requirements) {
    const total = await getBingoSubmissionTotal(req.id, teamId)
    if (total < req.required_quantity) {
      allComplete = false
      break
    }
  }

  const { data: existing } = await supabaseAdmin
    .from('bingo_completions')
    .select('id')
    .eq('tile_id', tileId)
    .eq('team_id', teamId)
    .maybeSingle()

  if (allComplete && !existing) {
    await supabaseAdmin.from('bingo_completions').insert({ tile_id: tileId, team_id: teamId })
  } else if (!allComplete && existing) {
    await supabaseAdmin.from('bingo_completions').delete().eq('id', existing.id)
  }

  return allComplete
}
