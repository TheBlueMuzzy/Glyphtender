// THE PROMPT — what to do next ("Move a glyphling") and a smaller line under it (whose turn, or a note).
// It sits just above the seed tray, where your eyes and thumbs already are, in heading-size words
// (GDD §4 feel notes). Plain words (kit HudText — not a button, so it doesn't look like one).
// Its frame never changes height (B013): an invisible copy of EVERY line it can show (promptSizers), piled up in
// the same spot, holds it open as tall as the longest message at this width — so the board never jumps when the
// words go from 1 line to 2. The real words sit in the middle of the frame. Only when the tray is below/above the board
// (phone portrait): beside the board the prompt can't move it, and a phone held sideways has no height to spare.
// Beside the words: the glyphling of the player they're for (Muzzy, 2026-10-01: "so it's obvious who it applies to") —
// always, on every device: pass-and-play, online (others' turns too), the draft, a refresh, the reveal. Its spot is
// always there (empty when the words are for nobody in particular), so the words never shift sideways. Beside the
// board, when the gap left of the column has room, it hangs out into it (data-hang): the words keep the column's
// full width (so they wrap no more than before) and stay centred over the tray.
import { useLayoutEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { Avatar, HudText, Stack, Text } from '../ui/kit'
import { colourOf, glyphlingArt } from './art'
import { playerName, promptFor, promptIconSeat, promptSizers } from './prompt'
import { useGardenTuning } from './useTuning'

/** big: a roomy screen (big board hexes) — the prompt gets title-size words to match the big pieces.
 *  fixed: hold the frame at the height of the longest message (B013).
 *  hangRoom: px free left of the column (side layout) — the glyphling hangs out there if it fits. */
export function PromptLine({ big, fixed, hangRoom = 0 }: { big: boolean; fixed: boolean; hangRoom?: number }) {
  const state = useGameStore()
  const { text, detail } = promptFor(state)
  const players = state.game?.config.players ?? 0
  const sizers = !fixed ? { texts: [], detail: [] } : promptSizers(Array.from({ length: players }, (_, seat) => playerName(seat)))
  const size = big ? 'l' : 'm'
  const colours = useGardenTuning()
  const seat = promptIconSeat(state)
  const who = seat ?? state.game?.current ?? 0
  // The room the glyphling takes beside the words (its width + the gap), measured: it hangs out only if that fits
  const row = useRef<HTMLDivElement>(null)
  const icon = useRef<HTMLSpanElement>(null)
  const [iconRoom, setIconRoom] = useState(0)
  useLayoutEffect(() => {
    if (!row.current || !icon.current) return
    const need = icon.current.offsetWidth + (parseFloat(getComputedStyle(row.current).columnGap) || 0)
    setIconRoom((old) => (Math.abs(old - need) < 1 ? old : need))
  }, [size])
  const hang = iconRoom > 0 && hangRoom >= iconRoom
  const avatar = <Avatar name={playerName(who)} src={glyphlingArt(who)} color={colours[colourOf(who)]} />
  return (
    <div className="game-prompt" data-hang={hang || undefined}>
      {/* the frame's size: the glyphling's room + the tallest main line over the tallest small line (same word sizes
          as HudText's), so the words wrap exactly as the real ones do */}
      {fixed && (
        <div className="game-prompt-row game-prompt-sizer" aria-hidden="true">
          <span className="game-prompt-icon-space">{avatar}</span>
          <Stack gap="xs">
            <div className="game-prompt-pile">{sizers.texts.map((t) => <Text key={t} kind={size === 'm' ? 'heading' : 'title'}><Ghost words={t} /></Text>)}</div>
            <div className="game-prompt-pile">{sizers.detail.map((t) => <Text key={t} kind="label"><Ghost words={t} /></Text>)}</div>
          </Stack>
        </div>
      )}
      {/* the real line: the glyphling right beside the words, the two centred together */}
      <div ref={row} className="game-prompt-row">
        <span ref={icon} className="game-prompt-icon" data-seat={seat ?? undefined} data-empty={seat === null || undefined} aria-hidden={seat === null || undefined}>
          {avatar}
        </span>
        <HudText size={size} detail={detail || undefined} pop={state.game?.phase === 'over'}>{text}</HudText>
      </div>
    </div>
  )
}

/** Words drawn by CSS from an attribute: they take up their room but aren't text on the page (find-in-page and
 *  tests looking for the prompt's words only ever find the real ones). */
export const Ghost = ({ words }: { words: string }) => <span className="game-ghost-words" data-words={words} />
