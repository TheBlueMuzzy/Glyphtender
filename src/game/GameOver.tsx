// THE END SCREEN — opens when the Magic reveal finishes (or is skipped). Design: research/end-screen.md.
// It fills the whole screen (Muzzy, 2026-10-01: "the score screen should just be taller… full screen"), clear of
// the notch and the phone's bottom gesture edge (layout.json bottomRoom). Three pages, with tabs at the top and
// swipeable sideways — Results · Story · Scorecard — and the end bar pinned at the bottom: Menu (☰) · See board ·
// New game (EndBar.tsx: the SAME bar the finished garden shows with "See results", in the same spot — one place
// to tap to switch between board and scores). New game: the new-game screen; online the host takes everyone to the lobby.
// Every page has ONE layout at every size (Muzzy: "the highlights are not under the final results, but should be…
// fix this as I asked before"): Results = the players, then the highlights UNDER them; Story = the chart, its key
// under it, the caption under that; Scorecard = the table. On a big screen it all goes up a size or two
// (game.css --end-zoom) so the page fills the screen instead of floating small in the middle. No page scrolls at the
// sizes e2e:end checks (a phone on its side may, for the tallest pages: the bottom edge then fades).
// See board closes this so the finished garden is all there to look at. Esc and phone Back do the same.
//   Results    the winner big, the others by place, the Highlights carousel under them (EndResults, EndHighlights)
//   Story      everyone's Magic round by round, with the moments marked; tap a mark for what happened (StoryChart.tsx);
//              the same Highlights carousel under the key, its award marked on the chart by a 4-pointed star
// The two carousels share one index (awardAt): turning to Story shows the award Results was showing, star and all.
//   Scorecard  the breakdown, the best in each row tinted (EndScorecard.tsx)
// Everything comes from the finished game's log (src/game/stats.ts). Words: en.json → game.gameOver; knobs:
// content/tuning/endscreen.json.
// Kit parts: Screen (dialog), Stack, Tabs, ScrollArea, Text, Row (+ the pages' own, and EndBar's Buttons).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import text from '../../content/text/en.json'
import { useGameStore } from '../store/gameStore'
import { Row, Screen, ScrollArea, Stack, Tabs, Text } from '../ui/kit'
import { colourOf } from './art'
import { EndBar } from './EndBar'
import { EndHighlights } from './EndHighlights'
import { EndResults } from './EndResults'
import { EndScorecard } from './EndScorecard'
import { awardText, markerCaption, markerLabel, tangleBonusCaption } from './endText'
import { playerName, winnerTitle } from './prompt'
import { awardPoint, earnedAwards, markersNear, scorecards, standings, storyChart } from './stats'
import { SeatShape, StoryChart } from './StoryChart'
import { useEndTuning, useGardenTuning } from './useTuning'

const w = text.game.gameOver
const PAGES = ['results', 'story', 'scorecard'] as const
type Page = (typeof PAGES)[number]
const SWIPE = 60 // px sideways (and more sideways than up/down) to turn the page

type Props = { onNewGame: () => void; onMenu: () => void }

/** The Story chart's height: all the page's height that the key and caption under it leave (`under`), so the chart
 *  fills the screen with no empty band above it (Muzzy) and the page doesn't scroll — never below 60% of
 *  endscreen.json chartHeight (then the page scrolls rather than squash the chart). */
function chartHeight(page: number, under: number, base: number): number {
  return Math.round(Math.max(base * 0.6, page - under - 12))
}

/** Does the window match this CSS media query (kept up to date as it changes)? */
function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches)
  useEffect(() => {
    const list = matchMedia(query)
    const change = () => setMatches(list.matches)
    change()
    list.addEventListener('change', change)
    return () => list.removeEventListener('change', change)
  }, [query])
  return matches
}

