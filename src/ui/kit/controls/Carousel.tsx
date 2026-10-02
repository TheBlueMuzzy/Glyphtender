// CAROUSEL — one item at a time (highlights, tips, unlocks), moving on by itself.
//   <Carousel label="Highlights" autoSeconds={4} pauseSeconds={3}>{items}</Carousel>
// Every `autoSeconds` it shows the next item (wrapping round to the first). Tapping the item, ◀ ▶, ← / → or a sideways
// swipe moves to the next / previous one AND holds the auto-advance for `pauseSeconds` (then it carries on as usual:
// the next turn comes pauseSeconds + autoSeconds after the tap). Page dots under it show where you are (not buttons:
// a long row of 44px dots wouldn't fit a phone). One item: just the item. None: nothing.
// Reduce motion: no slide — the next item just appears; it still moves on by itself.
// index / onIndexChange: optional, to know (or set) which item shows — e.g. to mark it somewhere else.
// The pointer events stop here, so a swipe on the carousel never also turns a page it sits on.
import { Children, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { Button } from './Button'

type CarouselProps = {
  children: ReactNode
  /** What the items are, for screen readers ("Highlights") — also names the arrows ("Next highlights"). */
  label: string
  /** Seconds each item shows before the next. 0 = never moves on by itself. */
  autoSeconds?: number
  /** Seconds the auto-advance holds after a tap, an arrow or a swipe. */
  pauseSeconds?: number
  /** Which item shows (controlled), and/or a callback when it changes. */
  index?: number
  onIndexChange?: (index: number) => void
  className?: string
}

const SWIPE = 40 // px sideways (and more sideways than up/down) to count as a swipe
const TAP = 10 // px: moved less than this = a tap

export function Carousel({ children, label, autoSeconds = 4, pauseSeconds = 3, index, onIndexChange, className = '' }: CarouselProps) {
  const items = Children.toArray(children)
  const count = items.length
  const [own, setOwn] = useState(0)
  const raw = index ?? own
  const at = count ? ((raw % count) + count) % count : 0
  // Each user action restarts the timer with the pause added on (taps counts them; byUser says what the timer waits for)
  const [taps, setTaps] = useState(0)
  const byUser = useRef(false)

  const show = (next: number) => {
    const wrapped = ((next % count) + count) % count
    if (index === undefined) setOwn(wrapped)
    onIndexChange?.(wrapped)
  }
  const step = (direction: -1 | 1) => {
    byUser.current = true
    setTaps((n) => n + 1)
    show(at + direction)
  }

  useEffect(() => {
    if (count < 2 || !(autoSeconds > 0)) return
    const wait = (autoSeconds + (byUser.current ? Math.max(0, pauseSeconds) : 0)) * 1000
    const timer = setTimeout(() => {
      byUser.current = false
      show(at + 1)
    }, wait)
    return () => clearTimeout(timer)
    // (show is a new function every draw; the timer only needs to restart when these change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, taps, count, autoSeconds, pauseSeconds])

  // A tap moves on; a sideways swipe goes either way
  const start = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (e: PointerEvent) => {
    e.stopPropagation()
    start.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: PointerEvent) => {
    e.stopPropagation()
    const from = start.current
    start.current = null
    if (!from || count < 2) return
    const dx = e.clientX - from.x
    const dy = e.clientY - from.y
    if (Math.abs(dx) >= SWIPE && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1)
    else if (Math.abs(dx) < TAP && Math.abs(dy) < TAP) step(1)
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (count < 2 || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
    e.preventDefault()
    step(e.key === 'ArrowLeft' ? -1 : 1)
  }

  if (!count) return null
  const many = count > 1
  const name = label.toLowerCase()
  return (
    <div className={`kit-carousel ${className}`} role="region" aria-roledescription="carousel" aria-label={label}
      data-many={many || undefined} onKeyDown={onKeyDown}>
      <div className="kit-carousel-row">
        {many && <Button variant="ghost" icon aria-label={`Previous ${name}`} onClick={() => step(-1)}>◀</Button>}
        <div className="kit-carousel-view" onPointerDown={onPointerDown} onPointerUp={onPointerUp}
          onPointerCancel={() => (start.current = null)}>
          <div className="kit-carousel-track" style={{ '--kit-carousel-at': at } as CSSProperties}>
            {items.map((item, i) => (
              <div key={i} className="kit-carousel-item" role="group" aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}`} aria-hidden={i !== at || undefined} inert={i !== at || undefined}
                data-current={i === at || undefined}>
                {item}
              </div>
            ))}
          </div>
        </div>
        {many && <Button variant="ghost" icon aria-label={`Next ${name}`} onClick={() => step(1)}>▶</Button>}
      </div>
      {many && (
        <div className="kit-carousel-dots" aria-hidden="true">
          {items.map((_, i) => <span key={i} className="kit-carousel-dot" data-state={i === at ? 'on' : undefined} />)}
        </div>
      )}
    </div>
  )
}
