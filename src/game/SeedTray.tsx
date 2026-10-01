// THE SEED TRAY — the current player's seeds at REAL SIZE (as wide as a board hex, ≥ 44 px; see trayLayout.ts),
// drawn as one SVG so every size comes from content/tuning/layout.json and every colour from garden.json.
// Same piece-state look as the board: held = solid ring (lifted a little) · planned (aimed at the board) =
// an empty slot with a pulsing halo · waiting (move first) = dimmed. In refresh mode, set-aside seeds look held.
// During the draft it shows the glyphlings still waiting to be placed instead. While the device is being
// passed on (handoff) it shows empty slots: nobody sees the next player's seeds until they tap.
// Online it always shows THIS device's seeds (dimmed while it's someone else's turn).
// REFRESH (B011, store/refreshFx.ts): the set-aside seeds shrink away one after another, then the new seeds grow
// into those slots (a small overshoot — feel.json refreshGrow); the store passes play on after. Web Animations
// on each slot's [data-refresh-slot] group, never React state per frame. Reduce motion → the store skips it.
// NO RE-SORT: a cast seed's place stays where it was — the drawn seed grows into it, or it stays empty (TRAY_GAP)
// until a refresh fills it; the other seeds never shift (Muzzy 2026-10-01; refreshFx.refillInPlace).
// Taps and drags are handled by usePieceInput (data-hand / data-tray-pos / data-draft).
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { hexCorners } from '../engine/hex'
import { useGameStore } from '../store/gameStore'
import { TRAY_GAP } from '../store/turnPlan'
import { reduceMotion } from '../ui/kit'
import { colourOf, glyphlingArt, seedArt } from './art'
import { juiceFor } from './feel'
import type { TrayLayout } from './trayLayout'
import { useAnimTuning, useGardenTuning } from './useTuning'

/** boxWidth: how wide the tray's box is (the side panel is wider than 4 seeds); the seeds sit in its middle. */
type Props = { layout: TrayLayout; boxWidth: number }

