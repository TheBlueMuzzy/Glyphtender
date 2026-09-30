import { describe, expect, it } from 'vitest'
import { glideFrames, glideSeconds, hexSteps, offsetBetween } from './glide'

const timing = { moveBase: 0.15, movePerHex: 0.04 }

describe('move glide (F15)', () => {
  it('counts hex steps along every leyline', () => {
    expect(hexSteps({ q: 0, r: 0 }, { q: 0, r: 3 })).toBe(3) // N–S
    expect(hexSteps({ q: 0, r: 0 }, { q: 2, r: 0 })).toBe(2) // NW–SE
    expect(hexSteps({ q: 0, r: 0 }, { q: 4, r: -4 })).toBe(4) // SW–NE
    expect(hexSteps({ q: 2, r: 1 }, { q: 2, r: 1 })).toBe(0)
  })

  it('takes moveBase + movePerHex × hexes', () => {
    expect(glideSeconds({ q: 0, r: 0 }, { q: 0, r: 1 }, timing)).toBeCloseTo(0.19)
    expect(glideSeconds({ q: 0, r: 0 }, { q: 5, r: -5 }, timing)).toBeCloseTo(0.35)
  })

  it('starts at A and ends exactly on B', () => {
    const start = offsetBetween({ q: 0, r: 0 }, { q: 0, r: 2 }, 1)
    expect(start.x).toBeCloseTo(0)
    expect(start.y).toBeCloseTo(-2 * Math.sqrt(3)) // A is two hexes above B
    const frames = glideFrames(start, 0)
    expect(frames).toEqual([{ offset: 0, ...start }, { offset: 1, x: 0, y: 0 }])
  })

  it('the settle goes a little past B, the way it was travelling, then comes back', () => {
    const frames = glideFrames({ x: 0, y: -3 }, 0.06) // moving down
    expect(frames).toHaveLength(3)
    expect(frames[1].y).toBeCloseTo(0.06)
    expect(frames[1].x).toBeCloseTo(0)
    expect(frames[2]).toEqual({ offset: 1, x: 0, y: 0 })
  })
})
