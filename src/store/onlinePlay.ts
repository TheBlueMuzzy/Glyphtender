// ONLINE PLAY IN THE STORE (design/online.md §4). The server owns the real game; this device gets views of it.
//   · MY seat plans and animates exactly like pass-and-play. Cast sends the action at once (gameStore.ts);
//     when the seed lands, the server's new view replaces the game (if it hasn't come yet we wait; every
//     WAIT_FOR_VIEW_MS without it, we ask the server to send it again).
//   · OTHER seats' turns arrive as views with `lastTurn`. They're replayed on the OLD view first — their trail
//     draws on in their colour and holds (trail.ts; anim.json trailLead + trailHold), the glyphling glides
//     from → to, the throw starts after glideSeconds, lands — then the new view is applied and the runeblossom
//     sprouts; the trail is gone with the landing. Views that arrive meanwhile wait in the inbox and play in order.
//   · Anything else (draft placements, refreshes, a rejoin after a gap) is simply applied.
//   · MY refresh plays out on my own tray (B011, refreshFx.ts): the set-aside seeds shrink while the action
//     travels; its view waits for the shrink, then the new seeds grow in. Nobody else sees my seeds.
import animJson from '../../content/tuning/anim.json'
import { liveTuning } from '../devkit/tuning/liveTuning'
import type { GameView, OnlineAction } from '../../party/protocol'
import { hexKey, sameHex } from '../engine/hex'
import { SEAT_COLOURS, type Action, type GameState, type TurnSummary } from '../engine/types'
import { glideSeconds } from '../game/glide'
import { reduceMotion } from '../ui/kit/blocks/motion'
import { useGameStore, type OnlineLink } from './gameStore'
import type { Seat } from './seats'
import { emptyStats } from './stats'
import { inHandOrder } from './turnPlan'
import { trailOf } from './trail'
import { newSeedSlots, refillInPlace } from './refreshFx'

/** How long to wait for my own action's view before asking again (design §6 timers table; counted from Cast). */
export const WAIT_FOR_VIEW_MS = 3000

const anim = liveTuning('anim', animJson) // the replay's timings (read when a replay starts, so the Dev Kit's changes count)

const store = () => useGameStore.getState()
const set = (part: Partial<ReturnType<typeof store>>) => useGameStore.setState(part)

// The inbox: views waiting their turn to be shown. Plain module state — only one online game at a time.
let inbox: GameView[] = []
let replaying: GameView | null = null // another player's turn being played out on the old view
let sent: Action | null = null // my last action (to keep my own tray order when its view comes back)
let toServer: (message: OnlineAction) => boolean = () => false
let syncTimer: ReturnType<typeof setTimeout> | null = null
let replayTimer: ReturnType<typeof setTimeout> | null = null

/** Where this device's messages go (useRoom's send: false = not connected right now). Set by OnlineSession.tsx. */
export function connectOnline(post: (message: OnlineAction) => boolean) {
  toServer = post
}

/** A view from the server. A new game (or the first view after a reload) starts over from it. */
export function receiveView(view: GameView) {
  const { online, game } = store()
  if (!online || !game || view.gameId !== online.gameId) return startFrom(view)
  inbox.push(view)
  showNext()
}

/** The server refused my action (a stale version, or something illegal): drop the plan, ask for the true view. */
export function actionRefused() {
  if (!store().online) return
  sent = null
  set({ move: null, cast: null, selected: null, setAside: [], flying: false, waiting: false, refreshFx: null, note: 'problem' })
  toServer({ kind: 'sync' })
}

/** Leaving the online game: forget everything waiting. */
export function stopOnline() {
  inbox = []
  replaying = null
  sent = null
  clearTimers()
}

// ─── Showing views ──────────────────────────────────────────────────

function startFrom(view: GameView) {
  stopOnline()
  const game = view.game
  const online: OnlineLink = { mySeat: view.mySeat, gameId: view.gameId, version: view.version, post, landed, resume: showNext }
  const seats: Seat[] = view.names.map((name, seat) => ({ kind: seat === view.mySeat ? 'local' : 'online', name, colour: SEAT_COLOURS[seat] }))
  set({
    game, online, seats, waiting: false, flying: false, handoff: null, revealAt: null, landed: null, refreshFx: null, trail: null, scoring: null,
    move: null, cast: null, selected: null, setAside: [], note: null,
    options: {
      players: game.config.players, boardName: game.config.boardName, minWordLength: game.config.rules.minWordLength, hideSeeds: false,
      wordIndicators: view.options?.wordIndicators ?? true, // the host's choice, the same on every screen
    },
    stats: view.results?.stats ?? emptyStats(game.config.players),
    trayOrder: game.hands.map((hand) => inHandOrder(hand.length)),
  })
}

/** Shows the waiting views in order, one at a time (a flying seed, a replay, a cast's score sequence or my refresh's
 *  shrink holds the queue — the store calls resume → here when the score has faded). */
function showNext() {
  while (inbox.length > 0) {
    const { flying, online, game, refreshFx, scoring } = store()
    if (flying || replaying || scoring !== null || refreshFx?.stage === 'out' || !online || !game) return
    const view = inbox.shift()!
    if (view.version <= online.version) {
      // The server answered a sync (or a rejoin) with the game as it was: it never got my action
      if (view.version === online.version && store().waiting) actionLost()
      continue // old news
    }
    if (isOthersTurn(game, view, online.mySeat)) return startReplay(view)
    apply(view)
  }
}

