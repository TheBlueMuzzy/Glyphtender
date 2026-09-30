// THE BOARD — the night garden as one SVG that always fits its box. Taps and drops find pieces by
// data-hex (hexKey) and data-glyph (glyphling id); usePieceInput turns them into store actions.
//
// PIECE STATES — one look for every piece (GDD §4 "Piece states"):
//   options  — hexes you could pick: soft glow + dot (teal = move there, gold = cast there)
//   held     — the piece you're holding: solid ring in the player's colour
//   planned  — moved/targeted but not cast yet: pulsing halo at the hex edge (a targeted seed is also faded)
//   done     — plain piece
// WORDS (word indicators on): a white border behind the seeds — planned while aiming, then after they grow (WordBorders.tsx).
// MOVES glide from hex to hex (useGlide.ts) — a planned move, Undo, and moves made anywhere else.
// DANGER CUES (DangerCue.tsx): 1 move left = dashed thorny ring in the owner's colour · tangled = a vine wraps it
// Colours: content/tuning/garden.json · timings: anim.json · margin: layout.json.
import { useLayoutEffect, useMemo, useRef } from 'react'
import { getBoard } from '../engine/boards'
import { hexCorners, hexKey, hexToPixel, type Hex } from '../engine/hex'
import { useGameStore } from '../store/gameStore'
import { highlightFor } from '../store/turnPlan'
import { dangers } from '../store/danger'
import { revealSteps } from '../store/revealPlan'
import { colourOf, glyphlingArt, seedArt } from './art'
import { DangerCue } from './DangerCue'
import { RevealMarks } from './RevealMarks'
import { useGlide } from './useGlide'
import { WordBorders } from './WordBorders'
import { uniqueHexes } from '../store/wordMarks'
import { usePreview } from './usePreview'
import { HEX, useThrow } from './useThrow'
import { useAnimTuning, useGardenTuning, useLayoutTuning } from './useTuning'

type Props = {
  /** Reports how wide one hex is on screen (pixels), so the tray can match it. */
  onHexSize: (px: number) => void
  /** Tall screens: sit the board at the bottom of its box, right above the tray (thumb reach, no gap). */
  sitOnTray?: boolean
}

