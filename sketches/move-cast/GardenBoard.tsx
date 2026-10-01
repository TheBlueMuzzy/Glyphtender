// SKETCH board — flat SVG garden that always fits its box. Taps and drops are read from data-hex / data-glyph.
//
// DESIGN LANGUAGE (one look per state, same for glyphlings and seeds):
//   options  — hexes you could pick: soft glow + dot (teal = move there, gold = cast there)
//   held     — the piece you're holding: solid ring in the player's colour
//   planned  — moved/targeted but not cast yet: pulsing ring in the player's colour (a targeted seed is also faded)
//   done     — plain piece
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { hexCorners, hexKey, hexToPixel, type Board, type Hex } from '../../src/engine/hex'
import type { Colour, Glyphling, Seed } from './rules'
import type garden from '../../content/tuning/garden.json'
import type anim from '../../content/tuning/anim.json'

const SIZE = 1 // hexes are drawn at size 1; the viewBox scales them to fit
export const seedArt = (letter: string, colour: Colour) =>
  `${import.meta.env.BASE_URL}art/runeblossoms/${letter[0].toLowerCase()}-${colour}.webp`
export const glyphlingArt = (colour: Colour) => `${import.meta.env.BASE_URL}art/glyphlings/${colour}.webp`

/** A seed being thrown: flies from the glyphling to the target, then onLanded fires. */
export interface Flight { glyphId: string; from: Hex; to: Hex; colour: Colour; onLanded: () => void }

interface Props {
  board: Board
  glyphlings: Glyphling[] // shown where they are now (a planned move already applied)
  seeds: (Seed & { planned?: boolean })[]
  ghost: { hex: Hex; colour: Colour } | null // where a moved glyphling started — tap to send it back
  highlight: { hexes: Hex[]; kind: 'move' | 'cast' } | null
  heldGlyph: string | null
  plannedGlyph: string | null
  flight: Flight | null
  sproutKey: string | null // the runeblossom that's growing right now
  colours: typeof garden
  timing: typeof anim
  margin: number
  onHexSize: (px: number) => void // reports how wide one hex is on screen, for the readability check
}

