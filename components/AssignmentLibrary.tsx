'use client'

import { useMemo, useState, FormEvent } from 'react'
import { GAME_TYPES, GAME_TYPE_LABELS } from '@/lib/assignmentValidation'

type Group = { label: string; quantity: number; items: { itemId: number; itemName: string }[] }

type Assignment = {
  id: string
  created_by: string | null
  creatorName: string
  title: string
  description: string
  game_types: string[]
  kind: 'verzamel_item' | 'tekst'
  requirement_groups: Group[]
  wiki_url: string | null
  difficulty: string | null
  membership: string
  tags: string[]
}

type FormGroup = { label: string; quantity: string; items: { itemId: string; itemName: string }[] }

type FormState = {
  title: string
  description: string
  game_types: string[]
  kind: 'verzamel_item' | 'tekst'
  groups: FormGroup[]
  difficulty: string
  membership: string
  tags: string
  wiki_url: string
}

const DIFFICULTY_LABELS: Record<string, string> = {
  makkelijk: 'Makkelijk',
  gemiddeld: 'Gemiddeld',
  moeilijk: 'Moeilijk',
}
const MEMBERSHIP_LABELS: Record<string, string> = { f2p: 'F2P', p2p: 'P2P', beide: 'F2P + P2P' }

const emptyGroup = (): FormGroup => ({ label: '', quantity: '1', items: [{ itemId: '', itemName: '' }] })

const emptyForm = (): FormState => ({
  title: '',
  description: '',
  game_types: [],
  kind: 'tekst',
  groups: [emptyGroup()],
  difficulty: '',
  membership: 'beide',
  tags: '',
  wiki_url: '',
})

function toForm(a: Assignment): FormState {
  return {
    title: a.title,
    description: a.description,
    game_types: a.game_types,
    kind: a.kind,
    groups:
      a.requirement_groups.length > 0
        ? a.requirement_groups.map((g) => ({
            label: g.label,
            quantity: String(g.quantity),
            items: g.items.map((i) => ({ itemId: String(i.itemId), itemName: i.itemName })),
          }))
        : [emptyGroup()],
    difficulty: a.difficulty ?? '',
    membership: a.membership,
    tags: a.tags.join(', '),
    wiki_url: a.wiki_url ?? '',
  }
}

function toPayload(f: FormState) {
  return {
    title: f.title,
    description: f.description,
    game_types: f.game_types,
    kind: f.kind,
    requirement_groups:
      f.kind === 'verzamel_item'
        ? f.groups.map((g) => ({
            label: g.label,
            quantity: Number(g.quantity),
            items: g.items.map((i) => ({ itemId: Number(i.itemId), itemName: i.itemName })),
          }))
        : [],
    difficulty: f.difficulty || null,
    membership: f.membership,
    tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
    wiki_url: f.wiki_url,
  }
}

function summarizeGroups(groups: Group[]) {
  return groups.map((g) => `${g.quantity}× ${g.items.map((i) => i.itemName).join(' of ')}`).join(' · ')
}

