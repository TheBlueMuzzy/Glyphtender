// THE LIVE CONNECTION — mounted (App.tsx) for as long as this device is in a room, so the socket stays open
// through the lobby, the game and the end table. It runs the rooms module's useRoom and passes things on:
//   views → the game store (onlinePlay.ts) · refused moves → the store · other problems → a toast
//   a bot takes another player's seat / they're back → a toast (seatStatus.ts, B015)
//   shut out (no such room, full, started, kicked…) → back to the menu with the reason in friendly words
// While the connection is coming back it shows the kit's Reconnecting box.
import { useEffect, useRef } from 'react'
import text from '../../../content/text/en.json'
import type { GameView, OnlineAction, OnlineOptions } from '../../../party/protocol'
import type { RoomState } from '../../rooms/protocol'
import { useRoom } from '../../rooms/useRoom'
import { actionRefused, connectOnline, receiveView } from '../../store/onlinePlay'
import { useGameStore } from '../../store/gameStore'
import { Reconnecting, fill, screens, toast } from '../kit'
import { closeAllScreens } from '../newGame'
import { seatNotices } from './seatStatus'
import { closedMessage, createRoom, endOnline, leaveOnline, partyHost, useOnline } from './session'

const w = text.online

export function OnlineSession() {
  const code = useOnline((s) => s.code)
  const creating = useOnline((s) => s.creating)
  const name = useOnline((s) => s.name)
  const room = useRoom<GameView, OnlineAction, OnlineOptions>(code, { name, create: creating }, { host: partyHost() })

  // The screens read the room from the session store
  useEffect(() => { useOnline.setState({ room }) })

  // This device's moves go out through the room
  const send = room.send
  useEffect(() => connectOnline(send), [send])

  // Every new view goes to the game store; a view of "no game" (the host went back to the lobby) ends the game
  // and closes the end table (and anything else open), so the lobby shows
  useEffect(() => {
    if (room.view) receiveView(room.view)
    else if (useGameStore.getState().online) {
      useGameStore.getState().leaveGame()
      closeAllScreens()
    }
  }, [room.view])

  // In the room: the join screen closes (the lobby is underneath). A new game: the end table closes.
  const inRoom = room.room !== null
  useEffect(() => { if (inRoom && screens.current.at(-1) === 'online') screens.pop() }, [inRoom])
  const gameId = room.view?.gameId
  useEffect(() => { if (gameId !== undefined) closeAllScreens() }, [gameId])

  // B015: tell this player when a bot takes another player's seat, and when that player is back
  const roomState = room.room
  const you = room.mySeat?.id ?? null
  const seenRoom = useRef<RoomState | null>(null)
  useEffect(() => {
    for (const notice of seatNotices(seenRoom.current, roomState, you)) toast(fill(w.seats[notice.kind], { name: notice.name }))
    seenRoom.current = roomState
  }, [roomState, you])

  // Something we asked for didn't happen (we're still in the room)
  const error = room.error
  const clearError = room.clearError
  useEffect(() => {
    if (!error) return
    if (error.code === 'action_refused' || error.code === 'bad_action') actionRefused()
    else toast(fill(w.errors.problem, { reason: error.message }))
    clearError()
  }, [error, clearError])

  // Shut out of the room
  const { status, closedReason } = room
  useEffect(() => {
    if (status !== 'closed' || !closedReason || closedReason === 'left') return
    if (closedReason === 'code_taken' && creating) return createRoom() // that code was in use: try another
    const why = closedMessage(closedReason)
    endOnline(why)
    toast(why)
  }, [status, closedReason, creating])

  return status === 'reconnecting'
    ? <Reconnecting words={{ title: w.reconnect.title, quit: w.reconnect.quit }} message={w.reconnect.message} onQuit={() => { closeAllScreens(); leaveOnline() }} />
    : null
}
