import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import TeamsManager from '@/components/TeamsManager'
import EventStatusControl from '@/components/EventStatusControl'
import DeleteEventButton from '@/components/DeleteEventButton'
import GanzebordBoard from '@/components/GanzebordBoard'
import GanzebordConfigForm from '@/components/GanzebordConfigForm'
import GanzebordTilesManager from '@/components/GanzebordTilesManager'
import GanzebordLeaderboard from '@/components/GanzebordLeaderboard'
import GanzebordHistory from '@/components/GanzebordHistory'
import BingoConfigForm from '@/components/BingoConfigForm'
import BingoTilesManager from '@/components/BingoTilesManager'
import BingoBoard from '@/components/BingoBoard'
import BingoLeaderboard from '@/components/BingoLeaderboard'

const EVENT_TYPE_LABELS: Record<string, string> = {
  bingo: 'Bingo',
  ganzebord: 'Ganzebord',
  pvp_toernooi: 'PvP-toernooi',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Concept',
  active: 'Actief',
  finished: 'Afgerond',
}

export default async function EventPage({
  params,
}: {
  params: { slug: string; eventId: string }
}) {
  const { slug, eventId } = params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, name, type, status, config, community_id')
    .eq('id', eventId)
    .single()

  if (!event) {
    notFound()
  }

  const { data: membership } = await supabase
    .from('community_members')
    .select('role')
    .eq('community_id', event.community_id)
    .eq('profile_id', user.id)
    .single()

  const canManage = membership?.role === 'owner' || membership?.role === 'organizer'

  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select(
      'id, name, board_position, can_roll, pending_penalty, participants(id, display_name, discord_id)'
    )
    .eq('event_id', event.id)
    .order('created_at', { ascending: true })

  if (teamsError) {
    console.error('Fout bij ophalen teams:', teamsError)
  }

  const { data: unassigned } = await supabase
    .from('participants')
    .select('id, display_name, discord_id')
    .eq('event_id', event.id)
    .is('team_id', null)

  const { data: tiles } = await supabase
    .from('board_tiles')
    .select('*')
    .eq('event_id', event.id)

  const { data: reveals } = await supabase
    .from('board_tile_reveals')
    .select('tile_number')
    .eq('event_id', event.id)

  const { data: bingoTiles } = await supabase
    .from('bingo_tiles')
    .select('*')
    .eq('event_id', event.id)

  const { data: bingoCompletions } = await supabase
    .from('bingo_completions')
    .select('tile_id, team_id')
    .in('tile_id', (bingoTiles ?? []).map((t) => t.id))

  const { data: history } = await supabase
    .from('progress_updates')
    .select('id, data, source, created_at, created_by')
    .eq('event_id', event.id)
    .order('created_at', { ascending: false })
    .limit(30)

  const creatorIds = [...new Set((history ?? []).map((h) => h.created_by).filter(Boolean))]
  let creatorNames: Record<string, string> = {}
  if (creatorIds.length > 0) {
    const { data: creators } = await supabase
      .from('profiles')
      .select('id, username, osrs_username')
      .in('id', creatorIds as string[])
    creatorNames = Object.fromEntries(
      (creators ?? []).map((c) => [c.id, c.osrs_username || c.username])
    )
  }

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('discord_id')
    .eq('id', user.id)
    .single()

  let myTeamIds: string[] = []
  if (myProfile?.discord_id) {
    const { data: myParticipations } = await supabase
      .from('participants')
      .select('team_id')
      .eq('event_id', event.id)
      .eq('discord_id', myProfile.discord_id)
      .not('team_id', 'is', null)
    myTeamIds = (myParticipations ?? []).map((p) => p.team_id as string)
  }

  // Grote-bord-weergave: alleen voor een actief Ganzebord-event
  const isBigBoardView = event.type === 'ganzebord' && event.status === 'active'

  const teamsManagerEl = (
    <TeamsManager
      eventId={event.id}
      initialTeams={(teams as any) ?? []}
      initialUnassigned={unassigned ?? []}
      canManage={canManage}
    />
  )

  return (
    <main className={isBigBoardView ? 'container-wide' : 'container'}>
      <Link href={`/communities/${slug}`} className="back-link">
        &larr; Terug naar community
      </Link>
      <h1>
        {event.name}{' '}
        <span className="text-muted" style={{ fontSize: '0.5em', fontWeight: 400 }}>
          "{STATUS_LABELS[event.status] ?? event.status}"
        </span>
      </h1>
      <p className="text-muted">{EVENT_TYPE_LABELS[event.type] ?? event.type}</p>

      {!isBigBoardView && canManage && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <EventStatusControl eventId={event.id} currentStatus={event.status} />
          {event.status === 'draft' && (
            <DeleteEventButton eventId={event.id} communitySlug={slug} />
          )}
        </div>
      )}

      {teamsError && (
        <p className="error-text">
          Er ging iets mis bij het ophalen van teams: {teamsError.message}
        </p>
      )}

      {event.type === 'ganzebord' && (
        <>
          {canManage && !isBigBoardView && (
            <GanzebordConfigForm
              eventId={event.id}
              currentBoardSize={(event.config as any)?.boardSize ?? 63}
            />
          )}

          <GanzebordBoard
            eventId={event.id}
            boardSize={(event.config as any)?.boardSize ?? 63}
            teams={(teams as any) ?? []}
            tiles={(tiles as any) ?? []}
            canManage={canManage}
            myTeamIds={myTeamIds}
            eventStatus={event.status}
            revealedTileNumbers={(reveals ?? []).map((r) => r.tile_number)}
          />

          <GanzebordLeaderboard
            teams={(teams as any) ?? []}
            boardSize={(event.config as any)?.boardSize ?? 63}
          />

          {isBigBoardView ? (
            <>
              <div className="two-col-grid">
                <div>
                  <GanzebordHistory
                    history={(history as any) ?? []}
                    teams={(teams as any) ?? []}
                    creatorNames={creatorNames}
                  />
                </div>
                <div>{teamsManagerEl}</div>
              </div>

              {canManage && (
                <div
                  style={{
                    marginTop: 40,
                    paddingTop: 20,
                    borderTop: '1px solid rgba(184, 134, 59, 0.25)',
                    textAlign: 'center',
                  }}
                >
                  <EventStatusControl eventId={event.id} currentStatus={event.status} />
                </div>
              )}
            </>
          ) : (
            <>
              {canManage && (
                <GanzebordTilesManager
                  eventId={event.id}
                  boardSize={(event.config as any)?.boardSize ?? 63}
                  initialTiles={(tiles as any) ?? []}
                />
              )}
              <GanzebordHistory
                history={(history as any) ?? []}
                teams={(teams as any) ?? []}
                creatorNames={creatorNames}
              />
            </>
          )}
        </>
      )}

      {event.type === 'bingo' && (
        <>
          {canManage && (
            <BingoConfigForm
              eventId={event.id}
              currentGridSize={(event.config as any)?.gridSize ?? 5}
            />
          )}
          <BingoBoard
            gridSize={(event.config as any)?.gridSize ?? 5}
            tiles={(bingoTiles as any) ?? []}
            teams={(teams as any) ?? []}
            completions={(bingoCompletions as any) ?? []}
            canManage={canManage}
          />
          <BingoLeaderboard
            teams={(teams as any) ?? []}
            completions={(bingoCompletions as any) ?? []}
            totalTiles={((event.config as any)?.gridSize ?? 5) ** 2}
          />
          {canManage && (
            <BingoTilesManager
              eventId={event.id}
              gridSize={(event.config as any)?.gridSize ?? 5}
              initialTiles={(bingoTiles as any) ?? []}
            />
          )}
        </>
      )}

      {event.type === 'pvp_toernooi' && (
        <div className="panel-dark" style={{ marginTop: 24, textAlign: 'center' }}>
          <p className="text-muted" style={{ margin: 0 }}>
            Hier komt de PvP-toernooi-tool zelf — dat bouwen we in een volgende stap.
          </p>
        </div>
      )}

      {!isBigBoardView && teamsManagerEl}
    </main>
  )
}
