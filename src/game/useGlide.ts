// THE MOVE GLIDE — whenever a glyphling is drawn on a different hex than last time, it slides there
// instead of jumping. It only looks at "was on A, is now on B", so every source animates the same way:
// planning a move (tap/drop), taking it back (Undo / tap the ghost), the dev hook, and later the other
// players' moves arriving online. Each glyphling's group is [data-glide="id"] in Board.tsx.
// The browser animates it (Web Animations API) — no React state per frame. Reduce motion → instant.
import { useLayoutEffect, useRef, type RefObject } from 'react'
import { hexKey, type Hex } from '../engine/hex'
import { reduceMotion } from '../ui/kit'
import { glideFrames, glideSeconds, offsetBetween, type Offset } from './glide'
import { HEX } from './useThrow'
import type { AnimTuning } from './useTuning'

export function useGlide(svgRef: RefObject<SVGSVGElement | null>, spots: { id: number; hex: Hex }[], timing: AnimTuning) {
  const drawnAt = useRef(new Map<number, Hex>()) // where each glyphling was drawn last time
  const key = spots.map((s) => `${s.id}@${hexKey(s.hex)}`).join(' ')

  useLayoutEffect(() => {
    const before = drawnAt.current
    drawnAt.current = new Map(spots.map((s) => [s.id, s.hex])) // glyphlings that left the board are forgotten
    const svg = svgRef.current
    if (!svg || reduceMotion()) return
    for (const { id, hex } of spots) {
      const from = before.get(id)
      if (!from || hexKey(from) === hexKey(hex)) continue
      const group = svg.querySelector<SVGGElement>(`[data-glide="${id}"]`)
      if (!group) continue
      // Start from where it is on screen right now (it may still be gliding from an earlier change)
      const start = addOffsets(offsetBetween(from, hex, HEX), stillToGo(group))
      group.getAnimations().forEach((a) => a.cancel())
      const frames = glideFrames(start, timing.moveSettle).map((f) => ({
        offset: f.offset, transform: `translate(${f.x}px, ${f.y}px)`, easing: 'ease-in-out',
      }))
      group.animate(frames, { duration: glideSeconds(from, hex, timing) * 1000 })
    }
    // Only a change of spots starts a glide (timing is read when it starts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

/** If a glide is still running, how far the group is from where it was heading (else 0, 0). */
function stillToGo(group: SVGGElement): Offset {
  if (group.getAnimations().length === 0) return { x: 0, y: 0 }
  const m = new DOMMatrix(getComputedStyle(group).transform)
  return { x: m.e, y: m.f }
}

const addOffsets = (a: Offset, b: Offset): Offset => ({ x: a.x + b.x, y: a.y + b.y })
