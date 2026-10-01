// DEV ONLY (never in a release build): window.__glyphtender, so the e2e check and the console can
// peek at the game and fast-forward it. playRest() plays random legal moves (the engine's sim player)
// until the garden tangles, to reach the end screen quickly. The jumps do nothing in an online game (the server owns it).
import { applyAction, legalCasts, legalMoves, previewTurn } from '../engine/engine'
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
    /** Word spotlight e2e: plays random legal actions until the player to move can grow exactly `count` words with one
     *  cast, jumps the store there, and returns that turn (glyphling, move-to hex, hand index, target hex, the words) — or null. */
    findWordsTurn(count: number, seed = 1) {
      const { game, words, stats, online } = useGameStore.getState()
      if (!game || !words || online) return null
      let state = game
      let rng = seed
      for (let i = 0; i < 400 && state.phase !== 'over'; i++) {
        if (state.phase === 'play' && state.turnCount >= 6) {
          for (const g of state.glyphlings.filter((x) => x.seat === state.current && !state.tangled.includes(x.id))) {
            for (const to of legalMoves(state, g.id)) {
              for (const target of legalCasts(state, g.id, to)) {
                for (let hand = 0; hand < state.hands[state.current].length; hand++) {
                  const turn = { type: 'turn' as const, glyphling: g.id, to, seed: hand, target }
                  const made = previewTurn(state, turn, words).words
                  if (made.length !== count) continue
                  useGameStore.getState().loadState(state, stats)
                  return {
                    glyphling: g.id, to: hexKey(to), seed: hand, target: hexKey(target),
                    words: made.map((w) => ({ word: w.word, magic: w.magic, hexes: w.hexes.map(hexKey) })),
                  }
                }
              }
            }
          }
        }
        const pick = randomAction(state, rng)
        rng = pick.rng
        state = applyAction(state, pick.action, words)
      }
      return null
    },
    /** Plays random legal actions until the game is over. */
    playRest(seed = 1) {
      return playUntil(seed, (state) => state.phase === 'over')
    },
    /** Plays random legal actions until some glyphling has only 1 move left, on a player's turn (for the danger cue).
     *  If the garden tangles first, the game is left as it was (false) — try another seed. */
    playUntilDanger(seed = 1) {
      return playUntil(seed, (state) => state.phase === 'play' && [...dangers(state).values()].includes('warning'), true)
    },
  }
  ;(window as unknown as { __glyphtender: typeof hook }).__glyphtender = hook
}

/** Random legal actions (the engine's sim player) until done(state) or the game ends; the store jumps there
 *  (onlyIfDone: unless it never got there — then nothing changes). */
function playUntil(seed: number, done: (state: GameState) => boolean, onlyIfDone = false) {
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
  if (onlyIfDone && !done(state)) return false
  useGameStore.getState().loadState(state, stats)
  return done(state)
}
