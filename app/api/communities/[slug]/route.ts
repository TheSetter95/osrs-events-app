import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
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

  const { data: community } = await supabase
    .from('communities')
    .select('id')
    .eq('slug', params.slug)
    .single()

  if (!community) {
    return NextResponse.json({ error: 'Community niet gevonden.' }, { status: 404 })
  }

  const { error } = await supabase.from('communities').delete().eq('id', community.id)

  if (error) {
    return NextResponse.json(
      { error: 'Verwijderen mislukt. Alleen de owner mag dit.' },
      { status: 403 }
    )
  }

  return NextResponse.json({ success: true })
}
