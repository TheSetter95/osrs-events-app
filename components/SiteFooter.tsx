import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function SiteFooter() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let isSuperAdmin = false

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()
    isSuperAdmin = !!profile?.is_super_admin
  }

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
