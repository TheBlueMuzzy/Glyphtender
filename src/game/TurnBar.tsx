// THE TURN BAR — whose turn (their glyphling portrait, ringed) and what to do next, plus the Menu button.
// Kit parts only: Avatar, HudText (plain words — not a button, so it doesn't look like one), Button.
import text from '../../content/text/en.json'
import { useGameStore } from '../store/gameStore'
import { Avatar, Button, HudText, Row, screens } from '../ui/kit'
import { colourOf, glyphlingArt } from './art'
import { playerName, promptFor } from './prompt'
import { useGardenTuning } from './useTuning'

export function TurnBar() {
  const state = useGameStore()
  const colours = useGardenTuning()
  const game = state.game!
  const { text: prompt, detail } = promptFor(state)
  return (
    <Row gap="s" justify="between" className="game-turn-bar">
      <Avatar name={playerName(game.current)} src={glyphlingArt(game.current)} color={colours[colourOf(game.current)]} active />
      <div className="game-prompt"><HudText size="s" detail={detail || undefined}>{prompt}</HudText></div>
      <Button variant="secondary" icon aria-label={text.game.buttons.menu} onClick={() => screens.push('pause')}>☰</Button>
    </Row>
  )
}
