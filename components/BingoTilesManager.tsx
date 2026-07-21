'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

type Tile = {
  id: string
  position: number
  title: string
  description: string | null
  image_url: string | null
  wiki_url: string | null
}

export default function BingoTilesManager({
  eventId,
  gridSize,
  initialTiles,
}: {
  eventId: string
  gridSize: number
  initialTiles: Tile[]
}) {
  const router = useRouter()
  const totalTiles = gridSize * gridSize
  const [position, setPosition] = useState(1)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [wikiUrl, setWikiUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/bingo-tiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, position, title, description, wikiUrl }),
    })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error ?? 'Er ging iets mis.')
      setLoading(false)
      return
    }

    setTitle('')
    setDescription('')
    setWikiUrl('')
    setLoading(false)
    router.refresh()
  }

  async function handleDelete(tileId: string) {
    if (!confirm('Dit vakje verwijderen?')) return
    await fetch(`/api/bingo-tiles/${tileId}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="panel-dark" style={{ marginTop: 20 }}>
      <strong>Vakjes / opdrachten</strong>
      <p className="text-muted" style={{ fontSize: 12, margin: '4px 0 12px' }}>
        {initialTiles.length} / {totalTiles} vakjes ingevuld
      </p>

      {initialTiles.length > 0 && (
        <ul style={{ paddingLeft: 18, marginBottom: 12 }}>
          {[...initialTiles]
            .sort((a, b) => a.position - b.position)
            .map((tile) => (
              <li key={tile.id} style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                {tile.image_url && (
                  <img src={tile.image_url} alt="" width={20} height={20} style={{ objectFit: 'contain' }} />
                )}
                <span>
                  <strong>Vak {tile.position}:</strong> {tile.title}
                  {tile.description && (
                    <span className="text-muted" style={{ fontSize: 12 }}> — {tile.description}</span>
                  )}
                  <button
                    onClick={() => handleDelete(tile.id)}
                    className="btn-link"
                    style={{ marginLeft: 8 }}
                  >
                    verwijder
                  </button>
                </span>
              </li>
            ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {error && <p className="error-text">{error}</p>}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label className="field-label" style={{ margin: 0 }}>
            Vakje nr.
          </label>
          <input
            type="number"
            min={1}
            max={totalTiles}
            value={position}
            onChange={(e) => setPosition(Number(e.target.value))}
            className="input"
            style={{ width: 70 }}
          />
        </div>

        <input
          type="text"
          placeholder="Titel (bv. 'Dragon warhammer')"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input"
        />

        <input
          type="text"
          placeholder="Extra omschrijving (optioneel)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input"
        />

        <input
          type="text"
          placeholder="OSRS Wiki-link voor de afbeelding (optioneel, bv. https://oldschool.runescape.wiki/w/Dragon_warhammer)"
          value={wikiUrl}
          onChange={(e) => setWikiUrl(e.target.value)}
          className="input"
        />

        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="btn"
          style={{ alignSelf: 'flex-start' }}
        >
          {loading ? 'Bezig...' : 'Vakje opslaan'}
        </button>
      </form>
    </div>
  )
}
