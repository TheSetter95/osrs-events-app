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

  const { eventId, tileNumber, description, effectType, effectValue, transferable } =
    await request.json()

  if (!description || typeof description !== 'string' || !description.trim()) {
    return NextResponse.json({ error: 'Vul een omschrijving in.' }, { status: 400 })
  }

  if (!tileNumber || typeof tileNumber !== 'number' || tileNumber < 1) {
    return NextResponse.json({ error: 'Ongeldig vakjenummer.' }, { status: 400 })
  }

  const { data: tile, error } = await supabase
    .from('board_tiles')
    .upsert(
      {
        event_id: eventId,
        tile_number: tileNumber,
        description: description.trim(),
        effect_type: effectType ?? 'geen',
        effect_value: effectValue ?? null,
        transferable: !!transferable,
      },
      { onConflict: 'event_id,tile_number' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Opslaan mislukt. Ben je organizer/owner van deze community?' },
      { status: 403 }
    )
  }

  return NextResponse.json({ tile })
}
