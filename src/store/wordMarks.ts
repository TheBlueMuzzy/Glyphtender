// WHAT THE BOARD MARKS ABOUT MADE WORDS (word indicators on) — plain functions, tested:
//   the hexes that get the white word border (WordBorders.tsx), and the score sequence after a cast
//   (ScorePops.tsx + useScoreSequence.ts): each seed's Magic, word by word, and when each part plays.
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

type SequenceTiming = Pick<AnimTuning, 'spotlightFade' | 'scorePopDelay' | 'scoreWordTime' | 'scorePopGap' | 'scorePopTime' | 'scorePopHold' |
  'scoreFlyTime' | 'scoreTotalHold' | 'scoreTotalFade' | 'scoreTotalGrow' | 'scoreTotalMaxGrow'>

/** One seed's pop, in seconds after the seed lands: pops in over its letter, flies off, arrives in the total. */
export interface PopTimes { pop: number; fly: number; arrive: number }
/** A score arriving in the glyphling's running total: when, the total after it, and the total's resting size (1 = scoreTotalSize). */
export interface Arrival { at: number; total: number; size: number }
/** One word's turn on the stage: lit from `start` until `out` (the next word's start, or the very end), its total so far. */
export interface SequenceWord { start: number; out: number; total: number }

/** The whole score sequence of one cast (scoreSequence). Index-aligned with the pops it was made from. */
export interface ScoreSequence {
  words: SequenceWord[]
  pops: PopTimes[]
  arrivals: Arrival[]
  /** The last word, the final total and its bubble start fading here… */
  fadeStart: number
  /** …and are gone here (nothing from the turn is left). */
  end: number
}

/** How big the running total rests once it holds `total` Magic: it grows with every point, up to the cap. */
export const totalSize = (total: number, t: Pick<SequenceTiming, 'scoreTotalGrow' | 'scoreTotalMaxGrow'>) =>
  1 + Math.min(t.scoreTotalMaxGrow, t.scoreTotalGrow * total)

/**
 * THE SCORE SEQUENCE after a cast lands (Muzzy, 2026-10-01): the words score ONE AT A TIME, in the order the engine made
 * them (the same order the aiming spotlight cycles). For each word: its outline + bubble light, its seeds pop their
 * Magic one after another, then fly — one after another — into the glyphling's running total, which ticks up and grows
 * with every point that arrives. The next word starts after scoreWordTime, but never before this word's last point has
 * arrived and the total's pop has settled (scorePopTime), and the word has faded (spotlightFade) — so each word is
 * seen with its own total. After the last word the final total holds (scoreTotalHold), then everything fades (scoreTotalFade).
 * Seconds after the seed lands.
 */
export function scoreSequence(pops: ScorePop[], t: SequenceTiming): ScoreSequence {
  const words: SequenceWord[] = []
  const times: PopTimes[] = []
  const arrivals: Arrival[] = []
  const wordCount = pops.length ? Math.max(...pops.map((p) => p.word)) + 1 : 0
  let start = t.scorePopDelay
  let running = 0
  for (let w = 0; w < wordCount; w++) {
    const mine = pops.map((p, i) => ({ p, i })).filter(({ p }) => p.word === w)
    const leave = start + (mine.length - 1) * t.scorePopGap + t.scorePopTime + t.scorePopHold // the first seed flies
    let arrived = start
    mine.forEach(({ p, i }, j) => {
      const fly = leave + j * t.scorePopGap
      const arrive = fly + t.scoreFlyTime
      times[i] = { pop: start + j * t.scorePopGap, fly, arrive }
      running += p.amount
      arrivals.push({ at: arrive, total: running, size: totalSize(running, t) })
      arrived = arrive
    })
    words.push({ start, out: 0, total: running })
    // (the total's last pop settles while this word is still lit, then the word fades and the next one lights)
    start = Math.max(start + t.scoreWordTime, arrived + t.scorePopTime + t.spotlightFade)
  }
  const lastArrival = arrivals.length ? arrivals[arrivals.length - 1].at : t.scorePopDelay
  const fadeStart = lastArrival + t.scoreTotalHold
  const end = fadeStart + t.scoreTotalFade
  words.forEach((w, i) => { w.out = i + 1 < words.length ? words[i + 1].start : end })
  return { words, pops: times, arrivals, fadeStart, end }
}

/**
 * How long the garden needs after a seed lands before anything may cover it (the handoff box, the reveal) or the next
 * turn may start: the sprout + wordGlowTime, or — with score pops — until the score sequence has faded away.
 */
export function landingSeconds(game: GameState, showPops: boolean, t: AnimTuning): number {
  const sprout = t.growTime + t.wordGlowTime
  const turn = game.lastTurn
  if (!showPops || !turn || turn.words.length === 0) return sprout
  return Math.max(sprout, scoreSequence(scorePops(game, turn), t).end)
}
