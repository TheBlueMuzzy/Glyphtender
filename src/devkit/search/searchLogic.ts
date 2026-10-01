// The Dev Kit search's thinking, kept apart from its looks so it can be tested (searchLogic.test.ts, in the framework).
// Nothing here touches the page.
//
// How a setting matches what you type:
//   - case doesn't matter, and the typed text can sit ANYWHERE in a word: "ade" finds "spotlightFade"
//   - it looks in the setting's key, its key split into words ("trailFade" → "trail fade"), its readable label,
//     its help text, its section title and its file name
//   - several words = every one of them must be found (in any of those places): "trail fade"
//   - a section whose TITLE matches shows all of its settings

/** "trailFade" → "trail fade", "awardPriority.photoFinish" → "award priority photo finish", "on-primary" → "on primary" */
export function splitWords(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // trailFade → trail Fade
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // HTMLParser → HTML Parser
    .replace(/([a-zA-Z])(\d)/g, '$1 $2') // awardsFor2 → awardsFor 2
    .replace(/[._\-›]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** A label made from a key when the file gives none: "trailFade" → "Trail fade" */
export function readableKey(key: string): string {
  const words = splitWords(key)
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** What was typed, as lower-case words to find. "  Trail   FADE " → ["trail", "fade"]. Empty → [] (= no search). */
export const searchTerms = (query: string): string[] => query.toLowerCase().split(/\s+/).filter(Boolean)

/** Is every term somewhere in these texts? (Each key is also searched split into words.) */
export function matchesAll(terms: string[], texts: (string | undefined)[]): boolean {
  if (terms.length === 0) return true
  const hay = texts.filter(Boolean).flatMap((t) => [t!.toLowerCase(), splitWords(t!)]).join('\n')
  return terms.every((term) => hay.includes(term))
}

export type Part = { text: string; hit: boolean }

/** Cut a text into plain and matching parts, for highlighting: ("Trail fade", ["fade"]) → "Trail " + [fade] */
export function highlightParts(text: string, terms: string[]): Part[] {
  if (!text || terms.length === 0) return [{ text, hit: false }]
  const lower = text.toLowerCase()
  const hit = new Array<boolean>(text.length).fill(false)
  for (const term of terms) {
    for (let at = lower.indexOf(term); at !== -1; at = lower.indexOf(term, at + 1)) {
      for (let i = at; i < at + term.length; i++) hit[i] = true
    }
  }
  const parts: Part[] = []
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1]
    if (last && last.hit === hit[i]) last.text += text[i]
    else parts.push({ text: text[i], hit: hit[i] })
  }
  return parts
}

/** A titled, collapsible group of settings in a tab. id is unique across the whole Dev Kit, e.g. "tuning:Trails". */
export type Section<T> = { id: string; title: string; items: T[] }

/**
 * The sections and settings that match a search. A section whose title matches keeps all its settings;
 * otherwise only its matching settings stay, and a section with none left is dropped.
 * textsOf(item) = the texts to search for one setting (key, label, help, file…).
 */
export function filterSections<T, S extends Section<T> = Section<T>>(
  sections: S[],
  query: string,
  textsOf: (item: T) => (string | undefined)[],
): (S & { titleHit: boolean })[] {
  const terms = searchTerms(query)
  const found: (S & { titleHit: boolean })[] = []
  for (const section of sections) {
    const titleHit = terms.length > 0 && matchesAll(terms, [section.title])
    const items = titleHit ? section.items : section.items.filter((item) => matchesAll(terms, [...textsOf(item), section.title]))
    if (items.length > 0) found.push({ ...section, items, titleHit })
  }
  return found
}

/** How many settings match, over all sections. */
export const countFound = (found: { items: unknown[] }[]) => found.reduce((n, s) => n + s.items.length, 0)
