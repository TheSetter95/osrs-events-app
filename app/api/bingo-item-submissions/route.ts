import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { syncBingoTileCompletion } from '@/lib/bingoSubmissionTotals'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const { requirementId, teamId, quantity, screenshotUrl } = await request.json()

  if (!requirementId || !teamId || !quantity || quantity < 1) {
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

  // Geen positie-eis bij Bingo — alleen checken dat dit team ook echt bestaat
  // (de RLS-policy checkt zelf of jij lid bent van dit team)
  const { data: submission, error } = await supabase
    .from('bingo_item_submissions')
    .insert({
      requirement_id: requirementId,
      team_id: teamId,
      quantity,
      source: 'screenshot',
      status: 'pending',
      screenshot_url: screenshotUrl.trim(),
      submitted_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Insturen mislukt. Ben je lid van dit team?' }, { status: 403 })
  }

  // Ook een 'pending' inzending telt al mee voor de weergave/afronding-check
  const { data: requirement } = await supabase
    .from('bingo_tile_requirements')
    .select('tile_id')
    .eq('id', requirementId)
    .single()

  if (requirement) {
    await syncBingoTileCompletion(requirement.tile_id, teamId)
  }

  return NextResponse.json({ submission })
}
