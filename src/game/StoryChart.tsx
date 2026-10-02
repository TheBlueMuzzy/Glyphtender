// THE STORY CHART — everyone's secret Magic, round by round, finally shown (research/end-screen.md §4).
// One line per player in their glyphling colour; the last step is the end-of-game tangle bonus, in its own shaded
// column, drawn dotted. Marks on the lines: a knot where a glyphling got tangled (ringed in the tangler's colour),
// a tick where the lead changed — and ONE 4-pointed star in the holder's colour on the award the Highlights carousel
// is showing (Muzzy, 2026-10-02: "as they carousel, they should show as a 4 pointed star marker on that player's line
// at the time they did it"): it glides to the next award's spot as the carousel moves (reduce motion: it jumps).
// Tap a mark or the star (44 px target) → the caption under the chart.
// Each line ends in its own shape (circle, square, triangle, diamond — not colour alone) and its total.
// The lines draw themselves in, left to right, when the page opens (endscreen.json chartDrawSeconds; reduce motion = at once).
// Game graphics like the board: an SVG sized in real pixels (it measures its box), colours from garden.json + style names.
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { fill, reduceMotion } from '../ui/kit'
import type { ChartMarker, EndTuning, StoryChart as Chart } from './stats'
import { colourOf } from './art'
import type { GardenTuning } from './useTuning'
import text from '../../content/text/en.json'

const w = text.game.gameOver.chart
const MIN_TANGLE_COLUMN = 44

/** The chart's word size, px: 15 on a phone, growing with the chart's width up to 22 on a big screen (readable at desktop). */
const fontFor = (width: number) => Math.round(Math.min(22, Math.max(15, width / 46)))
/** Room around the plot for the numbers on the left, the totals on the right and the round labels underneath. */
const padFor = (font: number) => ({ left: Math.round(font * 2.3), right: Math.round(font * 3.5), top: 14, bottom: Math.round(font * 1.9) })

/** Each seat's end-of-line shape (so lines aren't told apart by colour alone). */
export function SeatShape({ seat, x, y, size, colour, ring }: { seat: number; x: number; y: number; size: number; colour: string; ring?: boolean }) {
  const r = size / 2
  const common = { fill: colour, stroke: ring ? 'var(--surface)' : 'none', strokeWidth: ring ? 2 : 0 }
  if (seat === 1) return <rect x={x - r * 0.9} y={y - r * 0.9} width={r * 1.8} height={r * 1.8} rx={1.5} {...common} />
  if (seat === 2) return <polygon points={`${x},${y - r * 1.1} ${x + r * 1.05},${y + r * 0.8} ${x - r * 1.05},${y + r * 0.8}`} {...common} />
  if (seat === 3) return <polygon points={`${x},${y - r * 1.15} ${x + r * 1.15},${y} ${x},${y + r * 1.15} ${x - r * 1.15},${y}`} {...common} />
  return <circle cx={x} cy={y} r={r} {...common} />
}

/** Round numbers for the guide lines: 2–3 faint lines at a nice step. */
function guideStep(max: number): number {
  for (const step of [5, 10, 20, 25, 50, 100, 200, 250, 500]) if (max / step <= 3) return step
  return Math.ceil(max / 3)
}

/** A 4-pointed star (✦) centred on 0,0: points up, right, down, left; narrow waist between them. */
const fourStar = (r: number) =>
  Array.from({ length: 8 }, (_, i) => {
    const angle = (Math.PI / 4) * i - Math.PI / 2
    const radius = i % 2 ? r * 0.36 : r
    return `${(radius * Math.cos(angle)).toFixed(2)},${(radius * Math.sin(angle)).toFixed(2)}`
  }).join(' ')

type Props = {
  chart: Chart
  colours: GardenTuning
  tuning: EndTuning
  /** The tapped marker (index into chart.markers), 'tangles' for the Tangles column, 'star' for the award star, or null. */
  selected: number | 'tangles' | 'star' | null
  onSelect: (which: number | 'tangles' | 'star' | null) => void
  /** Where the Highlights carousel's award goes (stats.ts awardPoint), or null: no award / no story to draw. */
  star: ChartMarker | null
  /** How tall the chart is, px. */
  height: number
  label: (marker: ChartMarker) => string
}

