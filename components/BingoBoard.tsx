'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Team = { id: string; name: string }
type Tile = {
  id: string
  position: number
  title: string
  description: string | null
  image_url: string | null
  wiki_url: string | null
}
type Completion = { tile_id: string; team_id: string }

const COLORS = ['#e03131', '#1971c2', '#2f9e44', '#f08c00', '#9c36b5', '#0c8599']

export default function BingoBoard({
  gridSize,
  tiles,
  teams,
  completions,
  canManage,
}: {
  gridSize: number
  tiles: Tile[]
  teams: Team[]
  completions: Completion[]
  canManage: boolean
}) {
  const router = useRouter()
  const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id ?? '')
  const [togglingTileId, setTogglingTileId] = useState<string | null>(null)

  const tilesByPosition: Record<number, Tile> = {}
  for (const tile of tiles) {
    tilesByPosition[tile.position] = tile
  }

  const teamColor = (teamId: string) => {
    const index = teams.findIndex((t) => t.id === teamId)
    return COLORS[index % COLORS.length]
  }

  function completedTeamsFor(tileId: string) {
    return completions.filter((c) => c.tile_id === tileId).map((c) => c.team_id)
  }

  async function handleToggle(tileId: string) {
    if (!canManage || !selectedTeamId) return
    setTogglingTileId(tileId)
    await fetch('/api/bingo-completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tileId, teamId: selectedTeamId }),
    })
    setTogglingTileId(null)
    router.refresh()
  }

  return (
    <div style={{ marginTop: 24 }}>
      {canManage && teams.length > 0 && (
        <div
          className="panel-dark"
          style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
        >
          <label className="field-label" style={{ margin: 0 }}>
            Vakjes afvinken voor team:
          </label>
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="input"
            style={{ width: 'auto' }}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: teamColor(selectedTeamId),
              display: 'inline-block',
            }}
          />
          <span className="text-muted" style={{ fontSize: 12 }}>
            Klik op een vakje om het aan/uit te vinken voor dit team
          </span>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
          gap: 4,
        }}
      >
        {Array.from({ length: gridSize * gridSize }, (_, i) => i + 1).map((position) => {
          const tile = tilesByPosition[position]
          const completedTeams = tile ? completedTeamsFor(tile.id) : []
          const selectedTeamDone = tile && completedTeams.includes(selectedTeamId)

          return (
            <div
              key={position}
              onClick={() => tile && canManage && handleToggle(tile.id)}
              title={tile?.description ?? undefined}
              style={{
                aspectRatio: '1',
                border: selectedTeamDone ? '2px solid var(--success-light)' : '1px solid var(--gold-dark)',
                borderRadius: 6,
                background: tile ? 'var(--parchment)' : 'var(--panel)',
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: tile && canManage ? 'pointer' : 'default',
                position: 'relative',
                opacity: togglingTileId === tile?.id ? 0.5 : 1,
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: tile ? '#8a7550' : 'var(--text-muted-dark)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {position}
              </span>

              {tile && (
                <>
                  {tile.image_url && (
                    <a
                      href={tile.wiki_url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        alignSelf: 'center',
                        cursor: tile.wiki_url ? 'pointer' : 'default',
                        pointerEvents: tile.wiki_url ? 'auto' : 'none',
                      }}
                    >
                      <img
                        src={tile.image_url}
                        alt=""
                        style={{
                          width: '100%',
                          maxWidth: 40,
                          height: 'auto',
                          objectFit: 'contain',
                          imageRendering: 'pixelated',
                        }}
                      />
                    </a>
                  )}
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text-on-parchment)',
                      fontWeight: 600,
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: tile.image_url ? 2 : 3,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {tile.title}
                  </span>
                </>
              )}

              {completedTeams.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {completedTeams.map((teamId) => (
                    <span
                      key={teamId}
                      title={teams.find((t) => t.id === teamId)?.name}
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        padding: '1px 4px',
                        borderRadius: 4,
                        background: teamColor(teamId),
                        color: 'white',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.4,
                      }}
                    >
                      {teams.find((t) => t.id === teamId)?.name ?? 'Team'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {tiles.length < gridSize * gridSize && (
        <p className="text-muted" style={{ fontSize: 13, marginTop: 8 }}>
          Nog niet alle vakjes hebben een opdracht — vul ze hieronder aan.
        </p>
      )}
    </div>
  )
}
