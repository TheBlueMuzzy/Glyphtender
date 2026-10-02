// THE BOARD — the night garden as one SVG that always fits its box. Taps and drops find pieces by
// data-hex (hexKey) and data-glyph (glyphling id); usePieceInput turns them into store actions.
//
// PIECE STATES — one look for every piece (GDD §4 "Piece states"):
//   options  — hexes you could pick, in the CURRENT PLAYER's colour: a soft filled hex + dot. Move there = the
//              player's colour · cast there = the same template in a lighter shade of it (garden.json castShade)
//   held     — the piece you're holding: solid ring in the player's colour
//   planned  — moved/targeted but not cast yet: pulsing halo at the hex edge (a targeted seed also gets a solid
//              "not planted yet" look — garden.json plannedSeedLook, PlannedSeedLook.tsx)
//   done     — plain piece
//   drop here — while dragging, the legal hex under the piece: a brighter, filled option (dropTarget.ts)
// WORDS (word indicators on): a white border behind the seeds — planned while aiming (2+ words → the word spotlight:
// one word lit at a time, looping, with a "QUA +4" label — F25). After the cast lands the words SCORE one at a time in
// that order (ScorePops.tsx: outline + "QUA", seed pops fly to the glyphling's growing total), then all of it fades.
// MOVES glide from hex to hex (useGlide.ts) — a planned move, Undo, and moves made anywhere else.
// TURN TRAILS (TurnTrail.tsx, trail.ts), in the player's colour, under the pieces: the plan (dotted move path) and
// another player's replayed turn (draws on before the glide). No cast arc; gone once the seed lands.
// DANGER CUES (DangerCue.tsx): 1 move left = dashed thorny ring in the owner's colour · tangled = a vine wraps it
// Colours: content/tuning/garden.json · timings: anim.json · margin: layout.json.
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { getBoard } from '../engine/boards'
import { hexCorners, hexKey, hexToPixel, type Hex } from '../engine/hex'
import { useGameStore } from '../store/gameStore'
import { boardHighlight } from '../store/turnPlan'
import { dangers } from '../store/danger'
import { revealSteps } from '../store/revealPlan'
import { colourOf, glyphlingArt, seedArt } from './art'
import { boardShift, boardView, type TraySide } from './boardPlace'
import { castColour } from './castShade'
import { DangerCue } from './DangerCue'
import { PLANNED_FILTER_ID } from './plannedLook'
import { PlannedSeedFilter } from './PlannedSeedLook'
import { RevealMarks } from './RevealMarks'
import { useGlide } from './useGlide'
import { useTurnPulse } from './useTurnPulse'
import { pulsingGlyphlings } from '../store/turnPulse'
import { ScorePops } from './ScorePops'
import { WordBorders, WordLabels, type SpotWord } from './WordBorders'
import { useWordSpotlight } from './useWordSpotlight'
import { TurnTrail } from './TurnTrail'
import { boardTrail, trailKey as trailKeyOf } from '../store/trail'
import { usePreview } from './usePreview'
import { HEX, useThrow } from './useThrow'
import { useAnimTuning, useGardenTuning, useLayoutTuning } from './useTuning'

const NO_WORDS: SpotWord[] = []

type Props = {
  /** Reports how wide one hex is on screen (pixels), so the tray can match it. */
  onHexSize: (px: number) => void
  /** Which side of the board's box the tray is on — the board sits close to it (boardPlace.ts). */
  traySide?: TraySide
}

