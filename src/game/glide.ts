// THE MOVE GLIDE, the plain maths (tested in glide.test.ts). A glyphling that was on hex A and is now on
// hex B slides there in a straight line — along its leyline for a real move.
// Time = moveBase + movePerHex × hexes (content/tuning/anim.json). useGlide.ts plays it.
import { hexToPixel, type Hex } from '../engine/hex'

/** How many hex steps apart two hexes are (1 = next door). */
export function hexSteps(a: Hex, b: Hex): number {
  const dq = b.q - a.q, dr = b.r - a.r
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2
}

/** How long a glide from A to B takes, in seconds. */
export function glideSeconds(a: Hex, b: Hex, timing: { moveBase: number; movePerHex: number }): number {
  return timing.moveBase + timing.movePerHex * hexSteps(a, b)
}

/** A point on screen, relative to where the glyphling is now drawn. */
export interface Offset { x: number; y: number }

/**
 * The glide's key frames, as offsets from the glyphling's NEW spot (it is already drawn at B; the glide
 * starts it back at `start` and slides it home). With `settle` > 0 it goes that far past B (in hex sizes)
 * and eases back — a tiny, cozy bounce. `start` is usually A − B.
 */
export function glideFrames(start: Offset, settle: number): { offset: number; x: number; y: number }[] {
  const length = Math.hypot(start.x, start.y)
  if (settle <= 0 || length === 0) return [{ offset: 0, ...start }, { offset: 1, x: 0, y: 0 }]
  // Past B = further along the way it was travelling (the opposite way from where it started)
  const past = { x: (-start.x / length) * settle, y: (-start.y / length) * settle }
  return [{ offset: 0, ...start }, { offset: 0.8, ...past }, { offset: 1, x: 0, y: 0 }]
}

/** From hex A to hex B, as an offset from B (hexes drawn at `size`). */
export function offsetBetween(a: Hex, b: Hex, size: number): Offset {
  const pa = hexToPixel(a, size), pb = hexToPixel(b, size)
  return { x: pa.x - pb.x, y: pa.y - pb.y }
}
