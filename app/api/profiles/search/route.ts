import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json({ profiles: [] })
  }

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, discord_id, osrs_username')
    .ilike('username', `%${q}%`)
    .limit(10)

  if (error) {
    return NextResponse.json({ error: 'Zoeken mislukt.' }, { status: 500 })
  }

  return NextResponse.json({ profiles: profiles ?? [] })
}
