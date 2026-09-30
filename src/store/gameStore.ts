// THE GAME STORE — what the screen shows: the engine's game state, the word list, and the turn being
// planned (move, cast, what's held) before Cast makes it real. Taps call these actions; the actions only
// ever change the game by sending an engine action (checkAction first, then applyAction). Golden rule.
// It also knows who sits in each seat (seats.ts), when the device is being passed on (handoff),
// the end table's numbers (stats.ts) and how far the end-of-game Magic reveal has got.
// ONLINE (onlinePlay.ts): this device plans its own seat exactly the same way, but the action goes to the
// server instead of the engine, and the server's view of the game comes back and replaces `game`.
import { create } from 'zustand'
import text from '../../content/text/en.json'
import { applyAction, checkAction, legalDraftHexes, newGame } from '../engine/engine'
import { hexKey, sameHex, type Hex } from '../engine/hex'
import { parseWordList } from '../engine/words'
import type { Action, GameState, WordList } from '../engine/types'
import {
  castOptions, hexIn, highlightFor, inHandOrder, isCurrents, mayMoveOnly, moveInOrder, reconcileOrder,
  shuffled, turnAction, type PlannedCast, type PlannedMove, type Selection,
} from './turnPlan'
import { isLocalHuman, localSeats, needsHandoff, type Seat } from './seats'
import { addTurn, emptyStats, type PlayerStats } from './stats'
import { revealSteps } from './revealPlan'

/** Short messages for taps that can't do anything (their words live in content/text/en.json → game.notes). */
export type Note = 'moveFirst' | 'notYours' | 'tangled' | 'wordsLoading' | 'wordsFailed' | 'problem'

/** The table options a game starts with (the new-game screen). Play again reuses them. */
export interface GameOptions {
  players: number
  boardName: string
  /** 2 = two-letter words count; 3 = the "2-letter words off" table option. */
  minWordLength: number
  /** Pass-and-play: hide the tray between turns until the next player taps "Show my seeds". */
  hideSeeds: boolean
  /** Made words get a white border, Cast shows "+N" and the Magic pops. Off = players spot words themselves. */
  wordIndicators: boolean
}

/** Waiting for the device to be passed to `seat` (their seeds stay hidden until they tap). */
export interface Handoff {
  seat: number
  /** True when a seed was just thrown: the screen lets it grow before asking for the device to be passed. */
  afterGrow: boolean
}

