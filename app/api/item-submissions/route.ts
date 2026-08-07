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

  const { requirementId, teamId, quantity, screenshotUrl } = await request.json()

  if (!requirementId || !teamId || !quantity || quantity < 1) {
    return NextResponse.json({ error: 'Ongeldige invoer.' }, { status: 400 })
  }

  if (!screenshotUrl || typeof screenshotUrl !== 'string' || !screenshotUrl.trim()) {
    return NextResponse.json({ error: 'Vul een link naar je screenshot in.' }, { status: 400 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(screenshotUrl.trim())
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('invalid')
  } catch {
    return NextResponse.json({ error: 'Dat is geen geldige link.' }, { status: 400 })
  }

  // Alleen geldig als het team ook echt op dit vakje staat
  const { data: requirement } = await supabase
    .from('board_tile_requirements')
    .select('id, tile_id, required_quantity, board_tiles(tile_number)')
    .eq('id', requirementId)
    .single()

  const { data: team } = await supabase
    .from('teams')
    .select('id, board_position')
    .eq('id', teamId)
    .single()

  const tileNumber = (requirement as any)?.board_tiles?.tile_number
  if (!requirement || !team || team.board_position !== tileNumber) {
    return NextResponse.json(
      { error: 'Dit team staat niet (meer) op dit vakje.' },
      { status: 400 }
    )
  }

  const { data: submission, error } = await supabase
    .from('item_submissions')
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
    return NextResponse.json(
      { error: 'Insturen mislukt. Ben je lid van dit team?' },
      { status: 403 }
    )
  }

  return NextResponse.json({ submission })
}
