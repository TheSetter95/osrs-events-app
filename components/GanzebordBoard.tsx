'use client'

import { useState } from 'react'
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
}

const COLORS = ['#c0392b', '#2471a3', '#27ae60', '#e08e0b', '#8e44ad', '#16a085']
const COLS = 10

function getSnakeOrder(total: number, cols: number) {
  const rows = Math.ceil(total / cols)
  const order: number[] = []
  for (let r = 0; r < rows; r++) {
    const rowNums: number[] = []
    for (let c = 0; c < cols; c++) {
      const n = r * cols + c + 1
      if (n <= total) rowNums.push(n)
    }
    if (r % 2 === 1) rowNums.reverse()
    order.push(...rowNums)
  }
  return order
}

export default function GanzebordBoard({
  eventId,
  boardSize,
  teams,
  tiles,
  canManage,
  myTeamIds,
}: {
  eventId: string
  boardSize: number
  teams: Team[]
  tiles: Tile[]
  canManage: boolean
  myTeamIds: string[]
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

  const tileOrder = getSnakeOrder(boardSize, COLS)
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

  function canRollFor(team: Team) {
    return canManage || (myTeamIds.includes(team.id) && team.can_roll)
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

  return (
    <div style={{ marginTop: 24 }}>
      {/* Het bord zelf */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gap: 4,
          marginBottom: 20,
          background: 'var(--panel)',
          border: '1px solid var(--gold-dark)',
          borderRadius: 'var(--radius)',
          padding: 8,
        }}
      >
        {tileOrder.map((tileNumber) => {
          const occupants = teamsByTile[tileNumber] ?? []
          const isFinish = tileNumber === boardSize
          const tileTask = tilesByNumber[tileNumber]
          return (
            <div
              key={tileNumber}
              title={tileTask ? tileTask.description : undefined}
              style={{
                aspectRatio: '1',
                border: tileTask ? '1px solid var(--danger-light)' : '1px solid var(--gold-dark)',
                borderRadius: 4,
                background: isFinish ? 'var(--gold-light)' : tileTask ? '#4a3420' : 'var(--parchment)',
                padding: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                fontSize: 10,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <span className="stat" style={{ color: tileTask ? 'var(--text-muted-dark)' : '#8a7550' }}>
                {tileNumber}
              </span>
              {tileTask && (
                <span style={{ position: 'absolute', top: 1, right: 2, fontSize: 10 }}>📜</span>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
                {occupants.map((t) => (
                  <span
                    key={t.id}
                    title={t.name}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: teamColor(t.id),
                      color: 'white',
                      fontSize: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {t.name.slice(0, 1).toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
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
