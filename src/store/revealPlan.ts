// THE MAGIC REVEAL, step by step (research: staged, skippable, slow enough to read — never all at once).
// Magic is secret all game; at the end it's revealed in this order:
//   1. tangles — the tangled glyphlings pulse
//   2. count   — each player's word Magic (everything but tangle bonuses) counts up, one player at a time, lowest first
//   3. bonus   — one step per rival piece next to a tangled glyphling: "+3" pops on it and flies into its owner's
//                total, which pops — the same as a cast's score sequence (Muzzy, 2026-10-03: same intention, same motion)
//   4. winner  — "Grand Glyphtender!" (ties share it)
// Plain data from the finished game; the screen (src/game/Reveal.tsx, RevealMarks.tsx) plays it with anim.json timings.
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
  revealPopTime: number
  scoreFlyTime: number
}

/** Every step of the reveal for a finished game. */
export function revealSteps(game: GameState): RevealStep[] {
  const board = getBoard(game.config.boardName)
  const taken = occupancy(game)
  const steps: RevealStep[] = [{ kind: 'tangles' }]
  // Word Magic first, lowest first, so the biggest comes last (equal: seat order) — the bonuses can still change the order
  const order = game.magic.map((magic, seat) => ({ words: magic - (game.tangleMagic[seat] ?? 0), seat }))
    .sort((a, b) => a.words - b.words || a.seat - b.seat)
  for (const { seat } of order) steps.push({ kind: 'count', seat })
  // Same sum as the engine's tangle bonus: each rival seed or glyphling next to a tangled glyphling
  for (const id of game.tangled) {
    const tangled = game.glyphlings.find((g) => g.id === id)
    if (!tangled) continue
    for (const hex of neighbours(board, tangled.hex)) {
      const who = taken.get(hexKey(hex))
      if (who && who.seat !== tangled.seat) steps.push({ kind: 'bonus', glyphling: id, hex, seat: who.seat, amount: game.config.rules.tangleBonus })
    }
  }
  steps.push({ kind: 'winner' })
  return steps
}

export function stepSeconds(step: RevealStep, timing: RevealTiming): number {
  if (step.kind === 'tangles') return timing.revealTangles
  // (a bonus pops, then flies into the total, arriving as the step ends — so it's never shorter than pop + flight)
  if (step.kind === 'bonus') return Math.max(timing.revealBonus, timing.revealPopTime + timing.scoreFlyTime)
  if (step.kind === 'count') return timing.revealCount
  return timing.revealWinner
}

/** How long the whole reveal takes, in seconds. */
export const revealSeconds = (steps: RevealStep[], timing: RevealTiming) =>
  steps.reduce((sum, step) => sum + stepSeconds(step, timing), 0)

/** What the screen shows at step `at` (null = not started; steps.length = finished, everything shown). */
export function revealView(steps: RevealStep[], at: number | null, game?: GameState) {
  const reached = at === null ? [] : steps.slice(0, at + 1)
  const current = at === null ? null : steps[at] ?? null
  // A bonus has ARRIVED in its owner's total once its step is over (it flies in as the step ends)
  const arrived = at === null ? [] : steps.slice(0, at).filter((s) => s.kind === 'bonus')
  const tangles = (seat: number) => arrived.reduce((sum, s) => sum + (s.kind === 'bonus' && s.seat === seat ? s.amount : 0), 0)
  const counted = reached.flatMap((s) => (s.kind === 'count' ? [s.seat] : []))
  return {
    /** Each seat's tangle Magic that has flown into its total so far. */
    tangles: (game?.magic ?? []).map((_, seat) => tangles(seat)),
    /** Each seat's total on screen: word Magic + the bonuses arrived so far — null until their Magic is counted. */
    scores: (game?.magic ?? []).map((magic, seat) =>
      counted.includes(seat) ? magic - (game?.tangleMagic[seat] ?? 0) + tangles(seat) : null),
    /** Seats whose Magic has been revealed. */
    counted,
    /** The step playing right now (null before it starts and once it's finished). */
    current,
    /** The winner has been announced. */
    announced: reached.some((s) => s.kind === 'winner'),
    finished: at !== null && at >= steps.length,
  }
}
