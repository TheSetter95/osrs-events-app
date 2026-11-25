import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfileFromPluginToken } from '@/lib/pluginAuth'

// Geeft de lijst item-ID's terug die in de ACTIEVE events van deze speler
// voorkomen. De plugin haalt dit om de paar minuten op en meldt daarna alleen
// nog drops die op deze lijst staan (in plaats van elke drop van elke kill).
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const profile = await getProfileFromPluginToken(request)
  if (!profile) {
    return NextResponse.json({ error: 'Ongeldige of onbekende plugin-sleutel.' }, { status: 401 })
  }
  if (!profile.discord_id) {
    return NextResponse.json({ itemIds: [], ttlSeconds: 300 })
  }

  const supabaseAdmin = createAdminClient()

  const { data: participations } = await supabaseAdmin
    .from('participants')
    .select('event_id')
    .eq('discord_id', profile.discord_id)
    .not('team_id', 'is', null)

  const eventIds = [...new Set((participations ?? []).map((p) => p.event_id))]
  if (eventIds.length === 0) {
    return NextResponse.json({ itemIds: [], ttlSeconds: 300 })
  }

  const { data: events } = await supabaseAdmin
    .from('events')
    .select('id, type')
    .in('id', eventIds)
    .eq('status', 'active')

  const idsOfType = (type: string) => (events ?? []).filter((e) => e.type === type).map((e) => e.id)
  const itemIds = new Set<number>()

  async function collect(
    parentIds: string[],
    parentTable: string,
    parentKey: string,
    childTable: string,
    childKey: string,
    acceptedTable: string,
    acceptedKey: string
  ) {
    if (parentIds.length === 0) return
    const { data: parents } = await supabaseAdmin.from(parentTable).select('id').in(parentKey, parentIds)
    const parentRows = (parents ?? []).map((p: any) => p.id)
    if (parentRows.length === 0) return

    let ownerIds = parentRows
    let key = acceptedKey
    if (childTable) {
      const { data: children } = await supabaseAdmin.from(childTable).select('id').in(childKey, parentRows)
      ownerIds = (children ?? []).map((c: any) => c.id)
      if (ownerIds.length === 0) return
    }
    const { data: accepted } = await supabaseAdmin.from(acceptedTable).select('item_id').in(key, ownerIds)
    for (const a of accepted ?? []) itemIds.add(Number((a as any).item_id))
  }

  await Promise.all([
    // Ganzebord: tiles -> requirements -> accepted items
    collect(idsOfType('ganzebord'), 'board_tiles', 'event_id', 'board_tile_requirements', 'tile_id',
      'requirement_accepted_items', 'requirement_id'),
    // Bingo
    collect(idsOfType('bingo'), 'bingo_tiles', 'event_id', 'bingo_tile_requirements', 'tile_id',
      'bingo_requirement_accepted_items', 'requirement_id'),
    // Miljoenenjacht
    collect(idsOfType('miljoenenjacht'), 'mj_assignments', 'event_id', 'mj_assignment_requirements', 'assignment_id',
      'mj_requirement_accepted_items', 'requirement_id'),
    // Losse Races: races -> accepted items
    collect(idsOfType('droprace'), 'drop_races', 'event_id', '', '', 'drop_race_accepted_items', 'race_id'),
    // Gauntlet: stages -> accepted items
    collect(idsOfType('gauntlet'), 'gauntlet_stages', 'event_id', '', '', 'gauntlet_stage_accepted_items', 'stage_id'),
  ])

  return NextResponse.json({ itemIds: [...itemIds], ttlSeconds: 300 })
}
