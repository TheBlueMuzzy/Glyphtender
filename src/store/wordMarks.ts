// WHAT THE BOARD MARKS ABOUT MADE WORDS (word indicators on) — plain functions, tested:
//   the hexes that get the white word border (WordBorders.tsx), and the score pops after a cast
//   (ScorePops.tsx): each seed's Magic, when each pops, and the turn's total they fly into.
import animJson from '../../content/tuning/anim.json'
import { seedMagic } from '../engine/engine'
import { hexKey, type Hex } from '../engine/hex'
import type { GameState, TurnSummary } from '../engine/types'

type AnimTuning = typeof animJson

/** The same hexes once each (a letter shared by two words gets one border). */
export function uniqueHexes(list: Hex[]): Hex[] {
  const seen = new Map(list.map((h) => [hexKey(h), h]))
  return [...seen.values()]
}

/** One seed's "+1" / "+2" over its hex. `stack` = how many pops sit under it on the same hex (a seed in two words). */
export interface ScorePop {
  hex: Hex
  amount: number
  /** Which made word it belongs to (0 = the first) — each word pops after the one before. */
  word: number
  /** Its place in the whole ripple (0 = pops first). */
  order: number
  stack: number
}

/**
 * The score pops for a turn that grew words: each seed of each word pops its Magic (the engine's own seedMagic —
 * 1, + the ownership bonus for the caster's own seed). `game` is the garden right AFTER the turn. Works on an
 * online view too: the words and seeds are on the board for all to see (only the running totals are secret).
 */
export function scorePops(game: GameState, turn: TurnSummary): ScorePop[] {
  const pops: ScorePop[] = []
  const onHex = new Map<string, number>()
  turn.words.forEach((word, w) => {
    for (const hex of word.hexes) {
      const stack = onHex.get(hexKey(hex)) ?? 0
      onHex.set(hexKey(hex), stack + 1)
      pops.push({ hex, amount: seedMagic(game, hex, turn.seat), word: w, order: pops.length, stack })
    }
  })
  return pops
}

/** The turn's Magic: every pop added up (the same as the engine's lastTurn.magic). */
export const popsTotal = (pops: ScorePop[]) => pops.reduce((sum, p) => sum + p.amount, 0)

type PopTiming = Pick<AnimTuning, 'scorePopDelay' | 'scorePopGap' | 'scoreWordGap' | 'scorePopTime' | 'scorePopHold' | 'scoreFlyTime' | 'scoreTotalHold' | 'scoreTotalFade'>

/** When each part of the pops plays, in seconds after the seed lands. */
export function popTimeline(pops: ScorePop[], t: PopTiming) {
  const startOf = (p: ScorePop) => t.scorePopDelay + p.order * t.scorePopGap + p.word * t.scoreWordGap
  const lastStart = pops.length ? Math.max(...pops.map(startOf)) : t.scorePopDelay
  const fly = lastStart + t.scorePopTime + t.scorePopHold // every pop leaves together
  const total = fly + t.scoreFlyTime * 0.8 // the total appears as they arrive
  return { startOf, fly, total, end: total + t.scoreTotalHold + t.scoreTotalFade }
}

/**
 * How long the garden needs after a seed lands before anything may cover it (the handoff box, the reveal):
 * the sprout + the word border's fade, or — with score pops — until the total has faded.
 */
export function landingSeconds(game: GameState, showPops: boolean, t: AnimTuning): number {
  const sprout = t.growTime + t.wordGlowTime
  const turn = game.lastTurn
  if (!showPops || !turn || turn.words.length === 0) return sprout
  return Math.max(sprout, popTimeline(scorePops(game, turn), t).end)
}
