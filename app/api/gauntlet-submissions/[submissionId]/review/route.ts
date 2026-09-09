import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

  // Geen verdere terugval-logica nodig: bij afwijzen telt de rij simpelweg niet meer
  // mee in de som (status != 'confirmed'/'pending'), dus de teller zakt vanzelf.
  const { data: submission, error } = await supabase
    .from('gauntlet_submissions')
    .update(updates)
    .eq('id', params.submissionId)
    .eq('status', 'pending')
    .select()
    .single()

  if (error || !submission) {
    return NextResponse.json(
      { error: 'Beoordelen mislukt. Ben je owner, en staat de melding nog open?' },
      { status: 403 }
    )
  }

  return NextResponse.json({ submission })
}
