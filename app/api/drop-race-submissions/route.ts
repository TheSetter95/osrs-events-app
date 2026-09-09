import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { recomputeRaceStatus } from '@/lib/recomputeRaceStatus'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const { raceId, teamId, participantId, quantity, screenshotUrl } = await request.json()

  if (!raceId || (!teamId && !participantId) || !quantity || quantity < 1) {
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

  const { data: race } = await supabase
    .from('drop_races')
    .select('id, status')
    .eq('id', raceId)
    .single()

  if (!race) {
    return NextResponse.json({ error: 'Race niet gevonden.' }, { status: 404 })
  }

  if (race.status === 'completed') {
    return NextResponse.json({ error: 'Deze race is al gewonnen.' }, { status: 400 })
  }

  const { data: submission, error } = await supabase
    .from('drop_race_submissions')
    .insert({
      race_id: raceId,
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

  await recomputeRaceStatus(raceId)

  return NextResponse.json({ submission })
}
