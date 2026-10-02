// END SCREEN, PAGE 3: SCORECARD — one row per stat, one column per player (best place first), the same rows for
// everyone, so it's easy to compare. The best number in a row gets a soft tint: where each player was strongest.
// Rows (research/end-screen.md §2; Muzzy's order 2026-10-02): Magic — total · from words · from tangles · from solo
// words; Words — 2-letter (only when the table plays with 2-letter words) · 3 · 4 · 5 · 6+ · longest · best turn;
// Play — multi-word turns · seeds refreshed (no tint: not "best") · complete tangles ("–" for an old log).
// Each section heading (Magic / Words / Play) sits on a darkened title bar as wide as the whole table (Muzzy, 2026-10-01).
// Kit parts: Avatar, Text. The table is plain HTML laid out in game.css (style names only).
import text from '../../content/text/en.json'
import type { GameState } from '../engine/types'
import { Avatar, Text } from '../ui/kit'
import { colourOf, glyphlingArt } from './art'
import { bestCells, scorecardRows } from './endText'
import type { Scorecard, Standing } from './stats'
import type { GardenTuning } from './useTuning'

const w = text.game.gameOver.card

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
          <tr className="game-scorecard-group"><th colSpan={seats.length + 1} scope="colgroup"><div className="game-scorecard-bar"><Text kind="caption">{group.name}</Text></div></th></tr>
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
