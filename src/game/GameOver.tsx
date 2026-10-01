// THE END SCREEN — opens when the Magic reveal finishes (or is skipped). Design: research/end-screen.md.
// It fills the whole screen (Muzzy, 2026-10-01: "the score screen should just be taller… full screen"), clear of
// the notch and the phone's bottom gesture edge (layout.json bottomRoom). Three pages, with tabs at the top and
// swipeable sideways — Results · Story · Scorecard — and Menu (☰) · See board · New game pinned at the bottom of every
// page (New game: the new-game screen; online the host takes everyone to the lobby). At 390×844 no page scrolls.
// See board closes it so the finished garden is all there to look at; the board's own "See results" button (where
// the tray was — ActionBar.tsx) brings it back. Esc and phone Back do the same as See board.
//   Results    the winner big, the others by place, the highlights (EndResults.tsx)
//   Story      everyone's Magic round by round, with the moments marked, its key right under it; tap a mark for
//              what happened (the caption under the key — beside the graph on a wide screen) (StoryChart.tsx)
//   Scorecard  the breakdown, the best in each row tinted (EndScorecard.tsx)
// Everything comes from the finished game's log (src/game/stats.ts). Words: en.json → game.gameOver; knobs:
// content/tuning/endscreen.json.
// Kit parts: Screen (dialog), Stack, Tabs, ScrollArea, Text, Button (+ the pages' own).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import text from '../../content/text/en.json'
import { useGameStore } from '../store/gameStore'
import { Button, Row, Screen, ScrollArea, Stack, Tabs, Text, screens } from '../ui/kit'
import { colourOf } from './art'
import { EndResults } from './EndResults'
import { EndScorecard } from './EndScorecard'
import { markerCaption, markerLabel, tangleBonusCaption } from './endText'
import { playerName, winnerTitle } from './prompt'
import { markersNear, pickAwards, scorecards, standings, storyChart, type Award } from './stats'
import { SeatShape, StoryChart } from './StoryChart'
import { useEndTuning, useGardenTuning, useLayoutTuning } from './useTuning'

const w = text.game.gameOver
const PAGES = ['results', 'story', 'scorecard'] as const
type Page = (typeof PAGES)[number]
const SWIPE = 60 // px sideways (and more sideways than up/down) to turn the page

type Props = { onNewGame: () => void; onMenu: () => void }

/** The Story chart's height: as tall as the page allows, so the page never scrolls. `under` = the rest of the Story
 *  page's height (the key under the chart, and — on a tall screen — the caption under that; wide, it sits beside).
 *  Never below 70% of endscreen.json chartHeight (then the page scrolls rather than squash the chart), never above
 *  2.4× (tall) / 2.5× (wide). */
