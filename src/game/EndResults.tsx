// END SCREEN, PAGE 1: RESULTS — what everyone sees first (research/end-screen.md §2).
// The winner big and centred (glyphling, name, Magic in the biggest words on the screen, and a thin bar split into
// Magic from Words and from Tangles — on a tall phone the glyphling sits BESIDE those, so the page fits without
// scrolling); everyone else smaller underneath, in place order. Each glyphling wears its place's ribbon (1st–4th,
// endscreen.json ribbon colours); a tie just shares the ribbon — no "=" or "tied" words (Muzzy, 2026-10-02).
// A shared win puts the winners side by side at the same size under "Shared win!".
// Wide screens (phone on its side, desktop): everyone in one row — a podium 2nd · 1st · 3rd · 4th, the winner raised
// (2 players: 1st · 2nd; a shared win: the winners first) — Muzzy's "the thing you're trying to do is in the middle".
// Highlights: the skill awards' carousel (EndHighlights.tsx — one award at a time), ALWAYS UNDER the players at every
// size, never beside them (Muzzy: "move highlights under the Grand Glyphtender: Color main results section, no scrolling").
// The page fits without scrolling (e2e:end); a big screen draws it all bigger (game.css --end-zoom).
// Kit parts: Stack, Row, Text, Badge (+ the Highlights' Carousel). The art and the split bar are game graphics (like the board).
import text from '../../content/text/en.json'
import { logIsComplete } from '../engine/log'
import type { GameState } from '../engine/types'
import type { ReactNode } from 'react'
import { Badge, Row, Stack, Text, fill, ordinal } from '../ui/kit'
import { colourOf, glyphlingArt } from './art'
import type { Scorecard, Standing } from './stats'
import type { EndTuning } from './stats'
import type { GardenTuning } from './useTuning'

const w = text.game.gameOver

type Props = {
  /** "Grand Glyphtender: Yellow!" — or "Shared win!" */
  title: string
  game: GameState
  ranked: Standing[]
  cards: Scorecard[]
  /** The Highlights carousel (EndHighlights), shown under the players — or nothing when no award was earned. */
  highlights: ReactNode
  colours: GardenTuning
  /** The ribbons' colours and size. */
  tuning: EndTuning
  wide: boolean
  /** A short screen (phone on its side): everyone a size smaller. */
  compact: boolean
  me: number | null
  name: (seat: number) => string
}

export function EndResults({ title, game, ranked, cards, highlights, colours, tuning, wide, compact, me, name }: Props) {
  const winners = ranked.filter((s) => s.place === 1)
  const others = ranked.filter((s) => s.place > 1)
  const shared = winners.length > 1
  const big = compact ? 'm' : 'l'
  const player = (s: Standing, size: 'l' | 'm' | 's') => (
    <PlayerResult key={s.seat} standing={s} card={cards[s.seat]} size={size} colours={colours} tuning={tuning} name={name(s.seat)} me={me === s.seat} />
  )
  // Wide: everyone in one row (a phone on its side has no height to spare) — one winner + 3 or more players: the
  // podium order 2 · 1 · 3 · 4; 2 players: winner · other; a shared win: the winners first, at the same size
  const order = !wide ? null
    : shared ? ranked
    : ranked.length >= 3 ? [others[0], winners[0], ...others.slice(1)] : [winners[0], ...others]
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

/** One player: glyphling with its place ribbon, name, Magic, and the Words | Tangles bar. */
function PlayerResult({ standing, card, size, colours, tuning, name, me }: {
  standing: Standing; card: Scorecard; size: 'l' | 'm' | 's'; colours: GardenTuning; tuning: EndTuning; name: string; me: boolean
}) {
  const winner = standing.place === 1
  return (
    <div className="game-end-player" data-size={size} data-winner={winner || undefined} data-seat={standing.seat}>
      {/* the glyphling with its place ribbon drawn on its corner — one picture, the size the glyphling always was */}
      <svg className="game-end-art" data-size={size} viewBox="0 0 100 100" overflow="visible" role="img"
        aria-label={fill(w.placeLabel, { place: ordinal(standing.place) })}>
        <image href={glyphlingArt(standing.seat)} width={100} height={100} preserveAspectRatio="xMidYMid meet" />
        <Ribbon place={standing.place} colour={ribbonColour(tuning, standing.place)} size={tuning.ribbonSize} />
      </svg>
      <div className="game-end-player-text">
        <Row gap="xs" justify="center" className="game-end-name">
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

const ribbonColour = (tuning: EndTuning, place: number) =>
  [tuning.ribbon1, tuning.ribbon2, tuning.ribbon3, tuning.ribbon4][Math.min(place, 4) - 1]

/** A place ribbon (rosette): two tails under a round badge with the place number, on the glyphling picture's top-left
 *  corner (drawn 40 × 48; `size` = its width as a share of the picture's). */
function Ribbon({ place, colour, size }: { place: number; colour: string; size: number }) {
  return (
    <g className="game-end-ribbon" transform={`translate(-2 -6) scale(${(size * 100) / 40})`} data-place={place}>
      <path d="M12 26 L6 46 L13 42 L17 47 L20 28 Z M28 26 L34 46 L27 42 L23 47 L20 28 Z" fill={colour} stroke="var(--surface)" strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M12 26 L6 46 L13 42 L17 47 L20 28 Z M28 26 L34 46 L27 42 L23 47 L20 28 Z" fill="black" opacity={0.18} />
      <circle cx={20} cy={18} r={16} fill={colour} stroke="var(--surface)" strokeWidth={2} />
      <circle cx={20} cy={18} r={12} fill="none" stroke="black" strokeOpacity={0.22} strokeWidth={1.5} strokeDasharray="2 2" />
      <text x={20} y={18} dy="0.36em" textAnchor="middle" fontSize={17} fontWeight={800} fill="var(--surface)">{place}</text>
    </g>
  )
}
