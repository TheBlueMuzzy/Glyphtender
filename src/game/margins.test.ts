import { describe, expect, it } from 'vitest'
import { edgeMargin, promptHangRoom, sideGaps } from './margins'

describe('the margin round the edges', () => {
  it('phones get the smallest margin; big screens a share of their shorter side', () => {
    expect(edgeMargin(390, 844, 16, 0.035)).toBe(16) // 390 × 0.035 = 13.7 → the 16 floor
    expect(edgeMargin(1443, 900, 16, 0.035)).toBe(32) // 900 × 0.035 = 31.5
    expect(edgeMargin(1920, 1080, 16, 0.035)).toBe(38)
  })
})

describe('even gaps with the board beside the tray', () => {
  // A square board (aspect 1) with no margin of its own, a column exactly as wide as its tray, no grid gap:
  // what's seen is the board (height − 2 margins) and the tray; the rest splits into 3 equal gaps.
  const base = { width: 1000, height: 500, edge: 20, gap: 0, column: 200, content: 200, aspect: 1, insetShare: 0 }

  it('splits the spare width into 3 equal gaps: edge | board | tray | edge', () => {
    // board 460 wide, tray 200 → 340 spare → 113.3 each
    const g = sideGaps(base)
    expect(g.board).toBeCloseTo(340 / 3)
    expect(g.middle).toBeCloseTo(340 / 3)
    expect(g.column).toBeCloseTo(340 / 3)
  })

  it('counts the grid gap next to each ruler, the board’s own margin and the column’s room round its tray', () => {
    const g = sideGaps({ ...base, gap: 8, column: 260, insetShare: 0.05 })
    const boardW = 460, inset = boardW * 0.05, spare = 30 // (260 − 200) / 2 each side of the tray
    const even = (1000 - (boardW - 2 * inset) - 200) / 3
    // what you'd SEE: ruler + grid gaps + the board's inset / the column's spare
    expect(g.board + 8 + inset).toBeCloseTo(even)
    expect(g.middle + 2 * 8 + inset + spare).toBeCloseTo(even)
    expect(g.column + 8 + spare).toBeCloseTo(even)
  })

  it('too narrow for the board at full height: every gap is just the margin (the board takes the rest)', () => {
    const g = sideGaps({ ...base, width: 700 }) // 700 − 460 − 200 = 40 spare → 13 a gap, under the 20 margin
    expect(g).toEqual({ board: 20, middle: 20, column: 20 })
  })

  it('never a negative ruler, and the column’s box (its ☰) never nearer the edge than the margin', () => {
    const g = sideGaps({ ...base, width: 700, gap: 8, column: 300, insetShare: 0.1 })
    expect(Math.min(g.board, g.middle, g.column)).toBeGreaterThanOrEqual(0)
    expect(g.column + 8).toBeGreaterThanOrEqual(20)
  })
})

describe('room for the glyphling beside the prompt (side layout)', () => {
  const base = { width: 1000, height: 500, edge: 20, gap: 0, column: 200, content: 200, aspect: 1, insetShare: 0 }
  it('the even gap left of the column, less the column’s own spare room and a margin kept clear', () => {
    expect(promptHangRoom(base)).toBeCloseTo(340 / 3 - 20)
    expect(promptHangRoom({ ...base, column: 260 })).toBeCloseTo(340 / 3 - 30 - 20)
  })
  it('too narrow (every gap is just the margin): no room', () => {
    expect(promptHangRoom({ ...base, width: 700 })).toBe(0)
  })
})
