import { describe, expect, it } from 'vitest'
import { applyAction, previewTurn } from './engine'
import { hexAt, position, wordsOf, type PositionPlan } from './testkit'

const words = wordsOf('AT', 'CAT', 'TO', 'QUIT', 'QAT')
const glyphlings = { 0: 'C6-7', 1: 'C1-4', 2: 'C11-1', 3: 'C11-4' }
/** Yellow moves glyphling 0 up from C6-7 to C6-6 and casts its first seed up to C6-4. */
const castAt = { type: 'turn' as const, glyphling: 0, to: hexAt('C6-6'), seed: 0, target: hexAt('C6-4') }
const game = (plan: Partial<PositionPlan>) => position({ glyphlings, hands: [['T'], ['E']], bag: ['X', 'Y'], ...plan })

describe('Magic (GDD §4.6)', () => {
  it('a word makes its seeds + 1 per seed the caster owns', () => {
    // Blue's A on C6-3 + Yellow's T = AT: 2 seeds + 1 own seed = 3.
    const next = applyAction(game({ seeds: [{}, { 'C6-3': 'A' }] }), castAt, words)
    expect(next.lastTurn?.words.map((w) => [w.word, w.magic])).toEqual([['AT', 3]])
    expect(next.magic).toEqual([3, 0])
  })

  it('owning every seed in the word: 2 seeds + 2 own = 4', () => {
    const next = applyAction(game({ seeds: [{ 'C6-3': 'A' }] }), castAt, words)
    expect(next.magic[0]).toBe(4)
  })

  it('uses ownershipBonus from the rules', () => {
    const next = applyAction(game({ seeds: [{ 'C6-3': 'A' }], rules: { ownershipBonus: 0 } }), castAt, words)
    expect(next.magic[0]).toBe(2)
  })

  it('shared seeds count in each word (CAT down + TO up-right through the same T)', () => {
    // C6-2 C, C6-3 A (Blue), T cast on C6-4; O (Blue) one step NE of C6-4 is C7-4.
    const s = game({ seeds: [{ 'C6-2': 'C' }, { 'C6-3': 'A', 'C7-4': 'O' }] })
    const next = applyAction(s, castAt, words)
    const made = Object.fromEntries(next.lastTurn!.words.map((w) => [w.word, w.magic]))
    expect(made).toEqual({ CAT: 3 + 2, TO: 2 + 1 })
    expect(next.magic[0]).toBe(8)
  })

  it('Q is a plain Q: QAT = 3 seeds (+3 own)', () => {
    const s = game({ seeds: [{ 'C6-2': 'Q', 'C6-3': 'A' }] })
    const next = applyAction(s, castAt, words)
    expect(next.lastTurn?.words.map((w) => [w.word, w.magic])).toEqual([['QAT', 6]])
  })

  it('QUIT needs its own U seed: Q U I + T = 4 seeds (+4 own); without the U, Q I T is no word', () => {
    const withU = game({ seeds: [{ 'C6-1': 'Q', 'C6-2': 'U', 'C6-3': 'I' }] })
    expect(applyAction(withU, castAt, words).lastTurn?.words.map((w) => [w.word, w.magic])).toEqual([['QUIT', 8]])
    const noU = game({ seeds: [{ 'C6-2': 'Q', 'C6-3': 'I' }] })
    expect(applyAction(noU, castAt, words).lastTurn?.words).toEqual([])
  })
})

describe('draw after Magic (GDD §4.7)', () => {
  it('made Magic → draw 1 from the front of the bag, then the next seat plays', () => {
    const next = applyAction(game({ seeds: [{}, { 'C6-3': 'A' }] }), castAt, words)
    expect(next.hands[0]).toEqual(['X'])
    expect(next.bag).toEqual(['Y'])
    expect(next.lastTurn?.drew).toBe(1)
    expect(next.current).toBe(1)
    expect(next.phase).toBe('play')
  })

  it('an empty bag means no draw', () => {
    const next = applyAction(game({ seeds: [{}, { 'C6-3': 'A' }], bag: [] }), castAt, words)
    expect(next.hands[0]).toEqual([])
    expect(next.lastTurn?.drew).toBe(0)
    expect(next.current).toBe(1)
  })
})

describe('previewTurn (the "Cast · +N" button)', () => {
  it('shows the words and Magic a turn would make, without playing it', () => {
    const s = game({ seeds: [{ 'C6-2': 'C' }, { 'C6-3': 'A', 'C7-4': 'O' }] })
    const copy = JSON.parse(JSON.stringify(s))
    const preview = previewTurn(s, castAt, words)
    expect(preview.magic).toBe(8)
    expect(preview.words.map((w) => w.word).sort()).toEqual(['CAT', 'TO'])
    expect(s).toEqual(copy)
  })

  it('refuses an illegal turn like applyAction does', () => {
    expect(() => previewTurn(game({}), { ...castAt, target: hexAt('C6-7') }, words)).not.toThrow() // the hex it left is fine
    expect(() => previewTurn(game({}), { ...castAt, to: hexAt('C5-5') }, words)).toThrow()
  })
})
