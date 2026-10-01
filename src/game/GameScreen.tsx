// THE GAME SCREEN — the layout shell: top bar (portrait + Menu), board, and the panel: prompt, seed tray, buttons.
// Layout by the SHAPE of the free space, not the device (TDD D04): taller than layout.stackedAspect →
// tray BELOW the board ("stacked"); otherwise tray BESIDE it, on the right ("side", sidePanelShare of the width).
// Settings → Gameplay → Tray position "Flipped" puts it on the other side: above the board / on its left.
// The board always fits its box and hugs the tray's side of it, so board and tray sit close.
// A margin all round (layout.json edgeMargin, margins.ts); beside the board the spare width is shared so
// edge | board | tray | edge look even, and the turn bar lines up with the tray.
// The tray is real size (trayLayout.ts); the buttons are about a board hex tall (finger-sized, ≥ 44 px).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import text from '../../content/text/en.json'
import { getBoard } from '../engine/boards'
import { useGameStore } from '../store/gameStore'
import { revealSteps } from '../store/revealPlan'
import { toast, useScreens } from '../ui/kit'
import { useGameSettings } from '../ui/gameSettings'
import { leaveToMenu } from '../ui/newGame'
import { ActionBar } from './ActionBar'
import { wordListUrl } from './art'
import { Board } from './Board'
import { boardView } from './boardPlace'
import { EndBar } from './EndBar'
import { Handoff } from './Handoff'
import { edgeMargin, promptHangRoom, sideGaps } from './margins'
import { RevealPanel } from './Reveal'
import { PromptLine } from './PromptLine'
import { SeedTray } from './SeedTray'
import { TurnBar } from './TurnBar'
import { trayLayout } from './trayLayout'
import { useNopeShake } from './useNopeShake'
import { usePieceInput } from './usePieceInput'
import { useGardenTuning, useLayoutTuning } from './useTuning'
import './game.css'

const HEX_HEIGHT = Math.sqrt(3) / 2 // a flat-top hex is this much as tall as it is wide
const BIG_HEX = 64 // board hexes this wide (px) or more = a roomy screen: the prompt's words go up a size

