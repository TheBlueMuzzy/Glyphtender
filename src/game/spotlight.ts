// WORD SPOTLIGHT (F25) — plain functions, tested (spotlight.test.ts). When a cast makes 2+ words, the board outlines
// ONE word at a time (QUA → TAB → AY → QUA …) so overlapping words never read as one blob (Muzzy saw Q-A-O lit at once
// and read "QAO"). Each word gets an equal slot of the loop: fade in → hold → fade out, then the next word.
// The slots never overlap, so at most one word is lit at any moment. Timings: anim.json spotlightHold / spotlightFade.
// The word's label ("QUA +4", garden.json spotlightLabel) goes on the nearest free spot that covers no letters.
import { hexKey, hexToPixel, type Hex } from '../engine/hex'

/** One slot in the loop, in seconds: fade in + hold + fade out. */
export const spotlightSlot = (hold: number, fade: number) => hold + 2 * fade

/**
 * Keyframes for word `index` of `count`, over one whole loop (count slots). Opacity 0 outside its own slot.
 * One word (count 1) → steady at `peak`, no loop.
 */
export function spotlightFrames(index: number, count: number, hold: number, fade: number, peak: number): Keyframe[] {
  if (count <= 1) return [{ opacity: peak }, { opacity: peak }]
  const slot = spotlightSlot(hold, fade)
  const loop = slot * count
  const at = (seconds: number) => Math.min(1, Math.max(0, seconds / loop))
  const start = index * slot
  return [
    { opacity: 0, offset: 0 },
    { opacity: 0, offset: at(start) },
    { opacity: peak, offset: at(start + fade) },
    { opacity: peak, offset: at(start + fade + hold) },
    { opacity: 0, offset: at(start + slot) },
    { opacity: 0, offset: 1 },
  ]
}

/** Whose slot it is `seconds` into the loop (its fades count as its own). No words → -1. */
export function litWord(seconds: number, count: number, hold: number, fade: number): number {
  if (count <= 1) return count - 1
  const slot = spotlightSlot(hold, fade)
  const t = ((seconds % (slot * count)) + slot * count) % (slot * count)
  return Math.min(count - 1, Math.floor(t / slot))
}

// ---- where the label goes ----
export interface Box { minX: number; minY: number; w: number; h: number }

const LETTER = 0.8 // a piece's letter/art, as a circle this big round its hex centre (hex size 1: corner 1, edge 0.87)
const STEP = 0.25 // candidate spots are tried on a grid this fine

// How far a rectangle (centre x,y, size w×h) is from a circle round point p; 0 = they touch or overlap
function gap(x: number, y: number, w: number, h: number, p: { x: number; y: number }, r: number) {
  const cx = Math.max(x - w / 2, Math.min(p.x, x + w / 2))
  const cy = Math.max(y - h / 2, Math.min(p.y, y + h / 2))
  return Math.max(0, Math.hypot(p.x - cx, p.y - cy) - r)
}

/**
 * The centre of a w×h label for `word`: never on the word's own letters, and as far as possible off every other
 * piece (`taken`: seeds and glyphlings), inside `view` (the board's SVG box), as close to the word as it can be.
 * Of the free spots, the one just over the word's top wins. Board units (a hex is size 1).
 */
export function labelSpot(word: Hex[], taken: Hex[], view: Box, w: number, h: number): { x: number; y: number } {
  const mine = new Set(word.map(hexKey))
  const own = word.map((hx) => hexToPixel(hx, 1))
  const others = taken.filter((hx) => !mine.has(hexKey(hx))).map((hx) => hexToPixel(hx, 1))
  const xs = own.map((p) => p.x), ys = own.map((p) => p.y)
  const mid = { x: (Math.min(...xs) + Math.max(...xs)) / 2 }
  const top = Math.min(...ys)
  const reach = 5 // how far (hex sizes) beyond the word to look
  let best = { x: mid.x, y: top - 1.5, cost: Infinity }
  for (let x = Math.min(...xs) - reach; x <= Math.max(...xs) + reach; x += STEP) {
    if (x - w / 2 < view.minX || x + w / 2 > view.minX + view.w) continue
    for (let y = Math.min(...ys) - reach; y <= Math.max(...ys) + reach; y += STEP) {
      if (y - h / 2 < view.minY || y + h / 2 > view.minY + view.h) continue
      let cost = 0
      let near = Infinity
      for (const p of own) {
        const g = gap(x, y, w, h, p, LETTER)
        if (g === 0) cost += 1000 // never over the word's own letters
        near = Math.min(near, g)
      }
      for (const p of others) if (gap(x, y, w, h, p, LETTER) === 0) cost += 40 // rather not over another piece
      cost += near // close to the word
      cost += Math.hypot(x - mid.x, y - top) * 0.3 // …best just over its top, in the middle
      if (cost < best.cost) best = { x, y, cost }
    }
  }
  return { x: best.x, y: best.y }
}
