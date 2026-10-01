// The shapes a turn trail is drawn with (TurnTrail.tsx) — plain maths, tested in trailShape.test.ts.
// The cast arc is the SAME curve the thrown seed flies (useThrow.ts uses throwHandle too), so a replayed
// seed travels exactly along the dashed arc it was shown on.
import { hexToPixel, type Hex } from '../engine/hex'

type Point = { x: number; y: number }

/** The bezier handle of a throw from a to b (screen points): above the middle, higher for a longer throw. */
export function throwHandle(a: Point, b: Point, arcHeight: number): Point {
  const distance = Math.hypot(b.x - a.x, b.y - a.y)
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - distance * arcHeight * 2 }
}

const n = (v: number) => +v.toFixed(3)

/** A straight line from hex to hex, as an SVG path (the move: glyphlings move along leylines). */
export function movePath(from: Hex, to: Hex, size: number): string {
  const a = hexToPixel(from, size), b = hexToPixel(to, size)
  return `M ${n(a.x)} ${n(a.y)} L ${n(b.x)} ${n(b.y)}`
}

/** The throw's arc from hex to hex, as an SVG path. */
export function castPath(from: Hex, to: Hex, size: number, arcHeight: number): string {
  const a = hexToPixel(from, size), b = hexToPixel(to, size)
  const h = throwHandle(a, b, arcHeight)
  return `M ${n(a.x)} ${n(a.y)} Q ${n(h.x)} ${n(h.y)} ${n(b.x)} ${n(b.y)}`
}

/**
 * When each part of a replayed trail draws on, as [start, end] shares of trailLead:
 * the from ring → the dotted path → the to ring → the cast arc → the target ring. A move-only turn's parts
 * spread over the whole lead.
 */
export function drawSteps(cast: boolean): Record<'from' | 'path' | 'to' | 'arc' | 'target', [number, number]> {
  return cast
    ? { from: [0, 0.15], path: [0.1, 0.45], to: [0.4, 0.55], arc: [0.5, 0.88], target: [0.82, 1] }
    : { from: [0, 0.25], path: [0.15, 0.8], to: [0.7, 1], arc: [1, 1], target: [1, 1] }
}
