import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfileFromPluginToken } from '@/lib/pluginAuth'
import { getSubmissionTotal } from '@/lib/submissionTotals'

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

    if (!event || event.status !== 'active' || event.type !== 'ganzebord') continue

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id, name, board_position')
      .eq('id', participation.team_id)
      .single()

    if (!team || team.board_position <= 0) continue

    // Het vakje waar het team NU op staat
    const { data: tile } = await supabaseAdmin
      .from('board_tiles')
      .select('id, tile_number, effect_type')
      .eq('event_id', event.id)
      .eq('tile_number', team.board_position)
      .eq('effect_type', 'verzamel_item')
      .maybeSingle()

    if (!tile) continue

    // Alle doelen op dit vakje, met hun acceptabele item-varianten
    const { data: requirements } = await supabaseAdmin
      .from('board_tile_requirements')
      .select('id, label, required_quantity')
      .eq('tile_id', tile.id)

    if (!requirements || requirements.length === 0) continue

    const { data: acceptedItems } = await supabaseAdmin
      .from('requirement_accepted_items')
      .select('requirement_id, item_id, item_name')
      .in('requirement_id', requirements.map((r) => r.id))

    const matchedAcceptedItem = (acceptedItems ?? []).find((a) => a.item_id === Number(itemId))
    if (!matchedAcceptedItem) continue

    const requirement = requirements.find((r) => r.id === matchedAcceptedItem.requirement_id)
    if (!requirement) continue

    const currentTotal = await getSubmissionTotal(requirement.id, team.id)
    if (currentTotal >= requirement.required_quantity) continue // al compleet, niets te melden

    const amountToLog = Math.min(quantity, requirement.required_quantity - currentTotal)

    await supabaseAdmin.from('item_submissions').insert({
      requirement_id: requirement.id,
      team_id: team.id,
      quantity: amountToLog,
      source: 'plugin',
      status: 'confirmed', // plugin-data vertrouwen we automatisch
      submitted_by: profile.id,
    })

    const newTotal = currentTotal + amountToLog

    // Check of ALLE benodigde doelen voor dit vakje nu compleet zijn (EN-logica)
    let tileFullyComplete = true
    for (const req of requirements) {
      const total = req.id === requirement.id ? newTotal : await getSubmissionTotal(req.id, team.id)
      if (total < req.required_quantity) {
        tileFullyComplete = false
        break
      }
    }

    matchedCount++
    updates.push({
      team: team.name,
      tile: tile.tile_number,
      item: requirement.label ?? matchedAcceptedItem.item_name ?? itemName,
      progress: `${newTotal}/${requirement.required_quantity}`,
      tileFullyComplete,
    })
  }

  return NextResponse.json({ matched: matchedCount, updates })
}
