import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AdminUserList from '@/components/AdminUserList'

export default async function BeheerPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!myProfile?.is_super_admin) {
    redirect('/')
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, osrs_username, discord_id, can_create_communities, is_super_admin')
    .order('username', { ascending: true })

  return (
    <main className="container">
      <Link href="/dashboard" className="back-link">
        &larr; Terug naar dashboard
      </Link>
      <h1>Sitebeheer</h1>
      <p className="text-muted">
        Bepaal hier welke accounts zelf een nieuwe community mogen aanmaken.
      </p>

      <AdminUserList profiles={profiles ?? []} currentUserId={user.id} />
    </main>
  )
}
