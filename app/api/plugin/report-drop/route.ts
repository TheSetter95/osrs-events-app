import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfileFromPluginToken } from '@/lib/pluginAuth'
import { getSubmissionTotal } from '@/lib/submissionTotals'
import { getBingoSubmissionTotal, syncBingoTileCompletion } from '@/lib/bingoSubmissionTotals'

export async function POST(request: Request) {
  const profile = await getProfileFromPluginToken(request)

  if (!profile) {
    return NextResponse.json({ error: 'Ongeldige of onbekende plugin-sleutel.' }, { status: 401 })
  }

  if (!profile.discord_id) {
    return NextResponse.json(
      { error: 'Dit profiel heeft geen gekoppeld Discord-account.' },
      { status: 400 }
    )
  }

  const { itemId, itemName, quantity } = await request.json()

  if (!itemId || !quantity || quantity < 1) {
    return NextResponse.json({ error: 'Ongeldige melding.' }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient()

  const { data: participations } = await supabaseAdmin
    .from('participants')
    .select('team_id, event_id')
    .eq('discord_id', profile.discord_id)
    .not('team_id', 'is', null)

  if (!participations || participations.length === 0) {
    return NextResponse.json({ matched: 0, message: 'Geen team gevonden voor dit account.' })
  }

  let matchedCount = 0
  const updates: any[] = []

  for (const participation of participations) {
    const { data: event } = await supabaseAdmin
      .from('events')
      .select('id, status, type')
      .eq('id', participation.event_id)
      .single()

    if (!event || event.status !== 'active') continue

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id, name, board_position')
      .eq('id', participation.team_id)
      .single()

    if (!team) continue

    // --- GANZEBORD: alleen het vakje waar het team NU op staat ---
    if (event.type === 'ganzebord' && team.board_position > 0) {
      const { data: tile } = await supabaseAdmin
        .from('board_tiles')
        .select('id, tile_number')
        .eq('event_id', event.id)
        .eq('tile_number', team.board_position)
        .eq('effect_type', 'verzamel_item')
        .maybeSingle()

      if (tile) {
        const { data: requirements } = await supabaseAdmin
          .from('board_tile_requirements')
          .select('id, label, required_quantity')
          .eq('tile_id', tile.id)

        const { data: acceptedItems } = await supabaseAdmin
          .from('requirement_accepted_items')
          .select('requirement_id, item_id, item_name')
          .in('requirement_id', (requirements ?? []).map((r) => r.id))

        const matchedAcceptedItem = (acceptedItems ?? []).find((a) => a.item_id === Number(itemId))
        const requirement = matchedAcceptedItem
          ? (requirements ?? []).find((r) => r.id === matchedAcceptedItem.requirement_id)
          : null

        if (requirement) {
          const currentTotal = await getSubmissionTotal(requirement.id, team.id)
          if (currentTotal < requirement.required_quantity) {
            const amountToLog = Math.min(quantity, requirement.required_quantity - currentTotal)

            await supabaseAdmin.from('item_submissions').insert({
              requirement_id: requirement.id,
              team_id: team.id,
              quantity: amountToLog,
              source: 'plugin',
              status: 'confirmed',
              submitted_by: profile.id,
            })

            const newTotal = currentTotal + amountToLog

            let tileFullyComplete = true
            for (const req of requirements ?? []) {
              const total = req.id === requirement.id ? newTotal : await getSubmissionTotal(req.id, team.id)
              if (total < req.required_quantity) {
                tileFullyComplete = false
                break
              }
            }

            matchedCount++
            updates.push({
              type: 'ganzebord',
              team: team.name,
              tile: tile.tile_number,
              item: requirement.label ?? matchedAcceptedItem?.item_name ?? itemName,
              progress: `${newTotal}/${requirement.required_quantity}`,
              tileFullyComplete,
            })
          }
        }
      }
    }

    // --- BINGO: alle nog-niet-voltooide verzameldoelen, geen positie-eis ---
    if (event.type === 'bingo') {
      const { data: bingoTiles } = await supabaseAdmin
        .from('bingo_tiles')
        .select('id, position')
        .eq('event_id', event.id)
        .eq('effect_type', 'verzamel_item')

      for (const bingoTile of bingoTiles ?? []) {
        // Al voltooid door dit team? Dan hoeft dit vakje niet meer gecheckt te worden
        const { data: existingCompletion } = await supabaseAdmin
          .from('bingo_completions')
          .select('id')
          .eq('tile_id', bingoTile.id)
          .eq('team_id', team.id)
          .maybeSingle()

        if (existingCompletion) continue

        const { data: requirements } = await supabaseAdmin
          .from('bingo_tile_requirements')
          .select('id, label, required_quantity')
          .eq('tile_id', bingoTile.id)

        const { data: acceptedItems } = await supabaseAdmin
          .from('bingo_requirement_accepted_items')
          .select('requirement_id, item_id, item_name')
          .in('requirement_id', (requirements ?? []).map((r) => r.id))

        const matchedAcceptedItem = (acceptedItems ?? []).find((a) => a.item_id === Number(itemId))
        const requirement = matchedAcceptedItem
          ? (requirements ?? []).find((r) => r.id === matchedAcceptedItem.requirement_id)
          : null

        if (!requirement) continue

        const currentTotal = await getBingoSubmissionTotal(requirement.id, team.id)
        if (currentTotal >= requirement.required_quantity) continue

        const amountToLog = Math.min(quantity, requirement.required_quantity - currentTotal)

        await supabaseAdmin.from('bingo_item_submissions').insert({
          requirement_id: requirement.id,
          team_id: team.id,
          quantity: amountToLog,
          source: 'plugin',
          status: 'confirmed',
          submitted_by: profile.id,
        })

        const newTotal = currentTotal + amountToLog
        const tileFullyComplete = await syncBingoTileCompletion(bingoTile.id, team.id)

        matchedCount++
        updates.push({
          type: 'bingo',
          team: team.name,
          tile: bingoTile.position,
          item: requirement.label ?? matchedAcceptedItem?.item_name ?? itemName,
          progress: `${newTotal}/${requirement.required_quantity}`,
          tileFullyComplete,
        })
      }
    }
  }

  return NextResponse.json({ matched: matchedCount, updates })
}
