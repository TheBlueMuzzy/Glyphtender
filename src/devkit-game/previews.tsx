// GLYPHTENDER'S SCREEN PREVIEWS — the Dev Kit's Screens tab lists these (` → Screens). Each opens a screen that's
// normally gated (you'd have to play a whole game, or get 4 phones online) with sample data, in a sandbox:
// a separate copy of the game in a frame over the real one (src/devkit/previews/). show() runs INSIDE that frame,
// so filling the stores here never touches the real game. Saves, sends and history steps are blocked there.
// Dev only — never in a release build. The sample games are real games played by the sim (sampleGames.ts).
// Not here (and why): an "update available" notice — there isn't one (a new release swaps in silently, B020);
// board moments (draft, refresh, danger cues, tangles) — the Snapshots tab restores those in the real game;
// Settings / Credits — not gated (the main menu opens them).
import type { DevKitPreview, PreviewSandbox } from '../devkit/previews/previewTypes'
import type { WordList } from '../engine/types'
import { SEAT_COLOURS } from '../engine/types'
import { wordListUrl } from '../game/art'
import type { Seat as RoomSeat } from '../rooms/protocol'
import { useGameStore, type OnlineLink } from '../store/gameStore'
import type { Seat } from '../store/seats'
import text from '../../content/text/en.json'
import { fill, screens, toast } from '../ui/kit'
import { closedMessage, useOnline, type Room } from '../ui/online/session'
import { PreviewApp } from './PreviewApp'
import { finishedGame, midGame, tiedGame, type SampleGame } from './sampleGames'

// ─── The end screen — ONE function, so a new end screen is a one-line swap (F26) ───────────────────────
/** Opens the end screen for a finished game: the reveal done, the end table open (src/game/GameOver.tsx). */
function showEndScreen(sample: SampleGame) {
  loadGame(sample)
  useGameStore.getState().skipReveal() // the Magic reveal already played (revealAt = its last step)
  screens.push('gameOver') // the end table: menuScreens.gameOver → GameOverDialog → GameOverScreen
}

// ─── Sample data ───────────────────────────────────────────────────────────────────────────────────
/** The real word list (the same file the game loads; the store keeps it, so the game screen won't load it again). */
async function words(): Promise<WordList> {
  await useGameStore.getState().loadWords(wordListUrl())
  const list = useGameStore.getState().words
  if (!list) throw new Error("the word list didn't load")
  return list
}

/** Puts a sample game in the store, with the table options a new game would have. */
function loadGame({ game, stats }: SampleGame) {
  useGameStore.getState().loadState(game, stats)
  useGameStore.setState({
    options: { players: game.config.players, boardName: game.config.boardName, minWordLength: game.config.rules.minWordLength, hideSeeds: true, wordIndicators: true },
  })
}

const PLAYER_COUNTS = [{ id: '2p', label: '2 players' }, { id: '3p', label: '3 players' }, { id: '4p', label: '4 players' }]
const END_VARIANTS = [...PLAYER_COUNTS, { id: 'tie', label: 'A tie' }]
const playersOf = (variant: string | undefined) => Number(variant?.[0] ?? 2)

/** A finished game for an end-of-game variant: 2p / 3p / 4p, or a 2-player tie. */
async function endGame(variant: string | undefined): Promise<SampleGame> {
  const list = await words()
  if (variant !== 'tie') return finishedGame(playersOf(variant), list)
  const tie = tiedGame(list)
  if (!tie) throw new Error('no tied game in the first 200 seeds — raise tiedGame tries')
  return tie
}

// Online: names, and a room / link that go nowhere
const ONLINE_NAMES = ['Muzzy', 'Ada', 'Sam', 'Kit']
const roomSeat = (i: number, extra: Partial<RoomSeat> = {}): RoomSeat =>
  ({ id: `seat-${i + 1}`, name: ONLINE_NAMES[i], kind: 'human', isHost: i === 0, connected: true, ready: true, missedTurns: 0, ...extra })
const nothing = () => {}

/** The session store's room, as useRoom would give it — every action does nothing (a preview never sends). */
function fakeRoom(seats: RoomSeat[], phase: 'lobby' | 'playing', mySeat: number): Room {
  return {
    status: 'open', room: { code: 'BAKU', phase, seats, minSeats: 2, maxSeats: 4 }, mySeat: seats[mySeat], isHost: seats[mySeat].isHost,
    view: null, error: null, closedReason: null, send: () => false,
    setReady: nothing, start: nothing, kick: nothing, addBot: nothing, backToLobby: nothing, leave: nothing, clearError: nothing,
  }
}

/** An online game on this device (seat 0), with the room beside it; `seats` = the room's seats. */
function onlineGame(sample: SampleGame, seats: RoomSeat[]) {
  const link: OnlineLink = { mySeat: 0, gameId: 1, version: 1, post: nothing, landed: nothing, resume: nothing }
  const storeSeats: Seat[] = seats.map((s, i) => ({ kind: i === 0 ? 'local' : 'online', name: s.name, colour: SEAT_COLOURS[i] }))
  loadGame(sample)
  useGameStore.setState({ online: link, seats: storeSeats, options: { ...useGameStore.getState().options!, hideSeeds: false } })
  useOnline.setState({ code: 'BAKU', name: ONLINE_NAMES[0], room: fakeRoom(seats, 'playing', 0) })
}

const LONG = 3600 // seconds: a preview's toast stays up to be looked at (the real ones go after 3)

