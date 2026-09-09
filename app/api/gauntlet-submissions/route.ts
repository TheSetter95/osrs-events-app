import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getCurrentStageOrder } from '@/lib/gauntletProgress'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const { stageId, teamId, participantId, quantity, screenshotUrl } = await request.json()

  if (!stageId || (!teamId && !participantId) || !quantity || quantity < 1) {
    return NextResponse.json({ error: 'Ongeldige invoer.' }, { status: 400 })
  }

  if (!screenshotUrl || typeof screenshotUrl !== 'string' || !screenshotUrl.trim()) {
    return NextResponse.json({ error: 'Vul een link naar je screenshot in.' }, { status: 400 })
  }

  try {
    const parsed = new URL(screenshotUrl.trim())
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid')
  } catch {
    return NextResponse.json({ error: 'Dat is geen geldige link.' }, { status: 400 })
  }

  const { data: stage } = await supabase
    .from('gauntlet_stages')
    .select('id, event_id, stage_order')
    .eq('id', stageId)
    .single()

  if (!stage) {
    return NextResponse.json({ error: 'Stap niet gevonden.' }, { status: 404 })
  }

  const mode: 'team' | 'individual' = teamId ? 'team' : 'individual'
  const racerId = teamId || participantId

  const currentOrder = await getCurrentStageOrder(stage.event_id, racerId, mode)

  if (stage.stage_order !== currentOrder) {
    return NextResponse.json(
      { error: `Deze stap is nog niet aan de beurt — eerst stap ${currentOrder} voltooien.` },
      { status: 400 }
    )
  }

  const { data: submission, error } = await supabase
    .from('gauntlet_submissions')
    .insert({
      stage_id: stageId,
      team_id: teamId || null,
      participant_id: participantId || null,
      quantity,
      source: 'screenshot',
      status: 'pending',
      screenshot_url: screenshotUrl.trim(),
      submitted_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Insturen mislukt.' }, { status: 403 })
  }

  return NextResponse.json({ submission })
}
