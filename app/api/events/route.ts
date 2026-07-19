import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_TYPES = ['bingo', 'ganzebord', 'pvp_toernooi']

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const { communitySlug, name, type } = await request.json()

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Vul een naam in voor het event.' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Ongeldig event-type.' }, { status: 400 })
  }

  // Community opzoeken op basis van de slug
  const { data: community, error: communityError } = await supabase
    .from('communities')
    .select('id')
    .eq('slug', communitySlug)
    .single()

  if (communityError || !community) {
    return NextResponse.json({ error: 'Community niet gevonden.' }, { status: 404 })
  }

  // Event aanmaken. De RLS-policy "Organizers beheren events" zorgt dat dit
  // alleen lukt als de gebruiker owner/organizer is van deze community —
  // mislukt het om die reden, dan geeft Supabase een foutmelding terug.
  const { data: event, error } = await supabase
    .from('events')
    .insert({
      community_id: community.id,
      name: name.trim(),
      type,
      status: 'draft',
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Aanmaken mislukt. Ben je organizer/owner van deze community?' },
      { status: 403 }
    )
  }

  return NextResponse.json({ event })
}