export default function AssignmentLibrary({
  initialAssignments,
  currentUserId,
  currentUserName,
  isSuperAdmin,
}: {
  initialAssignments: Assignment[]
  currentUserId: string
  currentUserName: string
  isSuperAdmin: boolean
}) {
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments)
  const [query, setQuery] = useState('')
  const [gameFilter, setGameFilter] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('')
  const [membershipFilter, setMembershipFilter] = useState('')

  // null = formulier dicht, 'new' = nieuwe opdracht, anders het id van de opdracht die je bewerkt
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return assignments.filter((a) => {
      if (gameFilter && !a.game_types.includes(gameFilter)) return false
      if (difficultyFilter && a.difficulty !== difficultyFilter) return false
      if (membershipFilter && a.membership !== membershipFilter && a.membership !== 'beide') return false
      if (!q) return true
      const haystack = [
        a.title,
        a.description,
        a.tags.join(' '),
        a.requirement_groups.flatMap((g) => g.items.map((i) => i.itemName)).join(' '),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [assignments, query, gameFilter, difficultyFilter, membershipFilter])

  function openNew() {
    setForm(emptyForm())
    setEditing('new')
    setError(null)
  }

  function openEdit(a: Assignment) {
    setForm(toForm(a))
    setEditing(a.id)
    setError(null)
  }

  function closeForm() {
    setEditing(null)
    setError(null)
  }

  function updateGroup(index: number, patch: Partial<FormGroup>) {
    setForm((f) => ({ ...f, groups: f.groups.map((g, i) => (i === index ? { ...g, ...patch } : g)) }))
  }

  function updateItem(groupIndex: number, itemIndex: number, patch: Partial<{ itemId: string; itemName: string }>) {
    setForm((f) => ({
      ...f,
      groups: f.groups.map((g, gi) =>
        gi === groupIndex
          ? { ...g, items: g.items.map((it, ii) => (ii === itemIndex ? { ...it, ...patch } : it)) }
          : g
      ),
    }))
  }

  function toggleGameType(type: string) {
    setForm((f) => ({
      ...f,
      game_types: f.game_types.includes(type)
        ? f.game_types.filter((t) => t !== type)
        : [...f.game_types, type],
    }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const isNew = editing === 'new'
    const res = await fetch(isNew ? '/api/assignments' : `/api/assignments/${editing}`, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toPayload(form)),
    })
    const result = await res.json().catch(() => ({}))
    setSaving(false)

    if (!res.ok) {
      setError(result.error ?? 'Opslaan mislukt.')
      return
    }

    const saved = result.assignment
    if (isNew) {
      setAssignments((list) => [{ ...saved, creatorName: currentUserName }, ...list])
    } else {
      setAssignments((list) =>
        list.map((a) => (a.id === saved.id ? { ...saved, creatorName: a.creatorName } : a))
      )
    }
    setEditing(null)
  }

  async function handleDelete(a: Assignment) {
    if (!confirm(`Opdracht "${a.title}" verwijderen? Dit kan niet ongedaan gemaakt worden.`)) return
    const res = await fetch(`/api/assignments/${a.id}`, { method: 'DELETE' })
    const result = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(result.error ?? 'Verwijderen mislukt.')
      return
    }
    setAssignments((list) => list.filter((x) => x.id !== a.id))
  }

  return (
    <div>
      {editing === null ? (
        <button className="btn" onClick={openNew} style={{ margin: '12px 0' }}>
          + Nieuwe opdracht
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="panel-dark" style={{ marginTop: 12 }}>
          <h2 style={{ fontSize: 18, marginTop: 0 }}>
            {editing === 'new' ? 'Nieuwe opdracht' : 'Opdracht bewerken'}
          </h2>

          <label className="field-label">Titel</label>
          <input
            className="input"
            maxLength={100}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="bv. Verzamel een Dragon warhammer"
            style={{ marginBottom: 12 }}
          />

          <label className="field-label">Omschrijving (dit komt straks in het vakje)</label>
          <textarea
            className="input"
            rows={3}
            maxLength={1000}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            style={{ marginBottom: 12 }}
          />

          <label className="field-label">Voor welke spelvormen?</label>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
            {GAME_TYPES.map((t) => (
              <label key={t} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={form.game_types.includes(t)}
                  onChange={() => toggleGameType(t)}
                />
                {GAME_TYPE_LABELS[t]}
              </label>
            ))}
          </div>

          <label className="field-label">Type opdracht</label>
          <select
            className="input"
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as FormState['kind'] })}
            style={{ marginBottom: 12 }}
          >
            <option value="tekst">Gewone opdracht (zonder item-controle)</option>
            <option value="verzamel_item">Items verzamelen (met item-ID's voor de plugin)</option>
          </select>

          {form.kind === 'verzamel_item' && (
            <div style={{ marginBottom: 12 }}>
              <label className="field-label">Verzameldoelen</label>
              {form.groups.map((g, gi) => (
                <div
                  key={gi}
                  style={{
                    border: '1px solid rgba(184, 134, 59, 0.35)',
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      value={g.quantity}
                      onChange={(e) => updateGroup(gi, { quantity: e.target.value })}
                      style={{ width: 90 }}
                      aria-label="Aantal"
                    />
                    <input
                      className="input"
                      value={g.label}
                      onChange={(e) => updateGroup(gi, { label: e.target.value })}
                      placeholder="Naam van het doel (optioneel)"
                      style={{ flex: 1, minWidth: 160 }}
                    />
                    {form.groups.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => setForm({ ...form, groups: form.groups.filter((_, i) => i !== gi) })}
                      >
                        Doel weg
                      </button>
                    )}
                  </div>

                  {g.items.map((it, ii) => (
                    <div key={ii} style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={it.itemId}
                        onChange={(e) => updateItem(gi, ii, { itemId: e.target.value })}
                        placeholder="Item-ID"
                        style={{ width: 110 }}
                      />
                      <input
                        className="input"
                        value={it.itemName}
                        onChange={(e) => updateItem(gi, ii, { itemName: e.target.value })}
                        placeholder={ii === 0 ? 'Itemnaam' : 'Alternatief item'}
                        style={{ flex: 1, minWidth: 160 }}
                      />
                      {g.items.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => updateGroup(gi, { items: g.items.filter((_, i) => i !== ii) })}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => updateGroup(gi, { items: [...g.items, { itemId: '', itemName: '' }] })}
                  >
                    + Alternatief item
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setForm({ ...form, groups: [...form.groups, emptyGroup()] })}
              >
                + Nog een doel
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <label className="field-label">Moeilijkheid</label>
              <select
                className="input"
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
              >
                <option value="">Niet ingesteld</option>
                {Object.entries(DIFFICULTY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">F2P / P2P</label>
              <select
                className="input"
                value={form.membership}
                onChange={(e) => setForm({ ...form, membership: e.target.value })}
              >
                {Object.entries(MEMBERSHIP_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="field-label">Labels (gescheiden door komma's, optioneel)</label>
          <input
            className="input"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="bv. pvm, raids, skilling"
            style={{ marginBottom: 12 }}
          />

          <label className="field-label">Wiki-link (optioneel, voor een afbeelding)</label>
          <input
            className="input"
            value={form.wiki_url}
            onChange={(e) => setForm({ ...form, wiki_url: e.target.value })}
            placeholder="https://oldschool.runescape.wiki/w/Dragon_warhammer"
            style={{ marginBottom: 12 }}
          />

          {error && <p className="error-text">{error}</p>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? 'Bezig...' : 'Opslaan'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={closeForm} disabled={saving}>
              Annuleren
            </button>
          </div>
        </form>
      )}

      <div className="panel-dark" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        <input
          className="input"
          placeholder="Zoeken op titel, tekst, label of item…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <select className="input" value={gameFilter} onChange={(e) => setGameFilter(e.target.value)}>
          <option value="">Alle spelvormen</option>
          {GAME_TYPES.map((t) => (
            <option key={t} value={t}>
              {GAME_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={difficultyFilter}
          onChange={(e) => setDifficultyFilter(e.target.value)}
        >
          <option value="">Elke moeilijkheid</option>
          {Object.entries(DIFFICULTY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={membershipFilter}
          onChange={(e) => setMembershipFilter(e.target.value)}
        >
          <option value="">F2P en P2P</option>
          <option value="f2p">Alleen F2P-geschikt</option>
          <option value="p2p">Alleen P2P</option>
        </select>
      </div>

      <p className="text-muted" style={{ fontSize: 13 }}>
        {filtered.length} van {assignments.length} opdrachten
      </p>

      {filtered.length === 0 ? (
        <p className="text-muted">
          {assignments.length === 0
            ? 'Er staan nog geen opdrachten in de bibliotheek. Voeg de eerste toe!'
            : 'Geen opdrachten gevonden met deze filters.'}
        </p>
      ) : (
        filtered.map((a) => {
          const canEdit = a.created_by === currentUserId || isSuperAdmin
          return (
            <div key={a.id} className="panel-dark" style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <strong>{a.title}</strong>
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {a.game_types.map((t) => (
                    <span key={t} className="badge badge-gold">
                      {GAME_TYPE_LABELS[t] ?? t}
                    </span>
                  ))}
                  {a.difficulty && (
                    <span className="badge badge-muted">{DIFFICULTY_LABELS[a.difficulty] ?? a.difficulty}</span>
                  )}
                  <span className="badge badge-muted">{MEMBERSHIP_LABELS[a.membership] ?? a.membership}</span>
                </span>
              </div>

              <p style={{ margin: '8px 0', whiteSpace: 'pre-wrap' }}>{a.description}</p>

              {a.kind === 'verzamel_item' && a.requirement_groups.length > 0 && (
                <p className="text-muted" style={{ fontSize: 13, margin: '4px 0' }}>
                  🎯 {summarizeGroups(a.requirement_groups)}
                </p>
              )}

              {a.tags.length > 0 && (
                <p className="text-muted" style={{ fontSize: 12, margin: '4px 0' }}>
                  {a.tags.map((t) => `#${t}`).join(' ')}
                </p>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  marginTop: 8,
                }}
              >
                <span className="text-muted" style={{ fontSize: 12 }}>
                  Door {a.creatorName}
                  {a.wiki_url && (
                    <>
                      {' · '}
                      <a href={a.wiki_url} target="_blank" rel="noopener noreferrer">
                        wiki
                      </a>
                    </>
                  )}
                </span>
                {canEdit && (
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(a)}>
                      Bewerken
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a)}>
                      Verwijderen
                    </button>
                  </span>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
