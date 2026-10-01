// A TURN TRAIL on the board, in the player's colour (trail.ts says which one shows and how):
//   from ring → dotted move path → to ring → dashed target ring.
//   plan  — only the path (the planned halos already ring both ends and the aimed hex)
//   live  — another player's replayed turn: the parts draw on one after another over anim.json trailLead
//           (Web Animations, no React state per frame; reduce motion = it's simply there)
// No cast arc (Muzzy: casts are straight-line shots — an arc reads as jumping over things), and it's gone once the
// seed lands. It sits UNDER the seeds and glyphlings (Board.tsx), so it never covers a letter. Every line has a dark
// casing so it still reads over a highlight of the same colour.
import { useLayoutEffect, useRef } from 'react'
import { hexCorners, hexToPixel } from '../engine/hex'
import { trailKey, type Trail, type TrailMode } from '../store/trail'
import { reduceMotion } from '../ui/kit'
import { colourOf } from './art'
import { drawSteps, movePath } from './trailShape'
import { HEX } from './useThrow'
import type { AnimTuning, GardenTuning } from './useTuning'

type Props = { trail: Trail; mode: TrailMode; colours: GardenTuning; timing: AnimTuning }

export function TurnTrail({ trail, mode, colours, timing }: Props) {
  const ref = useRef<SVGGElement>(null)
  const key = trailKey(trail)
  const live = mode === 'live'

  // Live: draw the parts on in order (rings fade in; the path is revealed along its length by a mask)
  useLayoutEffect(() => {
    const group = ref.current
    if (!group || !live || reduceMotion()) return
    const lead = timing.trailLead * 1000
    const animations: Animation[] = []
    for (const el of group.querySelectorAll<SVGElement>('[data-draw]')) {
      const [start, end] = (el.getAttribute('data-draw') ?? '0,1').split(',').map(Number)
      const options: KeyframeAnimationOptions = { delay: start * lead, duration: Math.max(1, (end - start) * lead), fill: 'backwards', easing: 'ease-out' }
      animations.push(el.hasAttribute('data-draw-line')
        ? el.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], options)
        : el.animate([{ opacity: 0 }, { opacity: 1 }], options))
    }
    return () => animations.forEach((a) => a.cancel())
    // Only a new trail draws on (timing is read when it starts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, live])

  const colour = colours[colourOf(trail.seat)]
  const w = colours.trailWidth
  const steps = drawSteps(trail.target !== null)
  const path = movePath(trail.from, trail.to, HEX)
  const at = (h: Trail['from']) => hexToPixel(h, HEX)
  const draw = (part: keyof typeof steps) => (live ? { 'data-draw': steps[part].join(',') } : {})

  // A ring at the hex's edge (it peeks out round a piece standing there); dashed for the cast target
  const ring = (part: 'from' | 'to' | 'target', h: Trail['from'], dashed: boolean) => {
    const { x, y } = at(h)
    return (
      <g data-trail-part={part} {...draw(part)}>
        <polygon points={hexCorners(x, y, HEX * 0.9)} fill="none" stroke={colours.background} strokeOpacity={0.55}
          strokeWidth={w * 1.2 + 0.07} strokeLinejoin="round" strokeDasharray={dashed ? `${w * 2.2} ${w * 1.6}` : undefined} />
        <polygon points={hexCorners(x, y, HEX * 0.9)} fill="none" stroke={colour}
          strokeWidth={w * 1.2} strokeLinejoin="round" strokeDasharray={dashed ? `${w * 2.2} ${w * 1.6}` : undefined} />
      </g>
    )
  }

  // The dotted move path, with a dark casing under it
  const dash = `0 ${w * 2.4}`
  return (
    <g ref={ref} data-trail={mode} data-trail-seat={trail.seat} data-trail-key={key} pointerEvents="none" opacity={colours.trailStrength}>
      {live && (
        <defs>
          <mask id="trail-reveal-path" maskUnits="userSpaceOnUse" x={-200} y={-200} width={400} height={400}>
            <path d={path} fill="none" stroke="white" strokeWidth={w * 6} pathLength={1}
              strokeDasharray="1 2" data-draw={steps.path.join(',')} data-draw-line="" />
          </mask>
        </defs>
      )}
      {live && ring('from', trail.from, false)}
      <g data-trail-part="path" mask={live ? 'url(#trail-reveal-path)' : undefined}>
        <path d={path} fill="none" stroke={colours.background} strokeOpacity={0.55} strokeWidth={w * 1.35 + 0.07}
          strokeDasharray={dash} strokeLinecap="round" />
        <path d={path} fill="none" stroke={colour} strokeWidth={w * 1.35} strokeDasharray={dash} strokeLinecap="round" />
      </g>
      {live && ring('to', trail.to, false)}
      {live && trail.target && ring('target', trail.target, true)}
    </g>
  )
}
