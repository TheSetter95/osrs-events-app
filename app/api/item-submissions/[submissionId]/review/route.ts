import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getSubmissionTotal } from '@/lib/submissionTotals'

export async function POST(
  request: Request,
  { params }: { params: { submissionId: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const { action, reason } = await request.json()

  if (!['confirm', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Ongeldige actie.' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {
    status: action === 'confirm' ? 'confirmed' : 'rejected',
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  }

  if (action === 'reject') {
    updates.rejection_reason = reason?.trim() || 'Geen reden opgegeven'
  }

  const { data: submission, error } = await supabase
    .from('item_submissions')
    .update(updates)
    .eq('id', params.submissionId)
    .eq('status', 'pending') // voorkomt dubbel beoordelen
    .select()
    .single()

  if (error || !submission) {
    return NextResponse.json(
      { error: 'Beoordelen mislukt. Ben je owner van deze community, en staat de melding nog open?' },
      { status: 403 }
    )
  }

  // Bij bevestigen: check of dit vakje nu volledig compleet is voor dit team,
  // en zo ja, geef het team automatisch weer vrij om te gooien.
  if (action === 'confirm') {
    const { data: requirement } = await supabase
      .from('board_tile_requirements')
      .select('tile_id')
      .eq('id', submission.requirement_id)
      .single()

    if (requirement) {
      const { data: allRequirements } = await supabase
        .from('board_tile_requirements')
        .select('id, required_quantity')
        .eq('tile_id', requirement.tile_id)

      let allComplete = true
      for (const req of allRequirements ?? []) {
        const total = await getSubmissionTotal(req.id, submission.team_id)
        if (total < req.required_quantity) {
          allComplete = false
          break
        }
      }

      if (allComplete) {
        await supabase.from('teams').update({ can_roll: true }).eq('id', submission.team_id)
      }
    }
  }

  return NextResponse.json({ submission })
}
