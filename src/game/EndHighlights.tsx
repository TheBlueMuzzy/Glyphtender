// THE HIGHLIGHTS CAROUSEL — the skill awards earned this game (stats.ts earnedAwards), ONE at a time: the holder's
// glyphling (and the rival's, small, when it's about them), the title, and the proof ("Blue's glyphling: 9 moves → 2").
// It moves on by itself every endscreen.json carouselSeconds; a tap, ◀ ▶ or a swipe moves it and holds it
// carouselPauseSeconds (UI kit Carousel). Results page only — the Story page shows an award in its moment slot when
// the scrub line is on it (GameOver.tsx; AwardRow is shared).
// The "Highlights" title sits centred on a dark strip across the whole window. Nothing earned → nothing here. Kit parts: Carousel, Stack, Row, Text.
import text from '../../content/text/en.json'
import { Carousel, Row, Stack, Text } from '../ui/kit'
import { glyphlingArt } from './art'
import { awardText } from './endText'
import type { Award } from './stats'

const w = text.game.gameOver

type Props = {
  awards: Award[]
  index: number
  onIndex: (index: number) => void
  name: (seat: number) => string
  autoSeconds: number
  pauseSeconds: number
  /** A wide screen (desktop, phone on its side): the award a size bigger, so it holds its own under the podium. */
  big?: boolean
}

export function EndHighlights({ awards, index, onIndex, name, autoSeconds, pauseSeconds, big = false }: Props) {
  if (!awards.length) return null
  return (
    <Stack gap="xs" className="game-end-highlights">
      <div className="game-end-highlights-strip"><Text kind="heading">{w.highlights}</Text></div>
      <Carousel label={w.highlights} index={index} onIndexChange={onIndex} autoSeconds={autoSeconds} pauseSeconds={pauseSeconds}>
        {awards.map((a) => <AwardRow key={`${a.id}:${a.holder}`} award={a} name={name} big={big} />)}
      </Carousel>
    </Stack>
  )
}

/** One award: the holder's glyphling (and the rival's, small, when it's about them), the title over the proof. */
export function AwardRow({ award, name, big = false }: { award: Award; name: (seat: number) => string; big?: boolean }) {
  const { title, reason } = awardText(award, name)
  return (
    <Row gap="s" className="kit-nowrap game-end-award" data-award={award.id} data-holder={award.holder}>
      <span className="game-end-award-art">
        {award.seats.slice(0, 2).map((seat, i) => (
          <img key={seat} className="game-end-art" data-size={i === 0 ? (big ? 'm' : 's') : 'xs'} src={glyphlingArt(seat)} alt={name(seat)} />
        ))}
      </span>
      <span className="game-end-award-text">
        <Text kind={big ? 'heading' : 'label'}>{title}</Text>
        <Text kind={big ? 'body' : 'caption'}>{reason}</Text>
      </span>
    </Row>
  )
}
