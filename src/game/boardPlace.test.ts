import { describe, expect, it } from 'vitest'
import { boardShift } from './boardPlace'

describe('where the board sits in its box', () => {
  it('tall: right on the tray (below or above)', () => {
    expect(boardShift('bottom', 0, 6)).toEqual({ x: 0, y: 3 })
    expect(boardShift('top', 0, 6)).toEqual({ x: 0, y: -3 })
  })

  it('wide: an eighth of the spare room stays on the tray’s side (right or left)', () => {
    const spare = 8 // centred: 4 each side → 1 on the tray's side, 7 on the far side
    expect(boardShift('right', spare, 0)).toEqual({ x: 3, y: 0 })
    expect(spare / 2 - boardShift('right', spare, 0).x).toBe(spare / 8) // the room left on the tray's side
    expect(boardShift('left', spare, 0)).toEqual({ x: -3, y: 0 })
  })
})