export function Board({ onHexSize, sitOnTray = false }: Props) {
  const game = useGameStore((s) => s.game)!
  const move = useGameStore((s) => s.move)
  const cast = useGameStore((s) => s.cast)
  const selected = useGameStore((s) => s.selected)
  const flying = useGameStore((s) => s.flying)
  const landed = useGameStore((s) => s.landed)
  const revealAt = useGameStore((s) => s.revealAt)
  const indicators = useGameStore((s) => s.options?.wordIndicators ?? true)
  const finishCast = useGameStore((s) => s.finishCast)
  const colours = useGardenTuning()
  const timing = useAnimTuning()
  const { boardMargin } = useLayoutTuning()
  const preview = usePreview()
  const board = getBoard(game.config.boardName)
  const svgRef = useRef<SVGSVGElement>(null)
  const seedRef = useRef<SVGGElement>(null)

  // The board's own area, plus a margin, as the SVG viewBox
  const view = useMemo(() => {
    const points = board.cells.map((h) => hexToPixel(h, HEX))
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y)
    const pad = boardMargin + 1
    const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad
    return { minX, minY, w: Math.max(...xs) + pad - minX, h: Math.max(...ys) + pad - minY }
  }, [board, boardMargin])

  // Measure the on-screen hex width whenever the board's box changes size
  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const measure = () => {
      const r = svg.getBoundingClientRect()
      onHexSize(2 * HEX * Math.min(r.width / view.w, r.height / view.h))
    }
    measure()
    const watcher = new ResizeObserver(measure)
    watcher.observe(svg)
    return () => watcher.disconnect()
  }, [view, onHexSize])

  const flight = useMemo(
    () => (flying && move && cast ? { glyphling: move.glyphling, from: move.to, to: cast.target } : null),
    [flying, move, cast],
  )
  useThrow({ svgRef, seedRef, flight, onLanded: finishCast, landed, timing, colours })

  // Where each glyphling is drawn (a planned move shows it on its new hex); a change of spot glides there
  const spots = useMemo(
    () => game.glyphlings.map((g) => ({ id: g.id, hex: move?.glyphling === g.id ? move.to : g.hex })),
    [game.glyphlings, move],
  )
  useGlide(svgRef, spots, timing)

  // Glyphlings with 0–1 moves left (everyone's — it's on the board for all to see, and never shows Magic)
  const inDanger = useMemo(() => dangers(game), [game])
  // At the end: the Magic reveal's steps (the tangled glow and the +3s are drawn on top of everything)
  const reveal = useMemo(() => (game.phase === 'over' ? revealSteps(game) : []), [game])

  // ---- what's where, with the planned move and cast shown ----
  const seat = game.current
  const player = colours[colourOf(seat)]
  const moved = move && game.glyphlings.find((g) => g.id === move.glyphling)
  const plannedLetter = cast ? game.hands[seat][cast.seed] : null
  const highlight = flying ? null : highlightFor(game, move, selected)
  const lit = board.cells.filter((h) => highlight?.hexes.some((x) => hexKey(x) === hexKey(h)))
  const glow = highlight?.kind === 'cast' ? colours.castGlow : colours.moveGlow
  // Word indicators off: nothing shows which seeds make a word (players spot words themselves)
  const outlined = indicators && !flying ? uniqueHexes(preview?.words.flatMap((w) => w.hexes) ?? []) : []
  const grown = indicators && landed && game.lastTurn ? uniqueHexes(game.lastTurn.words.flatMap((w) => w.hexes)) : []
  const s = colours.pieceScale
  const at = (h: Hex) => hexToPixel(h, HEX)

  // A ring at the hex's own edge — outside the art's coloured frame, so it reads as a halo
  const ring = (h: Hex, colour: string, planned: boolean) => {
    const { x, y } = at(h)
    return (
      <g pointerEvents="none">
        <polygon points={hexCorners(x, y, HEX * 1.02)} fill="none" stroke={colour} strokeWidth={0.2} strokeOpacity={0.3} strokeLinejoin="round" />
        <polygon points={hexCorners(x, y, HEX * 1.02)} fill="none" stroke={colour} strokeWidth={0.09} strokeLinejoin="round" />
        {planned && <animate attributeName="opacity" values="1;0.3;1" dur={`${timing.pulseTime}s`} repeatCount="indefinite" />}
      </g>
    )
  }

  return (
    <svg ref={svgRef} className="game-garden" viewBox={`${view.minX} ${view.minY} ${view.w} ${view.h}`}
      preserveAspectRatio={sitOnTray ? 'xMidYMax meet' : 'xMidYMid meet'} role="img" aria-label="Garden">
      {board.cells.map((h) => {
        const { x, y } = at(h)
        return <polygon key={hexKey(h)} data-hex={hexKey(h)} points={hexCorners(x, y, HEX * 0.97)}
          fill={colours.hexFill} stroke={colours.hexLine} strokeWidth={colours.hexLineWidth} />
      })}

      {/* Made words: a white border under the seeds (so it frames the letters instead of covering them) */}
      <WordBorders planned={outlined} grown={grown} grownKey={landed?.count ?? 0} colours={colours} />

      {moved && (
        <image data-hex={hexKey(moved.hex)} href={glyphlingArt(moved.seat)} x={at(moved.hex).x - s} y={at(moved.hex).y - s}
          width={2 * s} height={2 * s} opacity={colours.ghostOpacity} />
      )}

      {/* Options sit above the ghost, so a hex you can cast back onto is still clearly lit */}
      {lit.map((h) => {
        const { x, y } = at(h)
        return (
          <g key={`lit-${hexKey(h)}`} data-option={highlight?.kind}>
            <polygon data-hex={hexKey(h)} points={hexCorners(x, y, HEX * 0.97)} fill={glow} opacity={colours.glowStrength} />
            <circle data-hex={hexKey(h)} cx={x} cy={y} r={0.18} fill={glow} />
          </g>
        )
      })}

      {Object.entries(game.seeds).map(([key, seed]) => {
        const [q, r] = key.split(',').map(Number)
        const { x, y } = at({ q, r })
        return <image key={key} className="game-seed" data-hex={key} data-seed={key} href={seedArt(seed.letter, seed.seat)}
          x={x - s} y={y - s} width={2 * s} height={2 * s} />
      })}

      {cast && plannedLetter && (
        <g data-planned-seed>
          <image data-hex={hexKey(cast.target)} href={seedArt(plannedLetter, seat)} x={at(cast.target).x - s} y={at(cast.target).y - s}
            width={2 * s} height={2 * s} opacity={colours.plannedSeedOpacity} />
          {ring(cast.target, player, true)}
        </g>
      )}

      {game.glyphlings.map((g, i) => {
        const hex = spots[i].hex
        const { x, y } = at(hex)
        const held = selected?.kind === 'glyphling' && selected.id === g.id
        const planned = move?.glyphling === g.id
        const danger = held || planned ? undefined : inDanger.get(g.id) // held/planned rings win over the danger cue
        return (
          <g key={g.id} data-glide={g.id}>
            <g data-hop={g.id} className="game-hop">
              <image data-glyph={g.id} data-hex={hexKey(hex)} href={glyphlingArt(g.seat)} x={x - s} y={y - s} width={2 * s} height={2 * s}
                opacity={danger === 'tangled' ? colours.tangledDim : 1} />
            </g>
            {held ? ring(hex, colours[colourOf(g.seat)], false) : planned && ring(hex, colours[colourOf(g.seat)], true)}
            {danger && <DangerCue danger={danger} x={x} y={y} hex={HEX} owner={colours[colourOf(g.seat)]} colours={colours} glyphling={g.id} />}
          </g>
        )
      })}

      {game.phase === 'over' && <RevealMarks game={game} steps={reveal} at={revealAt} colours={colours} timing={timing} />}

      {flight && (
        <g ref={seedRef} transform={`translate(${at(flight.from).x} ${at(flight.from).y})`} pointerEvents="none">
          <circle r={timing.seedSize * 1.8} fill={player} opacity={0.25} />
          <circle r={timing.seedSize} fill={player} />
          <circle r={timing.seedSize * 0.45} cx={-timing.seedSize * 0.25} cy={-timing.seedSize * 0.25} fill={colours.seedShine} opacity={0.6} />
        </g>
      )}
    </svg>
  )
}
