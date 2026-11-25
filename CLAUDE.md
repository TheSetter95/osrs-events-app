# Massief Goud Events

Community-platform voor OSRS-events (Old School RuneScape) van de clan Massief Goud.
Eigenaar: Bas ("designer of learning", gamer, programmeur, Arnhem). Taal van de app, UI-teksten en communicatie: **Nederlands**. Code, variabelen en commits mogen Nederlands of Engels zijn; volg wat er al staat.

## Onderdelen

1. **Website** (deze repo): Next.js 14 (App Router, TypeScript), Supabase (Postgres, RLS, Auth met Discord OAuth), gehost op Vercel.
   - Live: https://massiefgoud.vercel.app (ook osrs-events-app.vercel.app)
2. **RuneLite-plugin "Massief Goud"** (aparte repo `TheSetter95/massief-goud-runelite-plugin`, Plugin Hub-fork `TheSetter95/plugin-hub`, bestand `plugins/massiefgoud`). Stuurt drops via `POST /api/plugin/report-drop` en haalt relevante item-ID's op via `GET /api/plugin/relevant-items`. Gebruikt een eigen plugin-sleutel (Bearer), geen cookies.
3. **Discord-bot**: wordt verwijderd/is niet meer in gebruik. Bouw er niets nieuws voor. Schoon verwijzingen ernaar op in de website waar dat gevraagd wordt (meldingskanaal/-rollen, `/gooi`, `/stand` in teksten en handleidingen). De Discord *Application* blijft nodig voor inloggen via Supabase.

## Eventtypes (`events.type`)

`ganzebord`, `bingo`, `droprace` (Losse Races), `gauntlet`, `pvp_toernooi` (nog niet gebouwd).
Toegestane types staan in `ALLOWED_TYPES` in `app/api/events/route.ts`. Nieuw type? Daar ook toevoegen, plus `EVENT_TYPES` in `app/communities/[slug]/events/new/page.tsx`.

- **Ganzebord**: bord met vakken, teams, dobbelsteen (`teams.can_roll`), fog of war (`board_tile_reveals`), verzamel-vakken (`board_tile_requirements`, alternatieve items via `requirement_accepted_items`). Als een team alle doelen van zijn vak heeft behaald, wordt `can_roll` automatisch `true`.
- **Bingo**: zelfde verzameldoelen als Ganzebord (`bingo_*` tabellen), meerdere vakken tegelijk, altijd zichtbaar.
- **Losse Races**: `drop_races*`, eerste die het item heeft wint; winnaar altijd herberekenen uit tijdstempels (`lib/recomputeRaceStatus.ts`).
- **Gauntlet**: opeenvolgende stages (`gauntlet_stages*`, `lib/gauntletProgress.ts`), team of individueel (`event.config.mode`). Afscherming van latere stages is gepland maar gepauzeerd.

## Belangrijke patronen

- **Inzendingen** (`item_submissions`, `bingo_item_submissions`, `drop_race_submissions`, `gauntlet_submissions`): `source` = `plugin` | `screenshot`, `status` = `confirmed` | `pending` | `rejected`. Voortgang = som van niet-afgewezen inzendingen. Alleen **owners** keuren screenshots goed/af (`ItemSubmissionsPanel.tsx`, review-routes).
- **Duplicaatwaarschuwing**: plugin-drop + screenshot binnen 30 min voor hetzelfde item geeft een ⚠️ (`findPossibleDuplicate`).
- **Rechten**: community-rollen `owner` / `organizer` / `member` (`community_members`). Communities aanmaken mag alleen met `profiles.can_create_communities`; beheer via `/beheer` (super-admin).
- **Server-side afdwingen**: verberg niet alleen iets in de UI. Elke beperking (rol, status, eigenaarschap) moet in de route handler of RLS staan.
- **Supabase-clients**: `lib/supabase/server.ts` (met sessie, RLS actief) en `lib/supabase/admin.ts` (service role, omzeilt RLS; alleen in server-code en alleen na eigen autorisatiecheck).
- **Middleware** (`middleware.ts`) ververst de Supabase-sessie. Bewust licht gehouden: slaat verzoeken zonder `sb-`-cookie, prefetches en `/api/plugin` over. Voeg hier geen zware logica of extra netwerkcalls aan toe.
- **Discord-IDs van deelnemers** worden niet in de UI getoond (alleen tooltip in `TeamsManager`).

## Prestatie (Vercel Hobby = beperkte CPU)

- Haal per eventpagina alleen de data op voor het eigen eventtype, en parallelliseer onafhankelijke queries (`Promise.all`).
- Geen polling of `router.refresh()` op een timer zonder overleg.
- De plugin meldt alleen items uit `/api/plugin/relevant-items`. Houd die route en `report-drop` lichtgewicht.

## Database

- SQL wordt handmatig in de Supabase SQL Editor gedraaid, bij voorkeur eerst op een testevent. Migraties staan als `stapNN-*.md`; de laatste uitgewerkte is stap 31 (races + gauntlet).
- **Openstaand ontwerp (stap 32, nog niet uitgevoerd)**: `deleted_event_archives` + BEFORE DELETE-trigger op `events` die een JSON-snapshot opslaat, `restore_deleted_event(uuid)`, en `event_audit_log` met triggers voor verwijderen, statuswijziging en positiewijziging van teams. Doel: een per ongeluk of kwaadwillig verwijderd actief event kunnen herstellen en wijzigingen kunnen traceren.
- `randomizer_drop_pool` bevat F2P+P2P drops uit osrsreboxed-db (voor de latere randomizer-gauntlet).

