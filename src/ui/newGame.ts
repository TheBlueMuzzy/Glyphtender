// Starting and leaving a game from the menus. The new-game screen (NewGameScreen.tsx) picks the table
// options; the last choices are remembered on this device (localStorage — never required: if the browser
// won't store them, the defaults are used). Play again reuses the options the game started with.
import boardsJson from '../../content/data/boards.json'
import rulesJson from '../../content/tuning/rules.json'
import { defaultBoardFor } from '../engine/boards'
import { useGameStore } from '../store/gameStore'
import { screens } from './kit'

/** What the new-game screen asks. */
export interface NewGameChoices {
  players: number
  /** A board name from content/data/boards.json ("small", "large"). */
  boardName: string
  /** On = 2-letter words make Magic (min word length 2); off = words need 3 letters or more. */
  twoLetterWords: boolean
  /** Pass-and-play: hide each player's seeds between turns. */
  hideSeeds: boolean
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>
const SAVE_KEY = 'glyphtender:new-game'
const MIN_PLAYERS = 2
const MAX_PLAYERS = 4

/** Every board in content/data/boards.json (its entries that have columns), e.g. ["small", "large"]. */
export const boardNames = (): string[] =>
  Object.entries(boardsJson).filter(([, entry]) => Array.isArray((entry as { columns?: unknown }).columns)).map(([name]) => name)

/** First time: 2 players on their default board, 2-letter words as rules.json says, seeds hidden. */
export const defaultChoices = (): NewGameChoices =>
  ({ players: MIN_PLAYERS, boardName: defaultBoardFor(MIN_PLAYERS), twoLetterWords: rulesJson.minWordLength <= 2, hideSeeds: true })

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
    minWordLength: choices.twoLetterWords ? 2 : 3, hideSeeds: choices.hideSeeds,
  })
}

/** Play again: the same table options as the game just played, a fresh garden. */
export function playAgain() {
  const options = useGameStore.getState().options
  closeAllScreens()
  if (!options) return startNewGame(loadChoices())
  useGameStore.getState().startGame({ ...options, seed: randomSeed() })
}

/** End table → New game: back to the menu with the new-game screen open. */
export function newGameFromEnd() {
  leaveToMenu()
  openNewGame()
}

/** Back to the main menu. */
export function leaveToMenu() {
  closeAllScreens()
  useGameStore.getState().leaveGame()
}

/** Close every open menu (the Dev Kit's restore uses this too). */
export function closeAllScreens() {
  for (let i = screens.current.length; i > 0; i--) screens.pop()
}
