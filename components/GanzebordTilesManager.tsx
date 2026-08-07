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
  tile_number: number
  description: string
  effect_type: 'geen' | 'terug_dobbelsteen' | 'terug_vast' | 'vooruit_dobbelsteen' | 'verzamel_item'
  effect_value: number | null
  transferable: boolean
  image_url: string | null
  wiki_url: string | null
  glow_color: string | null
  requirements?: Requirement[]
}

const EFFECT_LABELS: Record<string, string> = {
  geen: 'Geen automatisch effect (alleen tekst-opdracht)',
  terug_dobbelsteen: 'Rol de dobbelsteen en ga dat aantal terug',
  terug_vast: 'Ga een vast aantal vakjes terug',
  vooruit_dobbelsteen: 'Rol de dobbelsteen nog eens en ga dat aantal vooruit',
  verzamel_item: 'Verzamel item(s) (via RuneLite-plugin, teamteller)',
}

// Eén "doel" (bv. "Verzamel een Visage") kan meerdere acceptabele item-varianten
// hebben (bv. de 4 verschillende Visages) — welke dan ook telt mee voor hetzelfde,
// gezamenlijke aantal.
type DraftItem = { itemId: string; itemName: string }
type DraftGroup = { label: string; quantity: number; items: DraftItem[] }

const EMPTY_DRAFT_ITEM: DraftItem = { itemId: '', itemName: '' }
const EMPTY_DRAFT_GROUP = (): DraftGroup => ({ label: '', quantity: 1, items: [{ ...EMPTY_DRAFT_ITEM }] })

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
  const [effectType, setEffectType] = useState<
    'geen' | 'terug_dobbelsteen' | 'terug_vast' | 'vooruit_dobbelsteen' | 'verzamel_item'
  >('geen')
  const [effectValue, setEffectValue] = useState(3)
  const [groups, setGroups] = useState<DraftGroup[]>([EMPTY_DRAFT_GROUP()])
  const [transferable, setTransferable] = useState(false)
  const [glowColor, setGlowColor] = useState('')
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
        glowColor,
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
    if (!confirm('Deze opdracht verwijderen?')) return
    await fetch(`/api/board-tiles/${tileId}`, { method: 'DELETE' })
    if (editingTileId === tileId) handleCancelEdit()
    router.refresh()
  }

  function handleEdit(tile: Tile) {
    setEditingTileId(tile.id)
    setTileNumber(tile.tile_number)
    setDescription(tile.description)
    setWikiUrl(tile.wiki_url ?? '')
    setEffectType(tile.effect_type)
    setEffectValue(tile.effect_value ?? 3)
    setTransferable(tile.transferable)
    setGlowColor(tile.glow_color ?? '')
    setGroups(
      tile.requirements && tile.requirements.length > 0
        ? tile.requirements.map((r) => ({
            label: r.label,
            quantity: r.required_quantity,
            items:
              r.accepted_items && r.accepted_items.length > 0
                ? r.accepted_items.map((a) => ({ itemId: String(a.item_id), itemName: a.item_name }))
                : [{ ...EMPTY_DRAFT_ITEM }],
          }))
        : [EMPTY_DRAFT_GROUP()]
    )
    document.getElementById('ganzebord-tile-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function handleCancelEdit() {
    setEditingTileId(null)
    setTileNumber(1)
    setDescription('')
    setWikiUrl('')
    setEffectType('geen')
    setEffectValue(3)
    setTransferable(false)
    setGlowColor('')
    setGroups([EMPTY_DRAFT_GROUP()])
  }

  return (
    <div className="panel-dark" style={{ marginTop: 20 }}>
      <strong>Opdrachten per vakje</strong>

      {initialTiles.length > 0 && (
        <ul style={{ marginTop: 8, paddingLeft: 18 }}>
          {[...initialTiles]
            .sort((a, b) => a.tile_number - b.tile_number)
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
                  <strong>Vak {tile.tile_number}:</strong> {tile.description}{' '}
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    ({EFFECT_LABELS[tile.effect_type]}
                    {tile.transferable ? ', uitdeelbaar' : ''})
                  </span>
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

      <form
        id="ganzebord-tile-form"
        onSubmit={handleSubmit}
        style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        {error && <p className="error-text">{error}</p>}

        {editingTileId && (
          <p style={{ fontSize: 13, color: 'var(--gold-light)', margin: 0 }}>
            ✏️ Je bewerkt nu vak {tileNumber} — sla op om de wijzigingen te bevestigen.
          </p>
        )}

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
            disabled={!!editingTileId}
          />
          {editingTileId && (
            <span className="text-muted" style={{ fontSize: 12 }}>
              (vakjenummer kan niet gewijzigd worden — verwijder en maak opnieuw aan als je 'm wil verplaatsen)
            </span>
          )}
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
          <option value="vooruit_dobbelsteen">{EFFECT_LABELS.vooruit_dobbelsteen}</option>
          <option value="verzamel_item">{EFFECT_LABELS.verzamel_item}</option>
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

        {effectType === 'verzamel_item' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>
              Het team moet <strong>elk van onderstaande doelen</strong> behalen terwijl
              ze op dit vakje staan. Een doel kan één vast item zijn, of meerdere
              acceptabele varianten — bv. "Verzamel een Visage" met alle 4 de Visages
              als optie; welke dan ook telt mee voor hetzelfde aantal.
            </p>

            {groups.map((group, groupIndex) => (
              <div key={groupIndex} className="panel-dark" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={group.label}
                    onChange={(e) => updateGroup(groupIndex, { label: e.target.value })}
                    placeholder="Naam van dit doel (optioneel, bv. 'Visage')"
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
                    <button
                      type="button"
                      onClick={() => removeGroup(groupIndex)}
                      className="btn-link"
                      style={{ fontSize: 12 }}
                    >
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
              </div>
            ))}

            <button
              type="button"
              onClick={addGroup}
              className="btn btn-secondary btn-sm"
              style={{ alignSelf: 'flex-start' }}
            >
              + Nog een verzameldoel toevoegen
            </button>
          </div>
        )}

        {effectType !== 'geen' && effectType !== 'verzamel_item' && (
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={transferable}
              onChange={(e) => setTransferable(e.target.checked)}
            />
            Team mag dit {effectType === 'vooruit_dobbelsteen' ? 'voordeel' : 'nadeel'} uitdelen aan een ander team
          </label>
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
                style={{
                  width: 36,
                  height: 32,
                  padding: 0,
                  border: '1px solid var(--gold-dark)',
                  borderRadius: 4,
                  background: 'none',
                  cursor: 'pointer',
                }}
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
        <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>
          De gloed is ook zichtbaar terwijl het vakje nog verborgen is — een hint voor
          deelnemers dat er iets bijzonders op dit vakje staat.
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={loading || !description.trim()} className="btn">
            {loading ? 'Bezig...' : editingTileId ? 'Wijzigingen opslaan' : 'Opdracht opslaan'}
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
