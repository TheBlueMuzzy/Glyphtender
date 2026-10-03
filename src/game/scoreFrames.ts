// THE SCORE SEQUENCE'S KEYFRAMES — plain functions, tested (scoreFrames.test.ts). Every part of a cast's score
// (wordMarks.scoreSequence) is ONE Web Animation over the whole sequence, all started together at the landing, so the
// parts never drift apart. Times become offsets (share of the whole). Every part ENDS invisible (opacity 0), because
// the animations hold their last frame until the next landing (B007: a faint "+2" once stayed on the board).
// ScorePops.tsx plays them; reduce motion (`still`) = no flying, no scale bounce — words step, the total steps up, fade.
import type { ScoreSequence } from '../store/wordMarks'
import { throwHandle } from './trailShape'

type Timing = { popTime: number; fade: number }

const offsetIn = (seq: ScoreSequence) => (seconds: number) => Math.min(1, Math.max(0, seconds / seq.end))
const move = (x: number, y: number, scale: number) => `translate(${x}px, ${y}px) scale(${scale})`

/**
 * Word `i`'s outline and bubble: dark until its turn, fade in, lit, then gone by the time the next word lights (so
 * two words are never lit at once). The last word stays lit with the final total and fades with it.
 */
export function wordFrames(seq: ScoreSequence, i: number, peak: number, t: Timing, still: boolean): Keyframe[] {
  const at = offsetIn(seq)
  const w = seq.words[i]
  const fade = still ? 0 : t.fade
  const last = i === seq.words.length - 1
  const fadeOut = last ? seq.fadeStart : Math.max(w.start + fade, w.out - fade)
  return [
    { opacity: 0, offset: 0 },
    { opacity: 0, offset: at(w.start) },
    { opacity: peak, offset: at(w.start + fade) },
    { opacity: peak, offset: at(fadeOut) },
    { opacity: 0, offset: at(w.out) },
    { opacity: 0, offset: 1 },
  ]
}

const FLIGHT_STEPS = 14 // points along the arc (the browser draws straight between them — 14 reads as a smooth curve)

/**
 * Points flying (dx, dy) into a total, on the same arc a thrown seed flies (trailShape.throwHandle, anim.json arcHeight —
 * Muzzy: "the points should fly in an arc (like the seed). straight is boring and hard to read"), with the seed's
 * ease in-out. They shrink to 0.6 on the way and fade in the last fifth. `from` / `to` = offsets (shares of the whole
 * animation); `place(x, y, scale)` = the transform for that spot. Used by every "points fly into a total" in the game.
 */
export function flightFrames(dx: number, dy: number, arcHeight: number, from: number, to: number,
  place: (x: number, y: number, scale: number) => string): Keyframe[] {
  const handle = throwHandle({ x: 0, y: 0 }, { x: dx, y: dy }, arcHeight)
  return Array.from({ length: FLIGHT_STEPS + 1 }, (_, k) => {
    const t = k / FLIGHT_STEPS
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2 // ease in-out (the seed's)
    const x = 2 * (1 - e) * e * handle.x + e * e * dx
    const y = 2 * (1 - e) * e * handle.y + e * e * dy
    return { transform: place(x, y, 1 - 0.4 * e), opacity: t <= 0.8 ? 1 : (1 - t) / 0.2, offset: from + (to - from) * t }
  })
}

/** Seed pop `i` ("+2" over its letter): pops in (swelling past full size), waits, flies (dx, dy) on an arc into the
 *  total and vanishes. */
export function popFrames(seq: ScoreSequence, i: number, dx: number, dy: number, swell: number, t: Timing, arcHeight: number): Keyframe[] {
  const at = offsetIn(seq)
  const p = seq.pops[i]
  return [
    { transform: move(0, 0, 0.2), opacity: 0, offset: 0 },
    { transform: move(0, 0, 0.2), opacity: 0, offset: at(p.pop), easing: 'ease-out' },
    { transform: move(0, 0, swell), opacity: 1, offset: at(p.pop + t.popTime * 0.6) },
    { transform: move(0, 0, 1), opacity: 1, offset: at(p.pop + t.popTime) },
    ...flightFrames(dx, dy, arcHeight, at(p.fly), at(p.arrive), move),
    { transform: move(dx, dy, 0.6), opacity: 0, offset: 1 },
  ]
}

/**
 * The running total's size: each time points arrive it pops (swells past its new size and settles) and rests a
 * little BIGGER than before (Arrival.size). A pop cut short by the next arrival swells less. Still = it just steps up.
 */
export function totalScaleFrames(seq: ScoreSequence, swell: number, t: Timing, still: boolean): Keyframe[] {
  const at = offsetIn(seq)
  const list = seq.arrivals
  if (!list.length) return [{ transform: 'scale(1)' }, { transform: 'scale(1)' }]
  let size = still ? list[0].size : list[0].size * 0.3 // the first total grows in from small
  const frames: Keyframe[] = [{ transform: `scale(${size})`, offset: 0 }]
  list.forEach((a, k) => {
    frames.push({ transform: `scale(${size})`, offset: at(a.at), easing: 'ease-out' })
    if (!still) {
      const settle = Math.min(a.at + t.popTime, list[k + 1]?.at ?? Infinity)
      const bounce = 1 + (swell - 1) * Math.min(1, (settle - a.at) / t.popTime)
      frames.push({ transform: `scale(${a.size * bounce})`, offset: at(a.at + (settle - a.at) * 0.4) })
      frames.push({ transform: `scale(${a.size})`, offset: at(settle) })
    } else frames.push({ transform: `scale(${a.size})`, offset: at(a.at) })
    size = a.size
  })
  frames.push({ transform: `scale(${size})`, offset: 1 })
  return frames
}

/** The total's number after arrival `k` ("+4"): shows from its arrival until the next one replaces it; the last holds, then fades. */
export function countFrames(seq: ScoreSequence, k: number): Keyframe[] {
  const at = offsetIn(seq)
  const a = seq.arrivals[k]
  const next = seq.arrivals[k + 1]
  const shown = { opacity: 1 }, hidden = { opacity: 0 }
  return [
    { ...hidden, offset: 0 },
    { ...hidden, offset: at(a.at) },
    { ...shown, offset: at(a.at) },
    ...(next
      ? [{ ...shown, offset: at(next.at) }, { ...hidden, offset: at(next.at) }]
      : [{ ...shown, offset: at(seq.fadeStart) }, { ...hidden, offset: at(seq.end) }]),
    { ...hidden, offset: 1 },
  ]
}
