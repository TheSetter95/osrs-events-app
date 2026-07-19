# OSRS Events Platform — starter

Minimale Next.js-app die inlogt via Discord (met Supabase) en het profiel toont.
Dit is stap 3 uit het grotere plan: de basis waarop we straks de Bingo/Ganzebord/PvP-tools bouwen.

## Wat zit erin?

```
app/
  layout.tsx              -> basislayout van de site
  page.tsx                -> homepage: toont login-knop of profiel
  auth/callback/route.ts  -> vangt de Discord-login op en maakt de sessie aan
components/
  LoginButton.tsx          -> "Inloggen met Discord" knop
  LogoutButton.tsx          -> "Uitloggen" knop
lib/supabase/
  client.ts                -> Supabase-verbinding voor in de browser
  server.ts                -> Supabase-verbinding voor op de server
middleware.ts               -> houdt de login-sessie geldig
```

## Stap 1 — Vereisten installeren

Je hebt **Node.js** nodig (versie 18 of hoger). Check of je het al hebt:

```bash
node -v
```

Zo niet, download het via https://nodejs.org (kies de LTS-versie).

## Stap 2 — Project installeren

Pak deze map uit, open een terminal in de map, en voer uit:

```bash
npm install
```

Dit installeert Next.js, React en de Supabase-libraries.

## Stap 3 — Environment variables instellen

1. Kopieer `.env.local.example` naar een nieuw bestand genaamd `.env.local`
2. Ga in Supabase naar **Project Settings** → **API**
3. Vul in `.env.local` in:
   - `NEXT_PUBLIC_SUPABASE_URL` → de "Project URL"
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → de "anon public" key

> Deze twee waarden zijn bedoeld om publiek zichtbaar te zijn (ze staan letterlijk in elke browser die je site bezoekt) — dat is precies waarom we de Row Level Security policies uit Deel D hebben ingesteld. Zonder RLS zou iedereen met deze key alles kunnen lezen/schrijven; mét RLS bepalen de policies wat wel/niet mag.

## Stap 4 — Lokaal draaien

```bash
npm run dev
```

Ga naar http://localhost:3000 — je zou de "Inloggen met Discord"-knop moeten zien.

**Belangrijk:** klik nog niet meteen, want je Discord OAuth-app kent `localhost` nog niet als toegestane redirect. Ga naar Discord Developer Portal → jouw app → OAuth2 → Redirects, en voeg **ook** deze toe (naast de Supabase-callback-URL die je al had):

```
http://localhost:3000/auth/callback
```

En ga in Supabase naar **Authentication** → **URL Configuration** → zet bij **Redirect URLs**:

```
http://localhost:3000/auth/callback
```

Nu zou inloggen moeten werken: je wordt naar Discord gestuurd, keurt de app goed, en komt terug op je homepage met je Discord-avatar en naam zichtbaar.

## Stap 5 — Testen dat het echt werkt

Na het inloggen kun je in Supabase, onder **Table Editor** → **profiles**, controleren of er een rij is aangemaakt met jouw `discord_id`, `username` en `avatar_url`. Zo weet je zeker dat de trigger uit Deel C goed functioneert.

## Stap 6 — Deployen naar Vercel

1. Zet dit project in een GitHub-repository (nieuwe repo aanmaken, code pushen)
2. Ga naar https://vercel.com, log in met GitHub, klik **New Project**, kies je repository
3. Bij **Environment Variables**, voeg dezelfde twee variabelen toe als in je `.env.local`
4. Klik **Deploy**
5. Zodra het live is, krijg je een URL zoals `https://jouwproject.vercel.app`
6. Voeg **die** URL óók toe als redirect:
   - Discord Developer Portal → OAuth2 → Redirects: (de Supabase-callback stond er al, dat is genoeg — je hoeft de Vercel-URL hier niet apart toe te voegen)
   - Supabase → Authentication → URL Configuration → Redirect URLs: voeg toe `https://jouwproject.vercel.app/auth/callback`

## Wat is de volgende stap na dit?

Zodra login werkt, bouwen we:
1. Een pagina om een **community** aan te maken (schrijft naar de `communities`-tabel, jij wordt automatisch `owner`)
2. Een dashboard per community waar je **events** kan aanmaken
3. Daarna de eerste event-tool: **Bingo**

Loop je vast bij een van bovenstaande stappen (bv. een foutmelding bij `npm install`, of de Discord-redirect klopt niet)? Deel de exacte foutmelding, dan lossen we het samen op.
