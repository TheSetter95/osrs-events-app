import Link from 'next/link'

export default function SiteHeader() {
  return (
    <header
      style={{
        borderBottom: '1px solid var(--gold-dark)',
        background: 'rgba(0, 0, 0, 0.25)',
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: '0 auto',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img
            src="/logo.png"
            alt="Logo"
            width={32}
            height={32}
            style={{ borderRadius: 6, display: 'block' }}
          />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--gold-light)',
              fontSize: 16,
              letterSpacing: '0.03em',
            }}
          >
            Massief Goud Events
          </span>
        </Link>
      </div>
    </header>
  )
}
