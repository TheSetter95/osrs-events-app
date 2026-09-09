'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

type DraftItem = { itemId: string; itemName: string }

export default function GauntletManager({
  eventId,
  initialStages,
}: {
  eventId: string
  initialStages: any[]
}) {
  const router = useRouter()
  const nextOrder = initialStages.length + 1
  const [stageOrder, setStageOrder] = useState(nextOrder)
  const [label, setLabel] = useState('')
  const [requiredQuantity, setRequiredQuantity] = useState(1)
  const [items, setItems] = useState<DraftItem[]>([{ itemId: '', itemName: '' }])
  const [editingStageId, setEditingStageId] = useState<string | null>(null)
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
    setEditingStageId(null)
    setStageOrder(initialStages.length + 1)
    setLabel('')
    setRequiredQuantity(1)
    setItems([{ itemId: '', itemName: '' }])
  }

  function handleEdit(stage: any) {
    setEditingStageId(stage.id)
    setStageOrder(stage.stage_order)
    setLabel(stage.label)
    setRequiredQuantity(stage.required_quantity)
    setItems(
      stage.accepted_items?.length > 0
        ? stage.accepted_items.map((a: any) => ({ itemId: String(a.item_id), itemName: a.item_name }))
        : [{ itemId: '', itemName: '' }]
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/gauntlet-stages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        stageId: editingStageId,
        stageOrder,
        label,
        requiredQuantity,
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

  async function handleDelete(stageId: string) {
    if (!confirm('Deze stap verwijderen? De volgorde van latere stappen verandert hierdoor niet vanzelf.')) return
    await fetch(`/api/gauntlet-stages/${stageId}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="panel-dark" style={{ marginTop: 20 }}>
      <strong>Gauntlet-stappen (in volgorde)</strong>

      {initialStages.length > 0 && (
        <ol style={{ marginTop: 8, paddingLeft: 18 }}>
          {[...initialStages]
            .sort((a, b) => a.stage_order - b.stage_order)
            .map((stage) => (
              <li key={stage.id} style={{ marginBottom: 4 }}>
                <strong>{stage.label}</strong> — {stage.required_quantity}x
                <button onClick={() => handleEdit(stage)} className="btn-link" style={{ marginLeft: 8, color: 'var(--gold-light)' }}>
                  bewerken
                </button>
                <button onClick={() => handleDelete(stage.id)} className="btn-link" style={{ marginLeft: 8 }}>
                  verwijder
                </button>
              </li>
            ))}
        </ol>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {error && <p className="error-text">{error}</p>}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label className="field-label" style={{ margin: 0 }}>Stap nr.</label>
          <input
            type="number"
            min={1}
            value={stageOrder}
            onChange={(e) => setStageOrder(Number(e.target.value))}
            className="input"
            style={{ width: 70 }}
            disabled={!!editingStageId}
          />
        </div>

        <input
          type="text"
          placeholder="Naam van deze stap (bv. 'Wapen halen')"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="input"
        />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label className="field-label" style={{ margin: 0 }}>Benodigd aantal:</label>
          <input
            type="number"
            min={1}
            value={requiredQuantity}
            onChange={(e) => setRequiredQuantity(Number(e.target.value))}
            className="input"
            style={{ width: 70 }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="text-muted" style={{ fontSize: 11 }}>
            Acceptabele item(s) voor deze stap — welke dan ook telt mee:
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
            {loading ? 'Bezig...' : editingStageId ? 'Wijzigingen opslaan' : 'Stap toevoegen'}
          </button>
          {editingStageId && (
            <button type="button" onClick={resetForm} className="btn btn-secondary">
              Annuleren
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
