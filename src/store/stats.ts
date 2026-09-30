// THE END TABLE'S NUMBERS — gathered turn by turn from what the engine says each turn made (lastTurn).
// The rules don't need these, so they live beside the game, not in it. Magic totals and tangle Magic
// come straight from the engine at the end; this adds best turn, longest word and words made.
import type { TurnSummary } from '../engine/types'

export interface PlayerStats {
  /** Most Magic made in one turn. */
  bestTurn: number
  /** The longest word this player grew ('' if none yet). A tie keeps the first one. */
  longestWord: string
  /** How many words this player grew in the whole game. */
  wordsMade: number
}

/** Everyone starts with nothing. */
export const emptyStats = (players: number): PlayerStats[] =>
  Array.from({ length: players }, () => ({ bestTurn: 0, longestWord: '', wordsMade: 0 }))

/** The stats after one more finished turn (a new list — the old one isn't changed). */
export function addTurn(stats: PlayerStats[], turn: TurnSummary): PlayerStats[] {
  return stats.map((mine, seat) => {
    if (seat !== turn.seat) return mine
    const longest = turn.words.reduce((best, w) => (w.word.length > best.length ? w.word : best), mine.longestWord)
    return {
      bestTurn: Math.max(mine.bestTurn, turn.magic),
      longestWord: longest,
      wordsMade: mine.wordsMade + turn.words.length,
    }
  })
}
