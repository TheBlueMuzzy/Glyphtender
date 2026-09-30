import { describe, expect, it } from 'vitest'
import { newGame } from '../engine/engine'
import { position } from '../engine/testkit'
import { dangerOf, dangers } from './danger'

describe('tangle danger', () => {
  it('a glyphling in a corner pocket with one way out is a warning; boxed in, it is tangled', () => {
    // C1-1 is the top of the first column (4 hexes tall): its neighbours are C1-2, C2-2 and C2-3
    const oneWayOut = position({
      glyphlings: { 0: 'C1-1', 1: 'C6-5', 2: 'C11-2', 3: 'C8-6' },
      seeds: [{ 'C2-2': 'A' }, { 'C2-3': 'B', 'C1-3': 'C' }], // C1-2 is the only hex it can reach
    })
    expect(dangerOf(oneWayOut, 0)).toBe('warning')
    const boxedIn = position({
      glyphlings: { 0: 'C1-1', 1: 'C6-5', 2: 'C11-2', 3: 'C8-6' },
      seeds: [{ 'C2-2': 'A' }, { 'C2-3': 'B', 'C1-2': 'C' }],
    })
    expect(dangerOf(boxedIn, 0)).toBe('tangled')
    expect(dangerOf(boxedIn, 1)).toBeNull() // in the open garden
    expect(dangers(boxedIn)).toEqual(new Map([[0, 'tangled']]))
  })

  it('no danger cues during the draft', () => {
    expect(dangers(newGame({ players: 2, seed: 1 })).size).toBe(0)
  })
})
