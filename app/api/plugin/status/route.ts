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

  const results = []

  for (const participation of participations ?? []) {
    const { data: event } = await supabaseAdmin
      .from('events')
      .select('id, name, status, type')
      .eq('id', participation.event_id)
      .single()

    if (!event || event.status !== 'active' || event.type !== 'ganzebord') continue

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id, name, board_position')
      .eq('id', participation.team_id)
      .single()

    if (!team) continue

    let currentTile: any = null

    if (team.board_position > 0) {
      const { data: tile } = await supabaseAdmin
        .from('board_tiles')
        .select('id, description, effect_type')
        .eq('event_id', event.id)
        .eq('tile_number', team.board_position)
        .maybeSingle()

      if (tile) {
        let items: any[] = []

        if (tile.effect_type === 'verzamel_item') {
          const { data: requirements } = await supabaseAdmin
            .from('board_tile_requirements')
            .select('id, label, required_quantity')
            .eq('tile_id', tile.id)

          for (const req of requirements ?? []) {
            const { data: acceptedItems } = await supabaseAdmin
              .from('requirement_accepted_items')
              .select('item_id, item_name')
              .eq('requirement_id', req.id)

            const progress = await getSubmissionTotal(req.id, team.id)
            items.push({
              label: req.label,
              acceptedItems: (acceptedItems ?? []).map((a) => ({ itemId: a.item_id, itemName: a.item_name })),
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
