import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ProfileSettings from '@/components/ProfileSettings'

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, osrs_username')
    .eq('id', user.id)
    .single()

  return (
    <main className="container-narrow">
      <Link href="/dashboard" className="back-link">
        &larr; Terug naar dashboard
      </Link>
      <h1>Mijn profiel</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        {profile?.avatar_url && (
          <img src={profile.avatar_url} alt="" width={48} height={48} className="avatar" />
        )}
        <span className="text-muted">Discord: {profile?.username}</span>
      </div>

      <ProfileSettings userId={user.id} currentOsrsUsername={profile?.osrs_username ?? null} />
    </main>
  )
}
