type Team = { id: string; name: string; board_position: number }

export default function GanzebordLeaderboard({
  teams,
  boardSize,
}: {
  teams: Team[]
  boardSize: number
}) {
  const sorted = [...teams].sort((a, b) => b.board_position - a.board_position)
  const medals = ['🥇', '🥈', '🥉']

  if (sorted.length === 0) return null

  return (
    <div style={{ marginTop: 24 }}>
      <h2>Ranglijst</h2>
      {sorted.map((team, index) => (
        <div key={team.id} className="card-row">
          <span style={{ width: 24, textAlign: 'center' }}>{medals[index] ?? index + 1}</span>
          <strong style={{ flex: 1 }}>{team.name}</strong>
          <span className="stat text-muted" style={{ fontSize: 13 }}>
            vak {team.board_position} / {boardSize}
            {team.board_position >= boardSize && ' 🏁'}
          </span>
        </div>
      ))}
    </div>
  )
}
