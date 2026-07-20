import { createClient } from '@/lib/supabase/server'
import LoginButton from '@/components/LoginButton'
import LogoutButton from '@/components/LogoutButton'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <main className="container-narrow" style={{ textAlign: 'center' }}>
      <img
        src="/logo.png"
        alt="Massief Goud logo"
        width={120}
        height={120}
        style={{ borderRadius: 16, margin: '0 auto 16px', display: 'block' }}
      />
      <p className="eyebrow">Questlog voor je community</p>
      <h1 style={{ fontSize: 32 }}>Massief Goud Events</h1>

      {!user ? (
        <>
          <p className="text-muted">Log in om events voor je community te beheren.</p>
          <LoginButton />
        </>
      ) : (
        <>
          {profile?.avatar_url && (
            <img
              src={profile.avatar_url}
              alt="avatar"
              width={72}
              height={72}
              className="avatar"
              style={{ margin: '0 auto 16px', border: '2px solid var(--gold)' }}
            />
          )}
          <p>
            Ingelogd als <strong>{profile?.username ?? user.email}</strong>
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link href="/dashboard">
              <button className="btn">Naar dashboard</button>
            </Link>
            <LogoutButton />
          </div>
        </>
      )}
    </main>
  )
}
