// The score sequence's keyframes: every part ends invisible (B007), words never overlap, the total steps up in size.
import { describe, expect, it } from 'vitest'
import animJson from '../../content/tuning/anim.json'
import { scoreSequence, type ScorePop } from '../store/wordMarks'
import { countFrames, flightFrames, popFrames, totalScaleFrames, wordFrames } from './scoreFrames'

const pop = (word: number, order: number): ScorePop => ({ hex: { q: order, r: 0 }, amount: 2, word, order, stack: 0 })
const seq = scoreSequence([pop(0, 0), pop(0, 1), pop(1, 2), pop(1, 3), pop(2, 4), pop(2, 5)], animJson)
const t = { popTime: animJson.scorePopTime, fade: animJson.spotlightFade }
const opacityAt = (frames: Keyframe[], offset: number) => {
  // the value at `offset` (step-wise reading is enough here: the frames' own values at their offsets)
  let value = Number(frames[0].opacity)
  for (const f of frames) if ((f.offset as number) <= offset + 1e-9) value = Number(f.opacity)
  return value
}
const sorted = (frames: Keyframe[]) => frames.every((f, i) => i === 0 || (f.offset as number) >= (frames[i - 1].offset as number))

describe('score sequence keyframes', () => {
  const all = [
    ...seq.words.map((_, i) => wordFrames(seq, i, 1, t, false)),
    ...seq.words.map((_, i) => wordFrames(seq, i, 1, t, true)),
    ...seq.pops.map((_, i) => popFrames(seq, i, 3, -2, 1.3, t, animJson.arcHeight)),
    ...seq.arrivals.map((_, k) => countFrames(seq, k)),
  ]

  it('B007: every part ends invisible, and the offsets only go forward', () => {
    for (const frames of all) {
      expect(Number(frames.at(-1)!.opacity)).toBe(0)
      expect(sorted(frames)).toBe(true)
    }
    expect(sorted(totalScaleFrames(seq, 1.5, t, false))).toBe(true)
    expect(sorted(totalScaleFrames(seq, 1.5, t, true))).toBe(true)
  })

  it('never two words lit at once', () => {
    const words = seq.words.map((_, i) => wordFrames(seq, i, 1, t, false))
    for (let s = 0; s <= 1; s += 0.002) expect(words.filter((f) => opacityAt(f, s) > 0.5).length).toBeLessThanOrEqual(1)
  })

  it('exactly one total number shows from the first arrival until the fade', () => {
    const counts = seq.arrivals.map((_, k) => countFrames(seq, k))
    const first = seq.arrivals[0].at / seq.end, fade = seq.fadeStart / seq.end
    for (let s = first + 0.001; s < fade; s += 0.002) expect(counts.filter((f) => opacityAt(f, s) === 1).length).toBe(1)
  })

  it('reduce motion: the total still steps up in size (no bounce)', () => {
    const sizes = totalScaleFrames(seq, 1.5, t, true).map((f) => Number(/scale\(([\d.]+)\)/.exec(String(f.transform))![1]))
    expect(sizes.every((v, i) => i === 0 || v >= sizes[i - 1])).toBe(true)
    expect(sizes.at(-1)).toBeCloseTo(seq.arrivals.at(-1)!.size)
  })

  it('points fly on an ARC (like the seed), not a straight line — they lift above the straight path, and land on the total', () => {
    const place = (x: number, y: number, scale: number) => `${x},${y},${scale}`
    const frames = flightFrames(100, 0, animJson.arcHeight, 0.2, 0.6, place)
    const spots = frames.map((f) => String(f.transform).split(',').map(Number))
    expect(Math.min(...spots.map(([, y]) => y))).toBeLessThan(-20) // well above the straight line (y = 0)
    expect(spots.at(-1)!.slice(0, 2)).toEqual([100, 0])
    expect(frames[0].offset).toBe(0.2)
    expect(frames.at(-1)!.offset).toBeCloseTo(0.6)
    expect(Number(frames.at(-1)!.opacity)).toBe(0)
  })
})
