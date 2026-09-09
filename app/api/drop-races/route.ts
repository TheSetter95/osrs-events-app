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

  const { eventId, raceId, label, requiredQuantity, mode, items } = await request.json()

  if (!label || typeof label !== 'string' || !label.trim()) {
    return NextResponse.json({ error: 'Vul een naam voor de race in.' }, { status: 400 })
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

  let race
  if (raceId) {
    // Bewerken: alleen label/aantal, niet de modus (zou lopende inzendingen in de war schoppen)
    const { data, error } = await supabase
      .from('drop_races')
      .update({ label: label.trim(), required_quantity: requiredQuantity })
      .eq('id', raceId)
      .select()
      .single()
    if (error) {
      return NextResponse.json({ error: 'Bijwerken mislukt.' }, { status: 403 })
    }
    race = data
    await supabase.from('drop_race_accepted_items').delete().eq('race_id', race.id)
  } else {
    const { data, error } = await supabase
      .from('drop_races')
      .insert({
        event_id: eventId,
        label: label.trim(),
        required_quantity: requiredQuantity,
        mode: mode === 'individual' ? 'individual' : 'team',
      })
      .select()
      .single()
    if (error) {
      return NextResponse.json(
        { error: 'Aanmaken mislukt. Ben je organizer/owner van deze community?' },
        { status: 403 }
      )
    }
    race = data
  }

  const itemRows = items.map((item: any) => ({
    race_id: race.id,
    item_id: Number(item.itemId),
    item_name: item.itemName.trim(),
  }))

  const { error: itemsError } = await supabase.from('drop_race_accepted_items').insert(itemRows)

  if (itemsError) {
    return NextResponse.json(
      { error: 'Race opgeslagen, maar items opslaan mislukt: ' + itemsError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ race })
}
