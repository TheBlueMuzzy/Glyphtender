// END SCREEN, PAGE 3: SCORECARD — one row per stat, one column per player (best place first), the same rows for
// everyone, so it's easy to compare. The best number in a row gets a soft tint: where each player was strongest.
// Rows (research/end-screen.md §2): Magic — total · from words · …solo words · from tangles; Words — 2-letter (only
// when the table plays with 2-letter words) · 3 · 4 · 5 · 6+ · longest · best turn; Play — multi-word turns ·
// seeds refreshed · tangled a rival · got tangled (no tint on the last two: neither is "best").
// Kit parts: Avatar, Text. The table is plain HTML laid out in game.css (style names only).
import text from '../../content/text/en.json'
import type { GameState } from '../engine/types'
import { Avatar, Text, fill } from '../ui/kit'
import { colourOf, glyphlingArt } from './art'
import { LENGTHS, type Scorecard, type Standing } from './stats'
import type { GardenTuning } from './useTuning'

const w = text.game.gameOver.card

type Row = { label: string; values: number[]; shown?: (string | number)[]; tint: boolean }
type Group = { name: string; rows: Row[] }

/** The scorecard's rows for these players (columns in `seats` order). Pure, so it's tested. */
export function scorecardRows(game: GameState, cards: Scorecard[], seats: number[]): Group[] {
  const col = (value: (c: Scorecard) => number) => seats.map((seat) => value(cards[seat]))
  const lengths = LENGTHS.map((n, i) => ({
    label: i === LENGTHS.length - 1 ? fill(w.lettersPlus, { n }) : fill(w.letters, { n }),
    values: col((c) => c.byLength[i]),
    tint: true,
  })).filter((_, i) => LENGTHS[i] >= game.config.rules.minWordLength)
  return [
    { name: w.groups.magic, rows: [
      { label: w.total, values: col((c) => c.total), tint: true },
      { label: w.wordMagic, values: col((c) => c.wordMagic), tint: true },
      { label: w.soloMagic, values: col((c) => c.soloMagic), tint: true },
      { label: w.tangleMagic, values: col((c) => c.tangleMagic), tint: true },
    ] },
    { name: w.groups.words, rows: [
      ...lengths,
      { label: w.longestWord, values: col((c) => c.longestWord.length), tint: true },
      { label: w.bestTurn, values: col((c) => c.bestTurn?.magic ?? 0), shown: col((c) => c.bestTurn?.magic ?? 0).map((n) => (n ? `+${n}` : w.none)), tint: true },
    ] },
    { name: w.groups.play, rows: [
      { label: w.multiWord, values: col((c) => c.multiWordTurns), tint: true },
      { label: w.refreshed, values: col((c) => c.seedsRefreshed), tint: false },
      { label: w.tangledRivals, values: col((c) => c.tangledRivals), tint: true },
      { label: w.gotTangled, values: col((c) => c.gotTangled), tint: false },
    ] },
  ]
}

/** Which cells to tint: the biggest number in the row, if it's above 0 and not everyone's. */
export function bestCells(row: Row): boolean[] {
  const top = Math.max(...row.values)
  const all = row.values.every((v) => v === top)
  return row.values.map((v) => row.tint && top > 0 && !all && v === top)
}

export function EndScorecard({ game, cards, ranked, colours, name }: {
  game: GameState; cards: Scorecard[]; ranked: Standing[]; colours: GardenTuning; name: (seat: number) => string
}) {
  const seats = ranked.map((s) => s.seat)
  return (
    <table className="game-scorecard" aria-label={w.label} data-players={seats.length}>
      {/* (a fixed table takes its column widths from here: the labels get the room, the players share the rest) */}
      <colgroup><col className="game-scorecard-labels" />{seats.map((seat) => <col key={seat} />)}</colgroup>
      <thead>
        <tr>
          <td />
          {seats.map((seat) => (
            <th key={seat} scope="col">
              <Avatar name={name(seat)} src={glyphlingArt(seat)} color={colours[colourOf(seat)]} />
            </th>
          ))}
        </tr>
      </thead>
      {scorecardRows(game, cards, seats).map((group) => (
        <tbody key={group.name}>
          <tr className="game-scorecard-group"><th colSpan={seats.length + 1} scope="colgroup"><Text kind="caption">{group.name}</Text></th></tr>
          {group.rows.map((row) => {
            const best = bestCells(row)
            return (
              <tr key={row.label}>
                <th scope="row"><Text kind="label">{row.label}</Text></th>
                {row.values.map((v, i) => (
                  <td key={seats[i]} data-best={best[i] || undefined} title={best[i] ? w.best : undefined}>
                    {row.shown?.[i] ?? v}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      ))}
    </table>
  )
}
