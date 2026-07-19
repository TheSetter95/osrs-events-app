import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_ROLES = ['owner', 'organizer', 'member']

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const { profileId, role } = await request.json()

  if (!profileId || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Ongeldige invoer.' }, { status: 400 })
  }

  const { data: community } = await supabase
    .from('communities')
    .select('id')
    .eq('slug', params.slug)
    .single()

  if (!community) {
    return NextResponse.json({ error: 'Community niet gevonden.' }, { status: 404 })
  }

  const { data: member, error } = await supabase
    .from('community_members')
    .insert({ community_id: community.id, profile_id: profileId, role })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Deze gebruiker is al lid.' }, { status: 409 })
    }
    return NextResponse.json(
      { error: 'Toevoegen mislukt. Alleen owners mogen leden toevoegen.' },
      { status: 403 }
    )
  }

  return NextResponse.json({ member })
}