export function StoryChart({ chart, colours, tuning, selected, onSelect, height, label, star }: Props) {
  // Real pixels: the SVG is as wide as its box, so its words are true sizes
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = box.current!
    const measure = () => setWidth(Math.floor(el.clientWidth))
    measure()
    const watcher = new ResizeObserver(measure)
    watcher.observe(el)
    return () => watcher.disconnect()
  }, [])

  // Draw in once, left to right; the marks and labels fade in after
  const lines = useRef<SVGGElement>(null)
  const after = useRef<SVGGElement>(null)
  const drawn = useRef(false)
  useLayoutEffect(() => {
    if (!width || drawn.current) return
    drawn.current = true
    const seconds = tuning.chartDrawSeconds
    if (reduceMotion() || seconds <= 0) return
    const ms = seconds * 1000
    lines.current?.querySelectorAll('[data-draw]').forEach((el) =>
      el.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: ms, easing: 'ease-out', fill: 'backwards' }))
    after.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: ms, fill: 'backwards' })
  }, [width, tuning.chartDrawSeconds])

  const FONT = fontFor(width)
  const PAD = padFor(FONT)
  const S = FONT / 15 // marks and end shapes grow with the words
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const tangleW = Math.max(MIN_TANGLE_COLUMN, plotW / (chart.rounds + 1))
  const step = chart.rounds > 0 ? (plotW - tangleW) / chart.rounds : 0
  const X = (i: number) => PAD.left + (i <= chart.rounds ? i * step : chart.rounds * step + tangleW)
  const guide = guideStep(chart.max)
  const top = Math.max(guide, Math.ceil(chart.max / guide) * guide)
  const plotH = height - PAD.top - PAD.bottom
  const Y = (v: number) => PAD.top + (1 - v / top) * plotH
  const end = chart.rounds + 1
  const lineWidth = tuning.chartLineWidth

  // End labels: each line's total beside its shape, nudged apart so they never overlap
  const labels = chart.series
    .map((s) => ({ seat: s.seat, total: s.points[end], y: Y(s.points[end]) }))
    .sort((a, b) => a.y - b.y)
  for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + FONT + 3)
  const overflow = (labels.at(-1)?.y ?? 0) - (height - PAD.bottom)
  if (overflow > 0) labels.forEach((l) => (l.y -= overflow))

  // The star glides from the last award's spot to this one's (reduce motion: it just moves)
  const starAt = star && chart.series[star.seat] ? { x: X(star.x), y: Y(chart.series[star.seat].points[star.x]) } : null
  const starRef = useRef<SVGGElement>(null)
  const starWas = useRef<{ x: number; y: number } | null>(null)
  useLayoutEffect(() => {
    const was = starWas.current
    starWas.current = starAt
    if (!starAt || !was || (was.x === starAt.x && was.y === starAt.y) || reduceMotion()) return
    starRef.current?.animate(
      [{ transform: `translate(${was.x}px, ${was.y}px)` }, { transform: `translate(${starAt.x}px, ${starAt.y}px)` }],
      { duration: 350, easing: 'ease-in-out' })
  }, [starAt?.x, starAt?.y]) // eslint-disable-line react-hooks/exhaustive-deps

  const key = (which: number | 'tangles' | 'star') => (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    onSelect(selected === which ? null : which)
  }
  const colour = (seat: number) => colours[colourOf(seat)]

  return (
    <div ref={box} className="game-end-chart">
      {width > 0 && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={w.label} className="game-end-chart-svg">
          {/* The Tangles column, shaded; tap it for the bonus */}
          <g role="button" tabIndex={0} aria-label={w.tangles} onClick={() => onSelect(selected === 'tangles' ? null : 'tangles')} onKeyDown={key('tangles')} className="game-end-chart-hit">
            <rect x={X(chart.rounds)} y={PAD.top} width={tangleW} height={plotH} fill="var(--border)" opacity={selected === 'tangles' ? 0.55 : 0.3} rx={6} />
          </g>
          {/* Faint guide lines + their numbers */}
          {Array.from({ length: Math.floor(top / guide) + 1 }, (_, i) => i * guide).map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={X(end)} y1={Y(v)} y2={Y(v)} stroke="var(--border)" strokeWidth={1} opacity={v === 0 ? 0.9 : 0.5} />
              <text x={PAD.left - 6} y={Y(v)} dy="0.35em" textAnchor="end" fontSize={FONT - 2} fill="var(--muted)">{v}</text>
            </g>
          ))}
          {/* x labels: only the first round, the last round and Tangles */}
          <g fill="var(--muted)" fontSize={FONT - 2}>
            {chart.rounds >= 1 && <text x={X(1)} y={height - 8} textAnchor="middle">{fill(w.round, { n: 1 })}</text>}
            {chart.rounds > 1 && X(chart.rounds) - X(1) > 48 && <text x={X(chart.rounds) - 4} y={height - 8} textAnchor="end">{fill(w.round, { n: chart.rounds })}</text>}
            <text x={X(chart.rounds) + 4} y={height - 8} textAnchor="start">{w.tangles}</text>
          </g>
          {/* The lines (a surface-coloured ring under each, so crossing lines stay apart) */}
          <g ref={lines} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {chart.series.map((s) => {
              const pts = s.points.slice(0, end).map((v, i) => `${X(i)},${Y(v)}`).join(' ')
              return (
                <g key={s.seat}>
                  <polyline points={pts} stroke="var(--surface)" strokeWidth={lineWidth + 3} pathLength={1} strokeDasharray="1 1" data-draw />
                  <polyline points={pts} stroke={colour(s.seat)} strokeWidth={lineWidth} pathLength={1} strokeDasharray="1 1" data-draw />
                </g>
              )
            })}
          </g>
          <g ref={after}>
            {/* The tangle bonus step, dotted */}
            {chart.series.map((s) => (
              <line key={s.seat} x1={X(chart.rounds)} y1={Y(s.points[chart.rounds])} x2={X(end)} y2={Y(s.points[end])}
                stroke={colour(s.seat)} strokeWidth={lineWidth} strokeDasharray={`${lineWidth} ${lineWidth * 1.6}`} strokeLinecap="round" />
            ))}
            {/* Each line's end: its shape, and its total beside it */}
            {chart.series.map((s) => <SeatShape key={s.seat} seat={s.seat} x={X(end)} y={Y(s.points[end])} size={12 * S} colour={colour(s.seat)} ring />)}
            {labels.map((l) => (
              <text key={l.seat} x={X(end) + 12 * S} y={l.y} dy="0.35em" fontSize={FONT} fontWeight={700} fill="var(--on-surface)">{l.total}</text>
            ))}
            {/* The moments */}
            {chart.markers.map((m, i) => {
              const x = X(m.x)
              const y = Y(chart.series[m.seat].points[m.x])
              const on = selected === i
              return (
                <g key={i} role="button" tabIndex={0} aria-label={label(m)} aria-pressed={on} className="game-end-chart-hit"
                  onClick={() => onSelect(on ? null : i)} onKeyDown={key(i)} data-marker={m.kind}>
                  <circle cx={x} cy={y} r={Math.max(22, 16 * S)} fill="transparent" />
                  {on && <circle cx={x} cy={y} r={13 * S} fill="none" stroke="var(--focus)" strokeWidth={2.5} />}
                  {m.kind === 'tangle' && (
                    <>
                      <circle cx={x} cy={y} r={8 * S} fill="var(--surface)" stroke={colour(m.by ?? m.seat)} strokeWidth={3} />
                      <circle cx={x} cy={y} r={3.5 * S} fill={colour(m.seat)} />
                    </>
                  )}
                  {m.kind === 'lead' && <line x1={x} x2={x} y1={y - 11 * S} y2={y + 11 * S} stroke={colour(m.seat)} strokeWidth={3} strokeLinecap="round" />}
                </g>
              )
            })}
            {/* The Highlights star: the award the carousel shows, on its holder's line — glides from award to award */}
            {star && starAt && (
              <g role="button" tabIndex={0} aria-label={label(star)} aria-pressed={selected === 'star'} className="game-end-chart-hit game-end-star"
                onClick={() => onSelect(selected === 'star' ? null : 'star')} onKeyDown={key('star')} data-marker="star" data-seat={star.seat}
                data-x={star.x} ref={starRef} transform={`translate(${starAt!.x} ${starAt!.y})`}>
                <circle r={Math.max(22, 16 * S)} fill="transparent" />
                {selected === 'star' && <circle r={15 * S} fill="none" stroke="var(--focus)" strokeWidth={2.5} />}
                <polygon key={`${star.award}:${star.seat}:${star.turnNo}`} className="game-end-star-shape" points={fourStar(12 * S)}
                  fill={colour(star.seat)} stroke="var(--on-surface)" strokeWidth={1.5} strokeLinejoin="round" />
              </g>
            )}
          </g>
        </svg>
      )}
    </div>
  )
}
