// THE TOP BAR — whose turn (their glyphling portrait, ringed) on one side, the Menu button on the other.
// (What to do next sits just above the tray: PromptLine.tsx.) Kit parts only: Avatar, Button.
import text from '../../content/text/en.json'
import { useGameStore } from '../store/gameStore'
import { Avatar, Button, Row, screens } from '../ui/kit'
import { colourOf, glyphlingArt } from './art'
import { playerName, promptSeat } from './prompt'
import { useGardenTuning } from './useTuning'

export function TurnBar() {
  const state = useGameStore()
  const colours = useGardenTuning()
  const seat = promptSeat(state)
  return (
    <Row gap="s" justify="between" className="game-turn-bar">
      <Avatar name={playerName(seat)} src={glyphlingArt(seat)} color={colours[colourOf(seat)]} active />
      <Button variant="secondary" icon aria-label={text.game.buttons.menu} onClick={() => screens.push('pause')}>☰</Button>
    </Row>
  )
}
