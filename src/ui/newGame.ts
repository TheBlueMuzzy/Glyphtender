// Starting and leaving a game from the menus. The new-game screen (NewGameScreen.tsx) picks the table
// options; the last choices are remembered on this device (localStorage — never required: if the browser
// won't store them, the defaults are used). At the end, New game comes back here (online: the lobby).
import rulesJson from '../../content/tuning/rules.json'
import { boardNames, defaultBoardFor } from '../engine/boards'
import { useGameStore } from '../store/gameStore'
import { screens } from './kit'
import { leaveOnline, onlineBackToLobby } from './online/session'

/** What the new-game screen asks. */
export interface NewGameChoices {
  players: number
  /** A board name from content/data/boards.json ("small", "large"). */
  boardName: string
  /** On = 2-letter words make Magic (min word length 2); off = words need 3 letters or more. */
  twoLetterWords: boolean
  /** Pass-and-play: hide each player's seeds between turns. */
  hideSeeds: boolean
  /** On = made words get a white border, Cast shows "+N" and the Magic pops. Off = players spot words themselves. */
  wordIndicators: boolean
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>
const SAVE_KEY = 'glyphtender:new-game'
const MIN_PLAYERS = 2
const MAX_PLAYERS = 4

/** Every board in content/data/boards.json, e.g. ["small", "large"] (the server's options check uses it too). */
export { boardNames }

/** First time: 2 players on their default board, 2-letter words as rules.json says, seeds NOT hidden (players opt in), word indicators on. */
export const defaultChoices = (): NewGameChoices => ({
  players: MIN_PLAYERS, boardName: defaultBoardFor(MIN_PLAYERS), twoLetterWords: rulesJson.minWordLength <= 2, hideSeeds: false, wordIndicators: true,
})

/** A new player count also picks that count's default board (boards.json → defaultForPlayers). */
export const withPlayers = (choices: NewGameChoices, players: number): NewGameChoices =>
  ({ ...choices, players, boardName: defaultBoardFor(players) })

/** The browser's storage, or null where there is none (tests, private windows that refuse it). */
function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** The last choices made on this device, or the defaults (anything missing or odd falls back too). */
export function loadChoices(storage: Storage | null = browserStorage()): NewGameChoices {
  const fallback = defaultChoices()
  try {
    const saved = JSON.parse(storage?.getItem(SAVE_KEY) ?? 'null') as Partial<NewGameChoices> | null
    if (!saved) return fallback
    const players = Number.isInteger(saved.players) && saved.players! >= MIN_PLAYERS && saved.players! <= MAX_PLAYERS ? saved.players! : fallback.players
    const boardName = boardNames().includes(String(saved.boardName)) ? String(saved.boardName) : defaultBoardFor(players)
    return {
      players, boardName,
      twoLetterWords: typeof saved.twoLetterWords === 'boolean' ? saved.twoLetterWords : fallback.twoLetterWords,
      hideSeeds: typeof saved.hideSeeds === 'boolean' ? saved.hideSeeds : fallback.hideSeeds,
      wordIndicators: typeof saved.wordIndicators === 'boolean' ? saved.wordIndicators : fallback.wordIndicators,
    }
  } catch {
    return fallback
  }
}

export function saveChoices(choices: NewGameChoices, storage: Storage | null = browserStorage()) {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(choices))
  } catch {
    // Storage full or refused: the game still starts, it just won't remember
  }
}

const randomSeed = () => Math.floor(Math.random() * 2 ** 31)

/** Main menu → Play: open the new-game screen. */
export const openNewGame = () => screens.push('newGame')

/** Start: remember the choices, close the menus and deal a fresh game. */
export function startNewGame(choices: NewGameChoices) {
  saveChoices(choices)
  closeAllScreens()
  useGameStore.getState().startGame({
    players: choices.players, boardName: choices.boardName, seed: randomSeed(),
    minWordLength: choices.twoLetterWords ? 2 : 3, hideSeeds: choices.hideSeeds, wordIndicators: choices.wordIndicators,
  })
}

/** End table → New game (the only way on — GDD §4: fewer, clearer options): the new-game screen, with this
 *  device's last choices. Online: the host takes everyone back to the lobby to start again; others wait for it. */
export function newGameFromEnd() {
  if (useGameStore.getState().online) return onlineBackToLobby()
  leaveToMenu()
  openNewGame()
}

/** Back to the main menu (online: leaving the room — the seat is played for you so the others can finish). */
export function leaveToMenu() {
  closeAllScreens()
  if (useGameStore.getState().online) leaveOnline()
  useGameStore.getState().leaveGame()
}

/** Close every open menu (the Dev Kit's restore uses this too). */
export function closeAllScreens() {
  for (let i = screens.current.length; i > 0; i--) screens.pop()
}
