// WORD BORDERS — the one look for "these seeds make a word" (word indicators on; GDD §4 feel notes):
// a thick WHITE border (neutral — never a player colour) drawn BEHIND the seeds, so the letters sit on top and
// only the part outside them shows, like a frame round the word's hexes. Used twice:
//   planned — the words the aimed seed would make, while you aim (steady)
//   grown   — the words that just grew, after the seed lands (useThrow fades the [data-grown] group out)
// Colour + thickness: content/tuning/garden.json (wordBorder, wordBorderWidth, grownGlowStrength).
import { hexCorners, hexKey, hexToPixel, type Hex } from '../engine/hex'
import { HEX } from './useThrow'
import type { GardenTuning } from './useTuning'

type Props = {
  planned: Hex[]
  grown: Hex[]
  /** Changes every landing, so the grown border is drawn fresh (and its fade starts again). */
  grownKey: number
  colours: GardenTuning
}

export function WordBorders({ planned, grown, grownKey, colours }: Props) {
  // A ring centred on the hex's own edge: half of it hides under the seed art, the rest shows round it
  const border = (h: Hex, key: string) => {
    const { x, y } = hexToPixel(h, HEX)
    return (
      <polygon key={key} data-word-hex={hexKey(h)} points={hexCorners(x, y, HEX)} fill="none" stroke={colours.wordBorder}
        strokeWidth={colours.wordBorderWidth} strokeLinejoin="round" />
    )
  }
  return (
    <g pointerEvents="none">
      <g data-planned-words>{planned.map((h) => border(h, `planned-${hexKey(h)}`))}</g>
      <g data-grown opacity={0} key={`grown-${grownKey}`}>{grown.map((h) => border(h, `grown-${hexKey(h)}`))}</g>
    </g>
  )
}
