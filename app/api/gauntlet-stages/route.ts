import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const { eventId, stageId, stageOrder, label, requiredQuantity, items } = await request.json()

  if (!label || typeof label !== 'string' || !label.trim()) {
    return NextResponse.json({ error: 'Vul een naam voor de stap in.' }, { status: 400 })
  }

  if (!stageOrder || stageOrder < 1) {
    return NextResponse.json({ error: 'Ongeldig stapnummer.' }, { status: 400 })
  }

  if (!requiredQuantity || requiredQuantity < 1) {
    return NextResponse.json({ error: 'Ongeldig aantal.' }, { status: 400 })
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Voeg minstens één item toe.' }, { status: 400 })
  }

  for (const item of items) {
    if (!item.itemId || !item.itemName?.trim()) {
      return NextResponse.json({ error: 'Elk item heeft een geldig item-ID en naam nodig.' }, { status: 400 })
    }
  }

  const { data: stage, error } = await supabase
    .from('gauntlet_stages')
    .upsert(
      {
        id: stageId || undefined,
        event_id: eventId,
        stage_order: stageOrder,
        label: label.trim(),
        required_quantity: requiredQuantity,
      },
      { onConflict: 'event_id,stage_order' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Opslaan mislukt. Ben je organizer/owner van deze community?' },
      { status: 403 }
    )
  }

  await supabase.from('gauntlet_stage_accepted_items').delete().eq('stage_id', stage.id)

  const itemRows = items.map((item: any) => ({
    stage_id: stage.id,
    item_id: Number(item.itemId),
    item_name: item.itemName.trim(),
  }))

  const { error: itemsError } = await supabase.from('gauntlet_stage_accepted_items').insert(itemRows)

  if (itemsError) {
    return NextResponse.json(
      { error: 'Stap opgeslagen, maar items opslaan mislukt: ' + itemsError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ stage })
}
