import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const { assignmentId, teamId } = await request.json()

  if (!assignmentId || !teamId) {
    return NextResponse.json({ error: 'Ongeldige invoer.' }, { status: 400 })
  }

  // Voor het logboek: bij welk event hoort dit vakje?
  const { data: assignmentRow } = await supabase
    .from('mj_assignments')
    .select('event_id')
    .eq('id', assignmentId)
    .single()

  async function logChange(method: string) {
    if (!assignmentRow?.event_id) return
    await supabase.from('progress_updates').insert({
      event_id: assignmentRow.event_id,
      participant_id: null,
      data: { team_id: teamId, assignment_id: assignmentId, method },
      source: 'web',
      created_by: user!.id,
    })
  }

  const { data: existing } = await supabase
    .from('mj_completions')
    .select('id')
    .eq('assignment_id', assignmentId)
    .eq('team_id', teamId)
    .maybeSingle()

  if (existing) {
    // Al voltooid -> markering weer weghalen
    const { error } = await supabase.from('mj_completions').delete().eq('id', existing.id)

    if (error) {
      return NextResponse.json({ error: 'Bijwerken mislukt.' }, { status: 403 })
    }

    await logChange('mj_opdracht_teruggezet')
    return NextResponse.json({ completed: false })
  }

  // Nog niet voltooid -> markeren als voltooid
  const { error } = await supabase.from('mj_completions').insert({
    assignment_id: assignmentId,
    team_id: teamId,
    completed_by: user.id,
  })

  if (error) {
    return NextResponse.json(
      { error: 'Bijwerken mislukt. Ben je organizer/owner van deze community?' },
      { status: 403 }
    )
  }

  await logChange('mj_opdracht_afgevinkt')
  return NextResponse.json({ completed: true })
}
