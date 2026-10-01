import { describe, expect, it } from 'vitest'
import text from '../../content/text/en.json'
import { promptSizers } from './prompt'

const w = text.game
const names = ['Yellow', 'Bartholomew', 'Pink']

describe('the prompt frame holds the longest message (B013)', () => {
  const { texts, detail } = promptSizers(names)
  it('sizes for every prompt line the game shows (with the longest name filled in)', () => {
    // (waitingHost is a toast, not a prompt; refreshDetail is a small line)
    const lines = Object.entries(w.prompts).filter(([key]) => key !== 'waitingHost' && key !== 'refreshDetail')
    for (const [, template] of lines) {
      const filled = template.replace('{player}', 'Bartholomew').replace('{n}', '10').replace('{total}', '2')
      expect(texts).toContain(filled)
    }
    expect(detail).toContain(w.prompts.refreshDetail)
  })
  it('sizes for every note and the whose-turn line', () => {
    for (const note of Object.values(w.notes)) expect(detail).toContain(note)
    expect(detail).toContain("Bartholomew's turn")
  })
  it('sizes for the reveal, with every winner at once', () => {
    expect(texts).toContain(w.reveal.tangles)
    expect(texts).toContain('Grand Glyphtenders: Yellow & Bartholomew & Pink!')
    expect(texts).toContain('Counting Bartholomew\'s Magic…')
  })
})