function chartHeight(page: number, under: number, wide: boolean, base: number): number {
  const room = page - under - 12
  return Math.round(Math.min(base * (wide ? 2.5 : 2.4), Math.max(base * 0.7, room)))
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
  const { bottomRoom } = useLayoutTuning()
  const wide = useMedia('(min-aspect-ratio: 1/1)') // a phone on its side or a desktop: the podium, chart beside its caption
  const short = useMedia('(max-height: 32rem)') // a phone on its side: everything a size smaller (game.css matches)
  const [page, setPage] = useState<Page>('results')
  const [selected, setSelected] = useState<number | 'tangles' | null>(null)

  const end = useMemo(() => {
    if (!game) return null
    const awards = pickAwards(game, tuning)
    return { ranked: standings(game), cards: scorecards(game), awards, chart: storyChart(game, awards, tuning.maxMarkers) }
  }, [game, tuning])

  // The page's height, and what the Story page has besides the chart (its key + caption): the chart takes what's left
  const pageBox = useRef<HTMLDivElement>(null)
  const storyBox = useRef<HTMLDivElement>(null)
  const [pageHeight, setPageHeight] = useState(0)
  const [underChart, setUnderChart] = useState(0)
  useLayoutEffect(() => {
    const el = pageBox.current
    if (!el) return
    const measure = () => {
      setPageHeight(el.clientHeight)
      const story = storyBox.current
      if (story) setUnderChart(story.offsetHeight - (story.querySelector<HTMLElement>('.game-end-chart')?.offsetHeight ?? 0))
    }
    measure()
    const watcher = new ResizeObserver(measure)
    watcher.observe(el)
    if (storyBox.current) watcher.observe(storyBox.current)
    return () => watcher.disconnect()
  }, [end, page])

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
  // A highlight tapped on the Results page: the Story chart, at that moment
  const showAward = (award: Award) => {
    const at = end.chart.markers.findIndex((m) => m.kind === 'award' && m.award === award.id)
    setSelected(at >= 0 ? at : award.moment === 'tangles' ? 'tangles' : null)
    setPage('story')
  }
  // A tapped mark tells its moment — and any marks drawn on top of it (same round, nearly the same Magic)
  const tapped = typeof selected === 'number' && selected >= end.chart.markers.length ? null : selected // (another game since)
  const captions = tapped === null ? [w.chart.hint]
    : tapped === 'tangles' ? [tangleBonusCaption(game, name)]
    : markersNear(end.chart, tapped).map((m) => markerCaption(game, m, end.awards, name))

  return (
    <Screen dialog label={winnerTitle(game)}>
      <Stack gap="s" className="game-end" data-wide={wide || undefined}>
        <div className="game-end-tabs">
          <Tabs label={w.tabsLabel} tabs={tabs} value={w.tabs[page]} onChange={(tab) => setPage(PAGES[tabs.indexOf(tab)])} />
        </div>
        <div ref={pageBox} className="game-end-page" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => (swipe.current = null)}>
          <ScrollArea key={page} label={w.tabs[page]}>
            <div role="tabpanel" aria-label={w.tabs[page]} className="game-end-tabpanel">
              {page === 'results' && (
                <EndResults title={game.winners.length > 1 ? w.sharedWin : winnerTitle(game)} game={game} ranked={end.ranked} cards={end.cards} awards={end.awards} colours={colours} wide={wide} compact={short}
                  me={me} name={name} onAward={showAward} />
              )}
              {page === 'story' && (
                <div ref={storyBox} className="game-end-story" data-wide={wide || undefined}>
                  <div className="game-end-graph">
                    <StoryChart chart={end.chart} colours={colours} tuning={tuning} selected={selected} onSelect={setSelected}
                      height={chartHeight(pageHeight, underChart, wide, tuning.chartHeight)}
                      label={(m) => markerLabel(m, end.awards, name)} />
                    {/* The key, right under the graph: each line's shape and colour, and whose it is */}
                    <Row gap="s" justify="center" className="game-end-key">
                      {end.ranked.map((s) => (
                        <Row key={s.seat} gap="xs" className="kit-nowrap">
                          <svg className="game-end-key-shape" viewBox="0 0 16 16" aria-hidden="true">
                            <SeatShape seat={s.seat} x={8} y={8} size={12} colour={colours[colourOf(s.seat)]} />
                          </svg>
                          <Text kind="label">{name(s.seat)}</Text>
                        </Row>
                      ))}
                    </Row>
                  </div>
                  {/* Then what happened at the tapped mark (wide: beside the graph) */}
                  <div className="game-end-caption" aria-live="polite">
                    {[...new Set(captions)].map((line) => <Text key={line} kind={selected === null ? 'caption' : 'body'}>{line}</Text>)}
                  </div>
                </div>
              )}
              {page === 'scorecard' && <EndScorecard game={game} cards={end.cards} ranked={end.ranked} colours={colours} name={name} />}
            </div>
          </ScrollArea>
        </div>
        {/* Pinned on every page: one row, sharing the width (game.css). See board: close this to look at the garden */}
        <div className="game-end-buttons">
          <Button variant="ghost" icon aria-label={w.menu} title={w.menu} onClick={onMenu}>☰</Button>
          <Button variant="secondary" onClick={() => screens.pop()}>{w.seeBoard}</Button>
          <Button onClick={onNewGame}>{w.newGame}</Button>
        </div>
        {/* Room under the buttons, clear of the phone's home/back gesture edge (layout.json bottomRoom, as in the game) */}
        <svg className="game-end-foot" width={0} height={bottomRoom} aria-hidden="true" />
      </Stack>
    </Screen>
  )
}
