// THE TURN BAR — whose turn (their glyphling portrait, ringed) and what to do next, plus the Menu button.
// Kit parts only: Avatar, HudText (plain words — not a button, so it doesn't look like one), Button.
import text from '../../content/text/en.json'
import { useGameStore } from '../store/gameStore'
import { Avatar, Button, HudText, Row, screens } from '../ui/kit'
import { colourOf, glyphlingArt } from './art'
import { playerName, promptFor, promptSeat } from './prompt'
import { useGardenTuning } from './useTuning'

export function TurnBar() {
  const state = useGameStore()
  const colours = useGardenTuning()
  const { text: prompt, detail } = promptFor(state)
  const seat = promptSeat(state)
  return (
    <Row gap="s" justify="between" className="game-turn-bar">
      <Avatar name={playerName(seat)} src={glyphlingArt(seat)} color={colours[colourOf(seat)]} active />
      <div className="game-prompt"><HudText size="s" detail={detail || undefined} pop={state.game?.phase === 'over'}>{prompt}</HudText></div>
      <Button variant="secondary" icon aria-label={text.game.buttons.menu} onClick={() => screens.push('pause')}>☰</Button>
    </Row>
  )
}
