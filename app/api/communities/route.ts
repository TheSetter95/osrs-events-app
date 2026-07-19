import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Deze route wordt aangeroepen vanuit het formulier op /communities/new.
// Hij checkt dat je bent ingelogd, en roept dan de database-functie
// 'create_community' aan (zie stap3-communities-sql.md) die zowel de
// community als jouw owner-lidmaatschap in één keer aanmaakt.
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const { name } = await request.json()

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Vul een naam in.' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('create_community', {
    p_name: name.trim(),
  })

  if (error) {
    // Postgres-foutcode 23505 = unique constraint violation
    // (er bestaat al een community met deze naam/slug)
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Er bestaat al een community met (bijna) deze naam. Kies een andere naam.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ community: data })
}
