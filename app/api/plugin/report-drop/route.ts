import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfileFromPluginToken } from '@/lib/pluginAuth'

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

    // Matcht dit specifieke item met één van de benodigde items van dit vakje?
    const { data: requirement } = await supabaseAdmin
      .from('board_tile_requirements')
      .select('id, item_id, item_name, required_quantity')
      .eq('tile_id', tile.id)
      .eq('item_id', itemId)
      .maybeSingle()

    if (!requirement) continue

    const { data: existing } = await supabaseAdmin
      .from('team_item_progress')
      .select('id, quantity')
      .eq('requirement_id', requirement.id)
      .eq('team_id', team.id)
      .maybeSingle()

    const newQuantity = Math.min((existing?.quantity ?? 0) + quantity, requirement.required_quantity)

    if (existing) {
      await supabaseAdmin
        .from('team_item_progress')
        .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      await supabaseAdmin.from('team_item_progress').insert({
        requirement_id: requirement.id,
        team_id: team.id,
        quantity: newQuantity,
      })
    }

    // Check of ALLE benodigde items voor dit vakje nu compleet zijn (EN-logica)
    const { data: allRequirements } = await supabaseAdmin
      .from('board_tile_requirements')
      .select('id, required_quantity')
      .eq('tile_id', tile.id)

    const { data: allProgress } = await supabaseAdmin
      .from('team_item_progress')
      .select('requirement_id, quantity')
      .eq('team_id', team.id)
      .in('requirement_id', (allRequirements ?? []).map((r) => r.id))

    const progressByReq = Object.fromEntries((allProgress ?? []).map((p) => [p.requirement_id, p.quantity]))
    const tileFullyComplete = (allRequirements ?? []).every(
      (r) => (progressByReq[r.id] ?? 0) >= r.required_quantity
    )

    matchedCount++
    updates.push({
      team: team.name,
      tile: tile.tile_number,
      item: requirement.item_name ?? itemName,
      progress: `${newQuantity}/${requirement.required_quantity}`,
      tileFullyComplete,
    })
  }

  return NextResponse.json({ matched: matchedCount, updates })
}
