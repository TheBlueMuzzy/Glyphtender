// OLDER SAVED GAMES → TODAY'S SHAPE. Every saved game comes in through the store's loadState (Dev Kit snapshots,
// e2e fixtures, Dev Kit previews), which runs it through migrateGame — the one place an old save is brought up to date.
// Pure: it returns a new game and never changes the one it was given.
import type { GameState } from './types'

/** Games saved before 2026-10-01 hold the old "Qu" seed; it's a plain "Q" now (F24). */
const plainQ = (letter: string) => (letter === 'Qu' ? 'Q' : letter)

export function migrateGame(game: GameState): GameState {
  const seeds = Object.fromEntries(Object.entries(game.seeds).map(([key, seed]) => [key, { ...seed, letter: plainQ(seed.letter) }]))
  const lastTurn = game.lastTurn && { ...game.lastTurn, letter: game.lastTurn.letter && plainQ(game.lastTurn.letter) }
  const log = game.log && {
    ...game.log,
    turns: game.log.turns.map((t) => ({
      ...t,
      letter: t.letter && plainQ(t.letter),
      words: t.words.map((w) => ({ ...w, letters: w.letters.map(plainQ) })),
    })),
  }
  return { ...game, seeds, lastTurn, log, hands: game.hands.map((hand) => hand.map(plainQ)), bag: game.bag.map(plainQ) }
}
