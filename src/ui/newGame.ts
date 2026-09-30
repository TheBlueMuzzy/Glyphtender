// Starting and leaving a game from the menus. Until F14's new-game screen: always 2 players on the
// board content/data/boards.json names for 2 (defaultForPlayers), with a fresh random seed.
import { defaultBoardFor } from '../engine/boards'
import { useGameStore } from '../store/gameStore'
import { screens } from './kit'

const PLAYERS = 2

export function startNewGame() {
  const seed = Math.floor(Math.random() * 2 ** 31)
  useGameStore.getState().startGame({ players: PLAYERS, seed, boardName: defaultBoardFor(PLAYERS) })
}

/** Close any open screens (results, pause) and deal a fresh game. */
export function playAgain() {
  closeAllScreens()
  startNewGame()
}

/** Back to the main menu. */
export function leaveToMenu() {
  closeAllScreens()
  useGameStore.getState().leaveGame()
}

function closeAllScreens() {
  for (let i = screens.current.length; i > 0; i--) screens.pop()
}
