import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import InviteLinkButton from '@/components/InviteLinkButton'

const EVENT_TYPE_LABELS: Record<string, string> = {
  bingo: 'Bingo',
  ganzebord: 'Ganzebord',
  pvp_toernooi: 'PvP-toernooi',
}

export default async function CommunityPage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const { data: community, error: communityError } = await supabase
    .from('communities')
    .select('id, name, slug, logo_url')
    .eq('slug', slug)
    .single()

  if (communityError) {
    console.error('Fout bij ophalen community:', communityError)
  }

  if (!community) {
    notFound()
  }

  const { data: membership } = await supabase
    .from('community_members')
    .select('role')
    .eq('community_id', community.id)
    .eq('profile_id', user.id)
    .single()

  const canManageEvents = membership?.role === 'owner' || membership?.role === 'organizer'

  const { data: events } = await supabase
    .from('events')
    .select('id, name, type, status')
    .eq('community_id', community.id)
    .order('created_at', { ascending: false })

  return (
    <main className="container">
      <Link href="/dashboard" className="back-link">
        &larr; Terug naar dashboard
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {community.logo_url && (
          <img
            src={community.logo_url}
            alt=""
            width={64}
            height={64}
            className="avatar"
            style={{ border: '2px solid var(--gold)', objectFit: 'cover', flexShrink: 0 }}
          />
        )}
        <h1 style={{ margin: 0 }}>{community.name}</h1>
      </div>

      {canManageEvents && (
        <p>
          <InviteLinkButton slug={slug} />
        </p>
      )}

      {membership?.role === 'owner' && (
        <p>
          <Link href={`/communities/${slug}/members`}>👥 Leden beheren</Link>
        </p>
      )}

      {!events || events.length === 0 ? (
        <p className="text-muted">Nog geen events. Maak het eerste event aan.</p>
      ) : (
        <div>
          {events.map((event) => (
            <Link key={event.id} href={`/communities/${slug}/events/${event.id}`} className="card">
              <strong>{event.name}</strong>{' '}
              <span className="badge badge-muted">
                {EVENT_TYPE_LABELS[event.type] ?? event.type} &middot; {event.status}
              </span>
            </Link>
          ))}
        </div>
      )}

      {canManageEvents && (
        <Link href={`/communities/${slug}/events/new`}>
          <button className="btn" style={{ marginTop: 20 }}>
            + Nieuw event
          </button>
        </Link>
      )}
    </main>
  )
}