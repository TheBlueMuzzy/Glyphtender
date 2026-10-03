// THE REVEAL ON THE BOARD — drawn on top of the garden while the end-of-game Magic reveal plays:
//   the tangled glyphlings glow in the vine colour (pulsing at the start, steady while their bonus is counted),
//   and each tangle bonus pops "+3" on the rival piece that earned it, then flies into that player's total on their
//   chip (Reveal.tsx), which pops as it arrives — the SAME motion as a cast's score sequence (Muzzy, 2026-10-03: "if it
//   happens somewhere, and it's the same intention somewhere else, we also have it happen there"). Nothing stays on
//   the board: the chips' "Tangles +N" says where the Magic came from. Colours/sizes: garden.json · timings: anim.json
//   (revealPopTime, scoreFlyTime) · swell: feel.json seedPop. Reduce motion: no "+3" flies — the totals just step up.
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import text from '../../content/text/en.json'
import { hexCorners, hexToPixel } from '../engine/hex'
import type { GameState } from '../engine/types'
import type { RevealStep } from '../store/revealPlan'
import { revealView, stepSeconds } from '../store/revealPlan'
import { fill, reduceMotion } from '../ui/kit'
import { juiceFor } from './feel'
import { flightFrames } from './scoreFrames'
import { HEX } from './useThrow'
import type { AnimTuning, GardenTuning } from './useTuning'

type Props = { game: GameState; steps: RevealStep[]; at: number | null; colours: GardenTuning; timing: AnimTuning }

export function RevealMarks({ game, steps, at, colours, timing }: Props) {
  if (at === null) return null
  const view = revealView(steps, at)
  const bonus = view.current?.kind === 'bonus' ? view.current : null // the bonus popping + flying right now
  return (
    <g data-reveal pointerEvents="none">
      {game.tangled.map((id) => {
        const g = game.glyphlings.find((x) => x.id === id)
        if (!g) return null
        const { x, y } = hexToPixel(g.hex, HEX)
        const pulsing = view.current?.kind === 'tangles'
        const lit = pulsing || bonus?.glyphling === id
        return (
          <polygon key={id} data-reveal-tangled={id} points={hexCorners(x, y, HEX * 0.97)} fill={colours.vine}
            opacity={lit ? 0.45 : 0}>
            {pulsing && <animate attributeName="opacity" values="0.1;0.55;0.1" dur={`${timing.tangleBlinkTime}s`} repeatCount="indefinite" />}
          </polygon>
        )
      })}
      {bonus && !reduceMotion() && (
        <BonusFlight key={at} at={hexToPixel(bonus.hex, HEX)} seat={bonus.seat} label={fill(text.game.reveal.pop, { n: bonus.amount })}
          colours={colours} timing={timing} seconds={stepSeconds(bonus, timing)} />
      )}
    </g>
  )
}

/**
 * One "+3": pops in over its piece (swelling past full size, like a seed's "+2"), waits, then flies on the seed's arc into its owner's
 * total on the reveal chips and vanishes as it lands — exactly as the step ends, when the total takes the +3 and pops.
 * It flies on a layer over the whole game screen (not the board's SVG), because the chips are outside the board — inside
 * the game screen, so a menu opened over the game still covers it.
 */
function BonusFlight({ at, seat, label, colours, timing, seconds }: {
  at: { x: number; y: number }; seat: number; label: string; colours: GardenTuning; timing: AnimTuning; seconds: number
}) {
  const anchor = useRef<SVGCircleElement>(null)
  const pop = useRef<HTMLSpanElement>(null)
  const [spot, setSpot] = useState<{ x: number; y: number; size: number; layer: Element } | null>(null)
  // Where the piece is on screen, and how big the "+3" is there (the board's scale)
  useLayoutEffect(() => {
    const el = anchor.current
    const m = el?.getScreenCTM()
    if (!el || !m) return
    const p = new DOMPoint(at.x, at.y - HEX * 0.1).matrixTransform(m)
    setSpot({ x: p.x, y: p.y, size: colours.revealPopSize * m.a, layer: el.closest('.game') ?? document.body })
  }, [at.x, at.y, colours.revealPopSize])
  useLayoutEffect(() => {
    const el = pop.current
    const total = document.querySelector(`[data-reveal-seat="${seat}"] .kit-player-chip-score .kit-text`)?.getBoundingClientRect()
    if (!el || !spot) return
    const dx = total ? total.x + total.width / 2 - spot.x : 0, dy = total ? total.y + total.height / 2 - spot.y : 0
    const swell = 1 + juiceFor('seedPop').grow
    const at = (s: number) => Math.min(1, Math.max(0, s / seconds))
    const fly = seconds - timing.scoreFlyTime
    const move = (x: number, y: number, scale: number) => `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`
    const a = el.animate([
      { transform: move(0, 0, 0.2), opacity: 0, offset: 0, easing: 'ease-out' },
      { transform: move(0, 0, swell), opacity: 1, offset: at(timing.revealPopTime * 0.6) },
      { transform: move(0, 0, 1), opacity: 1, offset: at(timing.revealPopTime) },
      // (the seed's arc, like every "points fly into a total"; ends invisible — the last frame is held: B007)
      ...flightFrames(dx, dy, timing.arcHeight, at(fly), 1, move),
    ], { duration: seconds * 1000, fill: 'both' })
    return () => a.cancel()
  }, [spot, seat, seconds, timing.revealPopTime, timing.scoreFlyTime, timing.arcHeight])
  return (
    <>
      <circle ref={anchor} cx={at.x} cy={at.y} r={0} />
      {spot && createPortal(
        <span ref={pop} data-reveal-pop className="game-reveal-flight" aria-hidden="true"
          style={{ left: spot.x, top: spot.y, fontSize: spot.size, color: colours.revealPop, ['--pop-outline' as string]: colours.background }}>
          {label}
        </span>,
        spot.layer,
      )}
    </>
  )
}
