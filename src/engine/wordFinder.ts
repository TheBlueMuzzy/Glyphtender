// Finding the words a new seed makes. Words read along the 3 leylines, one way only:
// top → bottom, NW → SE and SW → NE (hex.ts LEYLINES).
import { LEYLINES, addHex, hexKey, type Hex } from './hex'
import { spell } from './words'
import type { GameState, WordList } from './types'

/** A word found on the board: how it's spelled and the seeds it's made of, in reading order. */
export interface FoundWord {
  word: string
  hexes: Hex[]
}

/** A stretch of the run, from seed `start` to seed `end` (both included). */
interface Span {
  start: number
  end: number
  word: string
}

/** The unbroken line of seeds through `at`, in reading direction `dir`. */
function runThrough(state: GameState, at: Hex, dir: Hex): Hex[] {
  const back = { q: -dir.q, r: -dir.r }
  let first = at
  while (state.seeds[hexKey(addHex(first, back))]) first = addHex(first, back)
  const run: Hex[] = []
  for (let h = first; state.seeds[hexKey(h)]; h = addHex(h, dir)) run.push(h)
  return run
}

/** Is `span` inside `other`? */
const inside = (span: Span, other: Span) => other !== span && other.start <= span.start && span.end <= other.end

/**
 * Muzzy's union rule, on one leyline:
 * (1) a word lying inside another word is dropped (GARDENING scores; GARDEN and DEN don't);
 * (2) then, shortest first, a word whose seeds are all covered by the other words still kept is dropped
 *     (SEAL + LEAP score; ALE, covered by the two of them together, doesn't).
 */
export function keepByUnionRule<T extends Span>(candidates: T[]): T[] {
  let kept = candidates.filter((c) => !candidates.some((other) => inside(c, other)))
  const shortestFirst = [...kept].sort((a, b) => a.end - a.start - (b.end - b.start) || a.start - b.start)
  for (const c of shortestFirst) {
    const others = kept.filter((k) => k !== c)
    let covered = true
    for (let i = c.start; i <= c.end; i++) if (!others.some((o) => o.start <= i && i <= o.end)) covered = false
    if (covered) kept = others
  }
  return kept.sort((a, b) => a.start - b.start)
}

/** Every word the seed on `at` makes (the seed must already be planted in `state`). */
export function findWords(state: GameState, at: Hex, words: WordList): FoundWord[] {
  const minLength = state.config.rules.minWordLength
  const found: FoundWord[] = []
  for (const dir of LEYLINES) {
    const run = runThrough(state, at, dir)
    const letters = run.map((h) => spell(state.seeds[hexKey(h)].letter))
    const newSeed = run.findIndex((h) => hexKey(h) === hexKey(at))
    // Every stretch that includes the new seed and is long enough.
    const candidates: Span[] = []
    for (let start = 0; start <= newSeed; start++) {
      for (let end = Math.max(newSeed, start + minLength - 1); end < run.length; end++) {
        const word = letters.slice(start, end + 1).join('')
        if (words.has(word)) candidates.push({ start, end, word })
      }
    }
    for (const span of keepByUnionRule(candidates)) found.push({ word: span.word, hexes: run.slice(span.start, span.end + 1) })
  }
  return found
}
