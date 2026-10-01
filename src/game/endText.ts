// THE END SCREEN'S SENTENCES — awards and chart captions, filled in from content/text/en.json → game.gameOver.
// Pure (names come in as a function), so it's tested without a screen.
import text from '../../content/text/en.json'
import { logOf } from '../engine/log'
import type { GameState, LogTurn } from '../engine/types'
import { fill } from '../ui/kit/blocks/words'
import type { Award, ChartMarker } from './stats'

const w = text.game.gameOver
type Name = (seat: number) => string

/** "Biggest turn" + "+14 Magic in one cast: GARDEN + DEN". */
export function awardText(award: Award, name: Name): { title: string; reason: string } {
  const words = w.awards[award.id]
  const values = Object.fromEntries(Object.entries(award.values).map(([k, v]) => [k, typeof v === 'boolean' ? String(v) : v]))
  if (typeof award.values.other === 'number') values.other = name(award.values.other)
  let reason = words.reason
  if (award.id === 'deciding' && award.values.tangles === true) reason = w.awards.deciding.reasonTangles
  if (award.id === 'braveKnot' && award.values.won === true) reason = w.awards.braveKnot.reasonWon
  return { title: words.title, reason: fill(reason, values) }
}

/** What happened on one turn: "Round 7 · Blue cast N: GARDEN + DEN, +14". */
export function turnCaption(turn: LogTurn, name: Name): string {
  const base = { round: turn.round, player: name(turn.seat), letter: turn.letter ?? '', n: turn.magic }
  if (turn.letter === null) return fill(w.chart.moveOnly, base)
  if (!turn.words.length) return fill(w.chart.turnNoWords, base)
  return fill(w.chart.turn, { ...base, words: turn.words.map((x) => x.word).join(w.and) })
}

/** The end bonus: "Tangles: Yellow +6 · Blue +3". */
export function tangleBonusCaption(game: GameState, name: Name): string {
  const parts = game.tangleMagic.flatMap((n, seat) => (n > 0 ? [fill(w.chart.tangleBonusPart, { player: name(seat), n })] : []))
  return parts.length ? fill(w.chart.tangleBonus, { list: parts.join(w.separator) }) : w.chart.noTangleBonus
}

/** The line under the chart when a marker is tapped. */
export function markerCaption(game: GameState, marker: ChartMarker, awards: Award[], name: Name): string {
  const turn = marker.turnNo === null ? null : logOf(game).turns.find((t) => t.turnNo === marker.turnNo) ?? null
  if (marker.kind === 'tangle' && turn) {
    const owner = name(marker.seat)
    if (marker.by === undefined || marker.by === marker.seat) return fill(w.chart.selfTangle, { round: turn.round, owner })
    return fill(w.chart.tangle, { round: turn.round, owner, by: name(marker.by) })
  }
  if (marker.kind === 'award') {
    const award = awards.find((a) => a.id === marker.award)
    if (award) {
      const { title, reason } = awardText(award, name)
      return `${title}: ${reason}`
    }
  }
  if (marker.kind === 'lead' && turn) return `${turnCaption(turn, name)}${w.separator}${fill(w.chart.lead, { player: name(marker.seat) })}`
  return turn ? turnCaption(turn, name) : tangleBonusCaption(game, name)
}

/** A short name for a marker, for screen readers. */
export function markerLabel(marker: ChartMarker, awards: Award[], name: Name): string {
  if (marker.kind === 'tangle') return fill(w.chart.markerTangle, { owner: name(marker.seat) })
  if (marker.kind === 'lead') return fill(w.chart.markerLead, { player: name(marker.seat) })
  const award = awards.find((a) => a.id === marker.award)
  return fill(w.chart.markerAward, { title: award ? w.awards[award.id].title : '', player: name(marker.seat) })
}
