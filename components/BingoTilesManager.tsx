'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

type AcceptedItem = { item_id: number; item_name: string }

type Requirement = {
  id?: string
  label: string
  required_quantity: number
  accepted_items?: AcceptedItem[]
}

type Tile = {
  id: string
  position: number
  title: string
  description: string | null
  image_url: string | null
  wiki_url: string | null
  glow_color: string | null
  effect_type: 'geen' | 'verzamel_item'
  requirements?: Requirement[]
}

type DraftItem = { itemId: string; itemName: string }
type DraftGroup = { label: string; quantity: number; useAlternatives: boolean; items: DraftItem[] }

const EMPTY_DRAFT_ITEM: DraftItem = { itemId: '', itemName: '' }
const EMPTY_DRAFT_GROUP = (): DraftGroup => ({
  label: '',
  quantity: 1,
  useAlternatives: false,
  items: [{ ...EMPTY_DRAFT_ITEM }],
})

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
  const [glowColor, setGlowColor] = useState('')
  const [effectType, setEffectType] = useState<'geen' | 'verzamel_item'>('geen')
  const [groups, setGroups] = useState<DraftGroup[]>([EMPTY_DRAFT_GROUP()])
  const [editingTileId, setEditingTileId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateGroup(groupIndex: number, patch: Partial<DraftGroup>) {
    setGroups((gs) => gs.map((g, i) => (i === groupIndex ? { ...g, ...patch } : g)))
  }
  function addGroup() {
    setGroups((gs) => [...gs, EMPTY_DRAFT_GROUP()])
  }
  function removeGroup(groupIndex: number) {
    setGroups((gs) => gs.filter((_, i) => i !== groupIndex))
  }
  function updateItem(groupIndex: number, itemIndex: number, patch: Partial<DraftItem>) {
    setGroups((gs) =>
      gs.map((g, i) =>
        i === groupIndex
          ? { ...g, items: g.items.map((it, j) => (j === itemIndex ? { ...it, ...patch } : it)) }
          : g
      )
    )
  }
  function addItemToGroup(groupIndex: number) {
    setGroups((gs) =>
      gs.map((g, i) => (i === groupIndex ? { ...g, items: [...g.items, { ...EMPTY_DRAFT_ITEM }] } : g))
    )
  }
  function removeItemFromGroup(groupIndex: number, itemIndex: number) {
    setGroups((gs) =>
      gs.map((g, i) => (i === groupIndex ? { ...g, items: g.items.filter((_, j) => j !== itemIndex) } : g))
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/bingo-tiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        position,
        title,
        description,
        wikiUrl,
        glowColor,
        effectType,
        requirementGroups:
          effectType === 'verzamel_item'
            ? groups.map((g) => ({
                label: g.label,
                quantity: g.quantity,
                items: g.items.map((it) => ({ itemId: it.itemId, itemName: it.itemName })),
              }))
            : null,
      }),
    })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error ?? 'Er ging iets mis.')
      setLoading(false)
      return
    }

    handleCancelEdit()
    setLoading(false)
    router.refresh()
  }

  async function handleDelete(tileId: string) {
    if (!confirm('Dit vakje verwijderen?')) return
    await fetch(`/api/bingo-tiles/${tileId}`, { method: 'DELETE' })
    if (editingTileId === tileId) handleCancelEdit()
    router.refresh()
  }

  function handleEdit(tile: Tile) {
    setEditingTileId(tile.id)
    setPosition(tile.position)
    setTitle(tile.title)
    setDescription(tile.description ?? '')
    setWikiUrl(tile.wiki_url ?? '')
    setGlowColor(tile.glow_color ?? '')
    setEffectType(tile.effect_type ?? 'geen')
    setGroups(
      tile.requirements && tile.requirements.length > 0
        ? tile.requirements.map((r) => ({
            label: r.label,
            quantity: r.required_quantity,
            useAlternatives: (r.accepted_items?.length ?? 0) > 1,
            items:
              r.accepted_items && r.accepted_items.length > 0
                ? r.accepted_items.map((a) => ({ itemId: String(a.item_id), itemName: a.item_name }))
                : [{ ...EMPTY_DRAFT_ITEM }],
          }))
        : [EMPTY_DRAFT_GROUP()]
    )
    document.getElementById('bingo-tile-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function handleCancelEdit() {
    setEditingTileId(null)
    setPosition(1)
    setTitle('')
    setDescription('')
    setWikiUrl('')
    setGlowColor('')
    setEffectType('geen')
    setGroups([EMPTY_DRAFT_GROUP()])
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
              <li key={tile.id} style={{ marginBottom: 6, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                {tile.image_url && (
                  <img src={tile.image_url} alt="" width={20} height={20} style={{ objectFit: 'contain', marginTop: 2 }} />
                )}
                {tile.glow_color && (
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: tile.glow_color,
                      boxShadow: `0 0 6px 2px ${tile.glow_color}`,
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  />
                )}
                <span>
                  <strong>Vak {tile.position}:</strong> {tile.title}
                  {tile.description && (
                    <span className="text-muted" style={{ fontSize: 12 }}> — {tile.description}</span>
                  )}
                  <button onClick={() => handleEdit(tile)} className="btn-link" style={{ marginLeft: 8, color: 'var(--gold-light)' }}>
                    bewerken
                  </button>
                  <button onClick={() => handleDelete(tile.id)} className="btn-link" style={{ marginLeft: 8 }}>
                    verwijder
                  </button>
                  {tile.effect_type === 'verzamel_item' && tile.requirements && tile.requirements.length > 0 && (
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12 }} className="text-muted">
                      {tile.requirements.map((r, i) => (
                        <li key={r.id ?? i}>
                          {r.required_quantity}x {r.label}
                          {r.accepted_items && r.accepted_items.length > 1 && (
                            <> (elk van: {r.accepted_items.map((a) => a.item_name).join(', ')})</>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </span>
              </li>
            ))}
        </ul>
      )}

      <form id="bingo-tile-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {error && <p className="error-text">{error}</p>}

        {editingTileId && (
          <p style={{ fontSize: 13, color: 'var(--gold-light)', margin: 0 }}>
            ✏️ Je bewerkt nu vak {position} — sla op om de wijzigingen te bevestigen.
          </p>
        )}

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
            disabled={!!editingTileId}
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
          placeholder="OSRS Wiki-link voor de afbeelding (optioneel)"
          value={wikiUrl}
          onChange={(e) => setWikiUrl(e.target.value)}
          className="input"
        />

        <select value={effectType} onChange={(e) => setEffectType(e.target.value as any)} className="input">
          <option value="geen">Geen automatisch effect (organizer vinkt handmatig af)</option>
          <option value="verzamel_item">Verzamel item(s) (via RuneLite-plugin/screenshot, teamteller)</option>
        </select>

        {effectType === 'verzamel_item' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>
              Het team moet <strong>elk van onderstaande doelen</strong> behalen om dit
              vakje te voltooien — een team mag hier op elk moment aan werken, ongeacht
              andere vakjes.
            </p>

            {groups.map((group, groupIndex) => (
              <div key={groupIndex} className="panel-dark" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {!group.useAlternatives ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="number"
                      min={1}
                      value={group.items[0]?.itemId ?? ''}
                      onChange={(e) => updateItem(groupIndex, 0, { itemId: e.target.value })}
                      placeholder="Item-ID"
                      className="input"
                      style={{ width: 90 }}
                    />
                    <input
                      type="text"
                      value={group.items[0]?.itemName ?? ''}
                      onChange={(e) => updateItem(groupIndex, 0, { itemName: e.target.value })}
                      placeholder="Naam van het item"
                      className="input"
                      style={{ flex: 1, minWidth: 120 }}
                    />
                    <label className="field-label" style={{ margin: 0 }}>Aantal:</label>
                    <input
                      type="number"
                      min={1}
                      value={group.quantity}
                      onChange={(e) => updateGroup(groupIndex, { quantity: Number(e.target.value) })}
                      className="input"
                      style={{ width: 70 }}
                    />
                    {groups.length > 1 && (
                      <button type="button" onClick={() => removeGroup(groupIndex)} className="btn-link" style={{ fontSize: 12 }}>
                        verwijder
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        value={group.label}
                        onChange={(e) => updateGroup(groupIndex, { label: e.target.value })}
                        placeholder="Naam van dit doel (bv. 'Visage')"
                        className="input"
                        style={{ flex: 1, minWidth: 140 }}
                      />
                      <label className="field-label" style={{ margin: 0 }}>Aantal nodig:</label>
                      <input
                        type="number"
                        min={1}
                        value={group.quantity}
                        onChange={(e) => updateGroup(groupIndex, { quantity: Number(e.target.value) })}
                        className="input"
                        style={{ width: 70 }}
                      />
                      {groups.length > 1 && (
                        <button type="button" onClick={() => removeGroup(groupIndex)} className="btn-link" style={{ fontSize: 12 }}>
                          dit doel verwijderen
                        </button>
                      )}
                    </div>

                    <div style={{ paddingLeft: 12, borderLeft: '2px solid rgba(184,134,59,0.3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span className="text-muted" style={{ fontSize: 11 }}>
                        Acceptabele item(s) voor dit doel — welke dan ook telt mee:
                      </span>
                      {group.items.map((item, itemIndex) => (
                        <div key={itemIndex} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            type="number"
                            min={1}
                            value={item.itemId}
                            onChange={(e) => updateItem(groupIndex, itemIndex, { itemId: e.target.value })}
                            placeholder="Item-ID"
                            className="input"
                            style={{ width: 90 }}
                          />
                          <input
                            type="text"
                            value={item.itemName}
                            onChange={(e) => updateItem(groupIndex, itemIndex, { itemName: e.target.value })}
                            placeholder="Naam van het item"
                            className="input"
                            style={{ flex: 1, minWidth: 120 }}
                          />
                          {group.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItemFromGroup(groupIndex, itemIndex)}
                              className="btn-link"
                              style={{ fontSize: 12 }}
                            >
                              verwijder
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addItemToGroup(groupIndex)}
                        className="btn btn-secondary btn-sm"
                        style={{ alignSelf: 'flex-start' }}
                      >
                        + Alternatief item toevoegen
                      </button>
                    </div>
                  </>
                )}

                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={group.useAlternatives}
                    onChange={(e) => {
                      const checked = e.target.checked
                      updateGroup(groupIndex, {
                        useAlternatives: checked,
                        items: checked ? group.items : [group.items[0] ?? { ...EMPTY_DRAFT_ITEM }],
                      })
                    }}
                  />
                  Alternatieve items toestaan (bv. "elk van de 4 Visages telt mee")
                </label>
              </div>
            ))}

            <button type="button" onClick={addGroup} className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
              + Nog een verzameldoel toevoegen
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={!!glowColor}
              onChange={(e) => setGlowColor(e.target.checked ? '#ffd700' : '')}
            />
            Gloed geven aan dit vakje
          </label>
          {glowColor && (
            <>
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(glowColor) ? glowColor : '#ffd700'}
                onChange={(e) => setGlowColor(e.target.value)}
                style={{ width: 36, height: 32, padding: 0, border: '1px solid var(--gold-dark)', borderRadius: 4, background: 'none', cursor: 'pointer' }}
              />
              <input
                type="text"
                value={glowColor}
                onChange={(e) => setGlowColor(e.target.value)}
                placeholder="#ffd700"
                className="input"
                style={{ width: 100 }}
              />
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={loading || !title.trim()} className="btn" style={{ alignSelf: 'flex-start' }}>
            {loading ? 'Bezig...' : editingTileId ? 'Wijzigingen opslaan' : 'Vakje opslaan'}
          </button>
          {editingTileId && (
            <button type="button" onClick={handleCancelEdit} className="btn btn-secondary">
              Annuleren
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
