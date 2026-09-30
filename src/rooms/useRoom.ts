// useRoom — the React hook a game's screens use to be in an online room.  (Browser only.)
//
//   const online = useRoom<MyView, MyAction, MyOptions, MyEvent>(roomCode, { name, create })
//   online.status   'idle' (no code) · 'connecting' · 'open' · 'reconnecting' · 'closed'
//   online.room     seats, phase, host… (null until the server answers)
//   online.mySeat   your own seat (null if you have none)
//   online.view     your view of the game, straight from the server's viewFor()
//   online.send(action)   a game move → the server's rules check it
//   online.leave()        ALWAYS leave through this (a plain socket close looks like a dropped connection)
//
// Pass roomCode = null when not online. Changing the code connects to the new room.
// Unmounting (or React StrictMode's practice unmount in dev) just drops the connection — it does
// NOT give up the seat, and the next mount takes the seat straight back. Only leave() gives it up.
import { useCallback, useEffect, useRef, useState } from 'react'
import type PartySocket from 'partysocket'
import { getPersistentId } from './identity'
import { parseServerMessage } from './protocol'
import type { ClientMessage, CloseReason, ErrorCode, RoomState, Seat } from './protocol'
import { openRoomSocket, sendToRoom } from './roomClient'

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed'

export interface RoomIdentity {
  /** The player's name (the server trims it to 16 characters). */
  name: string
  /** true = making a new room with this code · false = joining a friend's room (refused if nobody's there). */
  create: boolean
  /** Leave out — it comes from identity.ts. (Tests and e2e can pass their own.) */
  persistentId?: string
}

export interface UseRoomOptions<Event> {
  /** Called for every `event` the server sends, in order (views can arrive in one batch; events never get lost). */
  onEvent?: (event: Event) => void
  /** Leave out — it comes from partyHost() in roomClient.ts. */
  host?: string
}

export interface OnlineRoom<View, Action, Options> {
  status: ConnectionStatus
  room: RoomState | null
  mySeat: Seat | null
  isHost: boolean
  view: View | null
  /** The last thing the server refused (still in the room). Clear it with clearError(). */
  error: { code: ErrorCode; message: string } | null
  /** Why the room shut you out (status is 'closed'). */
  closedReason: CloseReason | null
  /** Send a game move. false = not sent (not connected right now). */
  send: (action: Action) => boolean
  setReady: (ready: boolean) => void
  /** Host: start a game (from the lobby, or a rematch after a game). */
  start: (options: Options) => void
  /** Host: remove a player or bot. */
  kick: (seatId: string) => void
  /** Host, lobby: add a bot seat (if the game allows bots). */
  addBot: () => void
  /** Host, after a game: everyone back to the lobby. */
  backToLobby: () => void
  /** Give up your seat and disconnect. */
  leave: () => void
  clearError: () => void
}

// Everything the hook remembers about ONE room code. If the code changes, it starts blank.
interface Connection<View> {
  code: string | null
  status: ConnectionStatus
  room: RoomState | null
  you: string | null
  view: View | null
  error: { code: ErrorCode; message: string } | null
  closedReason: CloseReason | null
}

function blank<View>(code: string | null): Connection<View> {
  return { code, status: code ? 'connecting' : 'idle', room: null, you: null, view: null, error: null, closedReason: null }
}

export function useRoom<View = unknown, Action = unknown, Options = unknown, Event = unknown>(
  roomCode: string | null,
  identity: RoomIdentity,
  options: UseRoomOptions<Event> = {},
): OnlineRoom<View, Action, Options> {
  const [saved, setSaved] = useState<Connection<View>>(() => blank(roomCode))
  const socketRef = useRef<PartySocket | null>(null)
  const identityRef = useRef(identity)
  const onEventRef = useRef(options.onEvent)
  useEffect(() => {
    identityRef.current = identity
    onEventRef.current = options.onEvent
  })

  const host = options.host
  useEffect(() => {
    if (!roomCode) return
    const code = roomCode
    let joined = false // true once the server has given us the room (reconnects then never "create")
    let closedOnPurpose = false

    // Change what we remember about THIS code (ignores anything left over from an older code)
    const update = (change: Partial<Connection<View>>) =>
      setSaved((before) => ({ ...(before.code === code ? before : blank<View>(code)), ...change }))

    const socket = openRoomSocket(code, host)
    socketRef.current = socket

    socket.onopen = () => {
      // Every open — the first AND every reconnect — says who we are; a known player gets their seat back.
      const me = identityRef.current
      update({ status: joined ? 'reconnecting' : 'connecting' })
      sendToRoom(socket, {
        type: 'join',
        name: me.name,
        persistentId: me.persistentId ?? getPersistentId(),
        create: me.create && !joined,
      })
    }

    socket.onclose = () => {
      if (closedOnPurpose) return
      update({ status: joined ? 'reconnecting' : 'connecting' }) // PartySocket tries again by itself
    }

    socket.onmessage = (event: MessageEvent) => {
      const message = parseServerMessage(event.data)
      if (!message) return
      switch (message.type) {
        case 'room':
          joined = true
          update({ status: 'open', room: message.room, you: message.you })
          break
        case 'view':
          update({ view: message.view as View })
          break
        case 'event':
          onEventRef.current?.(message.event as Event)
          break
        case 'error':
          update({ error: { code: message.code, message: message.message } })
          break
        case 'closed':
          // The server shut us out: stop, and don't let PartySocket reconnect
          closedOnPurpose = true
          socket.close()
          update({ status: 'closed', closedReason: message.reason })
          break
      }
    }

    return () => {
      // Unmount / code change / StrictMode: just drop the connection. The seat stays ours.
      closedOnPurpose = true
      socket.close()
      if (socketRef.current === socket) socketRef.current = null
    }
  }, [roomCode, host])

  // What this render shows: what we saved for this code, or a blank start if it's a new code
  const current = saved.code === roomCode ? saved : blank<View>(roomCode)
  const mySeat = current.room?.seats.find((seat) => seat.id === current.you) ?? null

  // Only send while we're really in the room (a message queued during a reconnect would arrive before our join)
  const sendMessage = useCallback((message: ClientMessage): boolean => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return false
    sendToRoom(socket, message)
    return true
  }, [])

  const leave = useCallback(() => {
    const socket = socketRef.current
    if (!socket) return
    sendMessage({ type: 'leave' })
    socket.onclose = null
    socket.onmessage = null
    socket.close()
    socketRef.current = null
    setSaved((before) => ({ ...before, status: 'closed', closedReason: 'left' }))
  }, [sendMessage])

  return {
    status: current.status,
    room: current.room,
    mySeat,
    isHost: mySeat?.isHost ?? false,
    view: current.view,
    error: current.error,
    closedReason: current.closedReason,
    send: useCallback((action: Action) => sendMessage({ type: 'action', action }), [sendMessage]),
    setReady: useCallback((ready: boolean) => void sendMessage({ type: 'ready', ready }), [sendMessage]),
    start: useCallback((startOptions: Options) => void sendMessage({ type: 'start', options: startOptions }), [sendMessage]),
    kick: useCallback((seatId: string) => void sendMessage({ type: 'kick', seatId }), [sendMessage]),
    addBot: useCallback(() => void sendMessage({ type: 'add_bot' }), [sendMessage]),
    backToLobby: useCallback(() => void sendMessage({ type: 'back_to_lobby' }), [sendMessage]),
    leave,
    clearError: useCallback(() => setSaved((before) => ({ ...before, error: null })), []),
  }
}
