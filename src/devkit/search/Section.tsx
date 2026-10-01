// Shared pieces for any Dev Kit tab that lists settings (Tuning, Color — and a game tab, if it wants):
//   <Section>       a titled group that opens/closes ("Trails · 6"); remembered per game (sectionState.ts).
//                   While searching it is always open, and its title takes you to it (search cleared).
//   <SectionIndex>  one chip per section (a dot carousel) + Expand all / Collapse all, at the top of a tab.
//   <Highlight>     a text with the searched-for parts marked.
// Give each <Section> a unique id ("tuning:Trails") — the search, the chips and the saved open/closed state use it.
import type { ReactNode } from 'react'
import { Carousel } from '../carousel/Carousel'
import { highlightParts } from './searchLogic'
import { goToSection, setSectionsOpen, useSectionOpen } from './sectionState'
import './search.css'

/** A text with every searched-for part in a <mark>. */
export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlightParts(text, terms).map((part, i) =>
        part.hit ? <mark key={i} className="dk-hit">{part.text}</mark> : part.text,
      )}
    </>
  )
}

type SectionProps = {
  id: string
  title: string
  count: number // how many settings it holds (or, while searching, how many match)
  terms: string[] // the search words ([] = not searching)
  defaultOpen: boolean // before it's ever been opened or closed
  changed?: boolean // a setting inside is changed but not saved — shows the dot even while it's closed
  onGoTo?: () => void // while searching: tapping the title goes there (the tab clears the search)
  children: ReactNode
}

export function Section({ id, title, count, terms, defaultOpen, changed, onGoTo, children }: SectionProps) {
  const remembered = useSectionOpen(id, defaultOpen)
  const searching = terms.length > 0
  const open = searching || remembered
  const name = (
    <>
      <span className="dk-section-arrow" aria-hidden="true">{open ? '▾' : '▸'}</span>
      {changed && <span className="dk-dot" title="Changed, not saved yet" />}
      <span className="dk-section-title"><Highlight text={title} terms={terms} /></span>
      <span className="dk-section-count">{count}</span>
    </>
  )
  return (
    <section className="dk-section" data-dk-section={id} data-open={open || undefined}>
      <h3 className="dk-section-head">
        {searching ? (
          <button type="button" className="dk-section-btn" onClick={onGoTo} title="Go to this section (clears the search)">
            {name}
            <span className="dk-section-go">go to ›</span>
          </button>
        ) : (
          <button type="button" className="dk-section-btn" aria-expanded={open} onClick={() => setSectionsOpen([id], !open)}>
            {name}
          </button>
        )}
      </h3>
      {open && <div className="dk-section-body">{children}</div>}
    </section>
  )
}

/** The chips at the top of a tab: tap one to open its section and scroll to it. Plus Expand all / Collapse all. */
export function SectionIndex({ sections, label }: { sections: { id: string; title: string; count: number }[]; label: string }) {
  if (sections.length < 2) return null
  const ids = sections.map((s) => s.id)
  return (
    <nav className="dk-index" aria-label={`${label} sections`}>
      <Carousel className="dk-index-chips" label={`${label} sections`}>
        {sections.map((s) => (
          <button key={s.id} type="button" className="dk-chip" onClick={() => goToSection(s.id)}>
            {s.title} <span className="dk-section-count">{s.count}</span>
          </button>
        ))}
      </Carousel>
      <div className="dk-index-all">
        <button type="button" className="dk-link" onClick={() => setSectionsOpen(ids, true)}>Expand all</button>
        <button type="button" className="dk-link" onClick={() => setSectionsOpen(ids, false)}>Collapse all</button>
      </div>
    </nav>
  )
}
