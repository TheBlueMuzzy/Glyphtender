// END SCREEN, PAGE 1: RESULTS — what everyone sees first (research/end-screen.md §2).
// The winner big and centred (glyphling, name, Magic in the biggest words on the screen, and a thin bar split into
// Magic from Words and from Tangles — on a tall phone the glyphling sits BESIDE those, so the page fits without
// scrolling); everyone else smaller underneath, in place order ("=2nd" for ties).
// A shared win puts the winners side by side at the same size under "Shared win!".
// Wide screens (phone on its side, desktop): everyone in one row — a podium 2nd · 1st · 3rd · 4th, the winner raised
// (2 players: 1st · 2nd; a shared win: the winners first) — Muzzy's "the thing you're trying to do is in the middle".
// Highlights: the awards (stats.ts pickAwards), ALWAYS UNDER the players at every size, never beside them (Muzzy:
// "move highlights under the Grand Glyphtender: Color main results section, no scrolling") — one compact row each
// (glyphling, title, reason; two to a line on a wide screen); tapping one opens the Story chart at that moment.
// The page fits without scrolling (e2e:end); a big screen draws it all bigger (game.css --end-zoom).
// Kit parts: Stack, Row, Text, Badge, ListRow. The art and the split bar are game graphics (like the board).
import text from '../../content/text/en.json'
import { logIsComplete } from '../engine/log'
import type { GameState } from '../engine/types'
import { Badge, ListRow, Row, Stack, Text, fill, ordinal } from '../ui/kit'
import { colourOf, glyphlingArt } from './art'
import { awardText } from './endText'
import type { Award, Scorecard, Standing } from './stats'
import type { GardenTuning } from './useTuning'

const w = text.game.gameOver

type Props = {
  /** "Grand Glyphtender: Yellow!" — or "Shared win!" */
  title: string
  game: GameState
  ranked: Standing[]
  cards: Scorecard[]
  awards: Award[]
  colours: GardenTuning
  wide: boolean
  /** A short screen (phone on its side): everyone a size smaller. */
  compact: boolean
  me: number | null
  name: (seat: number) => string
  onAward: (award: Award) => void
}

export function EndResults({ title, game, ranked, cards, awards, colours, wide, compact, me, name, onAward }: Props) {
  const winners = ranked.filter((s) => s.place === 1)
  const others = ranked.filter((s) => s.place > 1)
  const shared = winners.length > 1
  const big = compact ? 'm' : 'l'
  const player = (s: Standing, size: 'l' | 'm' | 's') => (
    <PlayerResult key={s.seat} standing={s} card={cards[s.seat]} size={size} colours={colours} name={name(s.seat)} me={me === s.seat} />
  )
  // Wide: everyone in one row (a phone on its side has no height to spare) — one winner + 3 or more players: the
  // podium order 2 · 1 · 3 · 4; 2 players: winner · other; a shared win: the winners first, at the same size
  const order = !wide ? null
    : shared ? ranked
    : ranked.length >= 3 ? [others[0], winners[0], ...others.slice(1)] : [winners[0], ...others]
  const highlights = awards.length > 0 && (
    <Stack gap="xs" className="game-end-highlights" data-wide={wide || undefined}>
      <Text kind="heading">{w.highlights}</Text>
      <div className="game-end-awards">{awards.map((a) => {
        const { title, reason } = awardText(a, name)
        return (
          <ListRow key={a.id} onClick={() => onAward(a)} label={
            <Row gap="s" className="kit-nowrap game-end-award">
              <span className="game-end-award-art">
                {a.seats.slice(0, 2).map((seat) => <img key={seat} className="game-end-art" data-size="xs" src={glyphlingArt(seat)} alt={name(seat)} />)}
              </span>
              {/* title and reason flow as one line of text (wrapping onto a 2nd only when long) */}
              <span className="game-end-award-text">
                <Text kind="label">{title}</Text>
                <Text kind="caption">{' · '}{reason}</Text>
              </span>
            </Row>
          } />
        )
      })}</div>
    </Stack>
  )
  return (
    <div className="game-end-results" data-wide={wide || undefined}>
      <Stack gap="s" className="game-end-standings">
        <Text kind={wide && !compact ? 'title' : 'heading'}>{title}</Text>
        {order ? (
          <div className="game-end-podium">{order.map((s) => player(s, s.place === 1 ? (shared ? 'm' : big) : 's'))}</div>
        ) : (
          <>
            <div className="game-end-winners" data-count={winners.length}>{winners.map((s) => player(s, winners.length > 1 ? 'm' : big))}</div>
            {others.length > 0 && <div className="game-end-others" data-count={others.length}>{others.map((s) => player(s, 's'))}</div>}
          </>
        )}
      </Stack>
      {highlights}
      {!logIsComplete(game) && <Text kind="caption">{w.noLog}</Text>}
    </div>
  )
}

/** One player: glyphling, place, name, Magic, and the Words | Tangles bar. */
function PlayerResult({ standing, card, size, colours, name, me }: {
  standing: Standing; card: Scorecard; size: 'l' | 'm' | 's'; colours: GardenTuning; name: string; me: boolean
}) {
  const place = fill(standing.tied ? w.tiedPlace : w.place, { place: ordinal(standing.place) })
  const winner = standing.place === 1
  return (
    <div className="game-end-player" data-size={size} data-winner={winner || undefined} data-seat={standing.seat}>
      <img className="game-end-art" src={glyphlingArt(standing.seat)} alt="" data-size={size} />
      <div className="game-end-player-text">
        <Row gap="xs" justify="center" className="game-end-name">
          {!winner && <Text kind="label">{place}</Text>}
          <Text kind={size === 'l' ? 'heading' : 'label'}>{name}</Text>
          {me && <Badge>{w.you}</Badge>}
        </Row>
        {/* the winner's "69 Magic" is the biggest thing on the screen; the others just their number */}
        <Text kind={size === 's' ? 'heading' : size === 'm' ? 'title' : 'display'}>{size === 's' ? standing.magic : fill(w.points, { n: standing.magic })}</Text>
        <SplitBar words={card.wordMagic} tangles={card.tangleMagic} colour={colours[colourOf(standing.seat)]} tangleColour={colours.vine} />
        <Text kind="caption">{fill(w.split, { words: card.wordMagic, tangles: card.tangleMagic })}</Text>
      </div>
    </div>
  )
}

/** A thin bar: the player's colour for Magic from words, the vine green for Magic from tangles. */
function SplitBar({ words, tangles, colour, tangleColour }: { words: number; tangles: number; colour: string; tangleColour: string }) {
  const total = words + tangles
  const wordShare = total > 0 ? (words / total) * 100 : 0
  const gap = words > 0 && tangles > 0 ? 2 : 0
  return (
    <svg className="game-end-split" viewBox="0 0 100 8" preserveAspectRatio="none" role="img"
      aria-label={fill(w.splitLabel, { words, tangles })}>
      <rect width={100} height={8} rx={4} fill="var(--border)" opacity={0.5} />
      {words > 0 && <rect width={Math.max(0, wordShare - gap / 2)} height={8} rx={4} fill={colour} />}
      {tangles > 0 && <rect x={wordShare + gap / 2} width={Math.max(0, 100 - wordShare - gap / 2)} height={8} rx={4} fill={tangleColour} />}
    </svg>
  )
}
