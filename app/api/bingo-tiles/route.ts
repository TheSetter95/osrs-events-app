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

  const { eventId, position, title, description, wikiUrl } = await request.json()

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'Vul een titel in.' }, { status: 400 })
  }

  if (!position || typeof position !== 'number' || position < 1) {
    return NextResponse.json({ error: 'Ongeldig vakjenummer.' }, { status: 400 })
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

  return NextResponse.json({ tile })
}