// ─── The list ──────────────────────────────────────────────────────────────────────────────────────
export const previews: DevKitPreview[] = [
  {
    id: 'handoff', label: 'Pass the device', group: 'Between turns', hint: 'phone',
    note: '"Pass to Blue" — pass-and-play with hidden seeds, between two players',
    variants: [{ id: '2p', label: 'to Blue (2p)' }, { id: '3p', label: 'to Purple (3p)' }, { id: '4p', label: 'to Pink (4p)' }],
    async show({ variant }) {
      const players = playersOf(variant)
      loadGame(midGame(players, await words(), { current: players - 1 }))
      useGameStore.setState({ handoff: { seat: players - 1, afterGrow: false } })
    },
  },
  {
    id: 'reveal', label: 'Magic reveal', group: 'End of game',
    note: 'Plays the staged reveal from the start (+3 tangles, then each player\'s Magic), then opens the end table. ↻ replays it',
    variants: END_VARIANTS,
    async show({ variant }) {
      loadGame(await endGame(variant)) // revealAt null: the reveal starts on its own, as after a real last turn
    },
  },
  {
    id: 'end-table', label: 'End table', group: 'End of game',
    note: 'The results, straight away (the reveal skipped)',
    variants: END_VARIANTS,
    async show({ variant }) {
      showEndScreen(await endGame(variant))
    },
  },
  {
    id: 'pause', label: 'Pause menu', group: 'Menus', note: 'The ☰ Menu button in a game',
    variants: [{ id: 'offline', label: 'Pass-and-play' }, { id: 'online', label: 'Online (Room BAKU)' }],
    async show({ variant }) {
      const sample = midGame(2, await words())
      if (variant === 'online') onlineGame(sample, [roomSeat(0), roomSeat(1)])
      else loadGame(sample)
      screens.push('pause')
      return variant === 'online' ? <PreviewApp /> : undefined
    },
  },
  {
    id: 'rules', label: 'Rules (how to play)', group: 'Menus', note: 'Menu → Rules, in a game',
    async show() {
      loadGame(midGame(2, await words()))
      screens.push('pause')
      screens.push('rules')
    },
  },
  {
    id: 'new-game', label: 'New game', group: 'Menus', note: 'Play → the table options (this device\'s last choices)',
    show() {
      screens.push('newGame')
    },
  },
  {
    id: 'lobby', label: 'Online lobby', group: 'Online', note: 'A room with friends in it — the host sees the table options',
    variants: [{ id: 'host2', label: 'Host, 2 seats' }, { id: 'host4', label: 'Host, 4 seats' }, { id: 'guest4', label: 'Guest, 4 seats' }],
    show({ variant }) {
      const four = variant !== 'host2'
      const seats = four
        ? [roomSeat(0), roomSeat(1), roomSeat(2, { ready: false }), roomSeat(3, { kind: 'bot', name: 'Bot' })]
        : [roomSeat(0), roomSeat(1, { ready: false })]
      const me = variant === 'guest4' ? 2 : 0
      useOnline.setState({ code: 'BAKU', name: ONLINE_NAMES[me], room: fakeRoom(seats, 'lobby', me) })
      return <PreviewApp />
    },
  },
  {
    id: 'join-error', label: 'Couldn\'t join', group: 'Online', note: 'Play online → Join, when the room says no',
    variants: [{ id: 'no_room', label: 'No such room' }, { id: 'room_full', label: 'Room full' }, { id: 'game_started', label: 'Game started' }],
    show({ variant }) {
      useOnline.setState({ name: ONLINE_NAMES[0], joinError: closedMessage((variant ?? 'no_room') as Parameters<typeof closedMessage>[0]) })
      screens.push('online')
    },
  },
  {
    id: 'seat-status', label: 'Bot took a seat', group: 'Online', note: 'A player left (or went idle): the toast, and the 🤖 / Away badge by their portrait',
    variants: [{ id: 'botLeft', label: 'Left → bot' }, { id: 'botIdle', label: 'Idle → bot' }, { id: 'away', label: 'Away' }],
    async show({ variant }) {
      const sample = midGame(3, await words(), { current: 1 }) // Ada's turn — the badge sits by the turn portrait
      const ada = variant === 'away' ? roomSeat(1, { connected: false }) : roomSeat(1, { kind: 'bot', connected: variant !== 'botLeft' })
      onlineGame(sample, [roomSeat(0), ada, roomSeat(2)])
      if (variant !== 'away') toast(fill(text.online.seats[variant === 'botIdle' ? 'botIdle' : 'botLeft'], { name: ONLINE_NAMES[1] }), { seconds: LONG })
      return <PreviewApp />
    },
  },
  {
    id: 'reconnecting', label: 'Reconnecting', group: 'Online', note: 'The connection dropped mid-game',
    async show() {
      onlineGame(midGame(2, await words()), [roomSeat(0), roomSeat(1)])
      return <PreviewApp reconnecting />
    },
  },
  {
    id: 'words-failed', label: 'Word list didn\'t load', group: 'Problems', note: 'A first visit on a bad connection: the warning, and Cast becomes Retry (Retry fails here too)',
    async show(sandbox: PreviewSandbox) {
      loadGame(midGame(2, await words()))
      sandbox.failRequests(wordListUrl()) // the game screen tries again on its own; that fails, as it would
      useGameStore.setState({ words: null, wordsStatus: 'idle' })
    },
  },
]