export function SeedTray({ layout, boxWidth }: Props) {
  const game = useGameStore((s) => s.game)!
  const move = useGameStore((s) => s.move)
  const cast = useGameStore((s) => s.cast)
  const selected = useGameStore((s) => s.selected)
  const setAside = useGameStore((s) => s.setAside)
  const trayOrder = useGameStore((s) => s.trayOrder)
  const hidden = useGameStore((s) => s.handoff !== null) // passing the device: the next player's seeds stay hidden
  const mySeat = useGameStore((s) => s.online?.mySeat ?? null)
  const refreshFx = useGameStore((s) => s.refreshFx)
  const colours = useGardenTuning()
  const timing = useAnimTuning()
  const svgRef = useRef<SVGSVGElement>(null)
  const seat = mySeat ?? game.current
  const refreshing = refreshFx?.seat === seat ? refreshFx : null
  const stage = refreshing?.stage

  // The refresh: shrink the set-aside seeds away (stage "out"), or grow the new ones in (stage "in"), slot after slot
  useLayoutEffect(() => {
    if (!stage || stage === 'gone' || reduceMotion()) return
    const pieces = svgRef.current?.querySelectorAll<SVGGElement>('[data-refresh-slot]') ?? [] // (left to right)
    const swell = 1 + juiceFor('refreshGrow').grow
    pieces.forEach((piece, i) => {
      const delay = i * timing.refreshStagger * 1000
      if (stage === 'out') {
        piece.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0)', opacity: 0 }],
          { duration: timing.refreshShrinkTime * 1000, delay, easing: 'ease-in', fill: 'forwards' })
      } else {
        piece.animate([{ transform: 'scale(0)' }, { transform: `scale(${swell})`, offset: 0.7 }, { transform: 'scale(1)' }],
          { duration: timing.refreshGrowTime * 1000, delay, easing: 'ease-out', fill: 'backwards' })
      }
    })
  }, [stage, timing])
  const myTurn = seat === game.current // online, the plan on the board may be another player's replay
  const player = colours[colourOf(seat)]
  const { tile, columns, width, height } = layout
  const gap = columns > 1 ? (width - columns * tile) / (columns - 1) : 0

  // Centre of slot number `pos`, left to right then the next row
  const left = Math.max(0, (boxWidth - width) / 2)
  const centre = (pos: number) => ({
    x: left + (pos % columns) * (tile + gap) + tile / 2,
    y: Math.floor(pos / columns) * (tile + gap) + tile / 2,
  })
  const art = tile * colours.pieceScale
  const slot = (x: number, y: number) => (
    <polygon points={hexCorners(x, y, tile / 2)} fill={colours.hexFill} stroke={colours.hexLine} strokeWidth={tile * colours.hexLineWidth / 2} />
  )
  const ring = (x: number, y: number, planned: boolean) => (
    <g pointerEvents="none">
      <polygon points={hexCorners(x, y, tile / 2)} fill="none" stroke={player} strokeWidth={tile * 0.1} strokeOpacity={0.3} strokeLinejoin="round" />
      <polygon points={hexCorners(x, y, tile / 2)} fill="none" stroke={player} strokeWidth={tile * 0.045} strokeLinejoin="round" />
      {planned && <animate attributeName="opacity" values="1;0.3;1" dur={`${timing.pulseTime}s`} repeatCount="indefinite" />}
    </g>
  )

  let tiles: ReactNode[]
  if (hidden) {
    tiles = Array.from({ length: game.config.rules.handSize }, (_, pos) => <g key={`hidden-${pos}`}>{slot(centre(pos).x, centre(pos).y)}</g>)
  } else if (game.phase === 'draft') {
    // The glyphlings this player still has to place; the next one is "held"
    const placed = game.glyphlings.filter((g) => g.seat === seat).length
    tiles = Array.from({ length: 2 - placed }, (_, pos) => {
      const { x, y } = centre(pos)
      return (
        <g key={pos} data-draft={pos === 0 ? 'next' : undefined}>
          {slot(x, y)}
          <image href={glyphlingArt(seat)} x={x - art / 2} y={y - art / 2} width={art} height={art} opacity={pos === 0 && myTurn ? 1 : 0.55} />
          {pos === 0 && myTurn && ring(x, y, false)}
        </g>
      )
    })
  } else {
    // (pass-and-play, while the new seeds grow in: the refreshed hand, before the game moves on to the next player)
    const hand = refreshing?.hand ?? game.hands[seat]
    const order = refreshing?.order ?? trayOrder[seat] ?? []
    const slots = Math.max(game.config.rules.handSize, order.length)
    tiles = Array.from({ length: slots }, (_, pos) => {
      const { x, y } = centre(pos)
      const index = order[pos]
      if (index === TRAY_GAP) return <g key={`empty-${pos}`} data-tray-pos={pos}>{slot(x, y)}</g> // a cast seed's place (a seed can be dropped into it)
      if (index === undefined || index >= hand.length) return <g key={`empty-${pos}`}>{slot(x, y)}</g>
      const aimed = myTurn && cast?.seed === index // on the board, waiting for Cast
      if (aimed) return <g key={`hand-${index}`} data-hand={index} data-tray-pos={pos} opacity={0.8}>{slot(x, y)}{ring(x, y, true)}</g>
      const inRefresh = (stage === 'in' ? refreshing?.newSlots : refreshing?.slots)?.includes(pos) ?? false // its seed going, or its new one coming
      if (inRefresh && stage === 'gone') return <g key={`empty-${pos}`}>{slot(x, y)}</g> // (online: waiting for the new seeds)
      const held = myTurn && ((selected?.kind === 'seed' && selected.index === index) || (stage !== 'in' && setAside.includes(index)))
      const waiting = !refreshing && (!myTurn || (game.phase === 'play' && !move))
      const lift = held ? -tile * 0.08 : 0
      const piece = <>
        <image href={seedArt(hand[index], seat)} x={x - art / 2} y={y - art / 2} width={art} height={art} />
        {held && ring(x, y, false)}
      </>
      return (
        <g key={`hand-${index}`} data-hand={index} data-tray-pos={pos} data-held={held || undefined}
          transform={`translate(0 ${lift})`} opacity={waiting ? 0.55 : 1}>
          {slot(x, y)}
          {inRefresh ? <g key={`refresh-${stage}`} data-refresh-slot={pos} className="game-refresh-slot">{piece}</g> : piece}
        </g>
      )
    })
  }

  return (
    // (a little room above the top row, so a held seed can lift without being cut off)
    <svg ref={svgRef} className="game-tray" data-refresh-stage={stage} width={left * 2 + width} height={height + tile * 0.1} viewBox={`0 ${-tile * 0.1} ${left * 2 + width} ${height + tile * 0.1}`}
      role="group" aria-label="Seeds">
      {tiles}
    </svg>
  )
}
