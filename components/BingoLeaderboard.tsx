type Team = { id: string; name: string }
type Completion = { tile_id: string; team_id: string }

export default function BingoLeaderboard({
  teams,
  completions,
  totalTiles,
}: {
  teams: Team[]
  completions: Completion[]
  totalTiles: number
}) {
  if (teams.length === 0) return null

  const counts = teams.map((team) => ({
    team,
    count: completions.filter((c) => c.team_id === team.id).length,
  }))

  counts.sort((a, b) => b.count - a.count)
  const medals = ['🥇', '🥈', '🥉']

  return (
    <div style={{ marginTop: 24 }}>
      <h2>Ranglijst</h2>
      {counts.map(({ team, count }, index) => (
        <div key={team.id} className="card-row">
          <span style={{ width: 24, textAlign: 'center' }}>{medals[index] ?? index + 1}</span>
          <strong style={{ flex: 1 }}>{team.name}</strong>
          <span className="stat text-muted" style={{ fontSize: 13 }}>
            {count} / {totalTiles} vakjes
          </span>
        </div>
      ))}
    </div>
  )
}
