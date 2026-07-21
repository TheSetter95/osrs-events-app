'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

type Tile = {
  id: string
  tile_number: number
  description: string
  effect_type: 'geen' | 'terug_dobbelsteen' | 'terug_vast'
  effect_value: number | null
  transferable: boolean
  image_url: string | null
  wiki_url: string | null
}

const EFFECT_LABELS: Record<string, string> = {
  geen: 'Geen automatisch effect (alleen tekst-opdracht)',
  terug_dobbelsteen: 'Rol de dobbelsteen en ga dat aantal terug',
  terug_vast: 'Ga een vast aantal vakjes terug',
}

export default function GanzebordTilesManager({
  eventId,
  boardSize,
  initialTiles,
}: {
  eventId: string
  boardSize: number
  initialTiles: Tile[]
}) {
  const router = useRouter()
  const [tileNumber, setTileNumber] = useState(1)
  const [description, setDescription] = useState('')
  const [wikiUrl, setWikiUrl] = useState('')
  const [effectType, setEffectType] = useState<'geen' | 'terug_dobbelsteen' | 'terug_vast'>('geen')
  const [effectValue, setEffectValue] = useState(3)
  const [transferable, setTransferable] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/board-tiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        tileNumber,
        description,
        effectType,
        effectValue: effectType === 'terug_vast' ? effectValue : null,
        transferable,
        wikiUrl,
      }),
    })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error ?? 'Er ging iets mis.')
      setLoading(false)
      return
    }

    setDescription('')
    setEffectType('geen')
    setTransferable(false)
    setWikiUrl('')
    setLoading(false)
    router.refresh()
  }

  async function handleDelete(tileId: string) {
    if (!confirm('Deze opdracht verwijderen?')) return
    await fetch(`/api/board-tiles/${tileId}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="panel-dark" style={{ marginTop: 20 }}>
      <strong>Opdrachten per vakje</strong>

      {initialTiles.length > 0 && (
        <ul style={{ marginTop: 8, paddingLeft: 18 }}>
          {[...initialTiles]
            .sort((a, b) => a.tile_number - b.tile_number)
            .map((tile) => (
              <li key={tile.id} style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                {tile.image_url && (
                  <img src={tile.image_url} alt="" width={20} height={20} style={{ objectFit: 'contain' }} />
                )}
                <span>
                  <strong>Vak {tile.tile_number}:</strong> {tile.description}{' '}
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    ({EFFECT_LABELS[tile.effect_type]}
                    {tile.transferable ? ', uitdeelbaar' : ''})
                  </span>
                  <button onClick={() => handleDelete(tile.id)} className="btn-link" style={{ marginLeft: 8 }}>
                    verwijder
                  </button>
                </span>
              </li>
            ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {error && <p className="error-text">{error}</p>}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label className="field-label" style={{ margin: 0 }}>Vakje nr.</label>
          <input
            type="number"
            min={1}
            max={boardSize}
            value={tileNumber}
            onChange={(e) => setTileNumber(Number(e.target.value))}
            className="input"
            style={{ width: 70 }}
          />
        </div>

        <input
          type="text"
          placeholder="Omschrijving van de opdracht"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input"
        />

        <input
          type="text"
          placeholder="OSRS Wiki-link voor de afbeelding (optioneel)"
          value={wikiUrl}
          onChange={(e) => setWikiUrl(e.target.value)}
          className="input"
        />

        <select
          value={effectType}
          onChange={(e) => setEffectType(e.target.value as any)}
          className="input"
        >
          <option value="geen">{EFFECT_LABELS.geen}</option>
          <option value="terug_dobbelsteen">{EFFECT_LABELS.terug_dobbelsteen}</option>
          <option value="terug_vast">{EFFECT_LABELS.terug_vast}</option>
        </select>

        {effectType === 'terug_vast' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label className="field-label" style={{ margin: 0 }}>Aantal vakjes terug:</label>
            <input
              type="number"
              min={1}
              value={effectValue}
              onChange={(e) => setEffectValue(Number(e.target.value))}
              className="input"
              style={{ width: 70 }}
            />
          </div>
        )}

        {effectType !== 'geen' && (
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={transferable}
              onChange={(e) => setTransferable(e.target.checked)}
            />
            Team mag deze straf uitdelen aan een ander team
          </label>
        )}

        <button type="submit" disabled={loading || !description.trim()} className="btn" style={{ alignSelf: 'flex-start' }}>
          {loading ? 'Bezig...' : 'Opdracht opslaan'}
        </button>
      </form>
    </div>
  )
}
