// Score pops: each seed's pop is the engine's own Magic for it, and together they add up to the turn's Magic.
// The score sequence: the words score one at a time (spotlight order), the running total adds up and grows.
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import animJson from '../../content/tuning/anim.json'
import { hideSecrets } from '../../party/views'
import { applyAction, checkAction, newGame, previewTurn } from '../engine/engine'
import { hexKey } from '../engine/hex'
import { randomAction } from '../engine/sim'
import { hexAt, position, wordsOf } from '../engine/testkit'
import { parseWordList } from '../engine/words'
import type { WordList } from '../engine/types'
import { landingSeconds, popsTotal, scorePops, scoreSequence, totalSize, uniqueHexes, type ScorePop } from './wordMarks'

let words: WordList
beforeAll(() => { words = parseWordList(readFileSync('public/words/words.csv', 'utf8')) })

// Yellow moves glyphling 0 from C6-7 to C6-6 and casts T onto C6-4: CAT down (C Yellow's, A Blue's) + TO (O Blue's)
const castT = { type: 'turn' as const, glyphling: 0, to: hexAt('C6-6'), seed: 0, target: hexAt('C6-4') }
const catAndTo = () => applyAction(position({
  glyphlings: { 0: 'C6-7', 1: 'C1-4', 2: 'C11-1', 3: 'C11-4' }, hands: [['T'], ['E']], bag: ['X'],
  seeds: [{ 'C6-2': 'C' }, { 'C6-3': 'A', 'C7-4': 'O' }],
}), castT, wordsOf('CAT', 'TO'))

describe('score pops', () => {
  it('each seed pops 1, +1 more for the caster’s own seeds — word by word (CAT: +2 +1 +2, then TO: +2 +1)', () => {
    const game = catAndTo()
    const pops = scorePops(game, game.lastTurn!)
    expect(pops.map((p) => [p.word, p.amount])).toEqual([[0, 2], [0, 1], [0, 2], [1, 2], [1, 1]])
    expect(popsTotal(pops)).toBe(game.lastTurn!.magic) // 8
  })

  it('a seed in two words pops twice, the second stacked above the first', () => {
    const game = catAndTo()
    const onT = scorePops(game, game.lastTurn!).filter((p) => hexKey(p.hex) === hexKey(hexAt('C6-4')))
    expect(onT.map((p) => p.stack)).toEqual([0, 1])
  })

  it('uses the rules’ ownership bonus (none → every seed pops 1)', () => {
    const game = applyAction(position({
      glyphlings: { 0: 'C6-7', 1: 'C1-4', 2: 'C11-1', 3: 'C11-4' }, hands: [['T'], []], seeds: [{ 'C6-3': 'A' }], rules: { ownershipBonus: 0 },
    }), castT, wordsOf('AT'))
    expect(scorePops(game, game.lastTurn!).map((p) => p.amount)).toEqual([1, 1])
  })

  it('whole random games: the pops always add up to the engine’s Magic — and an online view shows the same pops', () => {
    for (const seed of [1, 2, 3]) {
      let state = newGame({ players: 3, seed, boardName: 'large' })
      let rng = seed
      let checked = 0
      for (let i = 0; i < 400 && state.phase !== 'over'; i++) {
        const pick = randomAction(state, rng)
        rng = pick.rng
        state = applyAction(state, pick.action, words)
        if (pick.action.type !== 'turn' || !state.lastTurn?.words.length) continue
        const pops = scorePops(state, state.lastTurn)
        expect(popsTotal(pops)).toBe(state.lastTurn.magic)
        expect(pops).toHaveLength(state.lastTurn.words.reduce((n, w) => n + w.hexes.length, 0))
        const watcher = hideSecrets(state, (state.lastTurn.seat + 1) % 3) // Magic zeroed, the board in plain sight
        expect(scorePops(watcher, watcher.lastTurn!)).toEqual(pops)
        checked++
      }
      expect(checked).toBeGreaterThan(0)
    }
  })

  it('nothing covers the garden until the score sequence has faded (only when it shows)', () => {
    const game = catAndTo()
    const sprout = animJson.growTime + animJson.wordGlowTime
    expect(landingSeconds(game, false, animJson)).toBe(sprout)
    expect(landingSeconds(game, true, animJson)).toBe(Math.max(sprout, scoreSequence(scorePops(game, game.lastTurn!), animJson).end))
  })

  it('a letter shared by two words gets one border', () => {
    expect(uniqueHexes([hexAt('C6-3'), hexAt('C6-4'), hexAt('C6-3')])).toHaveLength(2)
  })
})