export function GameScreen({ onNewGame }: { onNewGame: () => void }) {
  const game = useGameStore((s) => s.game)!
  const loadWords = useGameStore((s) => s.loadWords)
  const wordsStatus = useGameStore((s) => s.wordsStatus)
  const layout = useLayoutTuning()
  const colours = useGardenTuning()

  useEffect(() => { loadWords(wordListUrl()) }, [loadWords])
  // Couldn't load the words (a first visit on a bad connection): say so — the Cast button becomes Retry
  useEffect(() => {
    if (wordsStatus === 'failed') toast(text.game.notes.wordsFailed, { variant: 'danger', dismissible: true })
  }, [wordsStatus])

  // The free space (inside the padding — the phone's safe area), watched as the window changes; and the grid's gap
  const rootRef = useRef<HTMLDivElement>(null)
  const [space, setSpace] = useState({ width: 390, height: 844, gap: 8 })
  useLayoutEffect(() => {
    const root = rootRef.current!
    const measure = () => {
      const style = getComputedStyle(root)
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      const gap = parseFloat(style.columnGap) || 0
      setSpace((old) => {
        const next = { width: root.clientWidth - padX, height: root.clientHeight - padY, gap }
        return old.width === next.width && old.height === next.height && old.gap === next.gap ? old : next
      })
    }
    measure()
    const watcher = new ResizeObserver(measure)
    watcher.observe(root)
    return () => watcher.disconnect()
  }, [])
  const stacked = space.height / space.width >= layout.stackedAspect

  // How wide a board hex is on screen. Small wobbles are ignored, so board and tray settle instead of
  // nudging each other back and forth (a bigger tray makes the board a little smaller, and so on).
  const [hexPx, setHexPx] = useState(0)
  const onHexSize = useCallback((px: number) => setHexPx((old) => (Math.abs(px - old) >= 2 ? Math.round(px) : old)), [])

  const flipped = useGameSettings((s) => s.trayFlipped)
  // The margin round the edges (margins.ts; layout.json edgeMargin / edgeMarginShare)
  const edge = edgeMargin(space.width, space.height, layout.edgeMargin, layout.edgeMarginShare)
  const room = stacked ? space.width - 2 * edge : Math.floor(space.width * layout.sidePanelShare)
  const slots = game.phase === 'draft' ? 2 : game.config.rules.handSize
  const tray = trayLayout({ room, hexPx, slots, tileMin: layout.trayTileMin, gap: layout.trayGap })
  // The side column keeps ONE width all game (draft, turns, handoff, reveal, end): its share of the screen,
  // or a full tray if that's wider. The ruler below holds it open, so whatever sits in the tray's place
  // (the reveal's narrow chips) can't shrink it and push the turn bar's words off the screen.
  const fullTray = trayLayout({ room, hexPx, slots: game.config.rules.handSize, tileMin: layout.trayTileMin, gap: layout.trayGap })
  const column = Math.max(room, fullTray.width)

  // The empty rulers that make the margins (game.css places them round the edge; each sits next to a grid gap,
  // so it's that much shorter). Beside the board, the spare width is shared so edge | board | tray | edge look even.
  const boardBox = useMemo(() => boardView(getBoard(game.config.boardName).cells, layout.boardMargin), [game.config.boardName, layout.boardMargin])
  const margin = Math.max(0, edge - space.gap)
  const sideInput = {
    width: space.width, height: space.height, edge, gap: space.gap, column, content: fullTray.width,
    aspect: boardBox.w / boardBox.h, insetShare: layout.boardMargin / boardBox.w,
  }
  const side = sideGaps(sideInput)
  // Beside the board, the prompt's glyphling may hang out into the gap left of the column (the words keep its width)
  const hangRoom = stacked ? 0 : promptHangRoom(sideInput)
  const rulers = stacked
    ? { left: margin, right: margin, middle: 0 }
    : flipped ? { left: side.column, right: side.board, middle: side.middle } : { left: side.board, right: side.column, middle: side.middle }

  // Taps and drags for board + tray; the dragged piece floats in its own layer on top
  const dragLayer = useRef<SVGSVGElement>(null)
  const dragImage = useRef<SVGImageElement>(null)
  const input = usePieceInput({ layer: dragLayer, image: dragImage }, layout, Math.max(tray.tile, hexPx) * 1.2)
  useNopeShake() // a tapped piece that can't be touched shakes "no"

  // When the garden tangles, the Magic reveal takes the tray's place (Reveal.tsx) and then opens the end table.
  // Once it's done, the finished garden (behind the end screen, or after See board) has the end bar at the bottom
  // instead of the buttons: ☰ · See results · New game, in the SAME spot as the end screen's (EndBar.tsx).
  const over = game.phase === 'over'
  const revealAt = useGameStore((s) => s.revealAt)
  const ended = over && revealAt !== null && revealAt >= revealSteps(game).length
  const showingResults = useScreens().includes('gameOver') // (the end screen has its own end bar)

  const traySide = stacked ? (flipped ? 'top' : 'bottom') : flipped ? 'left' : 'right'
  // Buttons as tall as a board hex (its flat-to-flat height), never below the finger-size floor
  const buttonPx = Math.max(layout.trayTileMin, Math.round(hexPx * HEX_HEIGHT))

  return (
    <>
    <div ref={rootRef} className="game" data-layout={stacked ? 'stacked' : 'side'} data-flipped={flipped || undefined} data-phase={game.phase} data-ended={ended || undefined} {...input}>
      <header className="game-bar">
        {/* beside the board: the portrait and ☰ line up with the tray's edges (a ruler as wide as the tray) */}
        {!stacked && <svg className="game-bar-ruler" width={fullTray.width} height={0} aria-hidden="true" />}
        <TurnBar />
      </header>
      <div className="game-board">
        <svg className="game-garden-back" aria-hidden="true"><rect width="100%" height="100%" fill={colours.background} /></svg>
        <Board onHexSize={onHexSize} traySide={traySide} />
      </div>
      <section className="game-panel" aria-label="Seeds and actions">
        <PromptLine big={hexPx >= BIG_HEX} fixed={stacked && !ended} hangRoom={hangRoom} />
        {over ? <RevealPanel compact={!stacked && hexPx < BIG_HEX} big={hexPx >= BIG_HEX} /> : <SeedTray layout={tray} boxWidth={stacked ? tray.width : column} />}
        {!ended && <ActionBar size={buttonPx} fixed={stacked} />}
      </section>
      {/* The game is over: the end bar along the bottom (EndBar.tsx — the same spot as the end screen's) */}
      {ended && !showingResults && <EndBar view="board" onMenu={leaveToMenu} onNewGame={onNewGame} />}
      {/* Tray below/above the board: room between the board and the prompt (B012 — layout.json promptGap) */}
      {stacked && <svg className="game-prompt-gap" width={0} height={layout.promptGap} aria-hidden="true" />}
      {/* Room under the whole game, clear of the phone's home/back gesture zone (B014 — layout.json bottomRoom) */}
      <svg className="game-foot" width={0} height={layout.bottomRoom} aria-hidden="true" />
      {/* an empty SVG as wide as the side column (sizes are SVG attributes — TDD D13) */}
      {!stacked && <svg className="game-column-ruler" width={column} height={0} aria-hidden="true" />}
      {/* The margins round the edge (layout.json edgeMargin) — beside the board, the even gaps too (margins.ts) */}
      <svg className="game-edge" data-edge="top" width={0} height={margin} aria-hidden="true" />
      <svg className="game-edge" data-edge="bottom" width={0} height={margin} aria-hidden="true" />
      <svg className="game-edge" data-edge="left" width={rulers.left} height={0} aria-hidden="true" />
      <svg className="game-edge" data-edge="right" width={rulers.right} height={0} aria-hidden="true" />
      {!stacked && <svg className="game-edge" data-edge="middle" width={rulers.middle} height={0} aria-hidden="true" />}
      <svg ref={dragLayer} className="game-drag-layer" aria-hidden="true">
        <image ref={dragImage} visibility="hidden" opacity={0.85} />
      </svg>
    </div>
    <Handoff stacked={stacked} flipped={flipped} />
    </>
  )
}
