// Whose glyphling sits beside the prompt (Muzzy, 2026-10-01: "so it's obvious who it applies to").
import { describe, expect, it } from 'vitest'
import { newGame } from '../engine/setup'
import { revealSteps } from '../store/revealPlan'
import type { GameState } from '../engine/types'
import { promptIconSeat } from './prompt'

const base = { move: null, cast: null, selected: null, flying: false, note: null, wordsStatus: 'ready', handoff: null, revealAt: null } as const
const at = (game: GameState, extra: object = {}) => promptIconSeat({ ...base, game, ...extra } as Parameters<typeof promptIconSeat>[0])

describe('the glyphling beside the prompt', () => {
  const game = newGame({ players: 3, seed: 5 })
  it('no game: nobody', () => expect(at(null as unknown as GameState)).toBeNull())
  it('is the player to move (the draft too)', () => {
    expect(at(game)).toBe(game.current)
    expect(at({ ...game, current: 2 })).toBe(2)
  })
  it('is the player the device is passed to during a handoff', () => {
    expect(at({ ...game, current: 1 }, { handoff: { seat: 2, afterGrow: false } })).toBe(2)
  })
  it('the reveal: whose Magic is counting, then the single winner; nobody for a shared win', () => {
    const over = { ...game, phase: 'over', winners: [1] } as GameState
    const steps = revealSteps(over)
    const count = steps.findIndex((step) => step.kind === 'count')
    if (count >= 0) expect(at(over, { revealAt: count })).toBe((steps[count] as { seat: number }).seat)
    expect(at(over, { revealAt: 0 })).toBeNull() // the tangles being revealed: nobody in particular
    expect(at(over, { revealAt: steps.length })).toBe(1) // the reveal is done: the winner
    expect(at({ ...over, winners: [0, 2] } as GameState, { revealAt: steps.length })).toBeNull()
  })
})
