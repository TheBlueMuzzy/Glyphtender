// The Color tool's thinking, kept apart from its looks so it can be tested (colorLogic.test.ts, in the framework).
// Nothing here touches the page or the files. normalizeHex / sameColour are handy for game tabs too.
import { filterSections, type Section } from '../search/searchLogic'

/** The 15 UI kit colours, in the order the panel lists them, with names Muzzy would use. */
export const UI_COLOURS = [
  { token: 'bg', name: 'Page background' },
  { token: 'on-bg', name: 'Text on page' },
  { token: 'surface', name: 'Cards' },
  { token: 'on-surface', name: 'Text on cards' },
  { token: 'primary', name: 'Main buttons' },
  { token: 'on-primary', name: 'Text on main buttons' },
  { token: 'accent', name: 'Highlight' },
  { token: 'danger', name: 'Danger' },
  { token: 'on-danger', name: 'Text on danger' },
  { token: 'muted', name: 'Quiet text' },
  { token: 'border', name: 'Outlines' },
  { token: 'focus', name: 'Keyboard focus' },
  { token: 'ink', name: 'Ink' },
  { token: 'on-game', name: 'HUD text on the game' },
  { token: 'game-shade', name: 'HUD text halo' },
] as const

export type UiColours = Record<string, string> // token → "#rrggbb"
export type Change = { name: string; from: string; to: string }

/** "Main buttons (primary)" */
export const uiLabel = (token: string) => `${UI_COLOURS.find((c) => c.token === token)?.name ?? token} (${token})`

const isUiColour = (name: string) => UI_COLOURS.some((c) => c.token === name)

/** Tidy a typed colour: "#ABC", "abc", "#AABBCC" → "#aabbcc". Anything else → null. */
export function normalizeHex(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/.test(t)) return '#' + [...t].map((ch) => ch + ch).join('')
  if (/^[0-9a-f]{6}$/.test(t)) return '#' + t
  return null
}

/** Same colour? ("#FFF" and "#ffffff" are.) Non-hex values like "transparent" compare as text. */
export function sameColour(a: string | undefined, b: string | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  return (normalizeHex(a) ?? a) === (normalizeHex(b) ?? b)
}

/** The colours the game shows: the preset's, with the file's tweaks on top. */
export function uiColoursFrom(preset: Record<string, unknown>, tweaks: Record<string, unknown> = {}): UiColours {
  const out: UiColours = {}
  for (const { token } of UI_COLOURS) out[token] = String(tweaks[token] ?? preset[token])
  return out
}

/**
 * What goes in style.json "tweaks" on Save: every colour that differs from the preset
 * (colours equal to the preset are dropped), plus any non-colour tweaks the file already had —
 * this tool only owns the colours, so fonts/spacing tweaks are left exactly as they were.
 */
export function tweaksToSave(
  preset: Record<string, unknown>,
  colours: UiColours,
  oldTweaks: Record<string, unknown> = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(oldTweaks)) if (!isUiColour(name)) out[name] = value
  for (const { token } of UI_COLOURS) {
    if (!sameColour(colours[token], String(preset[token]))) out[token] = colours[token]
  }
  return out
}

/** Every UI colour that differs between two sets, with friendly names, in panel order. */
export function listChanges(before: UiColours, after: UiColours): Change[] {
  const changes: Change[] = []
  for (const { token } of UI_COLOURS) {
    if (!sameColour(before[token], after[token])) changes.push({ name: uiLabel(token), from: before[token], to: after[token] })
  }
  return changes
}

/** Does any UI colour differ? (decides whether Save has anything to write) */
export const uiChanged = (a: UiColours, b: UiColours) => UI_COLOURS.some(({ token }) => !sameColour(a[token], b[token]))

/**
 * The "Copy for Claude" text — any tool can use it, e.g.
 *   Colour changes from the Dev Kit (Roll Better) — saved to content/ui/style.json:
 *   - Main buttons (primary): #ffc629 → #ff9f1c
 * what = "Colour", files = "content/ui/style.json". liveBuild = a release build, which can't save.
 */
export function copyForClaudeText(
  game: string,
  changes: Change[],
  allSaved: boolean,
  liveBuild = false,
  what = 'Colour',
  files = 'content/ui/style.json',
): string {
  if (changes.length === 0) return `No ${what.toLowerCase()} changes in the Dev Kit (${game}) since the game loaded.`
  let status = allSaved ? `saved to ${files}` : 'NOT all saved yet (press Save in the Dev Kit to write them to content/)'
  // The live build can't save — these only exist in that browser tab until Claude writes them in
  if (liveBuild) status = `tried in the live build, NOT saved — please write them into ${files}`
  const lines = changes.map((c) => `- ${c.name}: ${c.from} → ${c.to}`)
  return [`${what} changes from the Dev Kit (${game}) — ${status}:`, ...lines].join('\n')
}

/** The Color tab's one section, for the Dev Kit search: every UI colour, found by its name or token. */
export const UI_COLOUR_SECTION: Section<(typeof UI_COLOURS)[number]> = { id: 'color:UI colours', title: 'UI colours', items: [...UI_COLOURS] }

/** The UI colours matching a search (by name, token, or "style.json"). */
export const searchUiColours = (query: string) =>
  filterSections([UI_COLOUR_SECTION], query, (c: (typeof UI_COLOURS)[number]) => [c.token, c.name, 'style.json'])
