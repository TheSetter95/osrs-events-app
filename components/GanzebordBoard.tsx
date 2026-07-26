'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Team = {
  id: string
  name: string
  board_position: number
  can_roll: boolean
  pending_penalty: boolean
}

type Tile = {
  id: string
  tile_number: number
  description: string
  effect_type: 'geen' | 'terug_dobbelsteen' | 'terug_vast'
  effect_value: number | null
  transferable: boolean
  image_url: string | null
  wiki_url: string | null
  glow_color: string | null
}

const COLORS = ['#c0392b', '#2471a3', '#27ae60', '#e08e0b', '#8e44ad', '#16a085']

type GridCell = { row: number; col: number }

// Genereert alle cellen van een size×size raster in kloksgewijze spiraalvolgorde,
// van buiten (linksboven) naar binnen — exact zoals een klassiek ganzebord.
function generateSpiral(size: number): GridCell[] {
  const cells: GridCell[] = []
  let top = 0
  let bottom = size - 1
  let left = 0
  let right = size - 1

  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) cells.push({ row: top, col: c })
    top++
    for (let r = top; r <= bottom; r++) cells.push({ row: r, col: right })
    right--
    if (top <= bottom) {
      for (let c = right; c >= left; c--) cells.push({ row: bottom, col: c })
      bottom--
    }
    if (left <= right) {
      for (let r = bottom; r >= top; r--) cells.push({ row: r, col: left })
      left++
    }
  }
  return cells
}

// Bepaalt de rastergrootte en welke cel bij welk vakjenummer hoort. Het
// laatste vakje (de finish) krijgt altijd de middelste 2x2-cellen — precies
// de plek waar een spiraal op een even raster van nature eindigt.
function computeSpiralLayout(boardSize: number) {
  let size = 2
  while (size * size - 4 < boardSize - 1) {
    size += 2
  }

  const spiral = generateSpiral(size)
  const ringCells = spiral.slice(0, size * size - 4)
  const centerCells = spiral.slice(size * size - 4)

  const tileCells = ringCells.slice(0, boardSize - 1) // vakjes 1 .. boardSize-1
  const blankCells = ringCells.slice(boardSize - 1) // ongebruikte restcellen (indien niet precies passend)

  const centerRow = Math.min(...centerCells.map((c) => c.row))
  const centerCol = Math.min(...centerCells.map((c) => c.col))

  return { size, tileCells, blankCells, centerRow, centerCol }
}

