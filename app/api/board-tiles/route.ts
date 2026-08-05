import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getWikiImageUrl } from '@/lib/osrsWiki'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const {
    eventId,
    tileNumber,
    description,
    effectType,
    effectValue,
    transferable,
    wikiUrl,
    glowColor,
    requiredItems, // [{ itemId, itemName, quantity }, ...]
  } = await request.json()

  if (!description || typeof description !== 'string' || !description.trim()) {
    return NextResponse.json({ error: 'Vul een omschrijving in.' }, { status: 400 })
  }

  if (!tileNumber || typeof tileNumber !== 'number' || tileNumber < 1) {
    return NextResponse.json({ error: 'Ongeldig vakjenummer.' }, { status: 400 })
  }

  if (effectType === 'verzamel_item') {
    if (!Array.isArray(requiredItems) || requiredItems.length === 0) {
      return NextResponse.json(
        { error: 'Voeg minstens één benodigd item toe voor een verzameldoel.' },
        { status: 400 }
      )
    }
    for (const item of requiredItems) {
      if (!item.itemId || !item.itemName?.trim() || !item.quantity || item.quantity < 1) {
        return NextResponse.json(
          { error: 'Elk item heeft een geldig item-ID, naam en aantal nodig.' },
          { status: 400 }
        )
      }
    }
  }

  const imageUrl = wikiUrl?.trim() ? await getWikiImageUrl(wikiUrl.trim()) : null

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
        wiki_url: wikiUrl?.trim() || null,
        image_url: imageUrl,
        glow_color: glowColor || null,
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

  // Bestaande items voor dit vakje vervangen door de nieuwe lijst
  await supabase.from('board_tile_requirements').delete().eq('tile_id', tile.id)

  if (effectType === 'verzamel_item' && Array.isArray(requiredItems)) {
    const rows = requiredItems.map((item: any) => ({
      tile_id: tile.id,
      item_id: Number(item.itemId),
      item_name: item.itemName.trim(),
      required_quantity: Number(item.quantity),
    }))

    const { error: reqError } = await supabase.from('board_tile_requirements').insert(rows)

    if (reqError) {
      return NextResponse.json(
        { error: 'Vakje opgeslagen, maar items opslaan mislukt: ' + reqError.message },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ tile })
}
