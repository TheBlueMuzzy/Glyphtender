// THE TOP BAR — whose turn (their glyphling portrait, ringed) on one side, the Menu button on the other.
// (What to do next sits just above the tray: PromptLine.tsx.) Kit parts only: Avatar, Badge, Button.
// Online, a badge beside the portrait says who's really at that seat (B015): a robot while a bot plays it,
// "Away" while their connection is down and the seat waits for them.
// Online, the room code sits quietly beside the Menu button ("Room: BAKU") — to invite or rejoin without remembering it.
import text from '../../content/text/en.json'
import { useGameStore } from '../store/gameStore'
import { Avatar, Badge, Button, HudText, Row, fill, screens } from '../ui/kit'
import { seatStatus } from '../ui/online/seatStatus'
import { useOnline } from '../ui/online/session'
import { colourOf, glyphlingArt } from './art'
import { playerName, promptSeat } from './prompt'
import { useGardenTuning } from './useTuning'

const ROBOT = '🤖' // placeholder art (emoji rung of the placeholder ladder)

export function TurnBar() {
  const state = useGameStore()
  const colours = useGardenTuning()
  const seat = promptSeat(state)
  const name = playerName(seat)
  // Online: room seats are in game seat order. Not during the end reveal (the game is done).
  const roomSeat = useOnline((s) => s.room?.room?.seats[seat])
  const status = state.online && state.game?.phase !== 'over' ? seatStatus(roomSeat) : null
  const w = text.online.seats
  const code = useOnline((s) => s.code)
  return (
    <Row gap="s" justify="between" className="game-turn-bar">
      <Row gap="s">
        <Avatar name={name} src={glyphlingArt(seat)} color={colours[colourOf(seat)]} active />
        {status === 'bot' && <Badge variant="primary"><span role="img" aria-label={fill(w.bot, { name })} data-seat-status="bot">{ROBOT}</span></Badge>}
        {status === 'away' && <Badge><span role="img" aria-label={fill(w.awayLabel, { name })} data-seat-status="away">{w.away}</span></Badge>}
      </Row>
      <Row gap="s">
        {state.online && code && <span data-room-label><HudText size="s">{fill(text.online.roomLabel, { code })}</HudText></span>}
        <Button variant="secondary" icon aria-label={text.game.buttons.menu} onClick={() => screens.push('pause')}>☰</Button>
      </Row>
    </Row>
  )
}