/** Is this view another player's turn that we can play out on the view we're showing now? */
function isOthersTurn(old: GameState, view: GameView, mySeat: number): boolean {
  const turn = view.game.lastTurn
  if (!turn || turn.seat === mySeat || (view.change !== 'turn' && view.change !== 'refresh')) return false
  // Our view must be the moment just before it: their turn, the glyphling still on `from`, the target still empty
  const glyphling = old.glyphlings.find((g) => g.id === turn.glyphlingId)
  const targetFree = !turn.target || !old.seeds[hexKey(turn.target)]
  return old.phase === 'play' && old.current === turn.seat && !!glyphling && sameHex(glyphling.hex, turn.from) && targetFree
}

/** Replaces the game with the server's view (keeping my own tray order), and sprouts a seed that just landed. */
function apply(view: GameView) {
  const { game: old, online, trayOrder, landed } = store()
  if (!online || !old) return
  const mine = view.by === online.mySeat
  const myRefresh = mine && sent?.type === 'refresh' ? sent.setAside : null
  const order = view.game.hands.map((hand, seat) => {
    if (seat !== online.mySeat) return inHandOrder(hand.length)
    if (myRefresh) return refillInPlace(trayOrder[seat] ?? [], myRefresh, hand.length) // new seeds take the set-aside places
    const removed = !mine || sent?.type !== 'turn' || sent.seed === null ? [] : [sent.seed]
    return refillInPlace(trayOrder[seat] ?? [], removed, hand.length) // a cast: the drawn seed takes its place
  })
  const turn = view.game.lastTurn
  const sprout = turn?.target && isNewTurn(old.lastTurn, turn) ? { key: hexKey(turn.target), count: (landed?.count ?? 0) + 1 } : landed
  if (mine) {
    sent = null
    clearTimers()
  }
  set({
    game: view.game, online: { ...online, version: view.version }, trayOrder: order, landed: sprout,
    waiting: mine ? false : store().waiting, flying: false, trail: null,
    move: null, cast: null, selected: null, setAside: [], note: null,
    stats: view.results?.stats ?? store().stats,
  })
  // a seed that just landed scores now (its words one at a time); the next view waits for it to fade
  if (sprout !== landed) store().startScoring()
  // the new seeds grow into the emptied places (hand indexes from the kept count on are the new ones)
  if (myRefresh) store().refreshArrived(newSeedSlots(order[online.mySeat], old.hands[online.mySeat].length - myRefresh.length))
}

const isNewTurn = (before: TurnSummary | null, turn: TurnSummary) =>
  !before || before.seat !== turn.seat || before.glyphlingId !== turn.glyphlingId || !sameHex(before.from, turn.from) || !sameHex(before.to, turn.to)

// ─── Another player's turn, played out ──────────────────────────────

function startReplay(view: GameView) {
  const turn = view.game.lastTurn!
  const old = store().game!
  replaying = view
  // The seed they cast is public now (it's about to land), so the old view holds it in their first slot for the throw
  const game = turn.letter ? { ...old, hands: old.hands.map((hand, seat) => (seat === turn.seat ? [turn.letter!, ...hand.slice(1)] : hand)) } : old
  // First their trail draws on and holds, so you see who's playing, where from and where to (reduce motion: it just shows)
  set({ game, trail: trailOf(turn), move: null, cast: null, selected: null, note: null })
  const timing = anim.current
  const trailMs = ((reduceMotion() ? 0 : timing.trailLead) + timing.trailHold) * 1000
  replayTimer = setTimeout(() => {
    replayTimer = null
    if (replaying !== view) return
    // Then the glide; the throw leaves from where the glyphling lands (F15)
    set({ move: { glyphling: turn.glyphlingId, to: turn.to } })
    const glideMs = reduceMotion() ? 0 : glideSeconds(turn.from, turn.to, timing) * 1000
    replayTimer = setTimeout(() => {
      replayTimer = null
      if (replaying !== view) return
      if (turn.letter && turn.target) set({ cast: { seed: 0, target: turn.target }, flying: true })
      else landed() // a move-only turn is just the glide
    }, glideMs)
  }, trailMs)
}

// ─── The link the store calls ───────────────────────────────────────

function post(action: Action) {
  const online = store().online
  if (!online) return
  sent = action
  if (toServer({ kind: 'play', action, version: online.version })) waitForMyView()
  else actionLost() // not connected right now (the Reconnecting box is up)
}

/** My action never reached the server: give the plan back so the player can simply play it again. */
function actionLost() {
  sent = null
  clearTimers()
  set({ move: null, cast: null, selected: null, setAside: [], flying: false, waiting: false, refreshFx: null, note: 'problem' })
}

/** A seed landed (Board → finishCast → here): finish a replay, or show my own action's view once it's here. */
function landed() {
  if (replaying) {
    const view = replaying
    replaying = null
    apply(view)
  } else {
    set({ flying: false })
  }
  showNext()
}

// The server's answer to my action hasn't come: ask again every few seconds until it does
function waitForMyView() {
  if (syncTimer) return
  syncTimer = setTimeout(() => {
    syncTimer = null
    if (!store().waiting || !store().online) return
    console.warn('Online: no answer from the server yet — asking for the game again')
    toServer({ kind: 'sync' })
    waitForMyView()
  }, WAIT_FOR_VIEW_MS)
}

function clearTimers() {
  if (syncTimer) clearTimeout(syncTimer)
  if (replayTimer) clearTimeout(replayTimer)
  syncTimer = null
  replayTimer = null
}
