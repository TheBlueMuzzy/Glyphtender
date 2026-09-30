// THE MAGIC REVEAL, step by step (research: staged, skippable, slow enough to read — never all at once).
// Magic is secret all game; at the end it's revealed in this order:
//   1. tangles — the tangled glyphlings pulse
//   2. bonus   — one step per rival piece next to a tangled glyphling: "+3" pops on it (hex by hex)
//   3. count   — each player's Magic counts up, one player at a time, lowest first
//   4. winner  — "Grand Glyphtender!" (ties share it)
// Plain data from the finished game; the screen (src/game/Reveal.tsx) plays it with anim.json timings.
import { getBoard } from '../engine/boards'
import { hexKey, neighbours, type Hex } from '../engine/hex'
import { occupancy } from '../engine/moves'
import type { GameState } from '../engine/types'

export type RevealStep =
  | { kind: 'tangles' }
  | { kind: 'bonus'; glyphling: number; hex: Hex; seat: number; amount: number }
  | { kind: 'count'; seat: number }
  | { kind: 'winner' }

/** Seconds each kind of step lasts (content/tuning/anim.json). */
export interface RevealTiming {
  revealTangles: number
  revealBonus: number
  revealCount: number
  revealWinner: number
}

/** Every step of the reveal for a finished game. */
export function revealSteps(game: GameState): RevealStep[] {
  const board = getBoard(game.config.boardName)
  const taken = occupancy(game)
  const steps: RevealStep[] = [{ kind: 'tangles' }]
  // Same sum as the engine's tangle bonus: each rival seed or glyphling next to a tangled glyphling
  for (const id of game.tangled) {
    const tangled = game.glyphlings.find((g) => g.id === id)
    if (!tangled) continue
    for (const hex of neighbours(board, tangled.hex)) {
      const who = taken.get(hexKey(hex))
      if (who && who.seat !== tangled.seat) steps.push({ kind: 'bonus', glyphling: id, hex, seat: who.seat, amount: game.config.rules.tangleBonus })
    }
  }
  // Lowest Magic first, so the biggest total comes last (equal totals: seat order)
  const order = game.magic.map((magic, seat) => ({ magic, seat })).sort((a, b) => a.magic - b.magic || a.seat - b.seat)
  for (const { seat } of order) steps.push({ kind: 'count', seat })
  steps.push({ kind: 'winner' })
  return steps
}

export function stepSeconds(step: RevealStep, timing: RevealTiming): number {
  if (step.kind === 'tangles') return timing.revealTangles
  if (step.kind === 'bonus') return timing.revealBonus
  if (step.kind === 'count') return timing.revealCount
  return timing.revealWinner
}

/** How long the whole reveal takes, in seconds. */
export const revealSeconds = (steps: RevealStep[], timing: RevealTiming) =>
  steps.reduce((sum, step) => sum + stepSeconds(step, timing), 0)

/** What the screen shows at step `at` (null = not started; steps.length = finished, everything shown). */
export function revealView(steps: RevealStep[], at: number | null) {
  const reached = at === null ? [] : steps.slice(0, at + 1)
  const current = at === null ? null : steps[at] ?? null
  return {
    /** The "+3"s that have popped so far. */
    pops: reached.filter((s) => s.kind === 'bonus'),
    /** Seats whose Magic has been revealed. */
    counted: reached.flatMap((s) => (s.kind === 'count' ? [s.seat] : [])),
    /** The step playing right now (null before it starts and once it's finished). */
    current,
    /** The winner has been announced. */
    announced: reached.some((s) => s.kind === 'winner'),
    finished: at !== null && at >= steps.length,
  }
}
