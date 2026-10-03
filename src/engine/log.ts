// THE GAME LOG — one entry per completed turn, plus how the game ended (types.ts → GameLog).
// endTurn (tangle.ts) adds the entry, so every way a turn can end (a cast, a move only, a refresh) is logged once.
// Pure: it reads the game and returns new data. The end screen works everything out from it (src/game/stats.ts).
// SECRET: totalsAfter and the words' Magic are the running scores everyone is guessing at — the online server
// sends an empty log until the game is over (party/views.ts).
import { getBoard } from './boards'
import { hexKey, neighbours } from './hex'
import { seedsFlownOver, turnMobility } from './insight'
import { occupancy } from './moves'
import type { GameLog, GameState, LogEnd, LogTangle, LogTurn, LogWord } from './types'

/** A log with nothing in it yet. */
export const emptyLog = (): GameLog => ({ turns: [], end: null })

/** The game's log; an empty one for games saved before the log existed. */
export const logOf = (state: GameState): GameLog => state.log ?? emptyLog()

/** Every completed turn is in the log. False for a game saved before the log existed — even one played on to
 *  the end, whose log only starts partway through (its early turns were never written down). */
export const logIsComplete = (state: GameState): boolean => (state.log?.turns.length ?? -1) >= state.turnCount

/** The words of the last turn, with each seed's letter and owner (read from the board they were made on). */
export function logWords(state: GameState): LogWord[] {
  const turn = state.lastTurn
  if (!turn) return []
  const bonus = state.config.rules.ownershipBonus
  const cast = turn.target ? hexKey(turn.target) : null
  return turn.words.map((w) => {
    const seeds = w.hexes.map((h) => state.seeds[hexKey(h)])
    const owners = seeds.map((s) => s?.seat ?? -1)
    const hexes = w.hexes.map(hexKey)
    return {
      word: w.word,
      letters: seeds.map((s) => s?.letter ?? '?'),
      owners,
      magic: w.magic,
      ownMagic: owners.filter((o) => o === turn.seat).length * bonus,
      hexes,
      at: hexes.indexOf(cast ?? ''),
    }
  })
}

/**
 * Who completed this glyphling's tangle (Muzzy, 2026-10-02): the one seat whose pieces fill EVERY hex next to it —
 * its seeds AND its glyphlings ("your glyphlings count as your tiles", like the tangle bonus); no other seat's piece;
 * the board's edge neither helps nor hurts. Never the owner (your own pieces round your own glyphling isn't a complete
 * tangle). null = nobody. Read on the board the moment it got tangled.
 */
export function completeTangler(state: GameState, glyphlingId: number): number | null {
  const g = state.glyphlings.find((x) => x.id === glyphlingId)
  if (!g) return null
  const taken = occupancy(state)
  const around = neighbours(getBoard(state.config.boardName), g.hex).map((h) => taken.get(hexKey(h)))
  const by = around[0]?.seat
  const complete = around.length > 0 && by !== undefined && by !== g.seat
    && around.every((who) => who !== undefined && who.seat === by)
  return complete ? by : null
}

/**
 * The entry for the turn that just finished. `state` is the game as endTurn gets it (the board after the cast,
 * Magic already added); `tangled` = the glyphlings tangled now; `refreshed` = seeds set aside (null = no refresh).
 */
export function logTurn(state: GameState, tangled: number[], refreshed: number | null): LogTurn | null {
  const turn = state.lastTurn
  if (!turn) return null
  const before = logOf(state).turns.at(-1)
  // A new round each time play comes back round to the same or an earlier seat (seat 0 always starts)
  const round = before ? (turn.seat <= before.seat ? before.round + 1 : before.round)
    : Math.floor(state.turnCount / state.config.players) + 1 // (a game saved before the log: a fair guess)
  const newlyTangled = tangled.filter((id) => !state.tangled.includes(id))
  return {
    turnNo: state.turnCount + 1,
    round,
    seat: turn.seat,
    glyphlingId: turn.glyphlingId,
    from: { ...turn.from },
    to: { ...turn.to },
    letter: turn.letter,
    target: turn.target ? { ...turn.target } : null,
    words: logWords(state),
    magic: turn.magic,
    refreshed: refreshed ?? 0,
    refresh: refreshed !== null,
    totalsAfter: [...state.magic],
    tangledAfter: [...tangled],
    newlyTangled,
    freed: state.tangled.filter((id) => !tangled.includes(id)),
    completeTangles: newlyTangled.map((id) => ({ glyphling: id, by: completeTangler(state, id) })),
    // The skill awards' facts (insight.ts)
    mobility: turnMobility(state, turn.glyphlingId, turn.from, turn.target),
    castOver: seedsFlownOver(state, turn.seat, turn.to, turn.target),
    blocked: state.pendingLog?.blocked ?? null,
  }
}

/** How the game ended: who ended it, whether they tangled their own glyphling, and every tangle's bonus. */
export function logEnd(state: GameState, last: LogTurn, tangles: LogTangle[], tangleMagic: number[], totals: number[]): LogEnd {
  const ownerOf = (id: number) => state.glyphlings.find((g) => g.id === id)?.seat ?? -1
  return {
    endedOnTurn: last.turnNo,
    endedBy: last.seat,
    selfTangle: last.newlyTangled.some((id) => ownerOf(id) === last.seat),
    tangles,
    tangleMagic: [...tangleMagic],
    totals: [...totals],
  }
}
