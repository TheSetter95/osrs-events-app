import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfileFromPluginToken } from '@/lib/pluginAuth'
import { getSubmissionTotal } from '@/lib/submissionTotals'

export async function GET(request: Request) {
  const profile = await getProfileFromPluginToken(request)

  if (!profile) {
    return NextResponse.json({ error: 'Ongeldige of onbekende plugin-sleutel.' }, { status: 401 })
  }

  if (!profile.discord_id) {
    return NextResponse.json({ teams: [] })
  }

  const supabaseAdmin = createAdminClient()

  const { data: participations } = await supabaseAdmin
    .from('participants')
    .select('team_id, event_id')
    .eq('discord_id', profile.discord_id)
    .not('team_id', 'is', null)

  if (!participations || participations.length === 0) {
    return NextResponse.json({ teams: [] })
  }

  // Gebundeld ophalen in plaats van per deelname meerdere queries.
  const eventIds = [...new Set(participations.map((p) => p.event_id))]
  const teamIds = [...new Set(participations.map((p) => p.team_id as string))]

  const [{ data: events }, { data: teamRows }] = await Promise.all([
    supabaseAdmin
      .from('events')
      .select('id, name, status, type')
      .in('id', eventIds)
      .eq('status', 'active')
      .eq('type', 'ganzebord'),
    supabaseAdmin.from('teams').select('id, name, board_position').in('id', teamIds),
  ])

  if (!events || events.length === 0) {
    return NextResponse.json({ teams: [] })
  }

  const eventById = new Map(events.map((e) => [e.id, e]))
  const teamById = new Map((teamRows ?? []).map((t) => [t.id, t]))

  const relevant = participations.filter(
    (p) => eventById.has(p.event_id) && teamById.has(p.team_id as string)
  )

  const activeEventIds = [...new Set(relevant.map((p) => p.event_id))]
  const { data: tiles } = await supabaseAdmin
    .from('board_tiles')
    .select('id, event_id, tile_number, description, effect_type')
    .in('event_id', activeEventIds)

  // Welke vakjes staan teams nu op, en welke daarvan zijn verzamel-vakjes?
  const currentTileFor = (eventId: string, position: number) =>
    (tiles ?? []).find((t) => t.event_id === eventId && t.tile_number === position)

  const collectTileIds = [
    ...new Set(
      relevant
        .map((p) => {
          const team = teamById.get(p.team_id as string)!
          const tile = team.board_position > 0 ? currentTileFor(p.event_id, team.board_position) : null
          return tile && tile.effect_type === 'verzamel_item' ? tile.id : null
        })
        .filter(Boolean) as string[]
    ),
  ]

  const { data: requirements } = collectTileIds.length
    ? await supabaseAdmin
        .from('board_tile_requirements')
        .select('id, tile_id, label, required_quantity')
        .in('tile_id', collectTileIds)
    : { data: [] as any[] }

  const { data: acceptedItems } = (requirements ?? []).length
    ? await supabaseAdmin
        .from('requirement_accepted_items')
        .select('requirement_id, item_id, item_name')
        .in('requirement_id', (requirements ?? []).map((r: any) => r.id))
    : { data: [] as any[] }

  const results = []

  for (const participation of relevant) {
    const event = eventById.get(participation.event_id)!
    const team = teamById.get(participation.team_id as string)!

    let currentTile: any = null
    const tile = team.board_position > 0 ? currentTileFor(event.id, team.board_position) : null

    if (tile) {
      const items: any[] = []
      if (tile.effect_type === 'verzamel_item') {
        for (const req of (requirements ?? []).filter((r: any) => r.tile_id === tile.id)) {
          const progress = await getSubmissionTotal(req.id, team.id)
          items.push({
            label: req.label,
            acceptedItems: (acceptedItems ?? [])
              .filter((a: any) => a.requirement_id === req.id)
              .map((a: any) => ({ itemId: a.item_id, itemName: a.item_name })),
            requiredQuantity: req.required_quantity,
            progress,
          })
        }
      }

      currentTile = {
        description: tile.description,
        effectType: tile.effect_type,
        items,
      }
    }

    results.push({
      eventName: event.name,
      teamName: team.name,
      position: team.board_position,
      currentTile,
    })
  }

  return NextResponse.json({ teams: results })
}
