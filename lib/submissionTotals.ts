import { createAdminClient } from './supabase/admin'

// Telt alle niet-afgewezen submissions (confirmed + pending) op voor één team+item.
// Dit is de "levende" teller — er wordt nergens een los getal bijgehouden.
export async function getSubmissionTotal(requirementId: string, teamId: string) {
  const supabaseAdmin = createAdminClient()

  const { data } = await supabaseAdmin
    .from('item_submissions')
    .select('quantity')
    .eq('requirement_id', requirementId)
    .eq('team_id', teamId)
    .neq('status', 'rejected')

  return (data ?? []).reduce((sum, row) => sum + row.quantity, 0)
}
