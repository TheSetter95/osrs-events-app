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

  const { eventId, teamId, displayName, discordId } = await request.json()

  if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
    return NextResponse.json({ error: 'Vul een naam in voor de deelnemer.' }, { status: 400 })
  }

  const { data: participant, error } = await supabase
    .from('participants')
    .insert({
      event_id: eventId,
      team_id: teamId ?? null,
      display_name: displayName.trim(),
      discord_id: discordId?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Toevoegen mislukt. Ben je organizer/owner van deze community?' },
      { status: 403 }
    )
  }

  return NextResponse.json({ participant })
}
