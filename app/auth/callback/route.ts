import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Discord stuurt de gebruiker na het inloggen hierheen, met een
// "code" in de URL. Deze route wisselt die code in voor een echte
// login-sessie en stuurt de gebruiker daarna door — naar "next" als die
// is meegegeven (bv. terug naar een uitnodigingslink), anders naar de homepage.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  const safeNext = next && next.startsWith('/') ? next : '/'

  return NextResponse.redirect(`${origin}${safeNext}`)
}
