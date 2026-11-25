import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="container-narrow" style={{ textAlign: 'center' }}>
      <h1>Pagina niet gevonden</h1>
      <p className="text-muted">
        Deze pagina bestaat niet, of je hebt er geen toegang toe.
      </p>
      <Link href="/dashboard">
        <button className="btn">Naar dashboard</button>
      </Link>
    </main>
  )
}
