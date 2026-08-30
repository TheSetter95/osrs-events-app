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
  glow_color: string | null
}
type Completion = { tile_id: string; team_id: string }

const COLORS = ['#c0392b', '#2471a3', '#27ae60', '#e08e0b', '#8e44ad', '#16a085']

// Haalt de automatische "Team N"-prefix eraf, zelfde als bij Ganzebord
function displayTeamName(name: string) {
  const stripped = name.replace(/^Team\s+\d+\s*/i, '').trim()
  return stripped || name
}

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
                {displayTeamName(t.name)}
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
            Klik op een vakje om het aan/uit te vinken voor dit team (verzameldoelen
            worden automatisch bijgehouden, dit is alleen voor handmatige vakjes)
          </span>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
          gap: 4,
          background: 'linear-gradient(160deg, #2a2318, #17130c)',
          border: '3px solid var(--gold-dark)',
          borderRadius: 'var(--radius)',
          padding: 10,
          boxShadow: 'inset 0 0 30px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.5)',
        }}
      >
        {Array.from({ length: gridSize * gridSize }, (_, i) => i + 1).map((position) => {
          const tile = tilesByPosition[position]
          const completedTeams = tile ? completedTeamsFor(tile.id) : []
          const selectedTeamDone = tile && completedTeams.includes(selectedTeamId)
          const glowHex = tile?.glow_color || null
          const hasTeams = completedTeams.length > 0

          return (
            <div
              key={position}
              onClick={() => tile && canManage && handleToggle(tile.id)}
              title={tile?.description ?? undefined}
              style={{
                aspectRatio: '1',
                border: selectedTeamDone ? '2px solid var(--success-light)' : '1px solid var(--gold-dark)',
                borderRadius: 6,
                background: tile
                  ? 'linear-gradient(160deg, #4a463f, #2b2823)'
                  : 'radial-gradient(circle at 50% 40%, #3a3226, #17130c)',
                padding: 3,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: tile && canManage ? 'pointer' : 'default',
                position: 'relative',
                opacity: togglingTileId === tile?.id ? 0.5 : 1,
                overflow: 'hidden',
                boxShadow: glowHex
                  ? `0 0 10px 2px ${glowHex}`
                  : 'inset 0 0 6px rgba(0,0,0,0.5)',
              }}
            >
              <span
                className="stat"
                style={{
                  position: 'absolute',
                  bottom: 2,
                  left: 3,
                  fontSize: 9,
                  color: 'rgba(212, 162, 79, 0.85)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                }}
              >
                {position}
              </span>

              {tile && (
                <>
                  {tile.image_url && (
                    hasTeams ? (
                      <a
                        href={tile.wiki_url ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '42%',
                          height: '42%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          pointerEvents: tile.wiki_url ? 'auto' : 'none',
                        }}
                      >
                        <img
                          src={tile.image_url}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' }}
                        />
                      </a>
                    ) : (
                      <a
                        href={tile.wiki_url ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          inset: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          pointerEvents: tile.wiki_url ? 'auto' : 'none',
                        }}
                      >
                        <img
                          src={tile.image_url}
                          alt=""
                          style={{ width: '92%', height: '92%', objectFit: 'contain', imageRendering: 'pixelated' }}
                        />
                      </a>
                    )
                  )}
                  {!tile.image_url && (
                    <span
                      style={{
                        fontSize: 10,
                        color: 'var(--gold-light)',
                        fontWeight: 600,
                        lineHeight: 1.2,
                        textAlign: 'center',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        textShadow: '0 1px 2px rgba(0,0,0,0.7)',
                      }}
                    >
                      {tile.title}
                    </span>
                  )}
                </>
              )}

              {hasTeams && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 2,
                    justifyContent: 'center',
                    width: '100%',
                    padding: '0 2px',
                    marginTop: 2,
                  }}
                >
                  {completedTeams.map((teamId) => (
                    <span
                      key={teamId}
                      title={teams.find((t) => t.id === teamId)?.name}
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: teamColor(teamId),
                        color: 'white',
                        fontSize: 10,
                        fontWeight: 700,
                        lineHeight: 1.3,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                        textShadow: '0 1px 1px rgba(0,0,0,0.6)',
                        border: '1px solid rgba(0,0,0,0.35)',
                      }}
                    >
                      {displayTeamName(teams.find((t) => t.id === teamId)?.name ?? 'Team')}
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
