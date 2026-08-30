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
    position,
    title,
    description,
    wikiUrl,
    glowColor,
    effectType,
    requirementGroups,
  } = await request.json()

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'Vul een titel in.' }, { status: 400 })
  }

  if (!position || typeof position !== 'number' || position < 1) {
    return NextResponse.json({ error: 'Ongeldig vakjenummer.' }, { status: 400 })
  }

  if (effectType === 'verzamel_item') {
    if (!Array.isArray(requirementGroups) || requirementGroups.length === 0) {
      return NextResponse.json({ error: 'Voeg minstens één verzameldoel toe.' }, { status: 400 })
    }
    for (const group of requirementGroups) {
      if (!group.quantity || group.quantity < 1) {
        return NextResponse.json({ error: 'Elk doel heeft een geldig aantal nodig.' }, { status: 400 })
      }
      if (!Array.isArray(group.items) || group.items.length === 0) {
        return NextResponse.json({ error: 'Elk doel heeft minstens één item nodig.' }, { status: 400 })
      }
      for (const item of group.items) {
        if (!item.itemId || !item.itemName?.trim()) {
          return NextResponse.json(
            { error: 'Elk item heeft een geldig item-ID en naam nodig.' },
            { status: 400 }
          )
        }
      }
    }
  }

  const imageUrl = wikiUrl?.trim() ? await getWikiImageUrl(wikiUrl.trim()) : null

  const { data: tile, error } = await supabase
    .from('bingo_tiles')
    .upsert(
      {
        event_id: eventId,
        position,
        title: title.trim(),
        description: description?.trim() || null,
        wiki_url: wikiUrl?.trim() || null,
        image_url: imageUrl,
        glow_color: glowColor || null,
        effect_type: effectType ?? 'geen',
      },
      { onConflict: 'event_id,position' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Opslaan mislukt. Ben je organizer/owner van deze community?' },
      { status: 403 }
    )
  }

  await supabase.from('bingo_tile_requirements').delete().eq('tile_id', tile.id)

  if (effectType === 'verzamel_item' && Array.isArray(requirementGroups)) {
    for (const group of requirementGroups) {
      const label = group.label?.trim() || group.items.map((i: any) => i.itemName.trim()).join(' of ')

      const { data: requirement, error: reqError } = await supabase
        .from('bingo_tile_requirements')
        .insert({ tile_id: tile.id, label, required_quantity: Number(group.quantity) })
        .select()
        .single()

      if (reqError || !requirement) {
        return NextResponse.json(
          { error: 'Vakje opgeslagen, maar een doel opslaan mislukt: ' + reqError?.message },
          { status: 500 }
        )
      }

      const itemRows = group.items.map((item: any) => ({
        requirement_id: requirement.id,
        item_id: Number(item.itemId),
        item_name: item.itemName.trim(),
      }))

      const { error: itemsError } = await supabase.from('bingo_requirement_accepted_items').insert(itemRows)

      if (itemsError) {
        return NextResponse.json(
          { error: 'Vakje opgeslagen, maar items opslaan mislukt: ' + itemsError.message },
          { status: 500 }
        )
      }
    }
  }

  return NextResponse.json({ tile })
}
