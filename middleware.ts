import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Deze middleware draait bij pagina-aanvragen en zorgt dat de
// login-sessie geldig blijft (ververst het token indien nodig).
//
// CPU-besparing t.o.v. de vorige versie:
// 1. Verzoeken zonder Supabase-cookie (bezoekers die niet ingelogd zijn,
//    crawlers) hoeven geen sessie te verversen -> meteen doorsturen.
// 2. Prefetch-verzoeken van Next.js (links in beeld) slaan we over; de echte
//    navigatie ververst de sessie alsnog.
// 3. De plugin-API (/api/plugin) gebruikt een eigen sleutel, geen cookies,
//    en wordt via de matcher volledig overgeslagen.
export async function middleware(request: NextRequest) {
  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith('sb-'))
  if (!hasAuthCookie) {
    return NextResponse.next({ request })
  }

  const isPrefetch =
    request.headers.get('next-router-prefetch') !== null ||
    request.headers.get('purpose') === 'prefetch'
  if (isPrefetch) {
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Belangrijk: dit ververst de sessie als het token verlopen is
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/plugin|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml)$).*)',
  ],
}
