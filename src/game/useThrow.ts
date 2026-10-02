// THE THROW — what plays after Cast (the F01 story): the glyphling hops and throws, the seed flies an arc
// to its target (time = flightBase + flightPerHex × distance), lands, the game commits the turn, then the
// runeblossom sprouts with a little overshoot (then the words it made score one at a time and fade — ScorePops.tsx).
// Every frame changes SVG attributes directly (no React state per frame). Reduce motion → no flight.
import { useEffect, type RefObject } from 'react'
import { hexToPixel, type Hex } from '../engine/hex'
import { reduceMotion } from '../ui/kit'
import { throwHandle } from './trailShape'
import type { AnimTuning } from './useTuning'

export const HEX = 1 // hexes are drawn at size 1; the SVG viewBox scales them to fit

export interface ThrowInput {
  svgRef: RefObject<SVGSVGElement | null>
  seedRef: RefObject<SVGGElement | null>
  flight: { glyphling: number; from: Hex; to: Hex } | null
  onLanded: () => void
  landed: { key: string; count: number } | null
  timing: AnimTuning
}

const overshoot = 'cubic-bezier(0.34, 1.56, 0.64, 1)' // grows a touch past full size, then settles

export function useThrow({ svgRef, seedRef, flight, onLanded, landed, timing }: ThrowInput) {
  // The flight: hop, then move the seed along a curved path frame by frame
  useEffect(() => {
    if (!flight) return
    if (reduceMotion()) {
      onLanded()
      return
    }
    const hopper = svgRef.current?.querySelector(`[data-hop="${flight.glyphling}"]`)
    hopper?.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-timing.hopHeight}px)` }], {
      duration: timing.hopTime * 1000, iterations: 2, direction: 'alternate', easing: 'ease-out',
    })
    const a = hexToPixel(flight.from, HEX), b = hexToPixel(flight.to, HEX)
    const distance = Math.hypot(b.x - a.x, b.y - a.y)
    const ms = 1000 * (timing.flightBase + (timing.flightPerHex * distance) / Math.sqrt(3))
    const handle = throwHandle(a, b, timing.arcHeight) // bezier handle above the middle (the trail's arc is the same curve)
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2 // ease in-out
      const x = (1 - e) ** 2 * a.x + 2 * (1 - e) * e * handle.x + e * e * b.x
      const y = (1 - e) ** 2 * a.y + 2 * (1 - e) * e * handle.y + e * e * b.y
      seedRef.current?.setAttribute('transform', `translate(${x} ${y})`)
      if (t < 1) frame = requestAnimationFrame(step)
      else onLanded()
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
    // Only a new flight restarts it (timing is read once when it starts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight])

  // After landing: the runeblossom sprouts
  useEffect(() => {
    if (!landed || reduceMotion()) return
    const svg = svgRef.current
    svg?.querySelector(`[data-seed="${landed.key}"]`)?.animate(
      [{ transform: `scale(${timing.growFrom})`, opacity: 0.4 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: timing.growTime * 1000, easing: overshoot, fill: 'backwards' },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landed?.count])
}