export function GameOverScreen({ onNewGame, onMenu }: Props) {
  const game = useGameStore((s) => s.game)
  const me = useGameStore((s) => s.online?.mySeat ?? null)
  const colours = useGardenTuning()
  const tuning = useEndTuning()
  const wide = useMedia('(min-aspect-ratio: 1/1)') // a phone on its side or a desktop: everyone in one row (a podium)
  const short = useMedia('(max-height: 32rem)') // a phone on its side: everything a size smaller (game.css matches)
  const [page, setPage] = useState<Page>('results')
  const [selected, setSelected] = useState<number | 'tangles' | 'star' | null>(null)
  // The Highlights carousel's award — ONE index for both pages' carousels (Results + Story stay in step), and the
  // Story chart's star sits on that award's moment
  const [awardAt, setAwardAt] = useState(0)

  const end = useMemo(() => {
    if (!game) return null
    const awards = earnedAwards(game, tuning)
    return { ranked: standings(game), cards: scorecards(game), awards, chart: storyChart(game, tuning.maxMarkers) }
  }, [game, tuning])

  // The page's size, and what the Story page has besides the chart (its key + caption): the chart takes what's left
  const pageBox = useRef<HTMLDivElement>(null)
  const storyBox = useRef<HTMLDivElement>(null)
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 })
  const [underChart, setUnderChart] = useState(0)
  useLayoutEffect(() => {
    const el = pageBox.current
    if (!el) return
    const measure = () => {
      setPageSize({ width: el.clientWidth, height: el.clientHeight })
      const story = storyBox.current
      if (story) setUnderChart(story.offsetHeight - (story.querySelector<HTMLElement>('.game-end-chart')?.offsetHeight ?? 0))
    }
    measure()
    const watcher = new ResizeObserver(measure)
    watcher.observe(el)
    if (storyBox.current) watcher.observe(storyBox.current)
    return () => watcher.disconnect()
  }, [end, page])

  // Results and Scorecard fill the page: everything on them grows (game.css --end-zoom) until the page is
  // endscreen.json pageFill full — never below normal size, never above maxZoom — so a big screen shows a big page,
  // not a small one floating in the middle (Muzzy: "the information is small and doesn't fill the screen… it
  // shouldn't be this small"). Every size on those pages is a multiple of the zoom, so the height grows about in step
  // with it: measure, scale, measure again. (The Story chart fills the height by itself — chartHeight.)
  useLayoutEffect(() => {
    const box = pageBox.current
    if (!box) return
    box.style.removeProperty('--end-zoom') // (back to game.css's size step for this screen)
    const content = box.querySelector<HTMLElement>('.game-end-tabpanel > *')
    if (page === 'story' || !content || !pageSize.height) return
    const room = box.clientHeight * tuning.pageFill
    let zoom = 1
    for (let tries = 0; tries < 4; tries++) {
      box.style.setProperty('--end-zoom', String(zoom))
      const next = Math.min(tuning.maxZoom, Math.max(1, (zoom * room) / content.offsetHeight))
      if (Math.abs(next - zoom) < 0.01) break
      zoom = next
    }
    box.style.setProperty('--end-zoom', String(zoom))
    // (words that wrap at the bigger size can make it taller than planned: step back until it fits)
    while (zoom > 1 && content.offsetHeight > room) {
      zoom = Math.max(1, zoom - 0.05)
      box.style.setProperty('--end-zoom', String(zoom))
    }
  }, [page, end, pageSize, tuning.pageFill, tuning.maxZoom])

  // More below? The page's bottom edge fades (game.css) until it's scrolled to the end — so a cut-off row reads as "scroll"
  useLayoutEffect(() => {
    const scroller = pageBox.current?.querySelector<HTMLElement>('.kit-scroll')
    if (!scroller) return
    const check = () => scroller.toggleAttribute('data-more', scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 2)
    check()
    scroller.addEventListener('scroll', check, { passive: true })
    const watcher = new ResizeObserver(check)
    watcher.observe(scroller)
    if (scroller.firstElementChild) watcher.observe(scroller.firstElementChild)
    return () => { scroller.removeEventListener('scroll', check); watcher.disconnect() }
  }, [page, end])

  // Swipe sideways to turn the page (up/down still scrolls it)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (e: PointerEvent) => { swipe.current = { x: e.clientX, y: e.clientY } }
  const onPointerUp = (e: PointerEvent) => {
    const start = swipe.current
    swipe.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) < SWIPE || Math.abs(dx) < Math.abs(dy) * 1.5) return
    const next = PAGES.indexOf(page) + (dx < 0 ? 1 : -1)
    if (next >= 0 && next < PAGES.length) setPage(PAGES[next])
  }

  if (!game || !end) return null
  const name = playerName
  const tabs = PAGES.map((p) => w.tabs[p])
  // The award showing in the carousel, and its star on the chart (the holder's line, the round it happened)
  const award = end.awards.length ? end.awards[awardAt % end.awards.length] : null
  const star = award && awardPoint(game, end.chart, award)
  const highlights = (heading: boolean) => (
    <EndHighlights awards={end.awards} index={awardAt} onIndex={setAwardAt} name={name} heading={heading}
      autoSeconds={tuning.carouselSeconds} pauseSeconds={tuning.carouselPauseSeconds} />
  )
  // A tapped mark tells its moment — and any marks drawn on top of it (same round, nearly the same Magic)
  const tapped = typeof selected === 'number' && selected >= end.chart.markers.length ? null : selected // (another game since)
  const starCaption = () => { const t = award && awardText(award, name); return t ? `${t.title}: ${t.reason}` : w.chart.hint }
  const captions = tapped === null ? [w.chart.hint]
    : tapped === 'tangles' ? [tangleBonusCaption(game, name)]
    : tapped === 'star' ? [starCaption()]
    : markersNear(end.chart, tapped).map((m) => markerCaption(game, m, end.awards, name))

  return (
    <Screen dialog label={winnerTitle(game)}>
      <Stack gap="s" className="game-end">
        <div className="game-end-tabs">
          <Tabs label={w.tabsLabel} tabs={tabs} value={w.tabs[page]} onChange={(tab) => setPage(PAGES[tabs.indexOf(tab)])} />
        </div>
        <div ref={pageBox} className="game-end-page" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => (swipe.current = null)}>
          <ScrollArea key={page} label={w.tabs[page]}>
            <div role="tabpanel" aria-label={w.tabs[page]} className="game-end-tabpanel" data-page={page}>
              {page === 'results' && (
                <EndResults title={game.winners.length > 1 ? w.sharedWin : winnerTitle(game)} game={game} ranked={end.ranked} cards={end.cards} highlights={highlights(true)} colours={colours} wide={wide} compact={short}
                  me={me} name={name} />
              )}
              {page === 'story' && (
                <div ref={storyBox} className="game-end-story">
                  <StoryChart chart={end.chart} colours={colours} tuning={tuning} selected={selected} onSelect={setSelected}
                    height={chartHeight(pageSize.height, underChart, tuning.chartHeight)} star={star}
                    label={(m) => markerLabel(m, end.awards, name)} />
                  {/* The key, right under the chart: each line's shape and colour, and whose it is */}
                  <Row gap="m" justify="center" className="game-end-key">
                    {end.ranked.map((s) => (
                      <Row key={s.seat} gap="xs" className="kit-nowrap">
                        <svg className="game-end-key-shape" viewBox="0 0 16 16" aria-hidden="true">
                          <SeatShape seat={s.seat} x={8} y={8} size={12} colour={colours[colourOf(s.seat)]} />
                        </svg>
                        <Text kind="label">{name(s.seat)}</Text>
                      </Row>
                    ))}
                  </Row>
                  {/* The Highlights carousel (the same one as on Results, in step with it): its award has the star */}
                  {highlights(false)}
                  {/* Then what happened at the tapped mark, under it */}
                  <div className="game-end-caption" aria-live="polite">
                    {[...new Set(captions)].map((line) => <Text key={line} kind={selected === null ? 'caption' : 'body'}>{line}</Text>)}
                  </div>
                </div>
              )}
              {page === 'scorecard' && <EndScorecard game={game} cards={end.cards} ranked={end.ranked} colours={colours} name={name} />}
            </div>
          </ScrollArea>
        </div>
        {/* The end bar: the bottom row, exactly where the finished garden has it (EndBar.tsx) */}
        <EndBar view="results" onMenu={onMenu} onNewGame={onNewGame} />
      </Stack>
    </Screen>
  )
}
