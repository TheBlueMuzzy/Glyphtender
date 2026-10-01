// Word spotlight: one word lit at a time, in order, looping; the label never sits on the word's letters.
import { describe, expect, it } from 'vitest'
import { hexToPixel, type Hex } from '../engine/hex'
import { labelSpot, litWord, spotlightFrames, spotlightSlot } from './spotlight'

// Opacity of a keyframe list at a share (0–1) of the loop, linear between frames (as Web Animations plays them)
function opacityAt(frames: Keyframe[], share: number) {
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i]
    const ao = a.offset as number, bo = b.offset as number
    if (share <= bo) return bo === ao ? (b.opacity as number) : (a.opacity as number) + ((b.opacity as number) - (a.opacity as number)) * (share - ao) / (bo - ao)
  }
  return frames[frames.length - 1].opacity as number
}

describe('word spotlight cycle', () => {
  const hold = 0.8, fade = 0.12
  it('three words take turns: never two lit at once, each lit in its own slot, in order', () => {
    const frames = [0, 1, 2].map((i) => spotlightFrames(i, 3, hold, fade, 1))
    const loop = spotlightSlot(hold, fade) * 3
    for (let s = 0; s < 1; s += 0.005) {
      const lit = frames.map((f) => opacityAt(f, s)).filter((o) => o > 0.001)
      expect(lit.length).toBeLessThanOrEqual(1)
    }
    // the middle of each slot: that word, fully lit
    for (let i = 0; i < 3; i++) {
      const middle = (i + 0.5) * spotlightSlot(hold, fade) / loop
      expect(opacityAt(frames[i], middle)).toBeCloseTo(1)
      expect(litWord(middle * loop, 3, hold, fade)).toBe(i)
    }
    expect(litWord(loop + 0.1, 3, hold, fade)).toBe(0) // …and round again
  })

  it('one word just stays lit (no loop); offsets always run 0 → 1 in order', () => {
    expect(spotlightFrames(0, 1, hold, fade, 0.7)).toEqual([{ opacity: 0.7 }, { opacity: 0.7 }])
    for (const f of [spotlightFrames(1, 2, hold, 0, 1), spotlightFrames(2, 3, hold, fade, 1)]) {
      const offsets = f.map((k) => k.offset as number)
      expect(offsets[0]).toBe(0)
      expect(offsets[offsets.length - 1]).toBe(1)
      expect([...offsets].sort((a, b) => a - b)).toEqual(offsets)
    }
  })

  it('reduce motion (fade 0): words still step one at a time, with no fade in between', () => {
    const frames = [0, 1].map((i) => spotlightFrames(i, 2, hold, 0, 1))
    expect(opacityAt(frames[0], 0.25)).toBe(1)
    expect(opacityAt(frames[1], 0.25)).toBe(0)
    expect(opacityAt(frames[1], 0.75)).toBe(1)
  })
})

describe('the word label', () => {
  const view = { minX: -20, minY: -20, w: 40, h: 40 }
  const covers = (spot: { x: number; y: number }, w: number, h: number, hx: Hex) => {
    const p = hexToPixel(hx, 1)
    const cx = Math.max(spot.x - w / 2, Math.min(p.x, spot.x + w / 2)), cy = Math.max(spot.y - h / 2, Math.min(p.y, spot.y + h / 2))
    return Math.hypot(p.x - cx, p.y - cy) < 0.8
  }
  const word = [{ q: 0, r: 0 }, { q: 0, r: 1 }, { q: 0, r: 2 }] // a word down one column

  it('sits next to the word, never on its letters, and above it when that is free', () => {
    const spot = labelSpot(word, word, view, 3, 1)
    for (const hx of word) expect(covers(spot, 3, 1, hx)).toBe(false)
    expect(spot.y).toBeLessThan(hexToPixel(word[0], 1).y) // above the top letter
    expect(Math.abs(spot.x - hexToPixel(word[0], 1).x)).toBeLessThan(1)
  })

  it('steps round other pieces when it can (above is crowded → somewhere free)', () => {
    const crowd = [{ q: 0, r: -1 }, { q: -1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -2 }, { q: -1, r: -1 }, { q: 1, r: -2 }]
    const spot = labelSpot(word, [...word, ...crowd], view, 3, 1)
    for (const hx of [...word, ...crowd]) expect(covers(spot, 3, 1, hx)).toBe(false)
  })

  it('stays inside the board box', () => {
    const tight = { minX: -1.5, minY: -2, w: 3, h: 8 }
    const spot = labelSpot(word, word, tight, 2.5, 1)
    expect(spot.x - 1.25).toBeGreaterThanOrEqual(tight.minX)
    expect(spot.x + 1.25).toBeLessThanOrEqual(tight.minX + tight.w)
    expect(spot.y - 0.5).toBeGreaterThanOrEqual(tight.minY)
  })
})