// PE, AE, ET on shared letters, every seed the caster's own (+2 each): the words score one at a time → +4, +8, +12
const pop = (word: number, order: number): ScorePop => ({ hex: { q: order, r: 0 }, amount: 2, word, order, stack: 0 })
const peAeEt = [pop(0, 0), pop(0, 1), pop(1, 2), pop(1, 3), pop(2, 4), pop(2, 5)]

describe('score sequence (words score one at a time)', () => {
  const seq = scoreSequence(peAeEt, animJson)

  it('the running total after each word: 4 → 8 → 12, and every point that arrives adds to it (2, 4, 6 … 12)', () => {
    expect(seq.words.map((w) => w.total)).toEqual([4, 8, 12])
    expect(seq.arrivals.map((a) => a.total)).toEqual([2, 4, 6, 8, 10, 12])
  })

  it('the total grows with every point (bigger at +8 than +4, bigger still at +12), never past the cap', () => {
    const at = (n: number) => seq.arrivals.find((a) => a.total === n)!.size
    expect(at(4)).toBeLessThan(at(8))
    expect(at(8)).toBeLessThan(at(12))
    expect(totalSize(1000, animJson)).toBeCloseTo(1 + animJson.scoreTotalMaxGrow)
    expect(totalSize(0, animJson)).toBe(1)
  })

  it('one word at a time: a word scores (pops, flies, arrives) before the next starts, and its outline is out by then', () => {
    seq.words.forEach((w, i) => {
      const mine = seq.pops.filter((_, k) => peAeEt[k].word === i)
      expect(Math.min(...mine.map((p) => p.pop))).toBeCloseTo(w.start)
      const next = seq.words[i + 1]
      if (!next) return
      expect(Math.max(...mine.map((p) => p.arrive)) + animJson.scorePopTime + animJson.spotlightFade).toBeLessThanOrEqual(next.start + 1e-9) // its points are in first
      expect(w.out).toBe(next.start) // never two words lit at once
      expect(next.start - w.start).toBeGreaterThanOrEqual(animJson.scoreWordTime - 1e-9)
    })
    seq.pops.forEach((p) => {
      expect(p.fly).toBeGreaterThanOrEqual(p.pop + animJson.scorePopTime)
      expect(p.arrive).toBeCloseTo(p.fly + animJson.scoreFlyTime)
    })
  })

  it('the final total holds, then everything fades — and only then is the turn over', () => {
    const last = seq.arrivals.at(-1)!.at
    expect(seq.fadeStart).toBeCloseTo(last + animJson.scoreTotalHold)
    expect(seq.end).toBeCloseTo(seq.fadeStart + animJson.scoreTotalFade)
    expect(seq.words.at(-1)!.out).toBe(seq.end)
  })

  it('words score in the order the aiming spotlight showed them (the engine’s word order, kept by the landing)', () => {
    // A real cast: the words previewed while aiming (the spotlight's order) are the turn's words, in the same order
    const before = position({
      glyphlings: { 0: 'C6-7', 1: 'C1-4', 2: 'C11-1', 3: 'C11-4' }, hands: [['T'], ['E']], bag: ['X'],
      seeds: [{ 'C6-2': 'C' }, { 'C6-3': 'A', 'C7-4': 'O' }],
    })
    const list = wordsOf('CAT', 'TO')
    expect(checkAction(before, castT)).toBeNull()
    const aimed = previewTurn(before, castT, list).words.map((w) => w.word)
    const after = applyAction(before, castT, list)
    expect(after.lastTurn!.words.map((w) => w.word)).toEqual(aimed)
    const pops = scorePops(after, after.lastTurn!)
    const order = scoreSequence(pops, animJson).words.map((_, i) => after.lastTurn!.words[i].word)
    expect(order).toEqual(aimed)
    // …and each word's seeds pop in its own slot, in word order
    const starts = scoreSequence(pops, animJson).pops.map((p) => p.pop)
    expect([...starts].sort((a, b) => a - b)).toEqual(starts)
  })
})
