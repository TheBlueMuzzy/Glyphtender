// TANGLE DANGER CUES on the board — the same ring-at-the-hex-edge language as every other piece state:
//   warning (1 move left) — a dashed, "thorny" ring in the glyphling's owner's colour
//   tangled (no moves)   — a curly vine wrapped round it, with three little leaves (the glyphling fades a bit)
// Sizes and colours: content/tuning/garden.json (warningWidth, warningDash, vine, vineWidth, tangledDim).
import { hexCorners } from '../engine/hex'
import type { Danger } from '../store/danger'
import type { GardenTuning } from './useTuning'

type Props = { danger: Danger; x: number; y: number; hex: number; owner: string; colours: GardenTuning; glyphling: number }

export function DangerCue({ danger, x, y, hex, owner, colours, glyphling }: Props) {
  if (danger === 'warning') {
    const dash = colours.warningDash
    return (
      <polygon data-danger="warning" data-danger-of={glyphling} points={hexCorners(x, y, hex * 1.02)} fill="none" stroke={owner}
        strokeWidth={colours.warningWidth} strokeDasharray={`${dash} ${dash * 0.7}`} strokeLinecap="round" pointerEvents="none" />
    )
  }
  const r = hex * 0.9
  return (
    <g data-danger="tangled" data-danger-of={glyphling} pointerEvents="none">
      <path d={vinePath(x, y, r)} fill="none" stroke={colours.vine} strokeWidth={colours.vineWidth} strokeLinejoin="round" />
      {[40, 160, 280].map((degrees) => {
        const a = (degrees * Math.PI) / 180
        return <ellipse key={degrees} cx={x + r * Math.cos(a)} cy={y + r * Math.sin(a)} rx={hex * 0.16} ry={hex * 0.075}
          fill={colours.vine} transform={`rotate(${degrees + 60} ${x + r * Math.cos(a)} ${y + r * Math.sin(a)})`} />
      })}
    </g>
  )
}

/** A wavy ring round (x, y): the radius wobbles in and out 9 times as it goes round, like a curling vine. */
function vinePath(x: number, y: number, r: number): string {
  const points: string[] = []
  for (let i = 0; i <= 90; i++) {
    const a = (i / 90) * 2 * Math.PI
    const wobble = r * (1 + 0.07 * Math.sin(9 * a))
    points.push(`${(x + wobble * Math.cos(a)).toFixed(3)} ${(y + wobble * Math.sin(a)).toFixed(3)}`)
  }
  return `M ${points.join(' L ')} Z`
}
