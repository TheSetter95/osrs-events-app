import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import MembersManager from '@/components/MembersManager'
import DeleteCommunityButton from '@/components/DeleteCommunityButton'

export default async function MembersPage({
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

  const { data: community } = await supabase
    .from('communities')
    .select('id, name, slug')
    .eq('slug', slug)
    .single()

  if (!community) {
    notFound()
  }

  const { data: membership } = await supabase
    .from('community_members')
    .select('role')
    .eq('community_id', community.id)
    .eq('profile_id', user.id)
    .single()

  if (membership?.role !== 'owner') {
    return (
      <main className="container-narrow">
        <Link href={`/communities/${slug}`} className="back-link">
          &larr; Terug naar community
        </Link>
        <p className="text-muted">Alleen owners kunnen leden beheren.</p>
      </main>
    )
  }

  const { data: members } = await supabase
    .from('community_members')
    .select('id, role, profiles(id, username, avatar_url, osrs_username)')
    .eq('community_id', community.id)

  return (
    <main className="container-narrow">
      <Link href={`/communities/${slug}`} className="back-link">
        &larr; Terug naar community
      </Link>
      <h1>Leden — {community.name}</h1>

      <MembersManager slug={slug} initialMembers={(members as any) ?? []} currentUserId={user.id} />

      <DeleteCommunityButton slug={slug} communityName={community.name} />
    </main>
  )
}
