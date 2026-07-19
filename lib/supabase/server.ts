import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Deze client gebruik je in server components en route handlers.
// Hij leest/schrijft de login-sessie via cookies, zodat je weet
// wie er is ingelogd zonder dat de gebruiker steeds opnieuw hoeft in te loggen.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Kan genegeerd worden: gebeurt als een Server Component dit
            // aanroept. De middleware (zie middleware.ts) ververst de
            // sessie sowieso al.
          }
        },
      },
    }
  )
}
