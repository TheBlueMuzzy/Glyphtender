// THE PROMPT — what to do next ("Move a glyphling") and a smaller line under it (whose turn, or a note).
// It sits just above the seed tray, where your eyes and thumbs already are, in heading-size words
// (GDD §4 feel notes). Plain words (kit HudText — not a button, so it doesn't look like one).
import { useGameStore } from '../store/gameStore'
import { HudText } from '../ui/kit'
import { promptFor } from './prompt'

/** big: a roomy screen (big board hexes) — the prompt gets title-size words to match the big pieces. */
export function PromptLine({ big }: { big: boolean }) {
  const state = useGameStore()
  const { text, detail } = promptFor(state)
  return (
    <div className="game-prompt">
      <HudText size={big ? 'l' : 'm'} detail={detail || undefined} pop={state.game?.phase === 'over'}>{text}</HudText>
    </div>
  )
}
