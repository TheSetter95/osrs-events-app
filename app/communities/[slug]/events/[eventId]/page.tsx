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
import ItemSubmissionsPanel from '@/components/ItemSubmissionsPanel'
import BingoConfigForm from '@/components/BingoConfigForm'
import BingoTilesManager from '@/components/BingoTilesManager'
import BingoBoard from '@/components/BingoBoard'
import BingoLeaderboard from '@/components/BingoLeaderboard'
import DropRaceBoard from '@/components/DropRaceBoard'
import DropRaceManager from '@/components/DropRaceManager'
import GauntletBoard from '@/components/GauntletBoard'
import GauntletManager from '@/components/GauntletManager'
import GauntletConfigForm from '@/components/GauntletConfigForm'

const EVENT_TYPE_LABELS: Record<string, string> = {
  bingo: 'Bingo',
  ganzebord: 'Ganzebord',
  droprace: 'Losse Races',
  gauntlet: 'Gauntlet',
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

  const { data: tileRequirements } = await supabase
    .from('board_tile_requirements')
    .select('*')
    .in('tile_id', (tiles ?? []).map((t) => t.id))

  const { data: acceptedItems } = await supabase
    .from('requirement_accepted_items')
    .select('*')
    .in('requirement_id', (tileRequirements ?? []).map((r) => r.id))

  const requirementsWithItems = (tileRequirements ?? []).map((r) => ({
    ...r,
    accepted_items: (acceptedItems ?? []).filter((a) => a.requirement_id === r.id),
  }))

  const tilesWithRequirements = (tiles ?? []).map((tile) => ({
    ...tile,
    requirements: requirementsWithItems.filter((r) => r.tile_id === tile.id),
  }))

  const requirementIds = (tileRequirements ?? []).map((r) => r.id)

  const { data: rawSubmissions } = await supabase
    .from('item_submissions')
    .select('*')
    .in('requirement_id', requirementIds.length > 0 ? requirementIds : ['00000000-0000-0000-0000-000000000000'])
    .order('created_at', { ascending: false })

  const submitterIds = [...new Set((rawSubmissions ?? []).map((s) => s.submitted_by).filter(Boolean))]
  let submitterNames: Record<string, string> = {}
  if (submitterIds.length > 0) {
    const { data: submitters } = await supabase
      .from('profiles')
      .select('id, username, osrs_username')
      .in('id', submitterIds as string[])
    submitterNames = Object.fromEntries(
      (submitters ?? []).map((p) => [p.id, p.osrs_username || p.username])
    )
  }

  const submissions = (rawSubmissions ?? []).map((s) => ({
    ...s,
    submitterName: submitterNames[s.submitted_by] ?? 'Onbekend',
  }))

  const { data: reveals } = await supabase
    .from('board_tile_reveals')
    .select('tile_number')
    .eq('event_id', event.id)

  const { data: bingoTiles } = await supabase
    .from('bingo_tiles')
    .select('*')
    .eq('event_id', event.id)

  const { data: bingoTileRequirements } = await supabase
    .from('bingo_tile_requirements')
    .select('*')
    .in('tile_id', (bingoTiles ?? []).map((t) => t.id))

  const { data: bingoAcceptedItems } = await supabase
    .from('bingo_requirement_accepted_items')
    .select('*')
    .in('requirement_id', (bingoTileRequirements ?? []).map((r) => r.id))

  const bingoRequirementsWithItems = (bingoTileRequirements ?? []).map((r) => ({
    ...r,
    accepted_items: (bingoAcceptedItems ?? []).filter((a) => a.requirement_id === r.id),
  }))

  const bingoTilesWithRequirements = (bingoTiles ?? []).map((tile) => ({
    ...tile,
    requirements: bingoRequirementsWithItems.filter((r) => r.tile_id === tile.id),
  }))

  const bingoRequirementIds = (bingoTileRequirements ?? []).map((r) => r.id)

  const { data: rawBingoSubmissions } = await supabase
    .from('bingo_item_submissions')
    .select('*')
    .in(
      'requirement_id',
      bingoRequirementIds.length > 0 ? bingoRequirementIds : ['00000000-0000-0000-0000-000000000000']
    )
    .order('created_at', { ascending: false })

  const bingoSubmitterIds = [...new Set((rawBingoSubmissions ?? []).map((s) => s.submitted_by).filter(Boolean))]
  let bingoSubmitterNames: Record<string, string> = {}
  if (bingoSubmitterIds.length > 0) {
    const { data: submitters } = await supabase
      .from('profiles')
      .select('id, username, osrs_username')
      .in('id', bingoSubmitterIds as string[])
    bingoSubmitterNames = Object.fromEntries(
      (submitters ?? []).map((p) => [p.id, p.osrs_username || p.username])
    )
  }

  const bingoSubmissions = (rawBingoSubmissions ?? []).map((s) => ({
    ...s,
    submitterName: bingoSubmitterNames[s.submitted_by] ?? 'Onbekend',
  }))

  const { data: bingoCompletions } = await supabase
    .from('bingo_completions')
    .select('tile_id, team_id')
    .in('tile_id', (bingoTiles ?? []).map((t) => t.id))

  const { data: history } = await supabase
    .from('progress_updates')
    .select('id, data, source, created_at, created_by')
    .eq('event_id', event.id)
    .order('created_at', { ascending: false })

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
  let myParticipantIds: string[] = []
  if (myProfile?.discord_id) {
    const { data: myParticipations } = await supabase
      .from('participants')
      .select('id, team_id')
      .eq('event_id', event.id)
      .eq('discord_id', myProfile.discord_id)
    myTeamIds = (myParticipations ?? []).filter((p) => p.team_id).map((p) => p.team_id as string)
    myParticipantIds = (myParticipations ?? []).map((p) => p.id)
  }

  // --- Losse Races ---
  const { data: races } = await supabase
    .from('drop_races')
    .select('*')
    .eq('event_id', event.id)

  const { data: raceAcceptedItems } = await supabase
    .from('drop_race_accepted_items')
    .select('*')
    .in('race_id', (races ?? []).map((r) => r.id))

  const racesWithItems = (races ?? []).map((r) => ({
    ...r,
    accepted_items: (raceAcceptedItems ?? []).filter((a) => a.race_id === r.id),
  }))

  const { data: rawRaceSubmissions } = await supabase
    .from('drop_race_submissions')
    .select('*')
    .in('race_id', (races ?? []).length > 0 ? (races ?? []).map((r) => r.id) : ['00000000-0000-0000-0000-000000000000'])

  const raceSubmitterIds = [...new Set((rawRaceSubmissions ?? []).map((s) => s.submitted_by).filter(Boolean))]
  let raceSubmitterNames: Record<string, string> = {}
  if (raceSubmitterIds.length > 0) {
    const { data: submitters } = await supabase
      .from('profiles')
      .select('id, username, osrs_username')
      .in('id', raceSubmitterIds as string[])
    raceSubmitterNames = Object.fromEntries((submitters ?? []).map((p) => [p.id, p.osrs_username || p.username]))
  }
  const raceSubmissions = (rawRaceSubmissions ?? []).map((s) => ({
    ...s,
    submitterName: raceSubmitterNames[s.submitted_by] ?? 'Onbekend',
  }))

  const { data: allParticipants } = await supabase
    .from('participants')
    .select('id, display_name')
    .eq('event_id', event.id)

  // --- Gauntlet ---
  const { data: gauntletStages } = await supabase
    .from('gauntlet_stages')
    .select('*')
    .eq('event_id', event.id)

  const { data: gauntletAcceptedItems } = await supabase
    .from('gauntlet_stage_accepted_items')
    .select('*')
    .in('stage_id', (gauntletStages ?? []).map((s) => s.id))

  const gauntletStagesWithItems = (gauntletStages ?? []).map((s) => ({
    ...s,
    accepted_items: (gauntletAcceptedItems ?? []).filter((a) => a.stage_id === s.id),
  }))

  const { data: rawGauntletSubmissions } = await supabase
    .from('gauntlet_submissions')
    .select('*')
    .in(
      'stage_id',
      (gauntletStages ?? []).length > 0 ? (gauntletStages ?? []).map((s) => s.id) : ['00000000-0000-0000-0000-000000000000']
    )

  const gauntletSubmitterIds = [...new Set((rawGauntletSubmissions ?? []).map((s) => s.submitted_by).filter(Boolean))]
  let gauntletSubmitterNames: Record<string, string> = {}
  if (gauntletSubmitterIds.length > 0) {
    const { data: submitters } = await supabase
      .from('profiles')
      .select('id, username, osrs_username')
      .in('id', gauntletSubmitterIds as string[])
    gauntletSubmitterNames = Object.fromEntries(
      (submitters ?? []).map((p) => [p.id, p.osrs_username || p.username])
    )
  }
  const gauntletSubmissions = (rawGauntletSubmissions ?? []).map((s) => ({
    ...s,
    submitterName: gauntletSubmitterNames[s.submitted_by] ?? 'Onbekend',
  }))

  const gauntletMode: 'team' | 'individual' = (event.config as any)?.mode === 'individual' ? 'individual' : 'team'

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
      {isBigBoardView && (
        <>
          <span
            aria-hidden="true"
            style={{
              position: 'fixed',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 'clamp(80px, 14vw, 260px)',
              color: 'rgba(212, 162, 79, 0.08)',
              pointerEvents: 'none',
              zIndex: -1,
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            M
          </span>
          <span
            aria-hidden="true"
            style={{
              position: 'fixed',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 'clamp(80px, 14vw, 260px)',
              color: 'rgba(212, 162, 79, 0.08)',
              pointerEvents: 'none',
              zIndex: -1,
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            G
          </span>
        </>
      )}

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

          {((teams as any) ?? [])
            .map((team: any) => {
              const tile = (tilesWithRequirements as any[]).find(
                (t) => t.tile_number === team.board_position && t.effect_type === 'verzamel_item'
              )
              if (!tile || !tile.requirements || tile.requirements.length === 0) return null

              const reqIds = tile.requirements.map((r: any) => r.id)
              const teamSubmissions = submissions.filter(
                (s) => reqIds.includes(s.requirement_id) && s.team_id === team.id
              )

              return (
                <div key={team.id} style={{ marginTop: 16 }}>
                  <h3 style={{ fontSize: 15, margin: '0 0 4px' }}>
                    Verzameldoel — {team.name} (vak {team.board_position})
                  </h3>
                  <ItemSubmissionsPanel
                    requirements={tile.requirements}
                    submissions={teamSubmissions as any}
                    teamId={team.id}
                    canSubmit={myTeamIds.includes(team.id)}
                    isOwner={membership?.role === 'owner'}
                  />
                </div>
              )
            })}

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
                  initialTiles={(tilesWithRequirements as any) ?? []}
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
            tiles={(bingoTilesWithRequirements as any) ?? []}
            teams={(teams as any) ?? []}
            completions={(bingoCompletions as any) ?? []}
            canManage={canManage}
          />
          <BingoLeaderboard
            teams={(teams as any) ?? []}
            completions={(bingoCompletions as any) ?? []}
            totalTiles={((event.config as any)?.gridSize ?? 5) ** 2}
          />

          {((teams as any) ?? []).map((team: any) => {
            const openTiles = (bingoTilesWithRequirements as any[]).filter(
              (t) =>
                t.effect_type === 'verzamel_item' &&
                t.requirements?.length > 0 &&
                !(bingoCompletions ?? []).some((c) => c.tile_id === t.id && c.team_id === team.id)
            )
            if (openTiles.length === 0) return null

            return (
              <div key={team.id} style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: 15, margin: '0 0 4px' }}>
                  Openstaande verzameldoelen — {team.name}
                </h3>
                {openTiles.map((tile) => {
                  const reqIds = tile.requirements.map((r: any) => r.id)
                  const teamSubmissions = bingoSubmissions.filter(
                    (s) => reqIds.includes(s.requirement_id) && s.team_id === team.id
                  )
                  return (
                    <div key={tile.id} style={{ marginBottom: 10 }}>
                      <p className="text-muted" style={{ fontSize: 13, margin: '0 0 4px' }}>
                        Vak {tile.position}: {tile.title}
                      </p>
                      <ItemSubmissionsPanel
                        requirements={tile.requirements}
                        submissions={teamSubmissions as any}
                        teamId={team.id}
                        canSubmit={myTeamIds.includes(team.id)}
                        isOwner={membership?.role === 'owner'}
                        apiBasePath="/api/bingo-item-submissions"
                      />
                    </div>
                  )
                })}
              </div>
            )
          })}

          {canManage && (
            <BingoTilesManager
              eventId={event.id}
              gridSize={(event.config as any)?.gridSize ?? 5}
              initialTiles={(bingoTilesWithRequirements as any) ?? []}
            />
          )}
        </>
      )}

      {event.type === 'droprace' && (
        <>
          <DropRaceBoard
            races={(racesWithItems as any) ?? []}
            submissions={raceSubmissions as any}
            teams={(teams as any) ?? []}
            participants={(allParticipants as any) ?? []}
            myTeamIds={myTeamIds}
            myParticipantIds={myParticipantIds}
            isOwner={membership?.role === 'owner'}
          />
          {canManage && (
            <DropRaceManager eventId={event.id} initialRaces={(racesWithItems as any) ?? []} />
          )}
        </>
      )}

      {event.type === 'gauntlet' && (
        <>
          {canManage && <GauntletConfigForm eventId={event.id} currentMode={gauntletMode} />}
          <GauntletBoard
            stages={(gauntletStagesWithItems as any) ?? []}
            submissions={gauntletSubmissions as any}
            teams={(teams as any) ?? []}
            participants={(allParticipants as any) ?? []}
            mode={gauntletMode}
            myTeamIds={myTeamIds}
            myParticipantIds={myParticipantIds}
            isOwner={membership?.role === 'owner'}
          />
          {canManage && (
            <GauntletManager eventId={event.id} initialStages={(gauntletStagesWithItems as any) ?? []} />
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