export default function GanzebordBoard({
  eventId,
  boardSize,
  teams,
  tiles,
  canManage,
  myTeamIds,
  eventStatus,
  revealedTileNumbers,
}: {
  eventId: string
  boardSize: number
  teams: Team[]
  tiles: Tile[]
  canManage: boolean
  myTeamIds: string[]
  eventStatus: string
  revealedTileNumbers: number[]
}) {
  const router = useRouter()
  const [rollingTeamId, setRollingTeamId] = useState<string | null>(null)
  const [lastRoll, setLastRoll] = useState<{ teamId: string; roll: number } | null>(null)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [manualPosition, setManualPosition] = useState(0)
  const [rollError, setRollError] = useState<string | null>(null)

  const [pending, setPending] = useState<{ team: Team; tile: Tile } | null>(null)
  const [targetTeamId, setTargetTeamId] = useState<string>('')
  const [resolvingPenalty, setResolvingPenalty] = useState(false)

  const allVisible = eventStatus === 'draft'
  const revealedSet = new Set(revealedTileNumbers)

  const { size, tileCells, blankCells, centerRow, centerCol } = useMemo(
    () => computeSpiralLayout(boardSize),
    [boardSize]
  )

  const tilesByNumber: Record<number, Tile> = {}
  for (const tile of tiles) {
    tilesByNumber[tile.tile_number] = tile
  }

  const teamsByTile: Record<number, Team[]> = {}
  for (const team of teams) {
    if (team.board_position > 0 && team.board_position <= boardSize) {
      teamsByTile[team.board_position] = [...(teamsByTile[team.board_position] ?? []), team]
    }
  }

  const teamColor = (teamId: string) => {
    const index = teams.findIndex((t) => t.id === teamId)
    return COLORS[index % COLORS.length]
  }

  // Haalt de automatische "Team N"-prefix eraf, zodat alleen de eigen
  // toegevoegde naam overblijft (valt terug op de volledige naam als er
  // niets anders is dan "Team N").
  function displayTeamName(name: string) {
    const stripped = name.replace(/^Team\s+\d+\s*/i, '').trim()
    return stripped || name
  }

  function canRollFor(team: Team) {
    // Gooien mag alleen als het team is vrijgegeven — ook voor organizers/owners.
    // Organizers mogen dat voor élk vrijgegeven team; teamleden alleen voor hun eigen team.
    return team.can_roll && (canManage || myTeamIds.includes(team.id))
  }

  async function handleRoll(team: Team) {
    setRollError(null)
    setRollingTeamId(team.id)
    const res = await fetch(`/api/teams/${team.id}/roll`, { method: 'POST' })
    const result = await res.json()
    setRollingTeamId(null)

    if (!res.ok) {
      setRollError(result.error ?? 'Er ging iets mis.')
      return
    }

    setLastRoll({ teamId: team.id, roll: result.roll })

    if (result.tile) {
      setPending({ team, tile: result.tile })
      setTargetTeamId(team.id)
    }
    router.refresh()
  }

  async function handleManualSave(teamId: string) {
    await fetch(`/api/teams/${teamId}/position`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: manualPosition }),
    })
    setEditingTeamId(null)
    router.refresh()
  }

  async function handleToggleCanRoll(team: Team) {
    await fetch(`/api/teams/${team.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ can_roll: !team.can_roll }),
    })
    router.refresh()
  }

  async function handleResolvePending() {
    if (!pending) return
    setResolvingPenalty(true)

    if (pending.tile.effect_type === 'terug_dobbelsteen') {
      await fetch(`/api/teams/${targetTeamId}/assign-penalty`, { method: 'POST' })
    } else if (pending.tile.effect_type === 'terug_vast') {
      await fetch(`/api/teams/${targetTeamId}/penalty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: pending.tile.effect_type, value: pending.tile.effect_value }),
      })
    }

    setResolvingPenalty(false)
    setPending(null)
    router.refresh()
  }

  function renderTile(tileNumber: number, gridArea: React.CSSProperties) {
    const occupants = teamsByTile[tileNumber] ?? []
    const isFinish = tileNumber === boardSize
    const tileTask = tilesByNumber[tileNumber]
    const isRevealed = allVisible || revealedSet.has(tileNumber)
    const glowHex = tileTask?.glow_color || null

    if (!isRevealed) {
      const glowShadow = glowHex
        ? `0 0 12px 3px ${glowHex}, inset 0 0 10px rgba(0,0,0,0.5)`
        : `0 0 6px 1px rgba(184, 134, 59, 0.35), inset 0 0 10px rgba(0,0,0,0.5)`

      return (
        <div
          key={tileNumber}
          style={{
            ...gridArea,
            border: glowHex ? `1px solid ${glowHex}` : '1px solid var(--gold-dark)',
            borderRadius: 4,
            background: 'radial-gradient(circle at 50% 40%, #3a3226, #17130c)',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: glowShadow,
          }}
        >
          <img
            src="/logo.png"
            alt=""
            style={{
              width: '68%',
              height: '68%',
              objectFit: 'contain',
              opacity: 0.92,
              filter: glowHex
                ? `drop-shadow(0 0 4px ${glowHex})`
                : 'drop-shadow(0 0 3px rgba(184, 134, 59, 0.5))',
            }}
          />
          {occupants.length > 0 && (
            <div
              style={{
                position: 'absolute',
                bottom: 2,
                left: 2,
                right: 2,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 2,
                justifyContent: 'center',
              }}
            >
              {occupants.map((t) => (
                <span
                  key={t.id}
                  title={t.name}
                  style={{
                    padding: '1px 4px',
                    borderRadius: 4,
                    background: teamColor(t.id),
                    color: 'white',
                    fontSize: 7,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                    border: '1px solid rgba(0,0,0,0.4)',
                  }}
                >
                  {displayTeamName(t.name)}
                </span>
              ))}
            </div>
          )}
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
            {tileNumber}
          </span>
        </div>
      )
    }

    return (
      <div
        key={tileNumber}
        title={tileTask ? tileTask.description : undefined}
        style={{
          ...gridArea,
          border: tileTask ? '1px solid var(--danger-light)' : '1px solid var(--gold-dark)',
          borderRadius: 4,
          background: isFinish
            ? 'linear-gradient(160deg, #ffe9a8, var(--gold-light))'
            : tileTask
            ? 'linear-gradient(160deg, #4a3420, #2e2013)'
            : 'linear-gradient(160deg, #4a463f, #2b2823)',
          padding: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          fontSize: 10,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: glowHex ? `0 0 10px 2px ${glowHex}` : 'inset 0 0 6px rgba(0,0,0,0.5)',
        }}
      >
        {isFinish && (
          <span
            style={{
              fontSize: 16,
              textShadow: '0 1px 2px rgba(0,0,0,0.4)',
            }}
          >
            🏁
          </span>
        )}
        {tileTask?.image_url ? (
          <a
            href={tileTask.wiki_url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 1,
              right: 1,
              pointerEvents: tileTask.wiki_url ? 'auto' : 'none',
            }}
          >
            <img
              src={tileTask.image_url}
              alt=""
              style={{
                width: 12,
                height: 12,
                objectFit: 'contain',
              }}
            />
          </a>
        ) : (
          tileTask && <span style={{ position: 'absolute', top: 1, right: 2, fontSize: 10 }}>📜</span>
        )}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            justifyContent: 'center',
            width: '100%',
            padding: '0 2px',
          }}
        >
          {occupants.map((t) => (
            <span
              key={t.id}
              title={t.name}
              style={{
                padding: '1px 4px',
                borderRadius: 4,
                background: teamColor(t.id),
                color: 'white',
                fontSize: 8,
                fontWeight: 700,
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
            >
              {displayTeamName(t.name)}
            </span>
          ))}
        </div>
        <span
          className="stat"
          style={{
            position: 'absolute',
            bottom: 2,
            left: 3,
            fontSize: 9,
            color: isFinish ? 'rgba(74, 52, 32, 0.75)' : 'rgba(212, 162, 79, 0.85)',
            textShadow: isFinish ? undefined : '0 1px 2px rgba(0,0,0,0.9)',
          }}
        >
          {tileNumber}
        </span>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 24 }}>
      {/* Het bord zelf: echte spiraal met een 2x2 finish-vakje in het midden */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        {/* Gloeiend gouden spoor dat de route van vak 1 tot de finish toont */}
        <svg
          viewBox={`0 0 ${size} ${size}`}
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            inset: 13, // volgt de padding (10px) + border (3px) van het bord
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          <polyline
            points={[
              ...tileCells.map((c) => `${c.col + 0.5},${c.row + 0.5}`),
              `${centerCol + 1},${centerRow + 1}`,
            ].join(' ')}
            fill="none"
            stroke="var(--gold-light)"
            strokeWidth={0.035}
            strokeOpacity={0.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 0 1.5px rgba(212, 162, 79, 0.5))' }}
          />
        </svg>

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: `repeat(${size}, 1fr)`,
            gridTemplateRows: `repeat(${size}, 1fr)`,
            gap: 4,
            aspectRatio: '1',
            background: 'linear-gradient(160deg, #2a2318, #17130c)',
            border: '3px solid var(--gold-dark)',
            borderRadius: 'var(--radius)',
            padding: 10,
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          {tileCells.map((cell, idx) =>
            renderTile(idx + 1, {
              gridColumn: cell.col + 1,
              gridRow: cell.row + 1,
            })
          )}

          {blankCells.map((cell, i) => (
            <div
              key={`blank-${i}`}
              style={{
                gridColumn: cell.col + 1,
                gridRow: cell.row + 1,
                borderRadius: 4,
                background: 'rgba(0,0,0,0.25)',
              }}
            />
          ))}

          {renderTile(boardSize, {
            gridColumn: `${centerCol + 1} / span 2`,
            gridRow: `${centerRow + 1} / span 2`,
          })}
        </div>
      </div>

      {pending && canManage && (
        <div className="panel" style={{ marginBottom: 20, border: '2px solid var(--danger)' }}>
          <p style={{ margin: 0 }}>
            📜 <strong>{pending.team.name}</strong> landde op vak {pending.tile.tile_number}:{' '}
            {pending.tile.description}
          </p>

          {pending.tile.effect_type === 'geen' ? (
            <button onClick={() => setPending(null)} className="btn btn-secondary on-parchment btn-sm" style={{ marginTop: 10 }}>
              Sluiten
            </button>
          ) : (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {pending.tile.transferable ? (
                <>
                  <label style={{ fontSize: 13 }}>Straf toewijzen aan:</label>
                  <select
                    value={targetTeamId}
                    onChange={(e) => setTargetTeamId(e.target.value)}
                    className="input"
                    style={{ width: 'auto' }}
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.id === pending.team.id ? ' (zelf)' : ''}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <span style={{ fontSize: 13 }}>
                  Straf geldt voor <strong>{pending.team.name}</strong>
                </span>
              )}

              <button onClick={handleResolvePending} disabled={resolvingPenalty} className="btn btn-danger btn-sm">
                {resolvingPenalty
                  ? 'Bezig...'
                  : pending.tile.effect_type === 'terug_dobbelsteen'
                  ? 'Wijs toe (team gooit zelf)'
                  : 'Voer straf uit'}
              </button>
              <button onClick={() => setPending(null)} className="btn btn-secondary on-parchment btn-sm">
                Negeren
              </button>
            </div>
          )}
        </div>
      )}

      {pending && !canManage && (
        <div className="panel-dark" style={{ marginBottom: 20, fontSize: 13, border: '1px dashed var(--danger-light)' }}>
          📜 <strong>{pending.team.name}</strong> landde op vak {pending.tile.tile_number}:{' '}
          {pending.tile.description}
          {pending.tile.effect_type !== 'geen' && ' — vraag de organizer om dit af te handelen.'}
        </div>
      )}

      {rollError && <p className="error-text">{rollError}</p>}

      {teams.some((t) => t.board_position === 0) && (
        <p className="text-muted" style={{ fontSize: 13 }}>
          Op startvak:{' '}
          {teams
            .filter((t) => t.board_position === 0)
            .map((t) => t.name)
            .join(', ')}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {teams.map((team) => (
          <div key={team.id} className="card-row">
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: teamColor(team.id),
                flexShrink: 0,
              }}
            />
            <strong style={{ flex: 1 }}>{team.name}</strong>

            {team.pending_penalty && <span className="badge badge-danger">⏳ strafworp</span>}

            <span className="stat" style={{ color: 'var(--text-muted-light)', fontSize: 13 }}>
              vak {team.board_position} / {boardSize}
              {team.board_position >= boardSize && ' 🏁'}
            </span>

            {lastRoll?.teamId === team.id && (
              <span className="badge badge-success">🎲 {lastRoll.roll}</span>
            )}

            {canRollFor(team) && (
              <button
                onClick={() => handleRoll(team)}
                disabled={rollingTeamId === team.id || team.board_position >= boardSize}
                className="btn btn-sm"
              >
                {rollingTeamId === team.id ? '...' : '🎲 Gooi'}
              </button>
            )}

            {canManage && (
              <>
                <button
                  onClick={() => handleToggleCanRoll(team)}
                  title="Bepaal of teamleden zelf mogen gooien voor dit team"
                  className={`btn btn-sm ${team.can_roll ? 'btn-success' : 'btn-locked'}`}
                >
                  {team.can_roll ? '🔓 Vrijgegeven' : '🔒 Vergrendeld'}
                </button>

                {editingTeamId === team.id ? (
                  <>
                    <input
                      type="number"
                      min={0}
                      max={boardSize}
                      value={manualPosition}
                      onChange={(e) => setManualPosition(Number(e.target.value))}
                      className="input"
                      style={{ width: 60 }}
                    />
                    <button onClick={() => handleManualSave(team.id)} className="btn btn-success btn-sm">
                      Zet
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setEditingTeamId(team.id)
                      setManualPosition(team.board_position)
                    }}
                    className="btn btn-secondary on-parchment btn-sm"
                  >
                    Corrigeer
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
