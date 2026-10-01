// END SCREEN, PAGE 1: RESULTS — what everyone sees first (research/end-screen.md §2).
// The winner big and centred (glyphling, name, Magic in the biggest words on the screen, and a thin bar split into
// Magic from Words and from Tangles); everyone else smaller underneath, in place order ("=2nd" for ties).
// A shared win puts the winners side by side at the same size under "Shared win!".
// Wide screens (phone on its side, desktop): a podium — 2nd · 1st · 3rd · 4th, the winner raised — with the
// highlights beside it (Muzzy's "the thing you're trying to do is in the middle").
// Highlights: the awards (stats.ts pickAwards); tapping one opens the Story chart at that moment.
// Kit parts: Stack, Row, Text, Badge, Avatar, ListRow. The art and the split bar are game graphics (like the board).
import text from '../../content/text/en.json'
import type { GameState } from '../engine/types'
import { Avatar, Badge, ListRow, Row, Stack, Text, fill, ordinal } from '../ui/kit'
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
  // Wide + one winner + 3 or more players: the podium order 2 · 1 · 3 · 4, everyone in one row
  const podium = wide && !shared && ranked.length >= 3
  const order = podium ? [others[0], winners[0], ...others.slice(1)] : null
  const highlights = awards.length > 0 && (
    <Stack gap="xs" className="game-end-highlights">
      <Text kind="heading">{w.highlights}</Text>
      {awards.map((a) => {
        const { title, reason } = awardText(a, name)
        return (
          <ListRow key={a.id} onClick={() => onAward(a)} detail={reason} label={
            <Row gap="s" className="kit-nowrap">
              {a.seats.slice(0, 2).map((seat) => <Avatar key={seat} name={name(seat)} src={glyphlingArt(seat)} color={colours[colourOf(seat)]} />)}
              <Text kind="label">{title}</Text>
            </Row>
          } />
        )
      })}
    </Stack>
  )
  return (
    <div className="game-end-results" data-wide={wide || undefined}>
      <Stack gap="m" className="game-end-standings">
        <Text kind={compact ? 'heading' : 'title'}>{title}</Text>
        {order ? (
          <div className="game-end-podium">{order.map((s) => player(s, s.place === 1 ? big : 's'))}</div>
        ) : (
          <>
            <div className="game-end-winners" data-count={winners.length}>{winners.map((s) => player(s, winners.length > 1 ? 'm' : big))}</div>
            {others.length > 0 && <div className="game-end-others" data-count={others.length}>{others.map((s) => player(s, 's'))}</div>}
          </>
        )}
      </Stack>
      {highlights}
      {game.log === undefined && <Text kind="caption">{w.noLog}</Text>}
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
      {!winner && <Text kind="label">{place}</Text>}
      <Row gap="xs" justify="center" className="game-end-name">
        <Text kind={size === 'l' ? 'heading' : 'label'}>{name}</Text>
        {me && <Badge>{w.you}</Badge>}
      </Row>
      {/* the winner's "69 Magic" is the biggest thing on the screen; the others just their number */}
      <Text kind={size === 's' ? 'heading' : size === 'm' ? 'title' : 'display'}>{size === 's' ? standing.magic : fill(w.points, { n: standing.magic })}</Text>
      <SplitBar words={card.wordMagic} tangles={card.tangleMagic} colour={colours[colourOf(standing.seat)]} tangleColour={colours.vine} />
      <Text kind="caption">{fill(w.split, { words: card.wordMagic, tangles: card.tangleMagic })}</Text>
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
