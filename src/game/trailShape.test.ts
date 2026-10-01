import { describe, expect, it } from 'vitest'
import { hexToPixel } from '../engine/hex'
import { castPath, drawSteps, movePath, throwHandle } from './trailShape'

describe('trail shapes', () => {
  it('the move is a straight line from hex centre to hex centre', () => {
    const b = hexToPixel({ q: 0, r: -2 }, 1)
    expect(movePath({ q: 0, r: 0 }, { q: 0, r: -2 }, 1)).toBe(`M 0 0 L 0 ${+b.y.toFixed(3)}`)
  })

  it('the cast arc is the throw curve: its handle sits above the middle, higher for a longer throw', () => {
    const a = { x: 0, y: 0 }, near = { x: 2, y: 0 }, far = { x: 4, y: 0 }
    expect(throwHandle(a, near, 0.35)).toEqual({ x: 1, y: -1.4 })
    expect(throwHandle(a, far, 0.35).y).toBeLessThan(throwHandle(a, near, 0.35).y)
    expect(throwHandle(a, near, 0)).toEqual({ x: 1, y: 0 }) // flat
    expect(castPath({ q: 0, r: 0 }, { q: 2, r: -1 }, 1, 0.35)).toMatch(/^M 0 0 Q /)
  })

  it('the parts draw on in order — from ring, path, to ring, arc, target ring — inside the lead', () => {
    for (const cast of [true, false]) {
      const s = drawSteps(cast)
      const order = [s.from, s.path, s.to, s.arc, s.target]
      for (const [start, end] of order) expect(0 <= start && start <= end && end <= 1).toBe(true)
      for (let i = 1; i < order.length; i++) expect(order[i][0]).toBeGreaterThanOrEqual(order[i - 1][0])
    }
  })
})
