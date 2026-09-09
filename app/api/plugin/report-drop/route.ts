import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfileFromPluginToken } from '@/lib/pluginAuth'
import { getSubmissionTotal } from '@/lib/submissionTotals'
import { getBingoSubmissionTotal, syncBingoTileCompletion } from '@/lib/bingoSubmissionTotals'
import { recomputeRaceStatus } from '@/lib/recomputeRaceStatus'
import { getCurrentStageOrder } from '@/lib/gauntletProgress'

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
    .select('id, team_id, event_id')
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
      .select('id, status, type, config')
      .eq('id', participation.event_id)
      .single()

    if (!event || event.status !== 'active') continue

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id, name, board_position')
      .eq('id', participation.team_id)
      .single()

    if (!team) continue

    // --- GANZEBORD ---
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
            matchedCount++
            updates.push({ type: 'ganzebord', team: team.name, item: requirement.label })
          }
        }
      }
    }

    // --- BINGO ---
    if (event.type === 'bingo') {
      const { data: bingoTiles } = await supabaseAdmin
        .from('bingo_tiles')
        .select('id')
        .eq('event_id', event.id)
        .eq('effect_type', 'verzamel_item')

      for (const bingoTile of bingoTiles ?? []) {
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
        await syncBingoTileCompletion(bingoTile.id, team.id)
        matchedCount++
        updates.push({ type: 'bingo', team: team.name, item: requirement.label })
      }
    }

    // --- LOSSE RACES (geen positie-eis) ---
    if (event.type === 'droprace') {
      const { data: races } = await supabaseAdmin
        .from('drop_races')
        .select('id, mode, status')
        .eq('event_id', event.id)
        .neq('status', 'completed')

      for (const race of races ?? []) {
        const { data: acceptedItems } = await supabaseAdmin
          .from('drop_race_accepted_items')
          .select('item_id, item_name')
          .eq('race_id', race.id)

        const matchedItem = (acceptedItems ?? []).find((a) => a.item_id === Number(itemId))
        if (!matchedItem) continue

        // Racer-ID: team of de deelnemer zelf, afhankelijk van de modus
        let racerId: string | null = team.id
        if (race.mode === 'individual') {
          racerId = participation.id
        }
        if (!racerId) continue

        await supabaseAdmin.from('drop_race_submissions').insert({
          race_id: race.id,
          team_id: race.mode === 'team' ? racerId : null,
          participant_id: race.mode === 'individual' ? racerId : null,
          quantity,
          source: 'plugin',
          status: 'confirmed',
          submitted_by: profile.id,
        })

        await recomputeRaceStatus(race.id)

        matchedCount++
        updates.push({ type: 'droprace', racer: race.mode === 'team' ? team.name : profile.username, item: matchedItem.item_name })
      }
    }

    // --- GAUNTLET (alleen de huidige stap van deze racer telt) ---
    if (event.type === 'gauntlet') {
      const mode: 'team' | 'individual' = ((event.config as any)?.mode === 'individual') ? 'individual' : 'team'
      const racerId = mode === 'team' ? team.id : participation.id

      const currentStageOrder = await getCurrentStageOrder(event.id, racerId, mode)

      const { data: currentStage } = await supabaseAdmin
        .from('gauntlet_stages')
        .select('id, required_quantity, label')
        .eq('event_id', event.id)
        .eq('stage_order', currentStageOrder)
        .maybeSingle()

      if (currentStage) {
        const { data: acceptedItems } = await supabaseAdmin
          .from('gauntlet_stage_accepted_items')
          .select('item_id, item_name')
          .eq('stage_id', currentStage.id)

        const matchedItem = (acceptedItems ?? []).find((a) => a.item_id === Number(itemId))

        if (matchedItem) {
          await supabaseAdmin.from('gauntlet_submissions').insert({
            stage_id: currentStage.id,
            team_id: mode === 'team' ? racerId : null,
            participant_id: mode === 'individual' ? racerId : null,
            quantity,
            source: 'plugin',
            status: 'confirmed',
            submitted_by: profile.id,
          })

          matchedCount++
          updates.push({ type: 'gauntlet', stage: currentStage.label, item: matchedItem.item_name })
        }
      }
    }
  }

  return NextResponse.json({ matched: matchedCount, updates })
}
