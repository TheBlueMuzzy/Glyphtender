// A TURN TRAIL on the board, in the player's colour (trail.ts says which one shows and how):
//   from ring → dotted move path → to ring → dashed cast arc → dashed target ring.
//   plan  — only the path and the arc (the planned halos already ring both ends)
//   live  — another player's replayed turn: the parts draw on one after another over anim.json trailLead
//           (Web Animations, no React state per frame; reduce motion = it's simply there)
//   faint — the last turn, at garden.json trailFaint; a live trail fades down to it (same element, trailFade)
// It sits UNDER the seeds and glyphlings (Board.tsx), so it never covers a letter. Every line has a dark casing
// so it still reads over a highlight of the same colour.
import { useLayoutEffect, useRef } from 'react'
import { hexCorners, hexToPixel } from '../engine/hex'
import { trailKey, type Trail, type TrailMode } from '../store/trail'
import { reduceMotion } from '../ui/kit'
import { colourOf } from './art'
import { castPath, drawSteps, movePath } from './trailShape'
import { HEX } from './useThrow'
import type { AnimTuning, GardenTuning } from './useTuning'

type Props = { trail: Trail; mode: TrailMode; colours: GardenTuning; timing: AnimTuning }

export function TurnTrail({ trail, mode, colours, timing }: Props) {
  const ref = useRef<SVGGElement>(null)
  const key = trailKey(trail)
  const live = mode === 'live'

  // Live: draw the parts on in order (rings fade in; lines are revealed along their length by a mask)
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

  // Once the replayed turn has landed (live → faint): fade down rather than drop
  const wasLive = useRef(live)
  useLayoutEffect(() => {
    const group = ref.current
    if (group && wasLive.current && mode === 'faint' && !reduceMotion()) {
      group.animate([{ opacity: colours.trailStrength }, { opacity: colours.trailFaint }], { duration: timing.trailFade * 1000, easing: 'ease-out' })
    }
    wasLive.current = live
    // Only a change of mode fades (colours / timing are read when it starts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const colour = colours[colourOf(trail.seat)]
  const w = colours.trailWidth
  const steps = drawSteps(trail.target !== null)
  const path = movePath(trail.from, trail.to, HEX)
  const arc = trail.target ? castPath(trail.to, trail.target, HEX, timing.arcHeight) : null
  const rings = mode !== 'plan'
  const at = (h: Trail['from']) => hexToPixel(h, HEX)
  const opacity = mode === 'faint' ? colours.trailFaint : colours.trailStrength
  const draw = (part: keyof typeof steps) => (live ? { 'data-draw': steps[part].join(',') } : {})
  const masked = (part: 'path' | 'arc') => (live ? `url(#trail-reveal-${part})` : undefined)

  // A line with a dark casing under it; `dash` = the line's dash pattern
  const line = (part: 'path' | 'arc', d: string, dash: string, width: number) => (
    <g data-trail-part={part} mask={masked(part)}>
      <path d={d} fill="none" stroke={colours.background} strokeOpacity={0.55} strokeWidth={width + 0.07}
        strokeDasharray={dash} strokeLinecap="round" />
      <path d={d} fill="none" stroke={colour} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />
    </g>
  )
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

  return (
    <g ref={ref} data-trail={mode} data-trail-seat={trail.seat} data-trail-key={key} pointerEvents="none" opacity={opacity}>
      {live && (
        <defs>
          {(['path', 'arc'] as const).map((part) => (
            <mask key={part} id={`trail-reveal-${part}`} maskUnits="userSpaceOnUse" x={-200} y={-200} width={400} height={400}>
              <path d={part === 'path' ? path : arc ?? path} fill="none" stroke="white" strokeWidth={w * 6} pathLength={1}
                strokeDasharray="1 2" data-draw={steps[part].join(',')} data-draw-line="" />
            </mask>
          ))}
        </defs>
      )}
      {rings && ring('from', trail.from, false)}
      {line('path', path, `0 ${w * 2.4}`, w * 1.35)}
      {rings && ring('to', trail.to, false)}
      {arc && line('arc', arc, `${w * 2.4} ${w * 1.8}`, w)}
      {rings && trail.target && ring('target', trail.target, true)}
    </g>
  )
}
