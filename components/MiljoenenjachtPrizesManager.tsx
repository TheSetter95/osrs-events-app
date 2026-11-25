'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Row = { label: string; gp: string; opened: boolean }

// Alleen voor organizers/owners: de geheime inhoud van elke koffer instellen.
// Spelers kunnen deze gegevens nooit zien (staan in een aparte tabel met eigen RLS-regels).
export default function MiljoenenjachtPrizesManager({
  eventId,
  caseCount,
  initialPrizes,
  eventStatus,
}: {
  eventId: string
  caseCount: number
  initialPrizes: { case_number: number; label: string; gp_value: number | null; opened: boolean }[]
  eventStatus: string
}) {
  const router = useRouter()
  const byNumber = new Map(initialPrizes.map((p) => [p.case_number, p]))
  const [rows, setRows] = useState<Row[]>(
    Array.from({ length: caseCount }, (_, i) => {
      const p = byNumber.get(i + 1)
      return {
        label: p?.label ?? '',
        gp: p?.gp_value !== null && p?.gp_value !== undefined ? String(p.gp_value) : '',
        opened: p?.opened ?? false,
      }
    })
  )
  const [bulk, setBulk] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function update(index: number, patch: Partial<Row>) {
    setSaved(false)
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  // Eén prijs per regel: "10M gp | 10000000" of alleen "Twisted bow"
  function applyBulk() {
    const lines = bulk.split('\n').map((l) => l.trim()).filter(Boolean)
    setSaved(false)
    setRows((rs) => {
      const next = [...rs]
      let li = 0
      for (let i = 0; i < next.length && li < lines.length; i++) {
        if (next[i].opened) continue
        const [label, gp] = lines[li].split('|').map((x) => x.trim())
        next[i] = { ...next[i], label: label ?? '', gp: (gp ?? '').replace(/[^\d]/g, '') }
        li++
      }
      return next
    })
    setBulk('')
  }

  async function handleSave() {
    setError(null)
    setSaved(false)
    const missing = rows.findIndex((r) => !r.label.trim())
    if (missing !== -1) {
      setError(`Koffer ${missing + 1} heeft nog geen inhoud.`)
      return
    }
    setLoading(true)
    const res = await fetch('/api/miljoenenjacht/prizes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        prizes: rows.map((r, i) => ({ caseNumber: i + 1, label: r.label, gp: r.gp === '' ? null : Number(r.gp) })),
      }),
    })
    const result = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(result.error ?? 'Opslaan mislukt.')
      return
    }
    setSaved(true)
    router.refresh()
  }

  const total = rows.reduce((sum, r) => sum + (Number(r.gp) || 0), 0)

  return (
    <div className="panel-dark" style={{ marginTop: 20 }}>
      <strong>🔒 Inhoud van de koffers (geheim)</strong>
      <p className="text-muted" style={{ fontSize: 12, margin: '4px 0 12px' }}>
        Alleen organizers en owners zien dit. Spelers zien de inhoud pas als een koffer geopend is. Het gp-bedrag is
        optioneel en wordt gebruikt voor de stand per team.
        {eventStatus === 'finished' && ' Het event is afgerond: wijzigen kan niet meer.'}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ width: 70, fontSize: 13 }}>Koffer {i + 1}</span>
            <input
              className="input"
              placeholder="Inhoud (bv. 5M gp of Twisted bow)"
              maxLength={100}
              value={r.label}
              onChange={(e) => update(i, { label: e.target.value })}
              disabled={r.opened || eventStatus === 'finished'}
              style={{ flex: 1, minWidth: 160 }}
            />
            <input
              className="input"
              type="number"
              min={0}
              placeholder="gp-waarde"
              value={r.gp}
              onChange={(e) => update(i, { gp: e.target.value })}
              disabled={r.opened || eventStatus === 'finished'}
              style={{ width: 130 }}
            />
            {r.opened && <span className="badge badge-muted">geopend</span>}
          </div>
        ))}
      </div>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--gold-light)' }}>
          Lijst plakken (één prijs per regel, optioneel met | gp-waarde)
        </summary>
        <textarea
          className="input"
          rows={5}
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          placeholder={'1M gp | 1000000\nTwisted bow | 1500000000\nNiets (pech!)'}
          style={{ marginTop: 8 }}
        />
        <button type="button" className="btn btn-secondary btn-sm" onClick={applyBulk} style={{ marginTop: 6 }}>
          Verdeel over de koffers
        </button>
      </details>

      <p className="text-muted" style={{ fontSize: 12 }}>
        Totale gp-waarde van alle koffers: {total.toLocaleString('nl-NL')} gp
      </p>

      {error && <p className="error-text">{error}</p>}
      {saved && <p style={{ fontSize: 13, color: 'var(--gold-light)' }}>✅ Opgeslagen.</p>}

      <button
        type="button"
        className="btn"
        onClick={handleSave}
        disabled={loading || eventStatus === 'finished'}
      >
        {loading ? 'Bezig…' : 'Koffers opslaan'}
      </button>
    </div>
  )
}
