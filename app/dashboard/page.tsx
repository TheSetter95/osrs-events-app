import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from('community_members')
    .select('role, communities(id, name, slug)')
    .eq('profile_id', user.id)

  if (membershipsError) {
    console.error('Fout bij ophalen memberships:', membershipsError)
  }

  const isOwner = (memberships ?? []).some((m: any) => m.role === 'owner')

  return (
    <main className="container">
      <p className="eyebrow">Jouw communities</p>
      <h1>Dashboard</h1>

      {membershipsError && (
        <p className="error-text">
          Er ging iets mis bij het ophalen van je communities: {membershipsError.message}
        </p>
      )}

      {!memberships || memberships.length === 0 ? (
        <p className="text-muted">Je hebt nog geen community. Maak er eentje aan om te beginnen.</p>
      ) : (
        <div>
          {memberships.map((m: any) => (
            <Link key={m.communities.id} href={`/communities/${m.communities.slug}`} className="card">
              <strong>{m.communities.name}</strong>{' '}
              <span className="badge badge-muted">{m.role}</span>
            </Link>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>
        <Link href="/communities/new">
          <button className="btn">+ Nieuwe community</button>
        </Link>
        {isOwner && (
          <Link href="/opdrachten">
            <button className="btn btn-secondary">📚 Opdrachtenbibliotheek</button>
          </Link>
        )}
      </div>
    </main>
  )
}
