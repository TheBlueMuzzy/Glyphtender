import { describe, expect, it } from 'vitest'
import { getBoard } from '../engine/boards'
import { hexKey, neighbours } from '../engine/hex'
import { tangleBonus, tangledIds } from '../engine/tangle'
import { hexAt, position } from '../engine/testkit'
import type { GameState } from '../engine/types'
import { popsByHex, revealSeconds, revealSteps, revealView } from './revealPlan'
import animJson from '../../content/tuning/anim.json'

// Yellow's glyphling 0 is tangled in the corner: next to its own seed (no bonus) and two of Blue's (+3 each)
function finished(magic: number[]): GameState {
  const game = position({
    glyphlings: { 0: 'C1-1', 1: 'C6-5', 2: 'C11-2', 3: 'C8-6' },
    seeds: [{ 'C2-2': 'A' }, { 'C2-3': 'B', 'C1-2': 'C' }],
  })
  const tangled = tangledIds(game)
  return { ...game, phase: 'over', tangled, tangleMagic: tangleBonus(game, tangled), magic }
}

describe('the Magic reveal plan', () => {
  it('tangles pulse, then a +3 per rival piece next to a tangled glyphling, then totals lowest first, then the winner', () => {
    const steps = revealSteps(finished([20, 12]))
    expect(steps.map((s) => s.kind)).toEqual(['tangles', 'bonus', 'bonus', 'count', 'count', 'winner'])
    expect(steps.filter((s) => s.kind === 'count').map((s) => s.kind === 'count' && s.seat)).toEqual([1, 0]) // Blue (12) first
  })

  it('the +3 pops add up to exactly the engine\'s tangle bonus', () => {
    const game = finished([20, 12])
    const perSeat = [0, 0]
    for (const step of revealSteps(game)) if (step.kind === 'bonus') perSeat[step.seat] += step.amount
    expect(perSeat).toEqual(game.tangleMagic)
    expect(perSeat).toEqual([0, 6])
  })

  it('equal totals are counted in seat order', () => {
    const counts = revealSteps(finished([15, 15])).flatMap((s) => (s.kind === 'count' ? [s.seat] : []))
    expect(counts).toEqual([0, 1])
  })

  it('what shows at each step: pops, counted players, the winner', () => {
    const steps = revealSteps(finished([20, 12]))
    expect(revealView(steps, null)).toMatchObject({ pops: [], counted: [], announced: false, finished: false })
    expect(revealView(steps, 2).pops).toHaveLength(2)
    expect(revealView(steps, 3).counted).toEqual([1])
    expect(revealView(steps, 5)).toMatchObject({ counted: [1, 0], announced: true, finished: false })
    expect(revealView(steps, steps.length)).toMatchObject({ announced: true, finished: true, current: null })
  })

  it('a 2-player reveal takes about 6–10 seconds with the default timings', () => {
    const seconds = revealSeconds(revealSteps(finished([20, 12])), animJson)
    expect(seconds).toBeGreaterThanOrEqual(6)
    expect(seconds).toBeLessThanOrEqual(10)
  })

  it('a rival seed next to TWO tangled glyphlings shows one "+6" on the board, not two "+3"s on top of each other', () => {
    // Yellow's two glyphlings side by side in the corner, boxed in by Blue's seeds
    const board = getBoard('small')
    const corner = [hexAt('C1-1'), hexAt('C1-2')]
    const blue: Record<string, string> = {}
    for (const hex of corner.flatMap((h) => neighbours(board, h))) {
      if (!corner.some((c) => hexKey(c) === hexKey(hex))) blue[board.label(hex)] = 'A'
    }
    const game = position({ glyphlings: { 0: 'C1-1', 1: 'C1-2', 2: 'C8-6', 3: 'C11-2' }, seeds: [{}, blue] })
    const tangled = tangledIds(game)
    const over: GameState = { ...game, phase: 'over', tangled, tangleMagic: tangleBonus(game, tangled), magic: [0, 0] }
    const steps = revealSteps(over)
    const marks = popsByHex(revealView(steps, steps.length).pops)
    // one mark per hex, and together they add up to Blue's tangle Magic
    expect(new Set(marks.map((m) => hexKey(m.hex))).size).toBe(marks.length)
    expect(marks.reduce((sum, m) => sum + m.total, 0)).toBe(over.tangleMagic[1])
    expect(marks.some((m) => m.total === 6)).toBe(true)
  })
})
