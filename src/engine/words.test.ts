/// <reference types="node" />
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseWordList, spell } from './words'

const file = readFileSync(new URL('../../public/words/words.csv', import.meta.url))
const words = parseWordList(file.toString('utf8'))
const atLeast = (z: number) => [...words.values()].filter((v) => v >= z).length

describe('the official word list (public/words/words.csv)', () => {
  it('is the original words.txt, byte for byte', () => {
    // SHA-256 of Assets/Resources/words.txt in glyphtender-original (git blob 3280512a).
    expect(createHash('sha256').update(file).digest('hex')).toBe('7dd3b759bafa5c4a97c52d28ca29171d04b20e8e5337489d71a2deb48cc8e59e')
  })

  it('has the known Zipf tiers', () => {
    expect(atLeast(5)).toBe(1000)
    expect(atLeast(4)).toBe(6342)
    expect(atLeast(3)).toBe(21805)
    expect(atLeast(2)).toBe(43997)
  })

  it('has 63,657 words: the file has 63,656 line breaks and no line break after the last word (ROMAN)', () => {
    expect(file.toString('utf8').split('\n').length - 1).toBe(63656)
    expect(file.toString('utf8').endsWith('ROMAN,4.50')).toBe(true)
    expect(words.size).toBe(63657)
    expect(atLeast(0)).toBe(63657)
  })

  it('knows common words and their Zipf scores', () => {
    expect(words.get('THE')).toBe(7.73)
    expect(words.get('AA')).toBe(4.01)
    expect(words.has('QUIT')).toBe(true)
    expect(words.has('XYZZY')).toBe(false)
  })

  it('keeps the original’s quirk: ZYGOTES is glued onto a stray AA line (it’s "ZYGOTESAA" — not changed, see SPRINT notes)', () => {
    expect(words.has('ZYGOTES')).toBe(false)
    expect(words.has('ZYGOTESAA')).toBe(true)
  })
})

describe('parseWordList copes with other file shapes', () => {
  it('ignores a byte-order mark, Windows line ends, blank lines and a header', () => {
    const parsed = parseWordList('﻿WORD,ZIPF\r\ncat,3.5\r\n\r\nDOG,4\r\n')
    expect([...parsed.entries()]).toEqual([
      ['CAT', 3.5],
      ['DOG', 4],
    ])
  })
})

describe('Q (GDD §4.3 — plain Q since 2026-10-01)', () => {
  it('a Q seed spells just Q, like every other seed spells its letter', () => {
    expect(spell('Q')).toBe('Q')
    expect(spell('A')).toBe('A')
  })

  it('the list has the Q-without-U words a plain Q opens up (QI, QAT) and QUA for Q + U + A', () => {
    for (const w of ['QI', 'QAT', 'QUA', 'SUQ']) expect(words.has(w)).toBe(true)
  })
})
