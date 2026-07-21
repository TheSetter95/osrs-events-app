// Haalt de "pageimage" (thumbnail) op van een OSRS Wiki-pagina via de officiële
// MediaWiki API van de wiki — geen HTML-scraping, gewoon een nette API-aanvraag.
// Voorbeeld input: https://oldschool.runescape.wiki/w/Dragon_warhammer
export async function getWikiImageUrl(wikiUrl: string): Promise<string | null> {
  try {
    const url = new URL(wikiUrl)

    if (!url.hostname.includes('runescape.wiki')) {
      return null
    }

    const match = url.pathname.match(/\/w\/(.+)$/)
    if (!match) return null

    const title = decodeURIComponent(match[1])

    const apiUrl = `https://oldschool.runescape.wiki/api.php?action=query&titles=${encodeURIComponent(
      title
    )}&prop=pageimages&format=json&pithumbsize=300`

    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': 'osrs-events-app (contact via GitHub)' },
    })

    if (!res.ok) return null

    const data = await res.json()
    const pages = data?.query?.pages
    if (!pages) return null

    const page = Object.values(pages)[0] as any
    return page?.thumbnail?.source ?? null
  } catch {
    return null
  }
}
