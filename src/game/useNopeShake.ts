// THE "NO" SHAKE on screen — when the store says a piece refused a tap (store.nope, decided in nope.ts), that
// piece gives a quick sideways shake: a glyphling's [data-shake] group, a planted seed's image, a tray seed.
// Cozy, not harsh: small (feel.json noShake → shake, a share of the piece's width) and quick (anim.json
// noShakeTime). The browser animates it (Web Animations). Reduce motion → no shake (the prompt still says why).
import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import type { NopeTarget } from '../store/nope'
import { reduceMotion } from '../ui/kit'
import { juiceFor } from './feel'
import { useAnimTuning } from './useTuning'

const selectorFor = (target: NopeTarget) =>
  target.kind === 'glyph' ? `[data-shake="${target.key}"]` : target.kind === 'seed' ? `[data-seed="${target.key}"]` : `[data-hand="${target.key}"]`

export function useNopeShake() {
  const nope = useGameStore((s) => s.nope)
  const timing = useAnimTuning()
  useEffect(() => {
    if (!nope || reduceMotion()) return
    const piece = document.querySelector<SVGGraphicsElement>(selectorFor(nope))
    if (!piece) return
    const d = piece.getBBox().width * juiceFor('noShake').shake // in the piece's own units (board: hexes · tray: pixels)
    const at = (x: number) => ({ transform: `translateX(${x}px)` })
    piece.animate([at(0), at(-d), at(d), at(-d * 0.6), at(d * 0.3), at(0)], { duration: timing.noShakeTime * 1000, easing: 'ease-out' })
    // A new "no" (the count changes) shakes again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nope?.count])
}
