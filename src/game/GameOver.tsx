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
//   Story      everyone's Magic round by round, with the moments and every award marked; drag the line across it and
//              what happened on that round shows in ONE fixed-size slot under the key (Muzzy, 2026-10-02: stacking
//              "moves the story" — it mustn't): an award in its Highlights look, a tangle / lead change as a line;
//              several on one round take turns by themselves (no dots, no arrows); the award showing is the big star
//   Scorecard  the breakdown, the best in each row tinted (EndScorecard.tsx)
// Everything comes from the finished game's log (src/game/stats.ts). Words: en.json → game.gameOver; knobs:
// content/tuning/endscreen.json.
// Kit parts: Screen (dialog), Stack, Tabs, ScrollArea, Text, Row (+ the pages' own, and EndBar's Buttons).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import text from '../../content/text/en.json'
import { useGameStore } from '../store/gameStore'
import { Row, Screen, ScrollArea, Stack, Tabs, Text, fill } from '../ui/kit'
import { colourOf } from './art'
import { EndBar } from './EndBar'
import { AwardRow, EndHighlights } from './EndHighlights'
import { EndResults } from './EndResults'
import { EndScorecard } from './EndScorecard'
import { markerCaption, tangleBonusCaption } from './endText'
import { playerName, winnerTitle } from './prompt'
import { awardPoint, earnedAwards, scorecards, standings, storyChart, type ChartMarker } from './stats'
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
  // The Story chart's scrub line: a round, rounds + 1 = the Tangles column, null = not touched yet
  const [scrub, setScrub] = useState<number | null>(null)
  // The Results page's Highlights carousel: which award shows
  const [awardAt, setAwardAt] = useState(0)
  // The Story slot: which of the line's moments shows (they take turns when there are several)
  const [momentAt, setMomentAt] = useState(0)

  const end = useMemo(() => {
    if (!game) return null
    const awards = earnedAwards(game, tuning)
    const chart = storyChart(game, tuning.maxMarkers)
    const awardMarks = awards.map((a) => awardPoint(game, chart, a)).filter((m): m is ChartMarker => m !== null)
    return { ranked: standings(game), cards: scorecards(game), awards, chart, awardMarks }
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

  // The Story slot: a new spot for the line starts at its first moment (moveLine); several moments take turns every
  // endscreen.json carouselSeconds (one moment: the timer just keeps showing it)
  const moveLine = (x: number) => { setScrub(x); setMomentAt(0) }
  useEffect(() => {
    if (page !== 'story' || scrub === null) return
    const timer = setInterval(() => setMomentAt((i) => i + 1), tuning.carouselSeconds * 1000)
    return () => clearInterval(timer)
  }, [page, scrub, tuning.carouselSeconds])

  if (!game || !end) return null
  const name = playerName
  const tabs = PAGES.map((p) => w.tabs[p])
  // The scrub line's spot → what the slot shows: the round's moments (tangles, lead changes, awards) one at a time;
  // the Tangles column: the bonus; a quiet round: just its name; untouched: how to use the line
  const spotLabel = (x: number) => x > end.chart.rounds ? w.chart.tangles : x === 0 ? w.chart.start : fill(w.chart.spot, { round: x })
  const scrubbed = scrub !== null && scrub > end.chart.rounds + 1 ? null : scrub // (another game since)
  const moments = scrubbed === null ? [] : [...end.chart.markers, ...end.awardMarks].filter((m) => m.x === scrubbed)
  const moment = moments.length ? moments[momentAt % moments.length] : null
  const awardOf = (m: ChartMarker | null) => m?.kind === 'award' ? end.awards.find((a) => a.id === m.award && a.holder === m.seat) ?? null : null
  const slotAward = awardOf(moment)
  const slotText = scrubbed === null ? w.chart.hint
    : scrubbed > end.chart.rounds ? tangleBonusCaption(game, name)
    : moment ? markerCaption(game, moment, end.awards, name)
    : fill(w.chart.quiet, { round: spotLabel(scrubbed) })
  // The big star: the award the slot is showing (none showing → every star small)
  const star = slotAward ? moment : null

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
                <EndResults title={game.winners.length > 1 ? w.sharedWin : winnerTitle(game)} game={game} ranked={end.ranked} cards={end.cards} highlights={<EndHighlights awards={end.awards} index={awardAt} onIndex={setAwardAt} name={name} big={wide && !short}
                  autoSeconds={tuning.carouselSeconds} pauseSeconds={tuning.carouselPauseSeconds} />} colours={colours} tuning={tuning} wide={wide} compact={short}
                  me={me} name={name} />
              )}
              {page === 'story' && (
                <div ref={storyBox} className="game-end-story">
                  <StoryChart chart={end.chart} colours={colours} tuning={tuning} scrub={scrubbed} onScrub={moveLine}
                    height={chartHeight(pageSize.height, underChart, tuning.chartHeight)} awards={end.awardMarks} star={star}
                    spotLabel={spotLabel} />
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
                  {/* The slot: what happened where the line is — ONE thing at a time, always the same size, so the chart
                      never moves (an award in its Highlights look; anything else as a line) */}
                  <div className="game-end-caption" aria-live="polite" data-moments={moments.length}>
                    <div key={`${scrubbed}:${momentAt % Math.max(1, moments.length)}`} className="game-end-moment">
                      {slotAward ? <AwardRow award={slotAward} name={name} />
                        : <Text kind={scrubbed === null ? 'caption' : 'body'}>{slotText}</Text>}
                    </div>
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
