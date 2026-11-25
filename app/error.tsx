'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="container-narrow" style={{ textAlign: 'center' }}>
      <h1>Er ging iets mis</h1>
      <p className="text-muted">
        Er is een onverwachte fout opgetreden. Probeer het opnieuw. Blijft het misgaan,
        laat het dan weten aan een organizer
        {error.digest ? ` (foutcode: ${error.digest})` : ''}.
      </p>
      <button className="btn" onClick={() => reset()}>
        Opnieuw proberen
      </button>
    </main>
  )
}
