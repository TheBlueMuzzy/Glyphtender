// DEV ONLY (never in a release build): window.__glyphtender, so the e2e check and the console can
// peek at the game and fast-forward it. playRest() plays random legal moves (the engine's sim player)
// until the garden tangles, to reach the end screen quickly. The jumps do nothing in an online game (the server owns it).
import { applyAction, previewTurn } from '../engine/engine'
import { hexKey } from '../engine/hex'
import { randomAction } from '../engine/sim'
import { useGameStore } from '../store/gameStore'
import { castOptions } from '../store/turnPlan'
import { addTurn } from '../store/stats'
import { dangers } from '../store/danger'
import { useOnline } from '../ui/online/session'
import type { GameState } from '../engine/types'

export function installDevHook() {
  const hook = {
    store: useGameStore,
    /** The online session (room code, the live room) — read-only use by the online e2e. */
    online: useOnline,
    /** For the planned move: a seed (hand index) and target hex that make Magic (or, with false, none). */
    findCast(wantMagic: boolean) {
      const { game, move, words } = useGameStore.getState()
      if (!game || !move || !words) return null
      for (let seed = 0; seed < game.hands[game.current].length; seed++) {
        for (const target of castOptions(game, move)) {
          const { magic } = previewTurn(game, { type: 'turn', glyphling: move.glyphling, to: move.to, seed, target }, words)
          if (magic > 0 === wantMagic) return { seed, hex: hexKey(target) }
        }
      }
      return null
    },
    /** Plays random legal actions until the game is over. */
    playRest(seed = 1) {
      return playUntil(seed, (state) => state.phase === 'over')
    },
    /** Plays random legal actions until some glyphling has only 1 move left, on a player's turn (for the danger cue). */
    playUntilDanger(seed = 1) {
      return playUntil(seed, (state) => state.phase === 'play' && [...dangers(state).values()].includes('warning'))
    },
  }
  ;(window as unknown as { __glyphtender: typeof hook }).__glyphtender = hook
}

/** Random legal actions (the engine's sim player) until done(state) or the game ends; the store jumps there. */
function playUntil(seed: number, done: (state: GameState) => boolean) {
  const { game, words, stats: before, online } = useGameStore.getState()
  if (!game || !words || online) return false
  let state = game
  let stats = before
  let rng = seed
  for (let i = 0; i < 5000 && state.phase !== 'over' && !done(state); i++) {
    const pick = randomAction(state, rng)
    rng = pick.rng
    state = applyAction(state, pick.action, words)
    if (pick.action.type === 'turn' && state.lastTurn) stats = addTurn(stats, state.lastTurn) // for the end table
  }
  useGameStore.getState().loadState(state, stats)
  return done(state)
}
