type HistoryEntry = {
  id: string
  data: any
  source: 'web' | 'discord_bot'
  created_at: string
  created_by: string | null
}

type Team = { id: string; name: string }

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'zojuist'
  if (minutes < 60) return `${minutes} min geleden`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} uur geleden`
  const days = Math.floor(hours / 24)
  return `${days} dag${days === 1 ? '' : 'en'} geleden`
}

export default function GanzebordHistory({
  history,
  teams,
  creatorNames,
}: {
  history: HistoryEntry[]
  teams: Team[]
  creatorNames: Record<string, string>
}) {
  const teamName = (teamId: string) => teams.find((t) => t.id === teamId)?.name ?? 'Onbekend team'

  if (history.length === 0) return null

  return (
    <div className="panel-dark" style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 18 }}>Geschiedenis</h2>
      <ul style={{ listStyle: 'none', padding: 0, fontSize: 13, margin: 0 }}>
        {history.map((entry) => {
          const d = entry.data ?? {}
          const name = teamName(d.team_id)
          let actionText = ''

          if (d.method === 'dobbelsteen') {
            actionText = `🎲 gooide ${d.roll} (vak ${d.from} → ${d.to})`
          } else if (d.method === 'straf' || d.method === 'straf_zelf') {
            actionText = d.roll
              ? `💥 straf: dobbelsteen ${d.roll} terug (vak ${d.from} → ${d.to})`
              : `💥 straf: ${d.steps} terug (vak ${d.from} → ${d.to})`
          } else if (d.method === 'straf_toegewezen') {
            actionText = '📜 strafworp toegewezen'
          } else if (d.method === 'handmatig') {
            actionText = `✏️ handmatig gezet (vak ${d.from} → ${d.to})`
          } else {
            actionText = `vak ${d.from} → ${d.to}`
          }

          const via =
            entry.source === 'discord_bot'
              ? 'via Discord'
              : entry.created_by && creatorNames[entry.created_by]
              ? `door ${creatorNames[entry.created_by]}`
              : 'via website'

          return (
            <li
              key={entry.id}
              style={{
                padding: '6px 0',
                borderBottom: '1px solid rgba(184, 134, 59, 0.25)',
                color: 'var(--text-on-dark)',
              }}
            >
              <strong>{name}</strong> {actionText}{' '}
              <span className="text-muted">
                — {via}, {timeAgo(entry.created_at)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
