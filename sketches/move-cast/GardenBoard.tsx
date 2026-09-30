// SKETCH board — flat SVG garden that always fits its box. Taps and drops are read from data-hex / data-glyph.
import { useLayoutEffect, useMemo, useRef } from 'react'
import { hexCorners, hexKey, hexToPixel, type Board, type Hex } from '../../src/engine/hex'
import type { Colour, Glyphling, Seed } from './rules'
import type garden from '../../content/tuning/garden.json'

const SIZE = 1 // hexes are drawn at size 1; the viewBox scales them to fit
export const seedArt = (letter: string, colour: Colour) =>
  `${import.meta.env.BASE_URL}art/runeblossoms/${letter[0].toLowerCase()}-${colour}.webp`
export const glyphlingArt = (colour: Colour) => `${import.meta.env.BASE_URL}art/glyphlings/${colour}.webp`

interface Props {
  board: Board
  glyphlings: Glyphling[] // shown where they are now (a pending move already applied)
  seeds: (Seed & { pending?: boolean })[]
  ghost: { hex: Hex; colour: Colour } | null // where a moved glyphling started — tap to send it back
  highlight: { hexes: Hex[]; kind: 'move' | 'cast' } | null
  selectedGlyph: string | null
  colours: typeof garden
  margin: number
  onHexSize: (px: number) => void // reports how wide one hex is on screen, for the readability check
}

export function GardenBoard({ board, glyphlings, seeds, ghost, highlight, selectedGlyph, colours, margin, onHexSize }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  const viewBox = useMemo(() => {
    const pts = board.cells.map((h) => hexToPixel(h, SIZE))
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
    const pad = margin + 1
    const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad
    const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad
    return { minX, minY, w: maxX - minX, h: maxY - minY }
  }, [board, margin])

  // Measure the on-screen hex width whenever the board box changes size
  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const measure = () => {
      const r = svg.getBoundingClientRect()
      const scale = Math.min(r.width / viewBox.w, r.height / viewBox.h)
      onHexSize(Math.round(2 * SIZE * scale))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(svg)
    return () => ro.disconnect()
  }, [viewBox, onHexSize])

  const lit = new Set(highlight?.hexes.map(hexKey))
  const glow = highlight?.kind === 'cast' ? colours.castGlow : colours.moveGlow
  const s = colours.pieceScale

  return (
    <svg
      ref={svgRef}
      className="garden"
      viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.w} ${viewBox.h}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {board.cells.map((h) => {
        const { x, y } = hexToPixel(h, SIZE)
        return (
          <g key={hexKey(h)}>
            <polygon
              data-hex={hexKey(h)}
              points={hexCorners(x, y, SIZE * 0.97)}
              fill={colours.hexFill}
              stroke={colours.hexLine}
              strokeWidth={colours.hexLineWidth}
            />
          </g>
        )
      })}

      {ghost && (() => {
        const { x, y } = hexToPixel(ghost.hex, SIZE)
        return (
          <image data-hex={hexKey(ghost.hex)} href={glyphlingArt(ghost.colour)} x={x - s} y={y - s} width={2 * s} height={2 * s}
            opacity={colours.ghostOpacity} />
        )
      })()}

      {/* Highlights sit above the ghost, so a hex you can cast back onto is still clearly lit */}
      {board.cells.filter((h) => lit.has(hexKey(h))).map((h) => {
        const { x, y } = hexToPixel(h, SIZE)
        return (
          <g key={`lit-${hexKey(h)}`}>
            <polygon data-hex={hexKey(h)} points={hexCorners(x, y, SIZE * 0.97)} fill={glow} opacity={colours.glowStrength} />
            <circle data-hex={hexKey(h)} cx={x} cy={y} r={0.18} fill={glow} />
          </g>
        )
      })}

      {seeds.map((seed) => {
        const { x, y } = hexToPixel(seed.hex, SIZE)
        return (
          <g key={hexKey(seed.hex)} className={seed.pending ? 'pending' : undefined}>
            <image data-hex={hexKey(seed.hex)} href={seedArt(seed.letter, seed.colour)} x={x - s} y={y - s} width={2 * s} height={2 * s} />
            {seed.pending && <polygon className="pending-ring" points={hexCorners(x, y, SIZE * 0.9)} fill="none" stroke={colours.castGlow} strokeWidth={0.08} />}
          </g>
        )
      })}

      {glyphlings.map((g) => {
        const { x, y } = hexToPixel(g.hex, SIZE)
        const selected = g.id === selectedGlyph
        return (
          <g key={g.id}>
            <image data-glyph={g.id} data-hex={hexKey(g.hex)} href={glyphlingArt(g.colour)} x={x - s} y={y - s} width={2 * s} height={2 * s} />
            {selected && <polygon points={hexCorners(x, y, SIZE * 0.92)} fill="none" stroke={colours.moveGlow} strokeWidth={0.1} pointerEvents="none" />}
          </g>
        )
      })}
    </svg>
  )
}
