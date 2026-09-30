// SCORE POPS — after a cast grows words (word indicators on; GDD §4 feel notes): each seed of each word pops
// its Magic above it ("+1", or "+2" for the caster's own seed), word after word; then they all fly together into
// one bigger "+N" over the glyphling that cast — the turn's Magic, never a running total — which lingers and fades.
// Everyone sees it: pass-and-play before the handoff, and online for other players' turns too (their replay lands
// the same way). Reduce motion → only the total, still. The numbers come from src/store/wordMarks.ts (the engine's
// own seedMagic); timings: anim.json (score…), sizes/colour: garden.json (scorePop…), swell: feel.json.
// Every frame is the browser's (Web Animations on the text elements) — no React state per frame.
import { useEffect, useMemo, useRef } from 'react'
import text from '../../content/text/en.json'
import { hexToPixel } from '../engine/hex'
import type { TurnSummary, GameState } from '../engine/types'
import { popTimeline, popsTotal, scorePops } from '../store/wordMarks'
import { fill, reduceMotion } from '../ui/kit'
import { juiceFor } from './feel'
import { HEX } from './useThrow'
import type { AnimTuning, GardenTuning } from './useTuning'

type Props = { game: GameState; turn: TurnSummary; colours: GardenTuning; timing: AnimTuning }

const POP_ABOVE = HEX * 0.75 // a seed's pop sits this far above its hex centre (over the top of its letter)
const STACK_STEP = HEX * 0.5 // a second pop on the same hex (a seed in two words) sits this much higher
const TOTAL_ABOVE = HEX * 1.0 // the total sits over the glyphling's head

export function ScorePops({ game, turn, colours, timing }: Props) {
  const groupRef = useRef<SVGGElement>(null)
  const pops = useMemo(() => scorePops(game, turn), [game, turn])
  const caster = hexToPixel(turn.to, HEX)
  const spots = pops.map((p) => {
    const { x, y } = hexToPixel(p.hex, HEX)
    return { x, y: y - POP_ABOVE - p.stack * STACK_STEP }
  })

  // Play the whole story once, when this landing's pops appear
  useEffect(() => {
    const group = groupRef.current
    if (!group) return
    const ms = (seconds: number) => seconds * 1000
    const line = popTimeline(pops, timing)
    const total = group.querySelector('[data-score-total]')
    const totalLife = timing.scoreTotalHold + timing.scoreTotalFade
    if (reduceMotion()) {
      // Just the total: there, then gone (no growing, no flying)
      total?.animate([{ opacity: 1 }, { opacity: 1, offset: timing.scoreTotalHold / totalLife }, { opacity: 0 }],
        { duration: ms(totalLife), fill: 'both' })
      return
    }
    const seedSwell = 1 + juiceFor('seedPop').grow
    group.querySelectorAll<SVGTextElement>('[data-score-pop]').forEach((el, i) => {
      const pop = pops[i]
      // Pop in above its seed (grow past full size, settle) and stay…
      el.animate([{ transform: 'scale(0.2)', opacity: 0 }, { transform: `scale(${seedSwell})`, opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }],
        { delay: ms(line.startOf(pop)), duration: ms(timing.scorePopTime), easing: 'ease-out', fill: 'both' })
      // …then fly with all the others into the total over the glyphling
      const dx = caster.x - spots[i].x, dy = caster.y - TOTAL_ABOVE - spots[i].y
      el.animate([{ transform: 'translate(0, 0) scale(1)', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(0.6)`, opacity: 0.2 }],
        { delay: ms(line.fly), duration: ms(timing.scoreFlyTime), easing: 'ease-in', fill: 'forwards' })
    })
    const totalSwell = 1 + juiceFor('totalPop').grow
    const popIn = timing.scorePopTime / (timing.scorePopTime + totalLife)
    total?.animate([
      { transform: 'scale(0.3)', opacity: 0 },
      { transform: `scale(${totalSwell})`, opacity: 1, offset: popIn * 0.6 },
      { transform: 'scale(1)', opacity: 1, offset: popIn },
      { transform: 'scale(1)', opacity: 1, offset: popIn + (1 - popIn) * (timing.scoreTotalHold / totalLife) },
      { transform: 'scale(1)', opacity: 0 },
    ], { delay: ms(line.total), duration: ms(timing.scorePopTime + totalLife), easing: 'ease-out', fill: 'both' })
    // (one story per landing — the Board gives each landing its own ScorePops)
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
      {pops.map((p, i) => label(`pop-${i}`, spots[i].x, spots[i].y, fill(text.game.scorePop, { n: p.amount }), colours.scorePopSize, { 'data-score-pop': i }))}
      {label('total', caster.x, caster.y - TOTAL_ABOVE, fill(text.game.scorePop, { n: popsTotal(pops) }), colours.scoreTotalSize, { 'data-score-total': true })}
    </g>
  )
}
