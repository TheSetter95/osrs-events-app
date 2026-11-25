'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { GAME_TYPE_LABELS } from '@/lib/assignmentValidation'

export type PickedAssignment = {
  title: string
  description: string
  wiki_url: string | null
  kind: 'verzamel_item' | 'tekst'
  requirement_groups: { label: string; quantity: number; items: { itemId: number; itemName: string }[] }[]
}

type Row = PickedAssignment & { id: string; difficulty: string | null; membership: string; tags: string[] }

const DIFFICULTY_LABELS: Record<string, string> = { makkelijk: 'Makkelijk', gemiddeld: 'Gemiddeld', moeilijk: 'Moeilijk' }
const MEMBERSHIP_LABELS: Record<string, string> = { f2p: 'F2P', p2p: 'P2P', beide: 'F2P + P2P' }

// Laat een owner een opdracht uit de gedeelde bibliotheek kiezen. De gekozen opdracht
// wordt als KOPIE in het formulier gezet; de owner kan 'm daarna nog aanpassen.
export default function LibraryPicker({
  gameType,
  onPick,
}: {
  gameType: 'bingo' | 'ganzebord' | 'miljoenenjacht'
  onPick: (a: PickedAssignment) => void
}) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('assignment_templates')
      .select('id, title, description, wiki_url, kind, requirement_groups, difficulty, membership, tags')
      .contains('game_types', [gameType])
      .order('created_at', { ascending: false })
      .limit(300)
    setLoading(false)
    if (error) {
      setError('De bibliotheek kon niet geladen worden. Alleen owners hebben toegang.')
      return
    }
    setRows((data ?? []) as Row[])
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && rows === null) load()
  }

  const q = query.trim().toLowerCase()
  const filtered = (rows ?? []).filter(
    (r) => !q || `${r.title} ${r.description} ${(r.tags ?? []).join(' ')}`.toLowerCase().includes(q)
  )

  return (
    <div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={toggle}>
        📚 {open ? 'Bibliotheek sluiten' : 'Kies uit bibliotheek'}
      </button>

      {open && (
        <div className="panel-dark" style={{ marginTop: 8, padding: 10 }}>
          <p className="text-muted" style={{ fontSize: 12, margin: '0 0 8px' }}>
            Opdrachten voor {GAME_TYPE_LABELS[gameType]}. Je kiest een kopie: wijzigingen in de bibliotheek hebben
            later geen effect op dit event.
          </p>
          <input
            className="input"
            placeholder="Zoeken…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          {loading && <p className="text-muted">Laden…</p>}
          {error && <p className="error-text">{error}</p>}
          {rows && filtered.length === 0 && <p className="text-muted">Geen opdrachten gevonden.</p>}
          <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map((r) => (
              <button
                type="button"
                key={r.id}
                onClick={() => {
                  onPick(r)
                  setOpen(false)
                }}
                className="card"
                style={{ textAlign: 'left', cursor: 'pointer', padding: 8 }}
              >
                <strong>{r.title}</strong>{' '}
                {r.difficulty && <span className="badge badge-muted">{DIFFICULTY_LABELS[r.difficulty]}</span>}{' '}
                <span className="badge badge-muted">{MEMBERSHIP_LABELS[r.membership] ?? r.membership}</span>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  {r.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
