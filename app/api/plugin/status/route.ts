import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfileFromPluginToken } from '@/lib/pluginAuth'

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
            .select('id, item_id, item_name, required_quantity')
            .eq('tile_id', tile.id)

          for (const req of requirements ?? []) {
            const { data: progress } = await supabaseAdmin
              .from('team_item_progress')
              .select('quantity')
              .eq('requirement_id', req.id)
              .eq('team_id', team.id)
              .maybeSingle()

            items.push({
              itemId: req.item_id,
              itemName: req.item_name,
              requiredQuantity: req.required_quantity,
              progress: progress?.quantity ?? 0,
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
