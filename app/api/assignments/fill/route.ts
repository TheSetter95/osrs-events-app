import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { writeAssignmentToSlot, wikiImageFor, type GameKind, type LibraryAssignment } from '@/lib/tileWriters'

const GAMES: GameKind[] = ['bingo', 'ganzebord', 'miljoenenjacht']

// Vult alle LEGE vakjes van een event willekeurig met opdrachten uit de bibliotheek.
// Bestaande vakjes blijven ongemoeid. Alleen voor owners (zij mogen de bibliotheek lezen)
// en alleen zolang het event nog een concept is.
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const eventId = body?.eventId
  const difficulty = typeof body?.difficulty === 'string' && body.difficulty ? body.difficulty : null
  const membership = typeof body?.membership === 'string' && body.membership ? body.membership : null
  const tag = typeof body?.tag === 'string' && body.tag.trim() ? body.tag.trim().toLowerCase() : null

  if (typeof eventId !== 'string') {
    return NextResponse.json({ error: 'Ongeldige invoer.' }, { status: 400 })
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, type, status, config')
    .eq('id', eventId)
    .single()

  if (!event || !GAMES.includes(event.type as GameKind)) {
    return NextResponse.json({ error: 'Dit eventtype ondersteunt geen vulling uit de bibliotheek.' }, { status: 400 })
  }
  if (event.status !== 'draft') {
    return NextResponse.json(
      { error: 'Willekeurig vullen kan alleen zolang het event een Concept is.' },
      { status: 409 }
    )
  }

  const game = event.type as GameKind
  const config: any = event.config ?? {}

  // Welke plekken zijn er, en welke zijn al bezet?
  let slots: number[] = []
  let occupied = new Set<number>()

  if (game === 'bingo') {
    const size = Number(config.gridSize) || 5
    slots = Array.from({ length: size * size }, (_, i) => i + 1)
    const { data } = await supabase.from('bingo_tiles').select('position').eq('event_id', eventId)
    occupied = new Set((data ?? []).map((r: any) => r.position))
  } else if (game === 'ganzebord') {
    const size = Number(config.boardSize) || 63
    // Het laatste vak (de finish) slaan we over.
    slots = Array.from({ length: Math.max(size - 1, 0) }, (_, i) => i + 1)
    const { data } = await supabase.from('board_tiles').select('tile_number').eq('event_id', eventId)
    occupied = new Set((data ?? []).map((r: any) => r.tile_number))
  } else {
    const count = Number(config.assignmentCount) || Number(config.caseCount) || 26
    slots = Array.from({ length: count }, (_, i) => i + 1)
    const { data } = await supabase.from('mj_assignments').select('position').eq('event_id', eventId)
    occupied = new Set((data ?? []).map((r: any) => r.position))
  }

  const emptySlots = slots.filter((s) => !occupied.has(s))
  if (emptySlots.length === 0) {
    return NextResponse.json({ error: 'Er zijn geen lege vakjes meer om te vullen.' }, { status: 409 })
  }

  let query = supabase
    .from('assignment_templates')
    .select('id, title, description, wiki_url, kind, requirement_groups, membership, difficulty, tags')
    .contains('game_types', [game])
  if (difficulty) query = query.eq('difficulty', difficulty)
  if (tag) query = query.contains('tags', [tag])
  // F2P-event: alleen F2P-geschikte opdrachten. P2P-event: alles mag.
  if (membership === 'f2p') query = query.in('membership', ['f2p', 'beide'])

  const { data: candidates, error: libError } = await query.limit(500)

  if (libError) {
    return NextResponse.json({ error: 'De bibliotheek kon niet gelezen worden. Ben je owner?' }, { status: 403 })
  }
  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ error: 'Geen opdrachten gevonden met deze filters.' }, { status: 404 })
  }

  // Willekeurige volgorde (Fisher-Yates), elke opdracht hooguit één keer
  const pool = [...candidates]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }

  const count = Math.min(emptySlots.length, pool.length)
  const chosen = pool.slice(0, count)
  const images = await Promise.all(chosen.map((c: any) => wikiImageFor(c.wiki_url)))

  let filled = 0
  for (let i = 0; i < count; i++) {
    const result = await writeAssignmentToSlot(
      supabase,
      game,
      eventId,
      emptySlots[i],
      chosen[i] as unknown as LibraryAssignment,
      images[i]
    )
    if (!result.ok) {
      return NextResponse.json({ error: result.error, filled }, { status: 500 })
    }
    filled++
  }

  return NextResponse.json({
    filled,
    stillEmpty: emptySlots.length - filled,
    message:
      filled < emptySlots.length
        ? `${filled} vakjes gevuld. Er waren niet genoeg passende opdrachten voor de overige ${emptySlots.length - filled}.`
        : `${filled} vakjes gevuld.`,
  })
}
