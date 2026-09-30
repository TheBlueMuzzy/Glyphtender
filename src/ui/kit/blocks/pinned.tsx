// PINNED BOX — kit parts (a PlayerChip, a HudText…) stuck to a point in the game's world, e.g. beside a row
// on a 3D table. Kit parts are sized for the page (rem), but a pinned piece must grow and shrink WITH the table,
// or it covers the dice on a phone and looks tiny on a big screen. PinnedBox does that sizing.
// It knows nothing about 3D: the game's small adapter (see CATALOG.md → Pinned) puts it at the point and tells it
//   pixelsPerUnit: how many screen pixels one world unit takes up at that point right now.
// Then PinnedBox scales what's inside:
//   fit: [width, height] in world units — shrink or grow to fit that box on the table (whichever side is tighter).
//   rem: world units per rem (the kit's text size at normal text setting). Pieces with the same rem are drawn at
//        the same size (a column of chips), however long their words are; fit still shrinks one that would spill out.
//   anchor: which part of the piece sits on the point — 'right' (its right-middle: chips left of a row, the default),
//           'center' (its middle: banners) or 'left' (its left-middle).
//   name: shows up as data-pin="name", so game code can find the piece on the page.
// It is hidden until its first measure (never flashes at the wrong size), wears kit-scope (the style's fonts and
// colours) and never catches taps: the game underneath gets them.
import { useEffect, useRef, type ReactNode } from 'react'

// Page pixels in one rem at normal text size. Fixed on purpose: a bigger text setting makes pinned pieces bigger too.
export const REM_PIXELS = 16

// The scale that makes a piece measured at width × height (page pixels, unscaled) fit its box in the world.
// Returns null while the piece has no size yet (not drawn).
type PinScaleInput = { width: number; height: number; pixelsPerUnit: number; fit?: [number, number]; rem?: number }
export function pinScale({ width, height, pixelsPerUnit, fit, rem }: PinScaleInput) {
  if (!width || !height) return null
  let scale = Infinity
  if (fit) scale = Math.min((fit[0] * pixelsPerUnit) / width, (fit[1] * pixelsPerUnit) / height)
  if (rem) scale = Math.min(scale, (rem * pixelsPerUnit) / REM_PIXELS)
  return scale === Infinity ? 1 : scale
}

export type PinnedBoxProps = {
  pixelsPerUnit: number; fit?: [number, number]; rem?: number
  anchor?: 'right' | 'center' | 'left'; name?: string; children: ReactNode
}
export function PinnedBox({ pixelsPerUnit, fit, rem, anchor = 'right', name, children }: PinnedBoxProps) {
  const box = useRef<HTMLDivElement>(null)
  const [fitW, fitH] = fit ?? []
  // Measured again whenever the table's scale changes and whenever the piece's own content changes size.
  // offsetWidth/Height ignore the scale transform, so measuring never feeds back into itself.
  useEffect(() => {
    const el = box.current
    if (!el) return
    const apply = () => {
      const scale = pinScale({ width: el.offsetWidth, height: el.offsetHeight, pixelsPerUnit,
        fit: fitW === undefined || fitH === undefined ? undefined : [fitW, fitH], rem })
      if (scale === null) return
      el.style.setProperty('--kit-pin-scale', String(scale))
      el.dataset.ready = 'true'
    }
    apply()
    const watcher = new ResizeObserver(apply)
    watcher.observe(el)
    return () => watcher.disconnect()
  }, [pixelsPerUnit, fitW, fitH, rem])
  return <div ref={box} className="kit-scope kit-pinned" data-anchor={anchor} data-pin={name}>{children}</div>
}
