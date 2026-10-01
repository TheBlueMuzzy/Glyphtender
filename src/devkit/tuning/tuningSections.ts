// How the Tuning tab groups and names the settings — kept apart from its looks so it can be tested
// (tuningSections.test.ts, in the framework). Nothing here touches the page or the files.
//
// A tuning file may carry these notes for people (keys starting with _ are never shown as values):
//   "_help":     { "trailFade": "How long the trail takes to fade, in seconds." }   — a line under the setting
//                (or one string = a note for the whole file)
//   "_labels":   { "trailFade": "Trail: fade time" }                                — the name Muzzy sees
//                (none → made from the key: "trailFade" → "Trail fade")
//   "_sections": { "Trails": ["trailFade", "trailWidth"], "End screen": ["awardPriority"] }
//                — the section each setting sits in, in this order. A group key ("awardPriority") brings all of
//                its settings. Sections with the SAME title in different files become one section.
//                Settings left out go in a "<file>.json" section; a file with no _sections is one section.
//   "_ranges":   slider ranges (tuningLogic.ts sliderRange)
// The keys themselves never change for this — the game's code reads them.
// content/devkit.json "sectionOrder": ["Board look", "Trails", …] = the order of the sections (others follow).
import { filterSections, readableKey, type Section } from '../search/searchLogic'
import { listFields, nameOf, type Field, type TuningData } from './tuningLogic'

export type TuningItem = { file: string; path: string; kind: Field['kind']; label: string; help?: string }
export type TuningSection = Section<TuningItem> & {
  grouped: boolean // a whole file with no _sections: show its nested groups as headings, like before sections
  note?: string // a file's one-line _help, for its own section
}

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined)

/** Every setting of every tuning file, in titled sections (see the notes at the top). */
export function tuningSections(files: { name: string; data: TuningData }[], order: string[] = []): TuningSection[] {
  const byTitle = new Map<string, TuningSection>()
  const add = (title: string, item: TuningItem, extra: Partial<TuningSection> = {}) => {
    let section = byTitle.get(title)
    if (!section) byTitle.set(title, (section = { id: `tuning:${title}`, title, items: [], grouped: false, ...extra }))
    section.items.push(item)
  }

  for (const { name, data } of files) {
    const fields = listFields(data)
    const labels = isRecord(data._labels) ? data._labels : {}
    const help = isRecord(data._help) ? data._help : {}
    const sections = isRecord(data._sections) ? data._sections : null
    const item = (f: Field): TuningItem => ({
      file: name,
      path: f.path,
      kind: f.kind,
      label: text(labels[f.path]) ?? readableKey(sections ? f.path : nameOf(f.path)),
      help: text(help[f.path]),
    })

    const placed = new Set<string>()
    for (const [title, entries] of Object.entries(sections ?? {})) {
      if (!Array.isArray(entries)) continue
      for (const entry of entries) {
        for (const f of fields) {
          if (placed.has(f.path) || (f.path !== entry && !f.path.startsWith(`${entry}.`))) continue
          placed.add(f.path)
          add(title, item(f))
        }
      }
    }
    // Everything not in a section: the file's own section
    const title = sections ? `${name}.json (no section)` : `${name}.json`
    for (const f of fields) if (!placed.has(f.path)) add(title, item(f), { grouped: !sections, note: text(data._help) })
  }

  const all = [...byTitle.values()]
  const rank = (s: TuningSection) => {
    const at = order.indexOf(s.title)
    return at === -1 ? order.length : at
  }
  return all.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).map(({ s }) => s)
}

/** The texts a search looks through for one setting: key, label, help, file name. */
export const tuningTexts = (item: TuningItem) => [item.path, item.label, item.help, `${item.file}.json`]

/** The sections and settings matching a search (searchLogic.ts filterSections). */
export const searchTuning = (sections: TuningSection[], query: string) => filterSections(sections, query, tuningTexts)
