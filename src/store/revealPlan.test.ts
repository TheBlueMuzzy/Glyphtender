import { describe, expect, it } from 'vitest'
import { tangleBonus, tangledIds } from '../engine/tangle'
import { position } from '../engine/testkit'
import type { GameState } from '../engine/types'
import { revealSeconds, revealSteps, revealView, stepSeconds } from './revealPlan'
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
  it('tangles pulse, then word Magic lowest first, then a +3 per rival piece next to a tangled glyphling, then the winner', () => {
    const steps = revealSteps(finished([20, 12]))
    expect(steps.map((s) => s.kind)).toEqual(['tangles', 'count', 'count', 'bonus', 'bonus', 'winner'])
    expect(steps.filter((s) => s.kind === 'count').map((s) => s.kind === 'count' && s.seat)).toEqual([1, 0]) // Blue (12 − 6 = 6) first
  })

  it('the order is by WORD Magic (before tangle bonuses): the bonuses can still overtake', () => {
    // Yellow 10 words · Blue 14 in all, but 6 of it is tangle bonus → 8 words: Blue counts first, then flies past
    const steps = revealSteps(finished([10, 14]))
    expect(steps.flatMap((s) => (s.kind === 'count' ? [s.seat] : []))).toEqual([1, 0])
  })

  it('the +3 pops add up to exactly the engine\'s tangle bonus', () => {
    const game = finished([20, 12])
    const perSeat = [0, 0]
    for (const step of revealSteps(game)) if (step.kind === 'bonus') perSeat[step.seat] += step.amount
    expect(perSeat).toEqual(game.tangleMagic)
    expect(perSeat).toEqual([0, 6])
  })

  it('equal word Magic is counted in seat order', () => {
    // Blue: 21 − 6 tangle bonus = 15, the same as Yellow
    const counts = revealSteps(finished([15, 21])).flatMap((s) => (s.kind === 'count' ? [s.seat] : []))
    expect(counts).toEqual([0, 1])
  })

  it('what shows at each step: counted players, their totals as the +3s land, the winner', () => {
    const game = finished([20, 12])
    const steps = revealSteps(game)
    expect(revealView(steps, null, game)).toMatchObject({ scores: [null, null], counted: [], announced: false, finished: false })
    expect(revealView(steps, 1, game)).toMatchObject({ counted: [1], scores: [null, 6] }) // Blue's word Magic only
    expect(revealView(steps, 2, game).scores).toEqual([20, 6])
    // a +3 lands as its step ends: still 6 while the first one flies, 9 once the second starts
    expect(revealView(steps, 3, game)).toMatchObject({ scores: [20, 6], tangles: [0, 0] })
    expect(revealView(steps, 4, game)).toMatchObject({ scores: [20, 9], tangles: [0, 3] })
    expect(revealView(steps, 5, game)).toMatchObject({ scores: [20, 12], tangles: [0, 6], announced: true, finished: false })
    expect(revealView(steps, steps.length, game)).toMatchObject({ scores: [20, 12], announced: true, finished: true, current: null })
  })

  it('a 2-player reveal takes about 6–10 seconds with the default timings', () => {
    const seconds = revealSeconds(revealSteps(finished([20, 12])), animJson)
    expect(seconds).toBeGreaterThanOrEqual(6)
    expect(seconds).toBeLessThanOrEqual(10)
  })

  it('a bonus step is never shorter than its pop + flight (it lands as the step ends)', () => {
    const bonus = revealSteps(finished([20, 12])).find((s) => s.kind === 'bonus')!
    expect(stepSeconds(bonus, { ...animJson, revealBonus: 0.1 })).toBeCloseTo(animJson.revealPopTime + animJson.scoreFlyTime)
  })
})
