import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MAX_CASES = 100
const MAX_GP = 1_000_000_000_000 // 1 biljoen gp, ruim boven het OSRS-maximum per stapel

// Slaat het aantal koffers en de (geheime) inhoud ervan op.
// Body: { eventId, prizes: [{ caseNumber, label, gp }] }  — één regel per koffer, 1..N.
// Alleen koffers die nog dicht zijn worden aangepast; geopende koffers blijven staan.
export async function PUT(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const eventId = body?.eventId
  const prizes = body?.prizes

  if (typeof eventId !== 'string' || !Array.isArray(prizes) || prizes.length < 1 || prizes.length > MAX_CASES) {
    return NextResponse.json({ error: `Geef 1 tot ${MAX_CASES} koffers op.` }, { status: 400 })
  }

  const clean: { caseNumber: number; label: string; gp: number | null }[] = []
  for (const p of prizes) {
    const caseNumber = Number(p?.caseNumber)
    const label = typeof p?.label === 'string' ? p.label.trim() : ''
    if (!Number.isInteger(caseNumber) || caseNumber < 1 || caseNumber > MAX_CASES) {
      return NextResponse.json({ error: 'Ongeldig koffernummer.' }, { status: 400 })
    }
    if (label.length < 1 || label.length > 100) {
      return NextResponse.json({ error: `Koffer ${caseNumber}: vul een inhoud in (max. 100 tekens).` }, { status: 400 })
    }
    let gp: number | null = null
    if (p?.gp !== undefined && p?.gp !== null && p?.gp !== '') {
      gp = Number(p.gp)
      if (!Number.isInteger(gp) || gp < 0 || gp > MAX_GP) {
        return NextResponse.json({ error: `Koffer ${caseNumber}: ongeldig gp-bedrag.` }, { status: 400 })
      }
    }
    clean.push({ caseNumber, label, gp })
  }

  if (new Set(clean.map((c) => c.caseNumber)).size !== clean.length) {
    return NextResponse.json({ error: 'Elk koffernummer mag maar één keer voorkomen.' }, { status: 400 })
  }

  const { data: event } = await supabase.from('events').select('id, type, status').eq('id', eventId).single()
  if (!event || event.type !== 'miljoenenjacht') {
    return NextResponse.json({ error: 'Event niet gevonden.' }, { status: 404 })
  }
  if (event.status === 'finished') {
    return NextResponse.json({ error: 'Dit event is afgerond; de koffers kunnen niet meer gewijzigd worden.' }, { status: 409 })
  }

  const { data: existing } = await supabase
    .from('mj_cases')
    .select('id, case_number, opened_at')
    .eq('event_id', eventId)

  const existingByNumber = new Map((existing ?? []).map((c: any) => [c.case_number as number, c]))
  const keep = new Set(clean.map((c) => c.caseNumber))

  // Geopende koffers mogen nooit verdwijnen of veranderen
  for (const c of existing ?? []) {
    if (c.opened_at && !keep.has(c.case_number)) {
      return NextResponse.json(
        { error: `Koffer ${c.case_number} is al geopend en kan niet verwijderd worden.` },
        { status: 409 }
      )
    }
  }

  // Overbodige, nog dichte koffers verwijderen (prijs verdwijnt mee via cascade)
  const toDelete = (existing ?? []).filter((c: any) => !keep.has(c.case_number) && !c.opened_at).map((c: any) => c.id)
  if (toDelete.length > 0) {
    const { error } = await supabase.from('mj_cases').delete().in('id', toDelete)
    if (error) {
      return NextResponse.json({ error: 'Opslaan mislukt. Ben je organizer/owner?' }, { status: 403 })
    }
  }

  // Ontbrekende koffers aanmaken
  const missing = clean.filter((c) => !existingByNumber.has(c.caseNumber))
  if (missing.length > 0) {
    const { error } = await supabase
      .from('mj_cases')
      .insert(missing.map((c) => ({ event_id: eventId, case_number: c.caseNumber })))
    if (error) {
      return NextResponse.json({ error: 'Opslaan mislukt. Ben je organizer/owner?' }, { status: 403 })
    }
  }

  const { data: allCases } = await supabase
    .from('mj_cases')
    .select('id, case_number, opened_at')
    .eq('event_id', eventId)

  const idByNumber = new Map((allCases ?? []).map((c: any) => [c.case_number as number, c]))

  const rows = clean
    .map((c) => {
      const row: any = idByNumber.get(c.caseNumber)
      if (!row || row.opened_at) return null
      return { case_id: row.id, label: c.label, gp_value: c.gp }
    })
    .filter(Boolean)

  if (rows.length > 0) {
    const { error } = await supabase.from('mj_case_prizes').upsert(rows as any[], { onConflict: 'case_id' })
    if (error) {
      return NextResponse.json({ error: 'Prijzen opslaan mislukt: ' + error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, count: clean.length })
}
