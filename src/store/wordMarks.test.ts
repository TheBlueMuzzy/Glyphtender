// Score pops: each seed's pop is the engine's own Magic for it, and together they add up to the turn's Magic.
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import animJson from '../../content/tuning/anim.json'
import { hideSecrets } from '../../party/views'
import { applyAction, newGame } from '../engine/engine'
import { hexKey } from '../engine/hex'
import { randomAction } from '../engine/sim'
import { hexAt, position, wordsOf } from '../engine/testkit'
import { parseWordList } from '../engine/words'
import type { WordList } from '../engine/types'
import { landingSeconds, popTimeline, popsTotal, scorePops, uniqueHexes } from './wordMarks'

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

  it('the timeline: seeds ripple in order, words one after another, all fly together, then the total', () => {
    const game = catAndTo()
    const pops = scorePops(game, game.lastTurn!)
    const t = popTimeline(pops, animJson)
    const starts = pops.map(t.startOf)
    expect([...starts].sort((a, b) => a - b)).toEqual(starts)
    expect(starts[3] - starts[2]).toBeCloseTo(animJson.scorePopGap + animJson.scoreWordGap)
    expect(t.fly).toBeGreaterThan(starts.at(-1)!)
    expect(t.total).toBeGreaterThan(t.fly)
    expect(t.end).toBeCloseTo(t.total + animJson.scoreTotalHold + animJson.scoreTotalFade)
  })

  it('nothing covers the garden until the pops are done (only when they show)', () => {
    const game = catAndTo()
    const sprout = animJson.growTime + animJson.wordGlowTime
    expect(landingSeconds(game, false, animJson)).toBe(sprout)
    expect(landingSeconds(game, true, animJson)).toBe(Math.max(sprout, popTimeline(scorePops(game, game.lastTurn!), animJson).end))
  })

  it('a letter shared by two words gets one border', () => {
    expect(uniqueHexes([hexAt('C6-3'), hexAt('C6-4'), hexAt('C6-3')])).toHaveLength(2)
  })
})
