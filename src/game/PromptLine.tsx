// THE PROMPT — what to do next ("Move a glyphling") and a smaller line under it (whose turn, or a note).
// It sits just above the seed tray, where your eyes and thumbs already are, in heading-size words
// (GDD §4 feel notes). Plain words (kit HudText — not a button, so it doesn't look like one).
// Its frame never changes height (B013): an invisible copy of EVERY line it can show (promptSizers), piled up in
// the same spot, holds it open as tall as the longest message at this width — so the board never jumps when the
// words go from 1 line to 2. The real words sit in the middle of the frame. Only when the tray is below/above the board
// (phone portrait): beside the board the prompt can't move it, and a phone held sideways has no height to spare.
import { useGameStore } from '../store/gameStore'
import { HudText, Stack, Text } from '../ui/kit'
import { playerName, promptFor, promptSizers } from './prompt'

/** big: a roomy screen (big board hexes) — the prompt gets title-size words to match the big pieces.
 *  fixed: hold the frame at the height of the longest message (B013). */
export function PromptLine({ big, fixed }: { big: boolean; fixed: boolean }) {
  const state = useGameStore()
  const { text, detail } = promptFor(state)
  const players = state.game?.config.players ?? 0
  const sizers = !fixed ? { texts: [], detail: [] } : promptSizers(Array.from({ length: players }, (_, seat) => playerName(seat)))
  const size = big ? 'l' : 'm'
  return (
    <div className="game-prompt">
      {/* the frame's size: the tallest main line over the tallest small line (same words sizes as HudText's) */}
      {fixed && (
        <div className="game-prompt-sizer" aria-hidden="true">
          <Stack gap="xs">
            <div className="game-prompt-pile">{sizers.texts.map((t) => <Text key={t} kind={size === 'm' ? 'heading' : 'title'}><Ghost words={t} /></Text>)}</div>
            <div className="game-prompt-pile">{sizers.detail.map((t) => <Text key={t} kind="label"><Ghost words={t} /></Text>)}</div>
          </Stack>
        </div>
      )}
      <HudText size={size} detail={detail || undefined} pop={state.game?.phase === 'over'}>{text}</HudText>
    </div>
  )
}

/** Words drawn by CSS from an attribute: they take up their room but aren't text on the page (find-in-page and
 *  tests looking for the prompt's words only ever find the real ones). */
export const Ghost = ({ words }: { words: string }) => <span className="game-ghost-words" data-words={words} />
