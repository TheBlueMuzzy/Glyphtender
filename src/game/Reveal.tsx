// THE MAGIC REVEAL — plays when the garden tangles (the steps are in src/store/revealPlan.ts):
// after the last runeblossom has grown, the tangled glyphlings pulse, the "+3" tangle bonuses pop on the
// board hex by hex (RevealMarks.tsx), then each player's Magic counts up, lowest first, then the winner(s):
// "Grand Glyphtender!". Then the end table opens. Skip (in the button row) jumps to the end at any moment;
// with reduce motion on it starts at the end. Timings: content/tuning/anim.json (reveal…).
// This panel takes the tray's place: one kit PlayerChip per player — "Magic ?" until their turn to count,
// then the number counts up (the chip does that itself). Kit parts only: Grid, PlayerChip.
import { useEffect, useMemo } from 'react'
import text from '../../content/text/en.json'
import { useGameStore } from '../store/gameStore'
import { revealSteps, revealView, stepSeconds } from '../store/revealPlan'
import { Grid, PlayerChip, reduceMotion, screens } from '../ui/kit'
import { colourOf, glyphlingArt } from './art'
import { playerName } from './prompt'
import { useAnimTuning, useGardenTuning } from './useTuning'

const w = text.game.reveal

export function RevealPanel() {
  const game = useGameStore((s) => s.game)!
  const revealAt = useGameStore((s) => s.revealAt)
  const setRevealAt = useGameStore((s) => s.setRevealAt)
  const timing = useAnimTuning()
  const colours = useGardenTuning()
  const steps = useMemo(() => revealSteps(game), [game])
  const end = steps.length

  // Start once the last runeblossom has grown (reduce motion: straight to the end)
  useEffect(() => {
    if (revealAt !== null) return
    const quick = reduceMotion()
    const timer = setTimeout(() => setRevealAt(quick ? end : 0), quick ? 0 : (timing.growTime + timing.wordGlowTime) * 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealAt, end])

  // Each step waits its time, then the next one plays
  useEffect(() => {
    if (revealAt === null || revealAt >= end) return
    const timer = setTimeout(() => setRevealAt(revealAt + 1), stepSeconds(steps[revealAt], timing) * 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealAt, end])

  // Finished (or skipped): open the end table — once; closing it leaves the finished board to look at
  useEffect(() => {
    if (revealAt === end && !screens.current.includes('gameOver')) screens.push('gameOver')
  }, [revealAt, end])

  const view = revealView(steps, revealAt)
  const counting = view.current?.kind === 'count' ? view.current.seat : null
  return (
    <Grid gap="s" min="s" className="game-reveal" aria-label={w.label}>
      {game.magic.map((magic, seat) => {
        const shown = view.counted.includes(seat)
        const winner = view.announced && game.winners.includes(seat)
        return (
          <PlayerChip key={seat} size="s" name={playerName(seat)} avatar={glyphlingArt(seat)} color={colours[colourOf(seat)]}
            score={shown ? magic : undefined} scoreIcon="✦" detail={shown ? undefined : w.secret}
            badge={winner ? w.winnerBadge : undefined} active={counting === seat || winner} words={{ score: w.magic }} />
        )
      })}
    </Grid>
  )
}
