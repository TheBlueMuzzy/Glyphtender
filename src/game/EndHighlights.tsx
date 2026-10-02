// THE HIGHLIGHTS CAROUSEL — the skill awards earned this game (stats.ts earnedAwards), ONE at a time: the holder's
// glyphling (and the rival's, small, when it's about them), the title, and the proof ("Blue's glyphling: 9 moves → 2").
// It moves on by itself every endscreen.json carouselSeconds; a tap, ◀ ▶ or a swipe moves it and holds it
// carouselPauseSeconds (UI kit Carousel). The SAME carousel sits under the results (Results page) and under the chart's
// key (Story page), sharing one index (GameOver.tsx), so the Story chart's star marks the award showing right now.
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
  /** Show the "Highlights" heading above it (Results); the Story page goes without. */
  heading?: boolean
  /** A wide screen (desktop, phone on its side): the award a size bigger, so it holds its own under the podium. */
  big?: boolean
}

export function EndHighlights({ awards, index, onIndex, name, autoSeconds, pauseSeconds, heading = true, big = false }: Props) {
  if (!awards.length) return null
  return (
    <Stack gap="xs" className="game-end-highlights">
      {heading && <div className="game-end-highlights-strip"><Text kind="heading">{w.highlights}</Text></div>}
      <Carousel label={w.highlights} index={index} onIndexChange={onIndex} autoSeconds={autoSeconds} pauseSeconds={pauseSeconds}>
        {awards.map((a) => {
          const { title, reason } = awardText(a, name)
          return (
            <Row key={`${a.id}:${a.holder}`} gap="s" className="kit-nowrap game-end-award" data-award={a.id} data-holder={a.holder}>
              <span className="game-end-award-art">
                {a.seats.slice(0, 2).map((seat, i) => (
                  <img key={seat} className="game-end-art" data-size={i === 0 ? (big ? 'm' : 's') : 'xs'} src={glyphlingArt(seat)} alt={name(seat)} />
                ))}
              </span>
              <span className="game-end-award-text">
                <Text kind={big ? 'heading' : 'label'}>{title}</Text>
                <Text kind={big ? 'body' : 'caption'}>{reason}</Text>
              </span>
            </Row>
          )
        })}
      </Carousel>
    </Stack>
  )
}
