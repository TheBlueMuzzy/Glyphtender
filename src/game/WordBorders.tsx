// WORD BORDERS — the one look for "these seeds make a word" (word indicators on; GDD §4 feel notes):
// a thick WHITE border (neutral — never a player colour) drawn BEHIND the seeds, so the letters sit on top and
// only the part outside them shows, like a frame round the word's hexes. Used twice:
//   planned — the words the aimed seed would make, while you aim
//   grown   — the words the last cast grew: each lights in its turn as it scores, then fades with the final total
//             (the score sequence — ScorePops.tsx plays them; they start dark and END dark, so nothing outlives the turn)
// WORD SPOTLIGHT (F25): while aiming at 2+ words, ONE is lit at a time — QUA → TAB → AY → round again — so words that
// share letters never read as one blob. One word just stays lit. Each word can carry a small label ("QUA +4" while
// aiming; just "QUA" as it scores — its points pop on the seeds; garden.json spotlightLabel) on a free spot that
// covers no letters, drawn above the pieces (WordLabels).
// The aiming loop is Web Animations on the word groups (useWordSpotlight.ts; spotlight.ts has the keyframes) — no React state per frame.
// Colour + thickness: garden.json (wordBorder, wordBorderWidth, grownGlowStrength, spotlightLabel…);
// timing: anim.json (spotlightHold, spotlightFade). Reduce motion → no fades, the words just step.
import { useMemo } from 'react'
import text from '../../content/text/en.json'
import { hexCorners, hexKey, hexToPixel, type Hex } from '../engine/hex'
import type { MadeWord } from '../engine/types'
import { fill } from '../ui/kit'
import { labelSpot, type Box } from './spotlight'
import { HEX } from './useThrow'
import type { GardenTuning } from './useTuning'

export type SpotWord = Pick<MadeWord, 'word' | 'hexes' | 'magic'>
export type SpotKind = 'planned' | 'grown'

type Props = {
  planned: SpotWord[]
  grown: SpotWord[]
  /** Changes every landing, so the grown words are drawn fresh. */
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
  const words = (kind: SpotKind, list: SpotWord[], peak: number) =>
    list.map((w, i) => (
      <g key={`${kind}-${grownKey}-${i}-${w.word}`} data-spot-of={kind} data-spot-word={i} data-word={w.word}
        opacity={kind === 'grown' || list.length > 1 ? 0 : peak}>
        {w.hexes.map((h) => border(h, hexKey(h)))}
      </g>
    ))
  return (
    <g pointerEvents="none">
      <g data-planned-words>{words('planned', planned, 1)}</g>
      <g data-grown>{words('grown', grown, colours.grownGlowStrength)}</g>
    </g>
  )
}

type LabelProps = Props & {
  /** Hexes with a piece on them (seeds, glyphlings) — a label keeps off them when it can. */
  taken: Hex[]
  /** The board's SVG box (a label stays inside it). */
  view: Box
  /** Screen pixels per hex size, so the label never gets smaller than spotlightLabelMinPx. */
  pxPerHex: number
}

/** The lit word's label ("QUA +4" while aiming, "QUA" as it scores), drawn above the pieces; it lights and fades with its word's border. */
export function WordLabels({ planned, grown, grownKey, colours, taken, view, pxPerHex }: LabelProps) {
  const size = Math.max(colours.spotlightLabelSize, colours.spotlightLabelMinPx / pxPerHex)
  const takenId = taken.map(hexKey).join(';')
  const place = useMemo(() => (list: SpotWord[], kind: SpotKind) => list.map((w) => {
    // (as a word scores, its points pop on its seeds and fly to the glyphling — the bubble is just the word)
    const words = kind === 'planned' ? fill(text.game.spotlightLabel, { word: w.word, n: w.magic }) : w.word
    const width = words.length * size * 0.62 + size * 1.1, height = size * 1.6 // a pill round the words
    return { words, width, height, ...labelSpot(w.hexes, taken, view, width, height) }
    // (taken is compared by its hexes, not by the array)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [takenId, view, size])
  const plannedSpots = useMemo(() => place(planned, 'planned'), [place, planned])
  const grownSpots = useMemo(() => place(grown, 'grown'), [place, grown])
  if (!colours.spotlightLabel) return null

  const labels = (kind: SpotKind, list: SpotWord[], spots: ReturnType<typeof place>, peak: number) =>
    spots.map((s, i) => (
      <g key={`${kind}-${grownKey}-${i}-${list[i].word}`} data-spot-of={kind} data-spot-word={i} data-spot-label={s.words}
        opacity={kind === 'grown' || list.length > 1 ? 0 : peak}>
        <rect x={s.x - s.width / 2} y={s.y - s.height / 2} width={s.width} height={s.height} rx={s.height / 2}
          fill={colours.background} fillOpacity={0.88} stroke={colours.wordBorder} strokeWidth={size * 0.1} />
        <text x={s.x} y={s.y} textAnchor="middle" dominantBaseline="central" fontSize={size} fontWeight={800}
          fill={colours.wordBorder}>{s.words}</text>
      </g>
    ))
  return (
    <g pointerEvents="none" data-spot-labels>
      {labels('planned', planned, plannedSpots, 1)}
      {labels('grown', grown, grownSpots, colours.grownGlowStrength)}
    </g>
  )
}
