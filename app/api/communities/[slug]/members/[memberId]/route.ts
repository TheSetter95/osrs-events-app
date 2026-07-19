import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_ROLES = ['owner', 'organizer', 'member']

export async function PATCH(
  request: Request,
  { params }: { params: { slug: string; memberId: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const { role } = await request.json()

  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Ongeldige rol.' }, { status: 400 })
  }

  const { data: member } = await supabase
    .from('community_members')
    .select('id, community_id, role')
    .eq('id', params.memberId)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'Lid niet gevonden.' }, { status: 404 })
  }

  // Voorkom dat de laatste owner gedegradeerd wordt (dan heeft niemand nog de controle)
  if (member.role === 'owner' && role !== 'owner') {
    const { count } = await supabase
      .from('community_members')
      .select('id', { count: 'exact', head: true })
      .eq('community_id', member.community_id)
      .eq('role', 'owner')

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Je kan de laatste owner niet degraderen. Maak eerst iemand anders owner.' },
        { status: 400 }
      )
    }
  }

  const { data: updated, error } = await supabase
    .from('community_members')
    .update({ role })
    .eq('id', params.memberId)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Wijzigen mislukt. Alleen owners mogen rollen wijzigen.' },
      { status: 403 }
    )
  }

  return NextResponse.json({ member: updated })
}

export async function DELETE(
  request: Request,
  { params }: { params: { slug: string; memberId: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const { data: member } = await supabase
    .from('community_members')
    .select('id, community_id, role')
    .eq('id', params.memberId)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'Lid niet gevonden.' }, { status: 404 })
  }

  if (member.role === 'owner') {
    const { count } = await supabase
      .from('community_members')
      .select('id', { count: 'exact', head: true })
      .eq('community_id', member.community_id)
      .eq('role', 'owner')

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Je kan de laatste owner niet verwijderen.' },
        { status: 400 }
      )
    }
  }

  const { error } = await supabase.from('community_members').delete().eq('id', params.memberId)

  if (error) {
    return NextResponse.json(
      { error: 'Verwijderen mislukt. Alleen owners mogen leden verwijderen.' },
      { status: 403 }
    )
  }

  return NextResponse.json({ success: true })
}
