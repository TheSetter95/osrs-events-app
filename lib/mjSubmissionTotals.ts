import { createAdminClient } from './supabase/admin'

export async function getMjSubmissionTotal(requirementId: string, teamId: string) {
  const supabaseAdmin = createAdminClient()

  const { data } = await supabaseAdmin
    .from('mj_item_submissions')
    .select('quantity')
    .eq('requirement_id', requirementId)
    .eq('team_id', teamId)
    .neq('status', 'rejected')

  return (data ?? []).reduce((sum, row) => sum + row.quantity, 0)
}

// Checkt of alle doelen van een Miljoenenjacht-opdracht voor dit team compleet zijn, en zorgt dat
// mj_completions daarmee in sync blijft (voegt toe of haalt weg naargelang nodig).
export async function syncMjAssignmentCompletion(assignmentId: string, teamId: string) {
  const supabaseAdmin = createAdminClient()

  const { data: requirements } = await supabaseAdmin
    .from('mj_assignment_requirements')
    .select('id, required_quantity')
    .eq('assignment_id', assignmentId)

  if (!requirements || requirements.length === 0) return

  let allComplete = true
  for (const req of requirements) {
    const total = await getMjSubmissionTotal(req.id, teamId)
    if (total < req.required_quantity) {
      allComplete = false
      break
    }
  }

  const { data: existing } = await supabaseAdmin
    .from('mj_completions')
    .select('id')
    .eq('assignment_id', assignmentId)
    .eq('team_id', teamId)
    .maybeSingle()

  if (allComplete && !existing) {
    await supabaseAdmin.from('mj_completions').insert({ assignment_id: assignmentId, team_id: teamId })
  } else if (!allComplete && existing) {
    await supabaseAdmin.from('mj_completions').delete().eq('id', existing.id)
  }

  return allComplete
}
