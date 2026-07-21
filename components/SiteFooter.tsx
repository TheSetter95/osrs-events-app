import Link from 'next/link'

export default function SiteFooter() {
  return (
    <footer
      style={{
        marginTop: 40,
        padding: '20px',
        textAlign: 'center',
        fontSize: 12,
        borderTop: '1px solid rgba(184, 134, 59, 0.25)',
      }}
    >
      <span className="text-muted">
        <Link href="/voorwaarden">Servicevoorwaarden</Link>
        {' · '}
        <Link href="/privacybeleid">Privacybeleid</Link>
      </span>
    </footer>
  )
}
