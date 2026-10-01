// "DROP HERE" — while a piece is dragged, the legal hex under it lights up brighter than the other options
// (the zone reacts, not the piece). Board.tsx draws one hidden mark per option kind ([data-drop-target="move"]
// and [data-drop-target="cast"], in the player's colour) at the board's origin; this moves the right one onto the hex and shows it.
// Plain DOM attributes, set on each pointer move — no React state per frame.
import { hexToPixel, type Hex } from '../engine/hex'
import { HEX } from './useThrow'

/** Show the mark of `kind` on `hex`, or hide every mark (kind null). */
export function showDropTarget(hex: Hex | undefined, kind: 'move' | 'cast' | null) {
  for (const mark of document.querySelectorAll('[data-drop-target]')) {
    const on = kind !== null && hex !== undefined && mark.getAttribute('data-drop-target') === kind
    mark.setAttribute('visibility', on ? 'visible' : 'hidden')
    if (on) {
      const { x, y } = hexToPixel(hex, HEX)
      mark.setAttribute('transform', `translate(${x} ${y})`)
      mark.setAttribute('data-drop-hex', `${hex.q},${hex.r}`) // for the e2e check
    }
  }
}
