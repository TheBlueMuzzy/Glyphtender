// What the planned cast would grow: its words (outlined on the board) and the Magic for "Cast · +N".
// Only THIS move's Magic — running totals stay secret until the end (GDD §4.11).
import { useMemo } from 'react'
import { checkAction, previewTurn } from '../engine/engine'
import type { MadeWord } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { turnAction } from '../store/turnPlan'

export function usePreview(): { words: MadeWord[]; magic: number } | null {
  const game = useGameStore((s) => s.game)
  const move = useGameStore((s) => s.move)
  const cast = useGameStore((s) => s.cast)
  const words = useGameStore((s) => s.words)
  return useMemo(() => {
    if (!game || !move || !cast || !words) return null
    const action = turnAction(move, cast)
    if (action.type !== 'turn' || checkAction(game, action)) return null
    return previewTurn(game, action, words)
  }, [game, move, cast, words])
}
