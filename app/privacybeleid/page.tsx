import Link from 'next/link'

export const metadata = {
  title: 'Privacybeleid — Massief Goud Events',
}

export default function PrivacyPage() {
  return (
    <main className="container">
      <Link href="/" className="back-link">
        &larr; Terug naar home
      </Link>
      <h1>Privacybeleid</h1>
      <p className="text-muted" style={{ fontSize: 13 }}>Laatst bijgewerkt: juli 2026</p>

      <div className="panel-dark" style={{ lineHeight: 1.7 }}>
        <p>
          Dit privacybeleid legt uit welke gegevens Massief Goud Events (de "Dienst")
          verzamelt, waarom, en welke rechten je hebt. De Dienst is een fanproject en
          heeft geen officiële band met Jagex Ltd. of Old School RuneScape.
        </p>

        <h2 style={{ fontSize: 18 }}>1. Welke gegevens we verzamelen</h2>
        <p><strong>Via je Discord-account (bij het inloggen):</strong></p>
        <ul>
          <li>je Discord gebruikers-ID</li>
          <li>je Discord-gebruikersnaam en profielfoto</li>
        </ul>
        <p><strong>Die je zelf invoert:</strong></p>
        <ul>
          <li>je OSRS-gebruikersnaam (optioneel)</li>
          <li>community-, team- en event-gegevens die je aanmaakt of invoert</li>
          <li>een community-logo, als je er een uploadt</li>
        </ul>
        <p><strong>Automatisch, door gebruik van de Discord-bot:</strong></p>
        <ul>
          <li>je Discord-ID, wanneer je je aanmeldt voor een event via de bot</li>
        </ul>
        <p>
          We verzamelen geen wachtwoorden (inloggen verloopt volledig via Discord) en
          vragen geen e-mailadres of betaalgegevens op.
        </p>

        <h2 style={{ fontSize: 18 }}>2. Waarom we deze gegevens verzamelen</h2>
        <ul>
          <li>om je te kunnen laten inloggen en herkennen binnen je community('s);</li>
          <li>om events, teams en voortgang aan de juiste persoon te koppelen;</li>
          <li>om community-eigenaren in staat te stellen hun events te beheren.</li>
        </ul>

        <h2 style={{ fontSize: 18 }}>3. Met wie we gegevens delen</h2>
        <p>
          We verkopen jouw gegevens nooit. Voor het draaiende houden van de Dienst maken
          we gebruik van de volgende verwerkers (subverwerkers):
        </p>
        <ul>
          <li><strong>Discord</strong> — voor inloggen (OAuth) en de bot-functionaliteit</li>
          <li><strong>Supabase</strong> — voor de database, authenticatie en opslag van geüploade afbeeldingen</li>
          <li><strong>Vercel</strong> — voor het hosten van de website</li>
          <li><strong>Fly.io</strong> — voor het hosten van de Discord-bot</li>
        </ul>
        <p>
          Binnen een community zijn je Discord-naam, OSRS-naam en event-deelname
          zichtbaar voor andere leden van diezelfde community — dat is nodig voor de
          werking van de Dienst (bv. teamindeling, ranglijsten).
        </p>

        <h2 style={{ fontSize: 18 }}>4. Hoe lang we gegevens bewaren</h2>
        <p>
          We bewaren je gegevens zolang je account en/of community-lidmaatschap actief
          is. Verwijdert een owner een community, dan worden alle bijbehorende events,
          teams en voortgangsgegevens automatisch mee verwijderd.
        </p>

        <h2 style={{ fontSize: 18 }}>5. Jouw rechten</h2>
        <p>Onder de AVG/GDPR heb je het recht om:</p>
        <ul>
          <li>inzage te vragen in de gegevens die we van je hebben;</li>
          <li>onjuiste gegevens te laten corrigeren;</li>
          <li>je gegevens te laten verwijderen ("recht op vergetelheid");</li>
          <li>bezwaar te maken tegen bepaalde verwerkingen;</li>
          <li>een klacht in te dienen bij de Autoriteit Persoonsgegevens.</li>
        </ul>
        <p>
          Neem voor een verzoek contact op via de community-eigenaar of de beheerder van
          deze Dienst.
        </p>

        <h2 style={{ fontSize: 18 }}>6. Cookies</h2>
        <p>
          De Dienst gebruikt functionele cookies om je ingelogd te houden (via
          Supabase-authenticatie). We gebruiken geen tracking- of advertentiecookies.
        </p>

        <h2 style={{ fontSize: 18 }}>7. Beveiliging</h2>
        <p>
          We nemen redelijke technische maatregelen om je gegevens te beschermen
          (waaronder toegangsbeperkingen per rol/community, zodat gebruikers alleen bij
          gegevens kunnen die voor hen relevant zijn). Geen enkel systeem is echter 100%
          veilig.
        </p>

        <h2 style={{ fontSize: 18 }}>8. Wijzigingen</h2>
        <p>
          We kunnen dit privacybeleid van tijd tot tijd bijwerken. Bij belangrijke
          wijzigingen passen we de datum bovenaan deze pagina aan.
        </p>

        <h2 style={{ fontSize: 18 }}>9. Contact</h2>
        <p>
          Vragen over dit privacybeleid of je gegevens kun je stellen via de
          community-eigenaar of de beheerder van deze Dienst.
        </p>

        <p style={{ marginTop: 24 }}>
          Zie ook onze <Link href="/voorwaarden">Servicevoorwaarden</Link>.
        </p>
      </div>
    </main>
  )
}
