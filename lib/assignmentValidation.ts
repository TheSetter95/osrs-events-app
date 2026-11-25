import { MAX_QUANTITY } from '@/lib/limits'

export const GAME_TYPES = ['bingo', 'ganzebord', 'miljoenenjacht'] as const
export const KINDS = ['verzamel_item', 'tekst'] as const
export const DIFFICULTIES = ['makkelijk', 'gemiddeld', 'moeilijk'] as const
export const MEMBERSHIPS = ['f2p', 'p2p', 'beide'] as const

export const GAME_TYPE_LABELS: Record<string, string> = {
  bingo: 'Bingo',
  ganzebord: 'Ganzebord',
  miljoenenjacht: 'Miljoenenjacht',
}

export type RequirementGroup = {
  label: string
  quantity: number
  items: { itemId: number; itemName: string }[]
}

export type AssignmentInput = {
  title: string
  description: string
  game_types: string[]
  kind: string
  requirement_groups: RequirementGroup[]
  wiki_url: string | null
  difficulty: string | null
  membership: string
  tags: string[]
}

type Result = { ok: true; value: AssignmentInput } | { ok: false; error: string }

const MAX_GROUPS = 10
const MAX_ITEMS_PER_GROUP = 20
const MAX_TAGS = 10

// Controleert en schoont de invoer van het opdrachtenformulier op. Wordt door
// zowel het aanmaken als het wijzigen gebruikt, zodat de regels op één plek staan.
export function validateAssignment(body: any): Result {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Ongeldige invoer.' }
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (title.length < 1 || title.length > 100) {
    return { ok: false, error: 'Geef een titel van maximaal 100 tekens.' }
  }

  const description = typeof body.description === 'string' ? body.description.trim() : ''
  if (description.length < 1 || description.length > 1000) {
    return { ok: false, error: 'Geef een omschrijving van maximaal 1000 tekens.' }
  }

  const gameTypes: string[] = Array.isArray(body.game_types)
    ? [...new Set(body.game_types.filter((g: unknown) => typeof g === 'string'))] as string[]
    : []
  if (gameTypes.length === 0 || !gameTypes.every((g) => (GAME_TYPES as readonly string[]).includes(g))) {
    return { ok: false, error: 'Kies minstens één spelvorm (Bingo, Ganzebord of Miljoenenjacht).' }
  }

  const kind = body.kind
  if (!(KINDS as readonly string[]).includes(kind)) {
    return { ok: false, error: 'Ongeldig type opdracht.' }
  }

  const membership = body.membership ?? 'beide'
  if (!(MEMBERSHIPS as readonly string[]).includes(membership)) {
    return { ok: false, error: 'Ongeldige keuze voor F2P/P2P.' }
  }

  let difficulty: string | null = null
  if (body.difficulty !== undefined && body.difficulty !== null && body.difficulty !== '') {
    if (!(DIFFICULTIES as readonly string[]).includes(body.difficulty)) {
      return { ok: false, error: 'Ongeldige moeilijkheid.' }
    }
    difficulty = body.difficulty
  }

  let wikiUrl: string | null = null
  if (typeof body.wiki_url === 'string' && body.wiki_url.trim()) {
    try {
      const parsed = new URL(body.wiki_url.trim())
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid')
      if (body.wiki_url.trim().length > 300) throw new Error('too long')
      wikiUrl = body.wiki_url.trim()
    } catch {
      return { ok: false, error: 'De wiki-link is geen geldige link.' }
    }
  }

  const tags: string[] = Array.isArray(body.tags)
    ? [
        ...new Set(
          body.tags
            .filter((t: unknown) => typeof t === 'string')
            .map((t: string) => t.trim().toLowerCase())
            .filter((t: string) => t.length > 0 && t.length <= 30)
        ),
      ] as string[]
    : []
  if (tags.length > MAX_TAGS) {
    return { ok: false, error: `Gebruik maximaal ${MAX_TAGS} labels.` }
  }

  let groups: RequirementGroup[] = []
  if (kind === 'verzamel_item') {
    const raw = body.requirement_groups
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_GROUPS) {
      return { ok: false, error: `Voeg 1 tot ${MAX_GROUPS} verzameldoelen toe.` }
    }
    for (const g of raw) {
      const quantity = Number(g?.quantity)
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
        return { ok: false, error: 'Elk doel heeft een geldig aantal (heel getal) nodig.' }
      }
      if (!Array.isArray(g?.items) || g.items.length === 0 || g.items.length > MAX_ITEMS_PER_GROUP) {
        return { ok: false, error: 'Elk doel heeft minstens één item nodig.' }
      }
      const items: { itemId: number; itemName: string }[] = []
      for (const item of g.items) {
        const itemId = Number(item?.itemId)
        const itemName = typeof item?.itemName === 'string' ? item.itemName.trim() : ''
        if (!Number.isInteger(itemId) || itemId < 1 || itemName.length < 1 || itemName.length > 100) {
          return { ok: false, error: 'Elk item heeft een geldig item-ID (getal) en een naam nodig.' }
        }
        items.push({ itemId, itemName })
      }
      const label =
        typeof g.label === 'string' && g.label.trim()
          ? g.label.trim().slice(0, 100)
          : items.map((i) => i.itemName).join(' of ').slice(0, 100)
      groups.push({ label, quantity, items })
    }
  }

  return {
    ok: true,
    value: {
      title,
      description,
      game_types: gameTypes,
      kind,
      requirement_groups: groups,
      wiki_url: wikiUrl,
      difficulty,
      membership,
      tags,
    },
  }
}