/** An online game: which seat is this device's, the server's view version, and the way to the server (onlinePlay.ts). */
export interface OnlineLink {
  mySeat: number
  gameId: number
  version: number
  /** Send this seat's action to the server (it answers with a new view). */
  post: (action: Action) => void
  /** A thrown seed landed (this device's own, or another player's being replayed). */
  landed: () => void
}

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
  /** Who sits in each seat (all local for now). */
  seats: Seat[]
  options: GameOptions | null
  /** Set while the device is being passed on — the tray is hidden and nothing can be touched. */
  handoff: Handoff | null
  /** Each player's best turn, longest word and words made, for the end table. */
  stats: PlayerStats[]
  /** How far the end-of-game Magic reveal has got (a step number in revealPlan.ts); null = not started. */
  revealAt: number | null
  /** Online only (null in pass-and-play). */
  online: OnlineLink | null
  /** Online: this device's action went to the server; nothing can be touched until its view comes back. */
  waiting: boolean

  startGame: (options: Partial<GameOptions> & { players: number; seed: number }) => void
  leaveGame: () => void
  /** The next player has the device: show their seeds. */
  showSeeds: () => void
  setRevealAt: (step: number | null) => void
  /** Skip: jump to the end of the reveal (everything shown). */
  skipReveal: () => void
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
  /** Dev and e2e only: jump straight to a game state (with the end table's numbers so far, if known). */
  loadState: (game: GameState, stats?: PlayerStats[]) => void
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
    if (action.type === 'turn' && action.seed !== null && !words) { // only a cast grows words; a move-only turn never reads them
      set({ note: wordsNote() })
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

  // Why a cast can't go yet: the words are still coming, or they couldn't be loaded (the screen offers Retry)
  const wordsNote = (): Note => (get().wordsStatus === 'failed' ? 'wordsFailed' : 'wordsLoading')

  // Online: check it here too (so a mistake shows at once), then the server plays it and sends the new view.
  const sendOnline = (action: Action): boolean => {
    const { game, online } = get()
    if (!game || !online) return false
    const problem = checkAction(game, action)
    if (problem) {
      console.warn('Illegal action from the screen:', problem)
      set({ ...noPlan(), note: 'problem' })
      return false
    }
    set({ waiting: true, selected: null, note: null }) // before posting: the answer may come back at once
    online.post(action)
    return true
  }

  // May the screen touch the game right now? Not while a seed flies, not while the device is being
  // passed on, not while waiting for the server, and only when the seat whose turn it is belongs to a
  // human on this device.
  const canPlay = () => {
    const { game, flying, handoff, seats, waiting } = get()
    return game !== null && !flying && !waiting && handoff === null && isLocalHuman(seats, game.current)
  }

  // Once play has passed on: must the device be handed over first? (from = null: always — after the draft)
  const handoffTo = (from: number | null, next: GameState, afterGrow: boolean): Handoff | null => {
    const { seats, options } = get()
    if (next.phase !== 'play') return null
    return needsHandoff(seats, from, next.current, options?.hideSeeds ?? false) ? { seat: next.current, afterGrow } : null
  }

  return {
    game: null,
    words: null,
    wordsStatus: 'idle',
    ...noPlan(),
    flying: false,
    trayOrder: [],
    landed: null,
    seats: [],
    options: null,
    handoff: null,
    stats: [],
    revealAt: null,
    online: null,
    waiting: false,

    startGame: ({ players, seed, boardName, minWordLength, hideSeeds, wordIndicators }) => {
      const game = newGame({ players, seed, boardName, rules: minWordLength ? { minWordLength } : undefined })
      const options: GameOptions = {
        players, boardName: game.config.boardName, minWordLength: game.config.rules.minWordLength, hideSeeds: hideSeeds ?? true,
        wordIndicators: wordIndicators ?? true,
      }
      set({
        ...noPlan(), game, options, flying: false, landed: null, handoff: null, revealAt: null,
        seats: localSeats(players, text.game.players), stats: emptyStats(players),
        trayOrder: game.hands.map((h) => inHandOrder(h.length)),
      })
    },
    leaveGame: () => set({ ...noPlan(), game: null, flying: false, landed: null, handoff: null, revealAt: null, online: null, waiting: false }),
    showSeeds: () => set({ handoff: null }),
    setRevealAt: (step) => set({ revealAt: step }),
    skipReveal: () => {
      const { game } = get()
      if (game?.phase === 'over') set({ revealAt: revealSteps(game).length })
    },

    // The official word list, fetched once (about 250 KB gzipped). After a failed load, calling it again is Retry.
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
      const { game, selected } = get()
      if (!canPlay() || game?.phase !== 'play') return
      if (selected?.kind === 'glyphling' && selected.id === id) return set({ selected: null })
      get().grabGlyphling(id)
    },
    grabGlyphling: (id) => {
      const { game, move } = get()
      if (!game || !canPlay() || game.phase !== 'play') return
      if (!isCurrents(game, id)) return set({ note: 'notYours' })
      if (game.tangled.includes(id)) return set({ selected: null, note: 'tangled' })
      if (move?.glyphling === id) return set({ selected: { kind: 'glyphling', id }, note: null })
      set({ ...noPlan(), selected: { kind: 'glyphling', id } }) // a different glyphling: the old plan goes
    },

    // Tap a tray seed: in refresh mode it's set aside; otherwise hold it to cast (after a move).
    tapSeed: (index) => {
      const { game, selected, cast, move } = get()
      if (!game || !canPlay()) return
      if (game.phase === 'refresh') return get().toggleSetAside(index)
      if (game.phase !== 'play') return
      if (!move) return set({ note: 'moveFirst' })
      if (cast?.seed !== index && selected?.kind === 'seed' && selected.index === index) return set({ selected: null })
      get().grabSeed(index)
    },
    grabSeed: (index) => {
      const { game, cast, move } = get()
      if (!game || !canPlay() || game.phase !== 'play' || !move) return
      // Picking up the targeted seed takes it back off the board
      set({ selected: { kind: 'seed', index }, cast: cast?.seed === index ? null : cast, note: null })
    },

    // Tap a hex: place (draft), move there, cast there, or take back what's planned there.
    tapHex: (hex) => {
      const { game, move, cast, selected } = get()
      if (!game || !canPlay()) return
      if (game.phase === 'draft') {
        if (!hexIn(legalDraftHexes(game), hex)) return // not a glowing hex: nothing happens
        if (get().online) return void sendOnline({ type: 'draft', hex })
        const next = send({ type: 'draft', hex })
        if (!next) return
        const dealt = next.phase === 'play' // the draft is over and seeds are dealt: pass the device before turn 1
        return set({
          ...noPlan(), game: next, trayOrder: dealt ? next.hands.map((h) => inHandOrder(h.length)) : get().trayOrder,
          handoff: dealt ? handoffTo(null, next, false) : null,
        })
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
      if (cast && !selected && hexIn(castOptions(game, move), hex)) return set({ cast: { ...cast, target: hex }, note: null }) // aim it elsewhere
      const origin = move && game.glyphlings.find((g) => g.id === move.glyphling)?.hex
      if (origin && sameHex(origin, hex)) return set({ ...noPlan() }) // tapped the ghost: the glyphling goes back
      set({ selected: null })
    },

    // Undo takes back the last step: the cast, then the move.
    undo: () => {
      const { cast, move } = get()
      if (!canPlay()) return
      if (cast) return set({ cast: null, selected: null, note: null })
      if (move) set({ ...noPlan() })
    },

    // Cast: the seed flies (the board animates it) and finishCast runs when it lands.
    // A move-only turn (no seeds, or nowhere to cast) has nothing to throw, so it commits at once.
    startCast: () => {
      const { game, move, cast, words } = get()
      if (!game || !move || !canPlay()) return
      if (cast && !words) return set({ note: wordsNote() }) // End turn (move only) doesn't need the words
      // Online: the action leaves the moment Cast is pressed, so the trip to the server hides inside the throw
      if (get().online && (cast || mayMoveOnly(game, move))) {
        if (cast) set({ flying: true }) // the throw starts now; the server's view waits for it to land
        if (!sendOnline(turnAction(move, cast))) set({ flying: false })
        return
      }
      if (cast) return set({ flying: true, selected: null })
      if (mayMoveOnly(game, move)) get().finishCast()
    },
    finishCast: () => {
      const online = get().online
      if (online) return online.landed() // the server's view is applied there, not the engine's
      const { game, move, cast, trayOrder, stats } = get()
      if (!game || !move) return set({ flying: false })
      const next = send(turnAction(move, cast))
      if (!next) return set({ flying: false })
      const seat = game.current
      const order = [...trayOrder]
      order[seat] = reconcileOrder(order[seat] ?? [], cast ? [cast.seed] : [], next.hands[seat].length)
      const landed = cast ? { key: hexKey(cast.target), count: (get().landed?.count ?? 0) + 1 } : get().landed
      const played = next.lastTurn ? addTurn(stats, next.lastTurn) : stats
      set({ ...noPlan(), game: next, flying: false, trayOrder: order, landed, stats: played, handoff: handoffTo(seat, next, cast !== null) })
    },

    toggleSetAside: (index) => {
      const { setAside, game } = get()
      if (!canPlay() || game?.phase !== 'refresh') return
      set({ setAside: setAside.includes(index) ? setAside.filter((i) => i !== index) : [...setAside, index] })
    },
    // Refresh N (or Keep all = set nothing aside): refill to a full hand; set-aside seeds go back in the bag.
    // The player who just played does this BEFORE the device is passed on.
    refresh: (keepAll = false) => {
      const { game, setAside, trayOrder } = get()
      if (!game || !canPlay() || game.phase !== 'refresh') return
      const chosen = keepAll ? [] : [...setAside].sort((a, b) => a - b)
      if (get().online) return void sendOnline({ type: 'refresh', setAside: chosen })
      const next = send({ type: 'refresh', setAside: chosen })
      if (!next) return
      const seat = game.current
      const order = [...trayOrder]
      order[seat] = reconcileOrder(order[seat] ?? [], chosen, next.hands[seat].length)
      set({ ...noPlan(), game: next, trayOrder: order, handoff: handoffTo(seat, next, false) })
    },

    moveTraySeed: (from, to) => {
      const { game, trayOrder } = get()
      if (!game || !canPlay() || from === to) return
      const order = [...trayOrder]
      order[game.current] = moveInOrder(order[game.current], from, to)
      set({ trayOrder: order })
    },
    shuffleTray: () => {
      const { game, trayOrder } = get()
      if (!game || !canPlay()) return
      const order = [...trayOrder]
      order[game.current] = shuffled(order[game.current])
      set({ trayOrder: order })
    },

    loadState: (game, stats) => set({
      ...noPlan(), game, flying: false, handoff: null, revealAt: null,
      seats: get().seats.length === game.config.players ? get().seats : localSeats(game.config.players, text.game.players),
      stats: stats ?? (get().stats.length === game.config.players ? get().stats : emptyStats(game.config.players)),
      trayOrder: game.hands.map((h) => inHandOrder(h.length)),
    }),
  }
})
