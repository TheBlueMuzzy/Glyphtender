// THE GAME STORE — what the screen shows: the engine's game state, the word list, and the turn being
// planned (move, cast, what's held) before Cast makes it real. Taps call these actions; the actions only
// ever change the game by sending an engine action (checkAction first, then applyAction). Golden rule.
import { create } from 'zustand'
import { applyAction, checkAction, newGame } from '../engine/engine'
import { hexKey, sameHex, type Hex } from '../engine/hex'
import { parseWordList } from '../engine/words'
import type { GameState, WordList } from '../engine/types'
import {
  castOptions, hexIn, highlightFor, inHandOrder, isCurrents, mayMoveOnly, moveInOrder, reconcileOrder,
  shuffled, turnAction, type PlannedCast, type PlannedMove, type Selection,
} from './turnPlan'

/** Short messages for taps that can't do anything (their words live in content/text/en.json → game.notes). */
export type Note = 'moveFirst' | 'notYours' | 'tangled' | 'wordsLoading' | 'problem'

export interface GameStore {
  game: GameState | null
  words: WordList | null
  wordsStatus: 'idle' | 'loading' | 'ready' | 'failed'
  move: PlannedMove | null
  cast: PlannedCast | null
  selected: Selection
  /** True while a thrown seed is in the air — nothing can be touched. */
  flying: boolean
  /** Refresh mode: hand indexes set aside. */
  setAside: number[]
  /** Each seat's tray order (hand indexes, left to right). Only the screen cares; the rules don't. */
  trayOrder: number[][]
  /** The seed that just landed (hexKey) and a counter that changes every landing, for the grow + glow. */
  landed: { key: string; count: number } | null
  note: Note | null

  startGame: (options: { players: number; seed: number; boardName?: string }) => void
  leaveGame: () => void
  loadWords: (url: string) => Promise<void>
  setWords: (words: WordList) => void
  tapGlyphling: (id: number) => void
  grabGlyphling: (id: number) => void
  tapSeed: (index: number) => void
  grabSeed: (index: number) => void
  tapHex: (hex: Hex) => void
  undo: () => void
  startCast: () => void
  finishCast: () => void
  toggleSetAside: (index: number) => void
  refresh: (keepAll?: boolean) => void
  moveTraySeed: (from: number, to: number) => void
  shuffleTray: () => void
  /** Dev and e2e only: jump straight to a game state. */
  loadState: (game: GameState) => void
}

// Everything about the turn being planned, cleared (a fresh object each time, so nothing is shared)
const noPlan = (): Pick<GameStore, 'move' | 'cast' | 'selected' | 'setAside' | 'note'> =>
  ({ move: null, cast: null, selected: null, setAside: [], note: null })
const NO_WORDS: WordList = new Map() // the draft and refresh never read words

