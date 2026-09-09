// Bepaalt wie een race/gauntlet-stap als eerste heeft "geclaimd", puur op basis van
// de tijdstempels van niet-afgewezen inzendingen. Wordt telkens opnieuw berekend
// (nooit een vast "winnaar"-veld dat uit sync kan raken).
//
// racerKeyField: 'team_id' of 'participant_id', afhankelijk van de modus.

export type Submission = {
  id: string
  team_id: string | null
  participant_id: string | null
  quantity: number
  status: 'confirmed' | 'pending' | 'rejected'
  created_at: string
}

export function findEarliestQualifier(
  submissions: Submission[],
  requiredQuantity: number,
  racerKeyField: 'team_id' | 'participant_id'
): { racerId: string; reachedAt: string; isConfirmed: boolean } | null {
  const relevant = submissions
    .filter((s) => s.status !== 'rejected' && s[racerKeyField])
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const totals: Record<string, number> = {}
  const qualifiers: { racerId: string; reachedAt: string; isConfirmed: boolean }[] = []

  for (const s of relevant) {
    const racerId = s[racerKeyField] as string
    totals[racerId] = (totals[racerId] ?? 0) + s.quantity

    const alreadyQualified = qualifiers.some((q) => q.racerId === racerId)
    if (!alreadyQualified && totals[racerId] >= requiredQuantity) {
      qualifiers.push({ racerId, reachedAt: s.created_at, isConfirmed: s.status === 'confirmed' })
    }
  }

  if (qualifiers.length === 0) return null

  qualifiers.sort((a, b) => new Date(a.reachedAt).getTime() - new Date(b.reachedAt).getTime())
  return qualifiers[0]
}

// Telt hoeveel een team/deelnemer al heeft (niet-afgewezen), voor de live ranglijst.
export function computeTotals(
  submissions: Submission[],
  racerKeyField: 'team_id' | 'participant_id'
): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const s of submissions) {
    if (s.status === 'rejected') continue
    const racerId = s[racerKeyField]
    if (!racerId) continue
    totals[racerId] = (totals[racerId] ?? 0) + s.quantity
  }
  return totals
}
