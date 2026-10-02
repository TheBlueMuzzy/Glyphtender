// THE MAGIC REVEAL — plays when the garden tangles (the steps are in src/store/revealPlan.ts):
// after the last runeblossom has grown, the tangled glyphlings pulse, the "+3" tangle bonuses pop on the
// board hex by hex (RevealMarks.tsx), then each player's Magic counts up, lowest first, then the winner(s):
// "Grand Glyphtender!". Then the end table opens. Skip (in the button row) jumps to the end at any moment;
// with reduce motion on it starts at the end. Timings: content/tuning/anim.json (reveal…).
// This panel takes the tray's place: one kit PlayerChip per player — "Magic ?" until their turn to count,
// then the number counts up (the chip does that itself) with its tangle Magic beside the name. The chips sit in one
// tidy centred column, all as wide as the widest (game.css .game-reveal) — calm, not spread to the corners (Muzzy at
// 768×343: "this layout looks weird"). After the reveal the same chips stay with the finished garden (See board).
// Kit parts only: PlayerChip.
import { useEffect, useMemo } from 'react'
import text from '../../content/text/en.json'
import { useGameStore } from '../store/gameStore'
import { revealSteps, revealView, stepSeconds } from '../store/revealPlan'
import { landingSeconds } from '../store/wordMarks'
import { PlayerChip, fill, reduceMotion, screens } from '../ui/kit'
import { colourOf, glyphlingArt } from './art'
import { playerName } from './prompt'
import { useAnimTuning, useGardenTuning } from './useTuning'

const w = text.game.reveal

/** One-line chips, one chip per line (the wide tiles keep them from sitting side by side: a chip never shrinks,
 *  so two in a row on a phone ran into each other — "Yellow ★ ✦ 44" over Blue's chip, B016).
 *  compact: the side column — no tangle Magic beside the name (too narrow).
 *  big: a roomy screen (big board hexes, e.g. a desktop) — the chips a size up, so they match the big board. */
export function RevealPanel({ compact, big }: { compact: boolean; big: boolean }) {
  const game = useGameStore((s) => s.game)!
  const revealAt = useGameStore((s) => s.revealAt)
  const setRevealAt = useGameStore((s) => s.setRevealAt)
  const timing = useAnimTuning()
  const colours = useGardenTuning()
  const steps = useMemo(() => revealSteps(game), [game])
  const end = steps.length

  // Start once the last cast's score sequence has faded (the store's `scoring`) — or, if it scored nothing, once its
  // runeblossom has grown (reduce motion: then straight to the end)
  const pops = useGameStore((s) => s.options?.wordIndicators ?? true)
  const scoring = useGameStore((s) => s.scoring !== null)
  useEffect(() => {
    if (revealAt !== null || scoring) return
    const quick = reduceMotion()
    const scored = pops && (game.lastTurn?.words.length ?? 0) > 0 // (its sequence outlasts the sprout)
    const timer = setTimeout(() => setRevealAt(quick ? end : 0), quick || scored ? 0 : landingSeconds(game, false, timing) * 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealAt, end, scoring])

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
    <div className="game-reveal" role="group" aria-label={w.label}>
      {game.magic.map((magic, seat) => {
        const shown = view.counted.includes(seat)
        const winner = view.announced && game.winners.includes(seat)
        return (
          <PlayerChip key={seat} size={big ? 's' : 'xs'} name={playerName(seat)} avatar={glyphlingArt(seat)} color={colours[colourOf(seat)]}
            score={shown ? magic : undefined} scoreIcon="✦"
            detail={!shown ? w.secret : compact ? undefined : fill(w.tangleDetail, { n: game.tangleMagic[seat] })}
            badge={winner ? w.winnerBadge : undefined} active={counting === seat || winner} words={{ score: w.magic }} />
        )
      })}
    </div>
  )
}
