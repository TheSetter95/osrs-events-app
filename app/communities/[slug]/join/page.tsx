import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import LoginButton from '@/components/LoginButton'

export default async function JoinCommunityPage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params
  const supabase = await createClient()

  const { data: community } = await supabase
    .from('communities')
    .select('id, name, slug, logo_url')
    .eq('slug', slug)
    .single()

  if (!community) {
    notFound()
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Nog niet ingelogd: toon een uitleg + login-knop (die stuurt na login terug naar
  // deze pagina niet automatisch, maar de gebruiker klikt dan gewoon nogmaals op de
  // link/opent de community — vermeld dat hieronder).
  if (!user) {
    return (
      <main className="container-narrow" style={{ textAlign: 'center' }}>
        {community.logo_url && (
          <img
            src={community.logo_url}
            alt=""
            width={72}
            height={72}
            className="avatar"
            style={{ margin: '0 auto 16px', border: '2px solid var(--gold)', objectFit: 'cover' }}
          />
        )}
        <h1>Je bent uitgenodigd voor {community.name}</h1>
        <p className="text-muted">
          Log in met Discord om lid te worden van deze community.
        </p>
        <LoginButton redirectPath={`/communities/${slug}/join`} />
      </main>
    )
  }

  // Al lid? Dan gewoon meteen doorsturen.
  const { data: existingMembership } = await supabase
    .from('community_members')
    .select('id')
    .eq('community_id', community.id)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!existingMembership) {
    const { error } = await supabase.from('community_members').insert({
      community_id: community.id,
      profile_id: user.id,
      role: 'member',
    })

    if (error) {
      return (
        <main className="container-narrow" style={{ textAlign: 'center' }}>
          <h1>Lid worden mislukt</h1>
          <p className="error-text">{error.message}</p>
        </main>
      )
    }
  }

  redirect(`/communities/${slug}`)
}
