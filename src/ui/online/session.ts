// THE ONLINE SESSION — which room this device is in (the code), and the live room from useRoom
// (OnlineSession.tsx keeps `room` up to date). Screens read it; Create / Join / Leave go through here.
// Leaving ALWAYS goes through useRoom's leave() — a bare socket close would look like a dropped connection.
import { create } from 'zustand'
import text from '../../../content/text/en.json'
import partykitJson from '../../../partykit.json'
import type { GameView, OnlineAction, OnlineOptions } from '../../../party/protocol'
import type { OnlineRoom } from '../../rooms/useRoom'
import type { CloseReason } from '../../rooms/protocol'
import { makeRoomCode } from '../../rooms/roomCodes'
import { getPlayerName, setPlayerName } from '../../rooms/identity'
import { stopOnline } from '../../store/onlinePlay'
import { useGameStore } from '../../store/gameStore'
import { toast } from '../kit'

export type Room = OnlineRoom<GameView, OnlineAction, OnlineOptions>

interface Session {
  /** The room code this device is in (null = not online). */
  code: string | null
  /** true = this device made the room (only its very first join may create it). */
  creating: boolean
  name: string
  /** The live room (useRoom's result), or null before OnlineSession has run. */
  room: Room | null
  /** Why the last try to get into a room didn't work (friendly words), shown on the join screen. */
  joinError: string | null
}

// This tab's room code is kept through a reload (sessionStorage), so a reload goes straight back to its seat
const ROOM_KEY = 'glyphtender:room'
function rememberRoom(code: string | null) {
  try {
    if (code) sessionStorage.setItem(ROOM_KEY, code)
    else sessionStorage.removeItem(ROOM_KEY)
  } catch {
    // no storage (private window, tests): a reload just lands on the menu
  }
}
function roomBeforeReload(): string | null {
  try {
    return sessionStorage.getItem(ROOM_KEY)
  } catch {
    return null
  }
}

export const useOnline = create<Session>()(() => ({ code: roomBeforeReload(), creating: false, name: getPlayerName(), room: null, joinError: null }))

/**
 * Where the online server is. Live builds: VITE_PARTY_HOST. Local: the computer that served this page, on
 * partykit.json's port (1997) — so a phone on the Wi-Fi reaches the PC's `npm run party:dev` too.
 * (VITE_PARTY_PORT overrides the port: e2e:online runs its own server on another one.)
 */
export function partyHost(): string {
  const fromBuild = import.meta.env.VITE_PARTY_HOST as string | undefined
  const port = (import.meta.env.VITE_PARTY_PORT as string | undefined) || partykitJson.port
  return fromBuild || `${window.location.hostname}:${port}`
}

/** A reason the server shut us out, in the player's words (en.json → online.errors). */
export const closedMessage = (reason: CloseReason) =>
  (text.online.errors as Record<string, string>)[reason] ?? text.online.errors.room_closed

export function setName(name: string) {
  setPlayerName(name) // remembered for next time
  useOnline.setState({ name, joinError: null })
}

export function createRoom() {
  const code = makeRoomCode()
  rememberRoom(code)
  useOnline.setState({ code, creating: true, room: null, joinError: null })
}

export function joinRoom(code: string) {
  rememberRoom(code)
  useOnline.setState({ code, creating: false, room: null, joinError: null })
}

/** Out of the room (Leave, Menu → Leave game): tell the server, stop the online game, back to the menu. */
export function leaveOnline() {
  useOnline.getState().room?.leave()
  endOnline(null)
}

/** The room is gone for us (left, or shut out): forget it. `why` shows on the join screen if given. */
export function endOnline(why: string | null) {
  stopOnline()
  rememberRoom(null)
  useOnline.setState({ code: null, creating: false, room: null, joinError: why })
  if (useGameStore.getState().online) useGameStore.getState().leaveGame()
}

/** End table → New game: the host takes everyone back to the lobby (to change the options); everyone else waits. */
export function onlineBackToLobby() {
  const room = useOnline.getState().room
  if (room?.isHost) room.backToLobby()
  else toast(text.game.prompts.waitingHost)
}
