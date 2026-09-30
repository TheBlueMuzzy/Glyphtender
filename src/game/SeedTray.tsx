// THE SEED TRAY — the current player's seeds at REAL SIZE (as wide as a board hex, ≥ 44 px; see trayLayout.ts),
// drawn as one SVG so every size comes from content/tuning/layout.json and every colour from garden.json.
// Same piece-state look as the board: held = solid ring (lifted a little) · planned (aimed at the board) =
// an empty slot with a pulsing halo · waiting (move first) = dimmed. In refresh mode, set-aside seeds look held.
// During the draft it shows the glyphlings still waiting to be placed instead.
// Taps and drags are handled by usePieceInput (data-hand / data-tray-pos / data-draft).
import type { ReactNode } from 'react'
import { hexCorners } from '../engine/hex'
import { useGameStore } from '../store/gameStore'
import { colourOf, glyphlingArt, seedArt } from './art'
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
  const colours = useGardenTuning()
  const timing = useAnimTuning()
  const seat = game.current
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
  if (game.phase === 'draft') {
    // The glyphlings this player still has to place; the next one is "held"
    const placed = game.glyphlings.filter((g) => g.seat === seat).length
    tiles = Array.from({ length: 2 - placed }, (_, pos) => {
      const { x, y } = centre(pos)
      return (
        <g key={pos} data-draft={pos === 0 ? 'next' : undefined}>
          {slot(x, y)}
          <image href={glyphlingArt(seat)} x={x - art / 2} y={y - art / 2} width={art} height={art} opacity={pos === 0 ? 1 : 0.55} />
          {pos === 0 && ring(x, y, false)}
        </g>
      )
    })
  } else {
    const hand = game.hands[seat]
    const order = trayOrder[seat] ?? []
    const slots = Math.max(game.config.rules.handSize, order.length)
    tiles = Array.from({ length: slots }, (_, pos) => {
      const { x, y } = centre(pos)
      const index = order[pos]
      if (index === undefined || index >= hand.length) return <g key={`empty-${pos}`}>{slot(x, y)}</g>
      const aimed = cast?.seed === index // on the board, waiting for Cast
      if (aimed) return <g key={`hand-${index}`} data-hand={index} data-tray-pos={pos} opacity={0.8}>{slot(x, y)}{ring(x, y, true)}</g>
      const held = (selected?.kind === 'seed' && selected.index === index) || setAside.includes(index)
      const waiting = game.phase === 'play' && !move
      const lift = held ? -tile * 0.08 : 0
      return (
        <g key={`hand-${index}`} data-hand={index} data-tray-pos={pos} data-held={held || undefined}
          transform={`translate(0 ${lift})`} opacity={waiting ? 0.55 : 1}>
          {slot(x, y)}
          <image href={seedArt(hand[index], seat)} x={x - art / 2} y={y - art / 2} width={art} height={art} />
          {held && ring(x, y, false)}
        </g>
      )
    })
  }

  return (
    // (a little room above the top row, so a held seed can lift without being cut off)
    <svg className="game-tray" width={left * 2 + width} height={height + tile * 0.1} viewBox={`0 ${-tile * 0.1} ${left * 2 + width} ${height + tile * 0.1}`}
      role="group" aria-label="Seeds">
      {tiles}
    </svg>
  )
}
