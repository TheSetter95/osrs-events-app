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

  const safeNext = next && next.startsWith('/') ? next : '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      // Zichtbaar maken i.p.v. stilletjes doorsturen alsof er niets gebeurd is
      console.error('Inloggen mislukt bij het inwisselen van de code:', error)
      const errorUrl = new URL('/', origin)
      errorUrl.searchParams.set('login_error', error.message)
      return NextResponse.redirect(errorUrl)
    }
  }

  return NextResponse.redirect(`${origin}${safeNext}`)
}
