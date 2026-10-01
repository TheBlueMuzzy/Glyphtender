// The official Glyphtender word list (public/words/words.csv — the original's words.txt, unchanged).
// Each line is "WORD,ZIPF": the word in capitals and how common it is (Zipf score, 0 = rare/unknown).
import type { WordList } from './types'

/** Reads the word list's text into word → Zipf. Copes with a byte-order mark, Windows line ends and blank lines. */
export function parseWordList(text: string): Map<string, number> {
  const words = new Map<string, number>()
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text // strip a byte-order mark if there is one
  for (const line of clean.split(/\r?\n/)) {
    const [word, zipf] = line.split(',')
    const score = Number.parseFloat(zipf)
    if (!word || Number.isNaN(score)) continue // blank line or a header like "WORD,ZIPF"
    words.set(word.trim().toUpperCase(), score)
  }
  return words
}

/** How a seed spells: its letter, in capitals. (Q is a plain Q since 2026-10-01 — QUIT needs a U seed too.) */
export const spell = (letter: string) => letter.toUpperCase()

/** Is this spelling a word in the list? */
export const isWord = (words: WordList, spelled: string) => words.has(spelled)