export function GardenBoard(p: Props) {
  const { board, colours, timing } = p
  const svgRef = useRef<SVGSVGElement>(null)
  const seedRef = useRef<SVGGElement>(null)

  const viewBox = useMemo(() => {
    const pts = board.cells.map((h) => hexToPixel(h, SIZE))
    const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y)
    const pad = p.margin + 1
    const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad
    const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad
    return { minX, minY, w: maxX - minX, h: maxY - minY }
  }, [board, p.margin])

  // Measure the on-screen hex width whenever the board box changes size
  const { onHexSize } = p
  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const measure = () => {
      const r = svg.getBoundingClientRect()
      onHexSize(Math.round(2 * SIZE * Math.min(r.width / viewBox.w, r.height / viewBox.h)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(svg)
    return () => ro.disconnect()
  }, [viewBox, onHexSize])

  // The throw: move the seed along an arc frame by frame (mutating the element, not React state)
  const { flight } = p
  useEffect(() => {
    if (!flight) return
    const a = hexToPixel(flight.from, SIZE), b = hexToPixel(flight.to, SIZE)
    const dist = Math.hypot(b.x - a.x, b.y - a.y)
    const hexes = dist / Math.sqrt(3)
    const ms = 1000 * (timing.flightBase + timing.flightPerHex * hexes)
    const ctrl = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - dist * timing.arcHeight * 2 } // bezier handle above the middle
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2 // ease in-out
      const x = (1 - e) ** 2 * a.x + 2 * (1 - e) * e * ctrl.x + e * e * b.x
      const y = (1 - e) ** 2 * a.y + 2 * (1 - e) * e * ctrl.y + e * e * b.y
      seedRef.current?.setAttribute('transform', `translate(${x} ${y})`)
      if (t < 1) frame = requestAnimationFrame(step)
      else flight.onLanded()
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [flight, timing])

  const lit = new Set(p.highlight?.hexes.map(hexKey))
  const glow = p.highlight?.kind === 'cast' ? '#f2c14e' : '#5fd4c4' // the F01 sketch keeps its old gold / teal (the game now uses the player's colour)
  const s = colours.pieceScale
  const ring = (x: number, y: number, colour: Colour, kind: 'held' | 'planned') => (
    // Drawn at the hex's own edge, outside the art's coloured frame, so it reads as a halo, not part of the tile
    <polygon className={kind === 'planned' ? 'planned-ring' : undefined} points={hexCorners(x, y, SIZE * 1.02)}
      fill="none" stroke={colours[colour]} strokeWidth={0.09} strokeLinejoin="round" pointerEvents="none"
      style={{ filter: `drop-shadow(0 0 0.12px ${colours[colour]})` }} />
  )

  return (
    <svg ref={svgRef} className="garden" viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.w} ${viewBox.h}`} preserveAspectRatio="xMidYMid meet"
      style={{ '--hop': `${timing.hopTime}s`, '--hop-height': `${-timing.hopHeight}px`, '--grow': `${timing.growTime}s`, '--grow-from': timing.growFrom } as React.CSSProperties}>
      {board.cells.map((h) => {
        const { x, y } = hexToPixel(h, SIZE)
        return <polygon key={hexKey(h)} data-hex={hexKey(h)} points={hexCorners(x, y, SIZE * 0.97)}
          fill={colours.hexFill} stroke={colours.hexLine} strokeWidth={colours.hexLineWidth} />
      })}

      {p.ghost && (() => {
        const { x, y } = hexToPixel(p.ghost.hex, SIZE)
        return <image data-hex={hexKey(p.ghost.hex)} href={glyphlingArt(p.ghost.colour)} x={x - s} y={y - s} width={2 * s} height={2 * s} opacity={colours.ghostOpacity} />
      })()}

      {/* Options sit above the ghost, so a hex you can cast back onto is still clearly lit */}
      {board.cells.filter((h) => lit.has(hexKey(h))).map((h) => {
        const { x, y } = hexToPixel(h, SIZE)
        return (
          <g key={`lit-${hexKey(h)}`}>
            <polygon data-hex={hexKey(h)} points={hexCorners(x, y, SIZE * 0.97)} fill={glow} opacity={colours.glowStrength} />
            <circle data-hex={hexKey(h)} cx={x} cy={y} r={0.18} fill={glow} />
          </g>
        )
      })}

      {p.seeds.map((seed) => {
        const { x, y } = hexToPixel(seed.hex, SIZE)
        const key = hexKey(seed.hex)
        return (
          <g key={key}>
            <image className={key === p.sproutKey ? 'sprout' : undefined} data-hex={key} href={seedArt(seed.letter, seed.colour)}
              x={x - s} y={y - s} width={2 * s} height={2 * s} opacity={seed.planned ? colours.plannedSeedOpacity : 1} />
            {seed.planned && ring(x, y, seed.colour, 'planned')}
          </g>
        )
      })}

      {p.glyphlings.map((g) => {
        const { x, y } = hexToPixel(g.hex, SIZE)
        return (
          <g key={g.id} className={p.flight?.glyphId === g.id ? 'hop' : undefined}>
            <image data-glyph={g.id} data-hex={hexKey(g.hex)} href={glyphlingArt(g.colour)} x={x - s} y={y - s} width={2 * s} height={2 * s} />
            {g.id === p.heldGlyph ? ring(x, y, g.colour, 'held') : g.id === p.plannedGlyph && ring(x, y, g.colour, 'planned')}
          </g>
        )
      })}

      {flight && (
        <g ref={seedRef} transform={`translate(${hexToPixel(flight.from, SIZE).x} ${hexToPixel(flight.from, SIZE).y})`} pointerEvents="none">
          <circle r={timing.seedSize * 1.8} fill={colours[flight.colour]} opacity={0.25} />
          <circle r={timing.seedSize} fill={colours[flight.colour]} />
          <circle r={timing.seedSize * 0.45} cx={-timing.seedSize * 0.25} cy={-timing.seedSize * 0.25} fill="#fff" opacity={0.6} />
        </g>
      )}
    </svg>
  )
}
