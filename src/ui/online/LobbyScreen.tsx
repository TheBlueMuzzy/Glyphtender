// THE LOBBY — who's in the room (name, their glyphling colour, ready), the room code big with Copy, and for
// the host the table options (garden, 2-letter words, turn timer) + Start. Everyone else: I'm ready.
// Leave goes through useRoom.leave(). Kit Lobby with a room code; the option rows are kit ListRows.
import { useState } from 'react'
import text from '../../../content/text/en.json'
import roomsJson from '../../../content/rooms.json'
import type { OnlineOptions } from '../../../party/protocol'
import { boardNames } from '../../engine/boards'
import { colourOf, glyphlingArt } from '../../game/art'
import { useGardenTuning } from '../../game/useTuning'
import { ListRow, Lobby, Selector, Toggle, fill } from '../kit'
import { loadOnlineOptions, saveOnlineOptions } from './onlineOptions'
import { leaveOnline, useOnline } from './session'

const w = text.online
const boardLabel = (name: string) => (name === 'auto' ? w.options.auto : (text.newGame.boards as Record<string, string>)[name] ?? name)
const timerLabel = (seconds: number) => (seconds === 0 ? w.options.timerOff : fill(w.options.timerSeconds, { n: seconds }))

export function LobbyScreen() {
  const room = useOnline((s) => s.room)
  const colours = useGardenTuning()
  const [options, setOptions] = useState<OnlineOptions>(loadOnlineOptions)
  if (!room?.room) return null

  const seats = room.room.seats
  const players = seats.map((seat, i) => ({ id: seat.id, name: seat.name, ready: seat.ready, color: colours[colourOf(i)], avatar: glyphlingArt(i) }))
  const start = () => {
    saveOnlineOptions(options)
    room.start(options)
  }
  return (
    <Lobby words={w.lobby} roomCode={room.room.code} players={players} meId={room.mySeat?.id} hostId={seats.find((s) => s.isHost)?.id}
      minPlayers={room.room.minSeats} onReady={room.setReady} onStart={start} onLeave={leaveOnline}
      onCreate={() => {}} onJoin={() => {}}>
      {room.isHost && <TableOptions options={options} onChange={setOptions} />}
    </Lobby>
  )
}

/** The host's choices, as rows under the players. */
function TableOptions({ options, onChange }: { options: OnlineOptions; onChange: (options: OnlineOptions) => void }) {
  const boards = ['auto', ...boardNames()]
  const timers = roomsJson.turnTimerChoices
  return (
    <>
      <ListRow label={w.options.board} detail={w.options.boardDetail}>
        <Selector label={w.options.board} options={boards.map(boardLabel)} value={boardLabel(options.boardName)}
          onChange={(label) => onChange({ ...options, boardName: boards.find((b) => boardLabel(b) === label) ?? options.boardName })} />
      </ListRow>
      <ListRow label={w.options.twoLetterWords} detail={w.options.twoLetterDetail}>
        <Toggle label={w.options.twoLetterWords} on={options.minWordLength <= 2} onChange={(on) => onChange({ ...options, minWordLength: on ? 2 : 3 })} />
      </ListRow>
      <ListRow label={w.options.timer} detail={w.options.timerDetail}>
        <Selector label={w.options.timer} options={timers.map(timerLabel)} value={timerLabel(options.turnSeconds)}
          onChange={(label) => onChange({ ...options, turnSeconds: timers.find((t) => timerLabel(t) === label) ?? options.turnSeconds })} />
      </ListRow>
    </>
  )
}
