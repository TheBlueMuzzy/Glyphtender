// PLAY ONLINE — the first online screen (main menu → Play online): your name (remembered), then
// Create a room (a new 4-letter code) or Join a friend's room by its code. Kit Lobby without a room code.
// While the connection opens the buttons show busy; when the room answers, the lobby replaces this screen.
import { useState } from 'react'
import text from '../../../content/text/en.json'
import { cleanRoomCode } from '../../rooms/roomCodes'
import { Lobby, screens } from '../kit'
import { createRoom, joinRoom, leaveOnline, setName, useOnline } from './session'

const w = text.online

export function OnlineStartScreen() {
  const name = useOnline((s) => s.name)
  const code = useOnline((s) => s.code)
  const joinError = useOnline((s) => s.joinError)
  const [problem, setProblem] = useState<string | null>(null)
  const busy = code !== null // connecting (the lobby takes over as soon as the room answers)

  const named = () => {
    if (name.trim()) return true
    setProblem(w.errors.nameNeeded)
    return false
  }
  const onCreate = () => { if (named()) createRoom() }
  const onJoin = (typed: string) => {
    if (!named()) return
    const cleaned = cleanRoomCode(typed)
    if (cleaned) joinRoom(cleaned)
    else setProblem(w.errors.badCode)
  }
  const onBack = () => {
    if (code) leaveOnline() // stop trying to get in
    screens.pop()
  }

  return (
    <Lobby words={w.lobby} name={name} onNameChange={(typed) => { setProblem(null); setName(typed) }}
      busy={busy} error={problem ?? joinError ?? undefined}
      onCreate={onCreate} onJoin={onJoin} onBack={onBack}
      onStart={() => {}} onLeave={onBack} />
  )
}
