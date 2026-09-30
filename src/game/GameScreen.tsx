// THE GAME SCREEN — the layout shell: turn bar, board, seed tray and buttons.
// Layout by the SHAPE of the free space, not the device (TDD D04): taller than layout.stackedAspect →
// tray BELOW the board ("stacked"); otherwise tray BESIDE it ("side", taking sidePanelShare of the width).
// The board always fits its box; the tray is real size (trayLayout.ts).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { ActionBar } from './ActionBar'
import { wordListUrl } from './art'
import { Board } from './Board'
import { SeedTray } from './SeedTray'
import { TurnBar } from './TurnBar'
import { trayLayout } from './trayLayout'
import { usePieceInput } from './usePieceInput'
import { useAnimTuning, useGardenTuning, useLayoutTuning } from './useTuning'
import { screens } from '../ui/kit'
import './game.css'

export function GameScreen({ onPlayAgain }: { onPlayAgain: () => void }) {
  const game = useGameStore((s) => s.game)!
  const loadWords = useGameStore((s) => s.loadWords)
  const layout = useLayoutTuning()
  const timing = useAnimTuning()
  const colours = useGardenTuning()

  useEffect(() => { loadWords(wordListUrl()) }, [loadWords])

  // The free space (inside the padding), watched as the window changes
  const rootRef = useRef<HTMLDivElement>(null)
  const [space, setSpace] = useState({ width: 390, height: 844 })
  useLayoutEffect(() => {
    const root = rootRef.current!
    const measure = () => {
      const style = getComputedStyle(root)
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      setSpace({ width: root.clientWidth - padX, height: root.clientHeight - padY })
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

  const room = stacked ? space.width : Math.floor(space.width * layout.sidePanelShare)
  const slots = game.phase === 'draft' ? 2 : game.config.rules.handSize
  const tray = trayLayout({ room, hexPx, slots, tileMin: layout.trayTileMin, gap: layout.trayGap })

  // Taps and drags for board + tray; the dragged piece floats in its own layer on top
  const dragLayer = useRef<SVGSVGElement>(null)
  const dragImage = useRef<SVGImageElement>(null)
  const input = usePieceInput({ layer: dragLayer, image: dragImage }, layout, Math.max(tray.tile, hexPx) * 1.2)

  // When the garden tangles: let the last runeblossom grow, then show the results
  const over = game.phase === 'over'
  useEffect(() => {
    if (!over) return
    const wait = setTimeout(() => screens.push('gameOver'), (timing.growTime + timing.wordGlowTime) * 1000)
    return () => clearTimeout(wait)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over])

  return (
    <div ref={rootRef} className="game" data-layout={stacked ? 'stacked' : 'side'} data-phase={game.phase} {...input}>
      <header className="game-bar"><TurnBar /></header>
      <div className="game-board">
        <svg className="game-garden-back" aria-hidden="true"><rect width="100%" height="100%" fill={colours.background} /></svg>
        <Board onHexSize={onHexSize} sitOnTray={stacked} />
      </div>
      <section className="game-panel" aria-label="Seeds and actions">
        <SeedTray layout={tray} boxWidth={stacked ? tray.width : room} />
        <ActionBar onPlayAgain={onPlayAgain} />
      </section>
      <svg ref={dragLayer} className="game-drag-layer" aria-hidden="true">
        <image ref={dragImage} visibility="hidden" />
      </svg>
    </div>
  )
}