## Veiligheid, ethiek en integriteit

Bas werkt aan ethisch gebruik van IT in onderwijs en community's; hanteer dat hier ook.

- Bouw geen heimelijke manipulatie van uitkomsten (bijv. onzichtbaar dobbelstenen beïnvloeden). Aanpassingen door organizers moeten zichtbaar en gelogd zijn, met reden. Detectie en audit zijn welkom.
- Verwijderen van events: alleen owners, alleen in status Concept, afgedwongen op de server, met archief-snapshot (zie stap 32).
- Bewaar nooit geheimen in de repo: `.env*`, `SUPABASE_SERVICE_ROLE_KEY`, plugin-sleutels, bot-tokens. Vraag Bas niet om ze te plakken; verwijs naar Vercel/Supabase-instellingen.
- Privacybeleid staat op `/privacybeleid`. Het noemt ook dat de plugin het IP-adres meestuurt (inherent aan een HTTP-verzoek). Houd het beleid actueel bij nieuwe gegevensverwerking.

## Werkafspraken

- Antwoord en leg uit in het Nederlands, kort en praktisch. Bas is geen full-time ontwikkelaar: geef bij handmatige stappen (Vercel, Supabase, GitHub) duidelijke stappen in volgorde.
- Werk in een aparte branch; draai `npm run build` en los typefouten op voordat je zegt dat iets klaar is. Toon de wijzigingen (`git diff`) voor een commit.
- Commit en push alleen als Bas dat vraagt.
- Houd UI-opmaak consistent met bestaande componenten en CSS-klassen (gouden thema, `container` / `container-wide`, `panel-dark`, `text-muted`).
- Wijzigingen aan de plugin moeten **backwards compatible** met de server blijven tot de nieuwe Plugin Hub-versie is goedgekeurd.

## RuneLite Plugin Hub: valkuilen (uit eerdere afwijzingen)

- Bestandsnaam in `plugins/` volledig lowercase (`massiefgoud`), inhoud precies twee regels zonder spaties: `repository=...` en `commit=...`.
- Root van de plugin-repo: `build.gradle`, `runelite-plugin.properties` (met `build=standard`), `LICENSE` (BSD 2-Clause), `icon.png` (max 48x72).
- `build.gradle`: alleen `java`-plugin, Lombok **1.18.30**, geen toolchain-blok, geen `application`-plugin, RuneLite client als `compileOnly`.
- Gebruik `@Inject Gson`, geen `new Gson()`.
- Na elke codewijziging in de plugin: nieuwe commit-hash in `plugins/massiefgoud` zetten en een pull request openen via de compare-link naar `runelite/plugin-hub` (niet binnen de eigen fork).

## Openstaande ideeën (niet zonder overleg oppakken)

1. Stap 32: archief + audit-log + server-side delete-beperking.
2. Gauntlet-afscherming: per team/deelnemer alleen de huidige stage zichtbaar (`gauntlet-afscherming.zip` bestond al).
3. Randomizer-gauntlet: organizer-knop "genereer willekeurige reeks" met `randomizer_drop_pool`, zelfde item-ID tabellen zodat de plugin blijft werken.
4. Detectie van dobbelsteenmanipulatie door organizers (`app/api/teams/[teamId]/roll/route.ts` nakijken, logs vergelijken).
5. Notificaties of overzicht voor screenshots bij bingo/races/gauntlet nu de bot weg is (bijvoorbeeld teller "te beoordelen" op de eventpagina).
6. Duplicaatwaarschuwing ook in race- en gauntlet-borden.
7. Eventueel verhuizen van hosting als Vercel Hobby te krap blijft (Cloudflare of Vercel Pro); houd rekening met de plugin die naar `massiefgoud.vercel.app` wijst.

## Opdrachtenbibliotheek (stap 33)
- Tabel `assignment_templates`, gedeeld door alle owners van alle communities (ook site-admins). Pagina: `/opdrachten`, API: `/api/assignments`.
- Iedereen met toegang leest en voegt toe; alleen de maker (of een site-admin) bewerkt of verwijdert.
- Validatie staat in `lib/assignmentValidation.ts`. `requirement_groups` heeft dezelfde vorm als de tegel-editor: `[{label, quantity, items:[{itemId,itemName}]}]`.
- Opdrachten worden later als kopie (snapshot) in een event gezet, niet gekoppeld.

## Gepland: Miljoenenjacht (nog niet gebouwd)
- Spelvorm met koffers (aantal instelbaar, standaard 26), gedeeld door alle teams; elke koffer opent één keer.
- Teams krijgen een opdrachtenlijst zoals Bingo. Elke voltooide opdracht (plugin of screenshot) = 1 pull = 1 koffer openen.
- Prijzen vrij per event (gp, items of mix). Geopende koffers zijn openbaar (wie + inhoud), gesloten blijven verborgen.
- Geen bankier of bod.

## Gauntlet
- Gepauzeerd: in het nieuwe-event-formulier staat "niet gebruiken, onder ontwikkeling".
