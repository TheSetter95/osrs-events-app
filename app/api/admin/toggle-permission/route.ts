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

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!myProfile?.is_super_admin) {
    return NextResponse.json({ error: 'Alleen sitebeheerders mogen dit wijzigen.' }, { status: 403 })
  }

  const { profileId, canCreateCommunities } = await request.json()

  if (!profileId || typeof canCreateCommunities !== 'boolean') {
    return NextResponse.json({ error: 'Ongeldige invoer.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ can_create_communities: canCreateCommunities })
    .eq('id', profileId)

  if (error) {
    return NextResponse.json({ error: 'Bijwerken mislukt: ' + error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
