import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AssignmentLibrary from '@/components/AssignmentLibrary'

export const metadata = {
  title: 'Opdrachtenbibliotheek — Massief Goud Events',
}

export default async function AssignmentsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const [{ data: myProfile }, { data: ownerships }] = await Promise.all([
    supabase.from('profiles').select('username, osrs_username, is_super_admin').eq('id', user.id).single(),
    supabase.from('community_members').select('id').eq('profile_id', user.id).eq('role', 'owner').limit(1),
  ])

  const isSuperAdmin = !!myProfile?.is_super_admin
  const isOwner = (ownerships ?? []).length > 0

  if (!isOwner && !isSuperAdmin) {
    return (
      <main className="container">
        <Link href="/dashboard" className="back-link">
          &larr; Terug naar dashboard
        </Link>
        <h1>Opdrachtenbibliotheek</h1>
        <p className="text-muted">
          Alleen owners van een community hebben toegang tot de opdrachtenbibliotheek.
        </p>
      </main>
    )
  }

  const { data: rows, error } = await supabase
    .from('assignment_templates')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Fout bij ophalen opdrachten:', error)
  }

  const creatorIds = [...new Set((rows ?? []).map((r: any) => r.created_by).filter(Boolean))] as string[]
  let creatorNames: Record<string, string> = {}
  if (creatorIds.length > 0) {
    const { data: creators } = await supabase
      .from('profiles')
      .select('id, username, osrs_username')
      .in('id', creatorIds)
    creatorNames = Object.fromEntries(
      (creators ?? []).map((c: any) => [c.id, (c.osrs_username || c.username) as string])
    )
  }

  const assignments = (rows ?? []).map((r: any) => ({
    ...r,
    creatorName: r.created_by ? creatorNames[r.created_by] ?? 'Onbekend' : 'Verwijderd account',
  }))

  return (
    <main className="container">
      <Link href="/dashboard" className="back-link">
        &larr; Terug naar dashboard
      </Link>
      <p className="eyebrow">Gedeeld met alle owners</p>
      <h1>Opdrachtenbibliotheek</h1>
      <p className="text-muted">
        Verzamel hier opdrachten voor Bingo, Ganzebord en Miljoenenjacht. Alle owners kunnen ze
        lezen en gebruiken; wijzigen of verwijderen kan alleen de maker.
      </p>

      {error && (
        <p className="error-text">
          De bibliotheek kon niet geladen worden: {error.message}. Is stap 33 (SQL) al uitgevoerd?
        </p>
      )}

      <AssignmentLibrary
        initialAssignments={assignments as any}
        currentUserId={user.id}
        currentUserName={myProfile?.osrs_username || myProfile?.username || 'Jij'}
        isSuperAdmin={isSuperAdmin}
      />
    </main>
  )
}
