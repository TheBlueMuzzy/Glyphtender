// THE SCORE SEQUENCE — after a cast grows words (word indicators on; GDD §4 feel notes; Muzzy 2026-10-01): the words
// score ONE AT A TIME, in the order the aiming spotlight showed them. For each word: its outline + a bubble with just
// the word ("PE", no points) light up, each of its seeds pops its own Magic ("+2") over its letter, and the pops fly,
// one after another, into the casting glyphling's running total — which ticks up (+2, +4 …) and grows a little with
// every point (a big turn ends big). After the last word the final total holds, then the total, outline and bubble
// fade away together — all before the next turn starts (the store's `scoring` waits for it; so do the handoff box and
// the reveal). Everyone sees it: my cast, pass-and-play, and other players' replays online.
// Times: wordMarks.scoreSequence (anim.json score…) · keyframes: scoreFrames.ts · sizes/colour: garden.json
// (scorePop…) · swell: feel.json (seedPop, totalPop). Reduce motion → no pops flying, no bounce: the words step, the
// total steps up, everything fades. Every frame is the browser's (Web Animations) — no React state per frame.
import { useLayoutEffect, useMemo, useRef } from 'react'
import text from '../../content/text/en.json'
import { hexToPixel } from '../engine/hex'
import type { TurnSummary, GameState } from '../engine/types'
import { scorePops, scoreSequence } from '../store/wordMarks'
import { fill, reduceMotion } from '../ui/kit'
import { juiceFor } from './feel'
import { countFrames, popFrames, totalScaleFrames, wordFrames } from './scoreFrames'
import type { Box } from './spotlight'
import { HEX } from './useThrow'
import type { AnimTuning, GardenTuning } from './useTuning'

/** pxPerHex: how many screen pixels one hex size is — so the pops never get smaller than scorePopMinPx.
 *  view: the board's SVG box — the total stays inside it, even at its biggest. */
type Props = { game: GameState; turn: TurnSummary; colours: GardenTuning; timing: AnimTuning; pxPerHex: number; view: Box }

const POP_ABOVE = HEX * 0.75 // a seed's pop sits this far above its hex centre (over the top of its letter)
const STACK_STEP = HEX * 0.5 // a second pop on the same hex (a seed in two words) sits this much higher
const TOTAL_ABOVE = HEX * 1.0 // the total sits over the glyphling's head

export function ScorePops({ game, turn, colours, timing, pxPerHex, view }: Props) {
  const groupRef = useRef<SVGGElement>(null)
  const pops = useMemo(() => scorePops(game, turn), [game, turn])
  // (the timing is read once, when this landing's sequence starts — the store's timer used the same numbers)
  const seq = useMemo(() => scoreSequence(pops, timing), [pops]) // eslint-disable-line react-hooks/exhaustive-deps
  const spots = pops.map((p) => {
    const { x, y } = hexToPixel(p.hex, HEX)
    return { x, y: y - POP_ABOVE - p.stack * STACK_STEP }
  })

  // Readable on any board: small boards on phones scale the words up to at least scorePopMinPx on screen
  const grow = Math.max(1, colours.scorePopMinPx / (colours.scorePopSize * pxPerHex))
  const totalSize = colours.scoreTotalSize * grow
  // The total over the caster's head — nudged inside the board's box so even its biggest size stays on screen
  const biggest = totalSize * (1 + timing.scoreTotalMaxGrow) * 1.15
  const caster = hexToPixel(turn.to, HEX)
  const final = fill(text.game.scorePop, { n: seq.arrivals.at(-1)?.total ?? 0 })
  const halfW = Math.min(view.w / 2, final.length * biggest * 0.33), halfH = Math.min(view.h / 2, biggest * 0.6)
  const total = {
    x: Math.min(view.minX + view.w - halfW, Math.max(view.minX + halfW, caster.x)),
    y: Math.min(view.minY + view.h - halfH, Math.max(view.minY + halfH, caster.y - TOTAL_ABOVE)),
  }

  // Play the whole sequence once, when this landing's pops appear: every part is one animation over the whole of it
  useLayoutEffect(() => {
    const group = groupRef.current
    const svg = group?.ownerSVGElement
    if (!group || !svg || !seq.words.length) return
    const still = reduceMotion()
    const t = { popTime: timing.scorePopTime, fade: timing.spotlightFade }
    const options: KeyframeAnimationOptions = { duration: seq.end * 1000, fill: 'both' }
    const playing: Animation[] = []
    const play = (el: Element | null, frames: Keyframe[]) => el && playing.push(el.animate(frames, options))
    // Each word's outline (WordBorders, under the seeds) and its bubble (WordLabels), lit in its turn
    seq.words.forEach((_, i) => svg.querySelectorAll(`[data-spot-of="grown"][data-spot-word="${i}"]`)
      .forEach((el) => play(el, wordFrames(seq, i, colours.grownGlowStrength, t, still))))
    // Each seed's "+2" pops over its letter and flies on an arc (like the seed) into the total (reduce motion: they never show)
    const seedSwell = 1 + juiceFor('seedPop').grow
    if (!still) group.querySelectorAll('[data-score-pop]').forEach((el, i) =>
      play(el, popFrames(seq, i, total.x - spots[i].x, total.y - spots[i].y, seedSwell, t, timing.arcHeight)))
    // The running total: grows with every point, its number steps +2 → +4 → … → the final total, which fades
    play(group.querySelector('[data-score-total]'), totalScaleFrames(seq, 1 + juiceFor('totalPop').grow, t, still))
    group.querySelectorAll('[data-score-count]').forEach((el, k) => play(el, countFrames(seq, k)))
    return () => playing.forEach((a) => a.cancel())
    // (one sequence per landing — the Board gives each landing its own ScorePops)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A dark outline behind the letters (paint-order) keeps them readable on any runeblossom
  const label = (key: string, x: number, y: number, words: string, size: number, data: object) => (
    <text key={key} {...data} className="game-pop" x={x} y={y} textAnchor="middle" dominantBaseline="middle" opacity={0}
      fontSize={size} fontWeight={800} fill={colours.scorePop} stroke={colours.background} strokeWidth={size * 0.18}
      paintOrder="stroke" strokeLinejoin="round">
      {words}
    </text>
  )
  return (
    <g ref={groupRef} data-score-pops pointerEvents="none">
      {pops.map((p, i) => label(`pop-${i}`, spots[i].x, spots[i].y, fill(text.game.scorePop, { n: p.amount }), colours.scorePopSize * grow, { 'data-score-pop': i }))}
      <g data-score-total className="game-pop">
        {seq.arrivals.map((a, k) => label(`total-${k}`, total.x, total.y, fill(text.game.scorePop, { n: a.total }), totalSize, { 'data-score-count': k }))}
      </g>
    </g>
  )
}
