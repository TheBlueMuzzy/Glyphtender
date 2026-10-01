// DOT CAROUSEL — a row of things that may not all fit (tabs, chips). Instead of a sideways scroll bar it shows as
// many WHOLE items as fit; ◀ ▶ slide it a page at a time, and dots under it show which page you're on (tap one to
// jump there). A page never shows an item cut in half. Everything fits → just the row: no arrows, no dots. (Muzzy, 2026-10-01: "the dev kit shouldn't have a
// scroll bar, but a dot carousel UI with arrows that moves it left/right".)
//   <Carousel label="Tools" role="tablist" active={selectedIndex}>{tabs}</Carousel>
// active: the item to keep in view (the selected tab) — the carousel turns to its page when it changes.
// Keyboard: tabbing onto an item on another page turns to that page. Pages: carouselPages.ts (plain maths, tested).
import { Children, useCallback, useLayoutEffect, useRef, useState, type FocusEvent, type ReactNode } from 'react'
import { carouselPages, pageOf, type CarouselPage, type ItemBox } from './carouselPages'
import './carousel.css'

type Props = {
  children: ReactNode
  /** What the row is, for screen readers ("Tools") — also names the arrows ("Next tools"). */
  label: string
  /** The row's own role, e.g. "tablist" (the arrows and dots sit outside it). */
  role?: string
  active?: number
  className?: string
}

type Layout = { pages: CarouselPage[]; items: ItemBox[]; view: number }
const ONE_PAGE: Layout = { pages: [{ first: 0, offset: 0, width: 0 }], items: [], view: 0 }

export function Carousel({ children, label, role, active, className = '' }: Props) {
  const viewRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<Layout>(ONE_PAGE)
  const [page, setPage] = useState(0)
  const count = Children.count(children)

  // Where every item sits, and how wide the window onto them is → the pages
  const measure = useCallback(() => {
    const view = viewRef.current
    const track = trackRef.current
    if (!view || !track) return
    const items = [...track.children].map((el) => ({ left: (el as HTMLElement).offsetLeft, width: (el as HTMLElement).offsetWidth }))
    const width = view.clientWidth
    setLayout((old) => {
      const pages = carouselPages(items, width)
      const same = old.view === width && JSON.stringify(old.items) === JSON.stringify(items)
      return same ? old : { pages, items, view: width }
    })
  }, [])
  useLayoutEffect(() => {
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(measure)
    if (viewRef.current) watch.observe(viewRef.current)
    if (trackRef.current) {
      watch.observe(trackRef.current)
      for (const item of trackRef.current.children) watch.observe(item)
    }
    return () => watch.disconnect()
  }, [measure, count])

  // Keep the active item (the selected tab) in view: when it (or the pages) change, turn to its page.
  // (Done while drawing, React's "adjust state when a prop changes" pattern — not in an effect.)
  const [shown, setShown] = useState<{ active?: number; pages?: CarouselPage[] }>({})
  if (active !== undefined && active >= 0 && (shown.active !== active || shown.pages !== layout.pages)) {
    setShown({ active, pages: layout.pages })
    setPage(pageOf(layout.pages, active))
  }

  // Tabbing onto an item on another page turns to it
  const onFocus = (e: FocusEvent) => {
    const track = trackRef.current
    if (!track) return
    const index = [...track.children].findIndex((item) => item.contains(e.target as Node))
    if (index >= 0) setPage(pageOf(layout.pages, index))
  }

  const pages = layout.pages
  const at = Math.min(page, pages.length - 1)
  const paged = pages.length > 1
  const name = label.toLowerCase()
  return (
    <div className={`dk-carousel ${className}`} data-paged={paged || undefined}>
      {paged && (
        <button type="button" className="dk-carousel-arrow" data-side="prev" aria-label={`Previous ${name}`} title={`Previous ${name}`}
          disabled={at === 0} onClick={() => setPage(at - 1)}>◀</button>
      )}
      {/* (clipped to the page's whole items: the next page's first item never peeks in, cut in half) */}
      <div ref={viewRef} className="dk-carousel-view"
        style={paged ? { clipPath: `inset(-4px ${Math.max(0, layout.view - pages[at].width)}px -4px -4px)` } : undefined}>
        <div ref={trackRef} className="dk-carousel-track" role={role} aria-label={label} onFocus={onFocus}
          style={{ transform: `translateX(${-pages[at].offset}px)` }}>
          {children}
        </div>
      </div>
      {paged && (
        <button type="button" className="dk-carousel-arrow" data-side="next" aria-label={`Next ${name}`} title={`Next ${name}`}
          disabled={at === pages.length - 1} onClick={() => setPage(at + 1)}>▶</button>
      )}
      {paged && (
        <div className="dk-carousel-dots">
          {pages.map((_, i) => (
            <button key={i} type="button" className="dk-carousel-dot" aria-label={`${label}: page ${i + 1} of ${pages.length}`}
              aria-current={i === at || undefined} onClick={() => setPage(i)} />
          ))}
        </div>
      )}
    </div>
  )
}
