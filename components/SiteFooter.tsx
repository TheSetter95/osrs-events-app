'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// De footer draait in de browser in plaats van op de server. Daardoor hoeft de
// server bij elke pagina niet meer te controleren wie er is ingelogd, en kunnen
// pagina's met vaste tekst (privacybeleid, voorwaarden) statisch geserveerd worden.
//
// Het "Sitebeheer"-linkje is alleen een gemak: de pagina /beheer controleert zelf
// op de server of je super-admin bent.
const CACHE_KEY = 'mg_super_admin_check'

export default function SiteFooter() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function check() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          if (!cancelled) setIsSuperAdmin(false)
          try {
            sessionStorage.removeItem(CACHE_KEY)
          } catch {}
          return
        }

        const userId = session.user.id

        // Eenmaal per browsersessie opvragen en onthouden.
        try {
          const cached = sessionStorage.getItem(CACHE_KEY)
          if (cached && cached.startsWith(userId + ':')) {
            if (!cancelled) setIsSuperAdmin(cached.endsWith(':1'))
            return
          }
        } catch {}

        const { data: profile } = await supabase
          .from('profiles')
          .select('is_super_admin')
          .eq('id', userId)
          .single()

        const value = !!profile?.is_super_admin
        if (!cancelled) setIsSuperAdmin(value)
        try {
          sessionStorage.setItem(CACHE_KEY, `${userId}:${value ? '1' : '0'}`)
        } catch {}
      } catch {
        if (!cancelled) setIsSuperAdmin(false)
      }
    }

    check()

    // Bij in- of uitloggen zonder paginavernieuwing de status bijwerken.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      check()
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return (
    <footer
      style={{
        marginTop: 40,
        padding: '20px',
        textAlign: 'center',
        fontSize: 12,
        borderTop: '1px solid rgba(184, 134, 59, 0.25)',
      }}
    >
      <span className="text-muted">
        <Link href="/profiel">Mijn profiel</Link>
        {' · '}
        <Link href="/voorwaarden">Servicevoorwaarden</Link>
        {' · '}
        <Link href="/privacybeleid">Privacybeleid</Link>
        {isSuperAdmin && (
          <>
            {' · '}
            <Link href="/beheer">🛠️ Sitebeheer</Link>
          </>
        )}
      </span>
    </footer>
  )
}