export function Board({ onHexSize, traySide = 'bottom' }: Props) {
  const game = useGameStore((s) => s.game)!
  const move = useGameStore((s) => s.move)
  const cast = useGameStore((s) => s.cast)
  const selected = useGameStore((s) => s.selected)
  const flying = useGameStore((s) => s.flying)
  const landed = useGameStore((s) => s.landed)
  const revealAt = useGameStore((s) => s.revealAt)
  const seats = useGameStore((s) => s.seats)
  const waiting = useGameStore((s) => s.waiting)
  const indicators = useGameStore((s) => s.options?.wordIndicators ?? true)
  const replayTrail = useGameStore((s) => s.trail)
  const finishCast = useGameStore((s) => s.finishCast)
  const colours = useGardenTuning()
  const timing = useAnimTuning()
  const { boardMargin } = useLayoutTuning()
  const preview = usePreview()
  const board = getBoard(game.config.boardName)
  const svgRef = useRef<SVGSVGElement>(null)
  const seedRef = useRef<SVGGElement>(null)

  // The board's own area, plus a margin, as the SVG viewBox
  const view = useMemo(() => boardView(board.cells, boardMargin), [board, boardMargin])

  // Measure the on-screen hex width whenever the board's box changes size, and move the board toward the tray
  // (the viewBox slides the other way; the box's spare room shows the board there)
  const [shift, setShift] = useState({ x: 0, y: 0 })
  const [pxPerHex, setPxPerHex] = useState(40) // screen pixels per board unit (hex size), for text that must stay readable
  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const measure = () => {
      const r = svg.getBoundingClientRect()
      const scale = Math.min(r.width / view.w, r.height / view.h)
      if (!(scale > 0)) return
      onHexSize(2 * HEX * scale)
      setPxPerHex(scale)
      setShift(boardShift(traySide, r.width / scale - view.w, r.height / scale - view.h))
    }
    measure()
    const watcher = new ResizeObserver(measure)
    watcher.observe(svg)
    return () => watcher.disconnect()
  }, [view, onHexSize, traySide])

  const flight = useMemo(
    () => (flying && move && cast ? { glyphling: move.glyphling, from: move.to, to: cast.target } : null),
    [flying, move, cast],
  )
  useThrow({ svgRef, seedRef, flight, onLanded: finishCast, landed, timing })

  // Where each glyphling is drawn (a planned move shows it on its new hex); a change of spot glides there
  const spots = useMemo(
    () => game.glyphlings.map((g) => ({ id: g.id, hex: move?.glyphling === g.id ? move.to : g.hex })),
    [game.glyphlings, move],
  )
  useGlide(svgRef, spots, timing)

  // Whose turn: their movable glyphlings pulse gently until a move is planned
  const pulsing = useGameStore(useShallow(pulsingGlyphlings))
  useTurnPulse(svgRef, pulsing, timing)

  // Glyphlings with 0–1 moves left (everyone's — it's on the board for all to see, and never shows Magic)
  const inDanger = useMemo(() => dangers(game), [game])
  // At the end: the Magic reveal's steps (the tangled glow and the +3s are drawn on top of everything)
  const reveal = useMemo(() => (game.phase === 'over' ? revealSteps(game) : []), [game])

  // ---- what's where, with the planned move and cast shown ----
  const seat = game.current
  const player = colours[colourOf(seat)]
  const castTint = castColour(player, colours.background, colours.castShade) // the cast options: the same template, another shade
  const moved = move && game.glyphlings.find((g) => g.id === move.glyphling)
  const plannedLetter = cast ? game.hands[seat][cast.seed] : null
  const highlight = boardHighlight({ game, move, selected, flying, waiting, seats })
  const lit = board.cells.filter((h) => highlight?.hexes.some((x) => hexKey(x) === hexKey(h)))
  // Word indicators off: nothing shows which seeds make a word (players spot words themselves)
  const planned: SpotWord[] = indicators && !flying ? preview?.words ?? NO_WORDS : NO_WORDS
  // The score pops belong to the seed that just landed (its turn grew words)
  const turn = game.lastTurn
  const pops = indicators && landed && turn?.target && hexKey(turn.target) === landed.key && turn.words.length > 0 ? turn : null
  // The words it grew score one at a time, then fade with the final total (ScorePops plays them; they start and end dark,
  // so nothing from this turn is left once the next one starts — the store's `scoring` holds the next turn till then)
  const grown: SpotWord[] = pops ? pops.words : NO_WORDS
  // The turn trail: a replayed turn (live) or my plan — trail.ts
  const shownTrail = useMemo(() => boardTrail({ game, trail: replayTrail, move, cast }), [game, replayTrail, move, cast])
  useWordSpotlight(svgRef, 'planned', planned, 0, 1, timing, colours.spotlightLabel)
  const s = colours.pieceScale
  // Where a word's label may go: off every piece (seeds, glyphlings where they're drawn, the aimed seed), inside the board's box
  const taken = useMemo(() => [
    ...Object.keys(game.seeds).map((k) => { const [q, r] = k.split(',').map(Number); return { q, r } }),
    ...spots.map((p) => p.hex),
    ...(cast ? [cast.target] : []),
  ], [game.seeds, spots, cast])
  const labelBox = useMemo(() => ({ minX: view.minX - shift.x, minY: view.minY - shift.y, w: view.w, h: view.h }), [view, shift])
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
    <svg ref={svgRef} className="game-garden" viewBox={`${view.minX - shift.x} ${view.minY - shift.y} ${view.w} ${view.h}`}
      preserveAspectRatio="xMidYMid meet" role="img" aria-label="Garden">
      <defs><PlannedSeedFilter colours={colours} /></defs>
      {board.cells.map((h) => {
        const { x, y } = at(h)
        return <polygon key={hexKey(h)} data-hex={hexKey(h)} points={hexCorners(x, y, HEX * 0.97)}
          fill={colours.hexFill} stroke={colours.hexLine} strokeWidth={colours.hexLineWidth} />
      })}

      {/* Made words: a white border under the seeds (so it frames the letters instead of covering them) */}
      <WordBorders planned={planned} grown={grown} grownKey={landed?.count ?? 0} colours={colours} />

      {moved && (
        <image data-hex={hexKey(moved.hex)} href={glyphlingArt(moved.seat)} x={at(moved.hex).x - s} y={at(moved.hex).y - s}
          width={2 * s} height={2 * s} opacity={colours.ghostOpacity} />
      )}

      {/* Options sit above the ghost, so a hex you can cast back onto is still clearly lit */}
      {/* One template — soft filled hex + dot: move = the player's colour, cast = a lighter shade of it (castShade) */}
      {lit.map((h) => {
        const { x, y } = at(h)
        const cast = highlight?.kind === 'cast'
        return (
          <g key={`lit-${hexKey(h)}`} data-option={highlight?.kind}>
            <polygon data-hex={hexKey(h)} points={hexCorners(x, y, HEX * 0.97)} fill={cast ? castTint : player}
              opacity={cast ? colours.castFill : colours.glowStrength} />
            <circle data-hex={hexKey(h)} cx={x} cy={y} r={0.18} fill={cast ? castTint : player} />
          </g>
        )
      })}

      {/* "Drop here" marks, one per option kind, hidden until a drag is over a legal hex (dropTarget.ts moves them).
          The hex fills bright AND a glow ring spills past its edge, so it still shows round the piece floating over it. */}
      {(['move', 'cast'] as const).map((kind) => {
        const colour = kind === 'cast' ? castTint : player
        return (
          <g key={`drop-${kind}`} data-drop-target={kind} visibility="hidden" pointerEvents="none">
            <polygon points={hexCorners(0, 0, HEX * 1.16)} fill="none" stroke={colour} strokeWidth={0.26} strokeOpacity={colours.dropStrength} strokeLinejoin="round" />
            <polygon points={hexCorners(0, 0, HEX * 0.97)} fill={colour} opacity={colours.dropStrength} />
          </g>
        )
      })}

      {/* The turn trail — under the seeds and glyphlings, so it never covers a letter */}
      {shownTrail && <TurnTrail key={trailKeyOf(shownTrail.trail)} trail={shownTrail.trail} mode={shownTrail.mode} colours={colours} timing={timing} />}

      {Object.entries(game.seeds).map(([key, seed]) => {
        const [q, r] = key.split(',').map(Number)
        const { x, y } = at({ q, r })
        return <image key={key} className="game-seed" data-hex={key} data-seed={key} href={seedArt(seed.letter, seed.seat)}
          x={x - s} y={y - s} width={2 * s} height={2 * s} />
      })}

      {cast && plannedLetter && (
        <g data-planned-seed>
          <image data-hex={hexKey(cast.target)} href={seedArt(plannedLetter, seat)} x={at(cast.target).x - s} y={at(cast.target).y - s}
            width={2 * s} height={2 * s} filter={`url(#${PLANNED_FILTER_ID})`} />
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
            <g data-shake={g.id}>
              <g data-pulse={g.id} className="game-pulse">
                <g data-hop={g.id} className="game-hop">
                  <image data-glyph={g.id} data-hex={hexKey(hex)} href={glyphlingArt(g.seat)} x={x - s} y={y - s} width={2 * s} height={2 * s}
                    opacity={danger === 'tangled' ? colours.tangledDim : 1} />
                </g>
              </g>
              {held ? ring(hex, colours[colourOf(g.seat)], false) : planned && ring(hex, colours[colourOf(g.seat)], true)}
              {danger && <DangerCue danger={danger} x={x} y={y} hex={HEX} owner={colours[colourOf(g.seat)]} colours={colours} glyphling={g.id} />}
            </g>
          </g>
        )
      })}

      {/* The lit word's label ("QUA +4") — above the pieces, on a spot that covers no letters */}
      <WordLabels planned={planned} grown={grown} grownKey={landed?.count ?? 0} colours={colours} pxPerHex={pxPerHex}
        taken={taken} view={labelBox} />

      {pops && <ScorePops key={`pops-${landed?.count}`} game={game} turn={pops} colours={colours} timing={timing} pxPerHex={pxPerHex} view={labelBox} />}

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
