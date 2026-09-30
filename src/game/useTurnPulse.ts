// THE TURN PULSE on screen — the glyphlings pulsingGlyphlings() names breathe: a small, slow swell
// (feel.json turnPulse tier → grow; anim.json turnPulseTime). Each one's [data-pulse] group in Board.tsx.
// The browser animates it (Web Animations API, looping) — no React state per frame. Reduce motion → no pulse.
import { useLayoutEffect, type RefObject } from 'react'
import { reduceMotion } from '../ui/kit'
import { juiceFor } from './feel'
import type { AnimTuning } from './useTuning'

export function useTurnPulse(svgRef: RefObject<SVGSVGElement | null>, ids: number[], timing: AnimTuning) {
  const key = ids.join(',')
  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const groups = [...svg.querySelectorAll<SVGGElement>('[data-pulse]')]
    groups.forEach((g) => g.getAnimations().forEach((a) => a.cancel())) // every pulse stops…
    if (reduceMotion() || ids.length === 0) return
    const swell = 1 + juiceFor('turnPulse').grow
    for (const group of groups) { // …and the ones whose turn it is start again, in step
      if (!ids.includes(Number(group.getAttribute('data-pulse')))) continue
      group.animate([{ transform: 'scale(1)' }, { transform: `scale(${swell})` }, { transform: 'scale(1)' }],
        { duration: timing.turnPulseTime * 1000, iterations: Infinity, easing: 'ease-in-out' })
    }
    // Only a change of who pulses restarts it (timing is read when it starts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
