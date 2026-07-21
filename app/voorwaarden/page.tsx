import Link from 'next/link'

export const metadata = {
  title: 'Servicevoorwaarden — Massief Goud Events',
}

export default function TermsPage() {
  return (
    <main className="container">
      <Link href="/" className="back-link">
        &larr; Terug naar home
      </Link>
      <h1>Servicevoorwaarden</h1>
      <p className="text-muted" style={{ fontSize: 13 }}>Laatst bijgewerkt: juli 2026</p>

      <div className="panel-dark" style={{ lineHeight: 1.7 }}>
        <p>
          Deze servicevoorwaarden ("Voorwaarden") zijn van toepassing op het gebruik van
          Massief Goud Events (de "Dienst"), een website met bijbehorende Discord-bot
          waarmee community-eigenaren evenementen zoals Bingo, Ganzebord en
          PvP-toernooien kunnen organiseren voor Old School RuneScape-community's. Door
          de Dienst te gebruiken, ga je akkoord met deze Voorwaarden.
        </p>

        <h2 style={{ fontSize: 18 }}>1. Wat is de Dienst</h2>
        <p>
          De Dienst biedt tools om communities, events, teams en deelnemers te beheren,
          en een Discord-bot waarmee deelnemers zich kunnen aanmelden en voortgang
          kunnen bijhouden. De Dienst is een fanproject en heeft geen enkele officiële
          band met, goedkeuring van, of banden met Jagex Ltd. of Old School RuneScape.
          Alle merknamen en spelinhoud zijn eigendom van hun respectievelijke eigenaren.
        </p>

        <h2 style={{ fontSize: 18 }}>2. Account en toegang</h2>
        <p>
          Je krijgt toegang tot de Dienst door in te loggen met je Discord-account. Je
          bent zelf verantwoordelijk voor het geheimhouden van je Discord-inloggegevens
          en voor alle activiteit die via jouw account plaatsvindt.
        </p>

        <h2 style={{ fontSize: 18 }}>3. Rollen binnen een community</h2>
        <p>
          Een community-eigenaar ("owner") kan andere gebruikers uitnodigen en rollen
          toekennen (owner, organizer, member). Owners en organizers krijgen daarmee
          beheersrechten over events, teams en deelnemers binnen hun eigen community. De
          Dienst is niet verantwoordelijk voor beslissingen die community-eigenaren
          binnen hun eigen community nemen (zoals het toekennen van rollen, het
          verwijderen van deelnemers, of het beoordelen van event-voortgang).
        </p>

        <h2 style={{ fontSize: 18 }}>4. Content die je uploadt of invoert</h2>
        <p>
          Je bent zelf verantwoordelijk voor de content die je via de Dienst plaatst,
          zoals community-logo's, teamnamen, opdrachtomschrijvingen en OSRS-gebruikers-
          namen. Je garandeert dat je het recht hebt om deze content te plaatsen, en dat
          deze geen inbreuk maakt op rechten van derden, niet beledigend, discriminerend
          of anderszins onrechtmatig is. We behouden ons het recht voor om content te
          verwijderen die deze Voorwaarden schendt.
        </p>

        <h2 style={{ fontSize: 18 }}>5. Toegestaan gebruik</h2>
        <p>Je gaat ermee akkoord de Dienst niet te gebruiken om:</p>
        <ul>
          <li>de goede werking van de Dienst of Discord te verstoren of te ondermijnen;</li>
          <li>ongeautoriseerde toegang tot accounts, communities of gegevens van anderen te verkrijgen;</li>
          <li>content te plaatsen die onwettig, beledigend, intimiderend of anderszins schadelijk is;</li>
          <li>de Dienst te gebruiken voor doeleinden die in strijd zijn met de Servicevoorwaarden van Discord.</li>
        </ul>

        <h2 style={{ fontSize: 18 }}>6. Beschikbaarheid</h2>
        <p>
          De Dienst wordt aangeboden "zoals hij is", zonder garanties over
          ononderbroken beschikbaarheid. Als hobbyproject kan de Dienst tijdelijk
          offline zijn voor onderhoud, of om andere redenen worden gewijzigd, opgeschort
          of stopgezet.
        </p>

        <h2 style={{ fontSize: 18 }}>7. Aansprakelijkheid</h2>
        <p>
          Voor zover wettelijk toegestaan, is de Dienst niet aansprakelijk voor
          indirecte schade, gevolgschade, of verlies van gegevens die voortvloeit uit
          het gebruik van (of het niet kunnen gebruiken van) de Dienst.
        </p>

        <h2 style={{ fontSize: 18 }}>8. Beëindiging</h2>
        <p>
          Je kan het gebruik van de Dienst op elk moment stopzetten. We kunnen toegang
          tot de Dienst opschorten of beëindigen bij schending van deze Voorwaarden.
        </p>

        <h2 style={{ fontSize: 18 }}>9. Wijzigingen</h2>
        <p>
          We kunnen deze Voorwaarden van tijd tot tijd aanpassen. Bij belangrijke
          wijzigingen passen we de datum bovenaan deze pagina aan.
        </p>

        <h2 style={{ fontSize: 18 }}>10. Toepasselijk recht</h2>
        <p>Op deze Voorwaarden is Nederlands recht van toepassing.</p>

        <h2 style={{ fontSize: 18 }}>11. Contact</h2>
        <p>
          Vragen over deze Voorwaarden kun je stellen via de community-eigenaar of de
          beheerder van deze Dienst.
        </p>

        <p style={{ marginTop: 24 }}>
          Zie ook ons <Link href="/privacybeleid">Privacybeleid</Link>.
        </p>
      </div>
    </main>
  )
}
