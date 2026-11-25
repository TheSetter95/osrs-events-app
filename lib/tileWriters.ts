import { getWikiImageUrl } from '@/lib/osrsWiki'
import type { RequirementGroup } from '@/lib/assignmentValidation'

export type GameKind = 'bingo' | 'ganzebord' | 'miljoenenjacht'

export type LibraryAssignment = {
  title: string
  description: string
  wiki_url: string | null
  kind: string
  requirement_groups: RequirementGroup[]
}

// Per spelvorm: in welke tabellen komt een vakje/opdracht en hoe heten de kolommen?
const TABLES = {
  bingo: {
    tiles: 'bingo_tiles',
    positionColumn: 'position',
    requirements: 'bingo_tile_requirements',
    requirementParent: 'tile_id',
    accepted: 'bingo_requirement_accepted_items',
  },
  ganzebord: {
    tiles: 'board_tiles',
    positionColumn: 'tile_number',
    requirements: 'board_tile_requirements',
    requirementParent: 'tile_id',
    accepted: 'requirement_accepted_items',
  },
  miljoenenjacht: {
    tiles: 'mj_assignments',
    positionColumn: 'position',
    requirements: 'mj_assignment_requirements',
    requirementParent: 'assignment_id',
    accepted: 'mj_requirement_accepted_items',
  },
} as const

// Zet een bibliotheek-opdracht als KOPIE in een vakje van een event (geen koppeling:
// later wijzigen of verwijderen in de bibliotheek heeft geen effect op lopende events).
// `supabase` is de gewone gebruikers-client, dus RLS bepaalt of je dit mag.
export async function writeAssignmentToSlot(
  supabase: any,
  game: GameKind,
  eventId: string,
  slot: number,
  a: LibraryAssignment,
  imageUrl: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = TABLES[game]
  const effectType = a.kind === 'verzamel_item' ? 'verzamel_item' : 'geen'

  const base: Record<string, unknown> = {
    event_id: eventId,
    [t.positionColumn]: slot,
    wiki_url: a.wiki_url,
    image_url: imageUrl,
    effect_type: effectType,
  }

  if (game === 'ganzebord') {
    // Ganzebord kent geen aparte titel: titel en omschrijving worden één tekst.
    base.description = `${a.title}: ${a.description}`.slice(0, 1000)
    base.effect_value = null
    base.transferable = false
    base.glow_color = null
  } else {
    base.title = a.title
    base.description = a.description
    base.glow_color = null
  }

  const { data: tile, error } = await supabase
    .from(t.tiles)
    .upsert(base, { onConflict: `event_id,${t.positionColumn}` })
    .select('id')
    .single()

  if (error || !tile) {
    return { ok: false, error: 'Vakje opslaan mislukt. Ben je organizer/owner?' }
  }

  await supabase.from(t.requirements).delete().eq(t.requirementParent, tile.id)

  if (effectType !== 'verzamel_item' || a.requirement_groups.length === 0) {
    return { ok: true }
  }

  const { data: reqs, error: reqError } = await supabase
    .from(t.requirements)
    .insert(
      a.requirement_groups.map((g) => ({
        [t.requirementParent]: tile.id,
        label: g.label,
        required_quantity: g.quantity,
      }))
    )
    .select('id, label')

  if (reqError || !reqs || reqs.length !== a.requirement_groups.length) {
    return { ok: false, error: 'Doelen opslaan mislukt.' }
  }

  // Insert ... returning geeft de rijen in invoegvolgorde terug.
  const itemRows = a.requirement_groups.flatMap((g, i) =>
    g.items.map((item) => ({
      requirement_id: reqs[i].id,
      item_id: item.itemId,
      item_name: item.itemName,
    }))
  )

  const { error: itemsError } = await supabase.from(t.accepted).insert(itemRows)
  if (itemsError) {
    return { ok: false, error: 'Items opslaan mislukt.' }
  }

  return { ok: true }
}

export async function wikiImageFor(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    return await getWikiImageUrl(url)
  } catch {
    return null
  }
}
