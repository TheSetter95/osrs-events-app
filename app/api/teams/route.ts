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

  const { eventId, name } = await request.json()

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Vul een teamnaam in.' }, { status: 400 })
  }

  const { data: team, error } = await supabase
    .from('teams')
    .insert({ event_id: eventId, name: name.trim() })
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Aanmaken mislukt. Ben je organizer/owner van deze community?' },
      { status: 403 }
    )
  }

  return NextResponse.json({ team })
}
