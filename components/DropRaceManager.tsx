'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

type DraftItem = { itemId: string; itemName: string }

export default function DropRaceManager({
  eventId,
  initialRaces,
}: {
  eventId: string
  initialRaces: any[]
}) {
  const router = useRouter()
  const [label, setLabel] = useState('')
  const [requiredQuantity, setRequiredQuantity] = useState(1)
  const [mode, setMode] = useState<'team' | 'individual'>('team')
  const [items, setItems] = useState<DraftItem[]>([{ itemId: '', itemName: '' }])
  const [editingRaceId, setEditingRaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((its) => its.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }
  function addItem() {
    setItems((its) => [...its, { itemId: '', itemName: '' }])
  }
  function removeItem(index: number) {
    setItems((its) => its.filter((_, i) => i !== index))
  }

  function resetForm() {
    setEditingRaceId(null)
    setLabel('')
    setRequiredQuantity(1)
    setMode('team')
    setItems([{ itemId: '', itemName: '' }])
  }

  function handleEdit(race: any) {
    setEditingRaceId(race.id)
    setLabel(race.label)
    setRequiredQuantity(race.required_quantity)
    setMode(race.mode)
    setItems(
      race.accepted_items?.length > 0
        ? race.accepted_items.map((a: any) => ({ itemId: String(a.item_id), itemName: a.item_name }))
        : [{ itemId: '', itemName: '' }]
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/drop-races', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        raceId: editingRaceId,
        label,
        requiredQuantity,
        mode,
        items,
      }),
    })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error ?? 'Er ging iets mis.')
      setLoading(false)
      return
    }

    resetForm()
    setLoading(false)
    router.refresh()
  }

  async function handleDelete(raceId: string) {
    if (!confirm('Deze race verwijderen?')) return
    await fetch(`/api/drop-races/${raceId}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="panel-dark" style={{ marginTop: 20 }}>
      <strong>Races</strong>

      {initialRaces.length > 0 && (
        <ul style={{ marginTop: 8, paddingLeft: 18 }}>
          {initialRaces.map((race) => (
            <li key={race.id} style={{ marginBottom: 4 }}>
              <strong>{race.label}</strong> — {race.required_quantity}x,{' '}
              {race.mode === 'team' ? 'per team' : 'individueel'} ({race.status})
              <button onClick={() => handleEdit(race)} className="btn-link" style={{ marginLeft: 8, color: 'var(--gold-light)' }}>
                bewerken
              </button>
              <button onClick={() => handleDelete(race.id)} className="btn-link" style={{ marginLeft: 8 }}>
                verwijder
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {error && <p className="error-text">{error}</p>}

        <input
          type="text"
          placeholder="Naam van de race (bv. 'Twisted bow race')"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="input"
        />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="field-label" style={{ margin: 0 }}>Benodigd aantal:</label>
          <input
            type="number"
            min={1}
            value={requiredQuantity}
            onChange={(e) => setRequiredQuantity(Number(e.target.value))}
            className="input"
            style={{ width: 70 }}
          />
          <label className="field-label" style={{ margin: 0 }}>Modus:</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="input" style={{ width: 'auto' }} disabled={!!editingRaceId}>
            <option value="team">Per team</option>
            <option value="individual">Individueel</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="text-muted" style={{ fontSize: 11 }}>
            Acceptabele item(s) — welke dan ook telt mee:
          </span>
          {items.map((item, index) => (
            <div key={index} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="number"
                min={1}
                value={item.itemId}
                onChange={(e) => updateItem(index, { itemId: e.target.value })}
                placeholder="Item-ID"
                className="input"
                style={{ width: 90 }}
              />
              <input
                type="text"
                value={item.itemName}
                onChange={(e) => updateItem(index, { itemName: e.target.value })}
                placeholder="Naam van het item"
                className="input"
                style={{ flex: 1, minWidth: 120 }}
              />
              {items.length > 1 && (
                <button type="button" onClick={() => removeItem(index)} className="btn-link" style={{ fontSize: 12 }}>
                  verwijder
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addItem} className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
            + Alternatief item toevoegen
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={loading || !label.trim()} className="btn" style={{ alignSelf: 'flex-start' }}>
            {loading ? 'Bezig...' : editingRaceId ? 'Wijzigingen opslaan' : 'Race aanmaken'}
          </button>
          {editingRaceId && (
            <button type="button" onClick={resetForm} className="btn btn-secondary">
              Annuleren
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
