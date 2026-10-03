// THE REVEAL ON THE BOARD — drawn on top of the garden while the end-of-game Magic reveal plays:
//   the tangled glyphlings glow in the vine colour (pulsing at the start, steady while their bonus is counted),
//   and each tangle bonus pops "+3" on the rival piece that earned it, one hex at a time. The "+3"s stay,
//   so the board explains the tangle Magic afterwards too. Colours/sizes: garden.json · timings: anim.json.
import { useEffect, useRef } from 'react'
import text from '../../content/text/en.json'
import { hexCorners, hexKey, hexToPixel } from '../engine/hex'
import type { GameState } from '../engine/types'
import type { RevealStep } from '../store/revealPlan'
import { popsByHex, revealView } from '../store/revealPlan'
import { fill, reduceMotion } from '../ui/kit'
import { HEX } from './useThrow'
import type { AnimTuning, GardenTuning } from './useTuning'

type Props = { game: GameState; steps: RevealStep[]; at: number | null; colours: GardenTuning; timing: AnimTuning }

export function RevealMarks({ game, steps, at, colours, timing }: Props) {
  if (at === null) return null
  const view = revealView(steps, at)
  const scoring = view.current?.kind === 'bonus' ? view.current.glyphling : null // whose bonus is being counted now
  return (
    <g data-reveal pointerEvents="none">
      {game.tangled.map((id) => {
        const g = game.glyphlings.find((x) => x.id === id)
        if (!g) return null
        const { x, y } = hexToPixel(g.hex, HEX)
        const pulsing = view.current?.kind === 'tangles'
        const lit = pulsing || scoring === id
        return (
          <polygon key={id} data-reveal-tangled={id} points={hexCorners(x, y, HEX * 0.97)} fill={colours.vine}
            opacity={lit ? 0.45 : 0}>
            {pulsing && <animate attributeName="opacity" values="0.1;0.55;0.1" dur={`${timing.tangleBlinkTime}s`} repeatCount="indefinite" />}
          </polygon>
        )
      })}
      {/* One mark per hex (a piece next to two tangled glyphlings shows "+6"); it pops again each time it grows */}
      {popsByHex(view.pops).map((mark) => (
        <Pop key={`${hexKey(mark.hex)}-${mark.count}`} x={hexToPixel(mark.hex, HEX).x} y={hexToPixel(mark.hex, HEX).y}
          label={fill(text.game.reveal.pop, { n: mark.total })} colours={colours} seconds={timing.revealPopTime} />
      ))}
    </g>
  )
}

/** One "+3": grows past full size and settles when it appears (not with reduce motion). */
function Pop({ x, y, label, colours, seconds }: { x: number; y: number; label: string; colours: GardenTuning; seconds: number }) {
  const ref = useRef<SVGTextElement>(null)
  useEffect(() => {
    if (reduceMotion()) return
    ref.current?.animate(
      [{ transform: 'scale(0.2)', opacity: 0 }, { transform: 'scale(1.25)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: seconds * 1000, easing: 'ease-out' },
    )
  }, [seconds])
  return (
    // A dark outline behind the letters (paint-order) keeps them readable on any runeblossom
    <text ref={ref} data-reveal-pop className="game-pop" x={x} y={y - HEX * 0.1} textAnchor="middle" dominantBaseline="middle"
      fontSize={colours.revealPopSize} fontWeight={800} fill={colours.revealPop} stroke={colours.background}
      strokeWidth={colours.revealPopSize * 0.18} paintOrder="stroke" strokeLinejoin="round">
      {label}
    </text>
  )
}