export const useGameStore = create<GameStore>()((set, get) => {
  // Sends an engine action; says "problem" instead of crashing if it was somehow illegal.
  const send = (action: Parameters<typeof applyAction>[1]) => {
    const { game, words } = get()
    if (!game) return null
    if (action.type === 'turn' && !words) {
      set({ note: 'wordsLoading' })
      return null
    }
    const problem = checkAction(game, action)
    if (problem) {
      console.warn('Illegal action from the screen:', problem)
      set({ ...noPlan(), note: 'problem' })
      return null
    }
    return applyAction(game, action, words ?? NO_WORDS)
  }

  return {
    game: null,
    words: null,
    wordsStatus: 'idle',
    ...noPlan(),
    flying: false,
    trayOrder: [],
    landed: null,

    startGame: ({ players, seed, boardName }) => {
      const game = newGame({ players, seed, boardName })
      set({ ...noPlan(), game, flying: false, landed: null, trayOrder: game.hands.map((h) => inHandOrder(h.length)) })
    },
    leaveGame: () => set({ ...noPlan(), game: null, flying: false, landed: null }),

    // The official word list, fetched once (about 250 KB gzipped)
    loadWords: async (url) => {
      if (get().wordsStatus === 'loading' || get().wordsStatus === 'ready') return
      set({ wordsStatus: 'loading' })
      try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Word list: HTTP ${response.status}`)
        set({ words: parseWordList(await response.text()), wordsStatus: 'ready' })
      } catch (error) {
        console.warn('Could not load the word list', error)
        set({ wordsStatus: 'failed' })
      }
    },
    setWords: (words) => set({ words, wordsStatus: 'ready' }),

    // Tap a glyphling: hold it (tap again to let go). Tapping the moved one lets you pick a new spot.
    tapGlyphling: (id) => {
      const { game, selected, flying } = get()
      if (!game || flying || game.phase !== 'play') return
      if (selected?.kind === 'glyphling' && selected.id === id) return set({ selected: null })
      get().grabGlyphling(id)
    },
    grabGlyphling: (id) => {
      const { game, move, flying } = get()
      if (!game || flying || game.phase !== 'play') return
      if (!isCurrents(game, id)) return set({ note: 'notYours' })
      if (game.tangled.includes(id)) return set({ selected: null, note: 'tangled' })
      if (move?.glyphling === id) return set({ selected: { kind: 'glyphling', id }, note: null })
      set({ ...noPlan(), selected: { kind: 'glyphling', id } }) // a different glyphling: the old plan goes
    },

    // Tap a tray seed: in refresh mode it's set aside; otherwise hold it to cast (after a move).
    tapSeed: (index) => {
      const { game, selected, cast, move, flying } = get()
      if (!game || flying) return
      if (game.phase === 'refresh') return get().toggleSetAside(index)
      if (game.phase !== 'play') return
      if (!move) return set({ note: 'moveFirst' })
      if (cast?.seed !== index && selected?.kind === 'seed' && selected.index === index) return set({ selected: null })
      get().grabSeed(index)
    },
    grabSeed: (index) => {
      const { game, cast, move, flying } = get()
      if (!game || flying || game.phase !== 'play' || !move) return
      // Picking up the targeted seed takes it back off the board
      set({ selected: { kind: 'seed', index }, cast: cast?.seed === index ? null : cast, note: null })
    },

    // Tap a hex: place (draft), move there, cast there, or take back what's planned there.
    tapHex: (hex) => {
      const { game, move, cast, selected, flying } = get()
      if (!game || flying) return
      if (game.phase === 'draft') {
        const next = send({ type: 'draft', hex })
        if (!next) return
        const dealt = next.phase === 'play'
        return set({ ...noPlan(), game: next, trayOrder: dealt ? next.hands.map((h) => inHandOrder(h.length)) : get().trayOrder })
      }
      if (game.phase !== 'play') return
      const options = highlightFor(game, move, selected)
      if (selected?.kind === 'glyphling' && options && hexIn(options.hexes, hex)) {
        return set({ move: { glyphling: selected.id, to: hex }, cast: null, selected: null, note: null })
      }
      if (selected?.kind === 'seed' && move && hexIn(castOptions(game, move), hex)) {
        return set({ cast: { seed: selected.index, target: hex }, selected: null, note: null })
      }
      if (cast && sameHex(cast.target, hex)) return set({ cast: null, note: null }) // the seed goes back to the tray
      const origin = move && game.glyphlings.find((g) => g.id === move.glyphling)?.hex
      if (origin && sameHex(origin, hex)) return set({ ...noPlan() }) // tapped the ghost: the glyphling goes back
      set({ selected: null })
    },

    // Undo takes back the last step: the cast, then the move.
    undo: () => {
      const { cast, move, flying } = get()
      if (flying) return
      if (cast) return set({ cast: null, selected: null, note: null })
      if (move) set({ ...noPlan() })
    },

    // Cast: the seed flies (the board animates it) and finishCast runs when it lands.
    // A move-only turn (no seeds, or nowhere to cast) has nothing to throw, so it commits at once.
    startCast: () => {
      const { game, move, cast, flying, words } = get()
      if (!game || !move || flying) return
      if (!words) return set({ note: 'wordsLoading' })
      if (cast) return set({ flying: true, selected: null })
      if (mayMoveOnly(game, move)) get().finishCast()
    },
    finishCast: () => {
      const { game, move, cast, trayOrder } = get()
      if (!game || !move) return set({ flying: false })
      const next = send(turnAction(move, cast))
      if (!next) return set({ flying: false })
      const seat = game.current
      const order = [...trayOrder]
      order[seat] = reconcileOrder(order[seat] ?? [], cast ? [cast.seed] : [], next.hands[seat].length)
      const landed = cast ? { key: hexKey(cast.target), count: (get().landed?.count ?? 0) + 1 } : get().landed
      set({ ...noPlan(), game: next, flying: false, trayOrder: order, landed })
    },

    toggleSetAside: (index) => {
      const { setAside, game } = get()
      if (game?.phase !== 'refresh') return
      set({ setAside: setAside.includes(index) ? setAside.filter((i) => i !== index) : [...setAside, index] })
    },
    // Refresh N (or Keep all = set nothing aside): refill to a full hand; set-aside seeds go back in the bag.
    refresh: (keepAll = false) => {
      const { game, setAside, trayOrder } = get()
      if (!game || game.phase !== 'refresh') return
      const chosen = keepAll ? [] : [...setAside].sort((a, b) => a - b)
      const next = send({ type: 'refresh', setAside: chosen })
      if (!next) return
      const seat = game.current
      const order = [...trayOrder]
      order[seat] = reconcileOrder(order[seat] ?? [], chosen, next.hands[seat].length)
      set({ ...noPlan(), game: next, trayOrder: order })
    },

    moveTraySeed: (from, to) => {
      const { game, trayOrder } = get()
      if (!game || from === to) return
      const order = [...trayOrder]
      order[game.current] = moveInOrder(order[game.current], from, to)
      set({ trayOrder: order })
    },
    shuffleTray: () => {
      const { game, trayOrder } = get()
      if (!game) return
      const order = [...trayOrder]
      order[game.current] = shuffled(order[game.current])
      set({ trayOrder: order })
    },

    loadState: (game) => set({ ...noPlan(), game, flying: false, trayOrder: game.hands.map((h) => inHandOrder(h.length)) }),
  }
})
