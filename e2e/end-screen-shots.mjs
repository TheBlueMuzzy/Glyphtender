// THE END OF THE GAME, EVERY VIEW — 2, 3, 4 players and a shared win (the finished games in e2e/fixtures/end-*.json,
// made by scripts/end-fixtures.mjs) at 8 window sizes: phones tall (390×844, 360×780) and on their side (844×390),
// a short browser window (768×343 — Muzzy's reveal shot), and desktops (1066×1192, 1099×846, 1440×900, 1920×1080).
// Each: jump to the finished game (dev hook) → the Magic reveal playing (shot) → Skip → Results (shot) → Story, tap a
// mark (shot) → Scorecard (shot) → swipe back (phones) → See board (shot: the finished garden + the end bar) →
// See results (back).
// Checks (Muzzy's notes, 2026-10-01):
//   reveal  the Magic chips never overlap (B016), sit in one tidy centred group, Skip is a normal-size button (the
//           hidden sizer copy behind each card — Reveal.tsx — isn't a chip)
//   results the highlights' top is UNDER the players' bottom (never beside), at every size; the Highlights are a
//           carousel showing ONE award (none earned → no Highlights at all); at 390×844 and 1440×900 it moves on by
//           itself (carouselSeconds) and a tap moves it on AND holds it (carouselPauseSeconds) before it carries on
//   story   the key under the chart, the same carousel under the key, the caption under that; a 4-pointed star on the
//           shown award's holder's line, which moves when the carousel moves on
//   all     no page scrolls (phones on their side / short windows may — reported as a NOTE, not a failure); on a
//           desktop the page's content uses ≥ 70% of the window's height (not floating small in the middle);
//           (or as wide as the page — width ran out first); nothing within 12 px of the window's edges; buttons ≥ 44 px;
//           nothing sideways out of its page (a carousel's off-screen awards aside: they're hidden, waiting their turn)
//   bar     "See board" (end screen) and "See results" (garden) are the SAME rectangle (±1 px), and so are ☰ and New game
// plus: the end screen covers the whole window, the winner on screen at once, the scorecard tints a best (and its
// section headings sit on shaded title bars the width of the table), every
// chart mark is a ≥ 44 px target, the 2-letter row only when 2-letter words count, no console errors; and with
// reduce motion on the chart is drawn at once.
// Starts its OWN dev server (default port 5196 — never Muzzy's 5180) and closes only that one at the end.
//   npm run e2e:end [outDir] [port]
import { mkdirSync, readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const OUT = process.argv[2] ?? 'e2e-shots'
const PORT = Number(process.argv[3] ?? 5196)
// mayScroll: a phone on its side / a short window — a page may scroll there if it truly can't fit (reported as a NOTE)
// desktop: the page must fill the window (≥ 70% of its height)
const SIZES = [
  { width: 390, height: 844, mobile: true },
  { width: 360, height: 780, mobile: true },
  { width: 844, height: 390, mobile: true, mayScroll: true },
  { width: 768, height: 343, mobile: false, mayScroll: true },
  { width: 1066, height: 1192, mobile: false, desktop: true },
  { width: 1099, height: 846, mobile: false, desktop: true },
  { width: 1440, height: 900, mobile: false, desktop: true },
  { width: 1920, height: 1080, mobile: false, desktop: true },
]
const GAMES = ['end-2p', 'end-3p', 'end-4p', 'end-shared-win']
const TUNING = JSON.parse(readFileSync('content/tuning/endscreen.json', 'utf8'))
const TIMED = ['390x844', '1440x900'] // the sizes where the carousel's clock is checked too (it takes ~15 s a game)
const EDGE = 12 // px: nothing closer than this to the window's edges
const FILL = 0.7 // desktop: the page's content is at least this share of the window's height
mkdirSync(OUT, { recursive: true })

/** Problems on the end screen: clipped / too close to the edges, small buttons, the page out of its box. */
function problems(EDGE) {
  const out = []
  const scroller = document.querySelector('.game-end .kit-scroll')
  const view = scroller?.getBoundingClientRect()
  // (inside the page only what's in view counts — the page's own box is checked against the edges instead)
  const waiting = (el) => el.closest('.kit-carousel-item[aria-hidden="true"]') // a carousel's other items: hidden off to the side
  for (const el of [document.querySelector('.game-end-page'), ...document.querySelectorAll('.game-end button, .game-end .kit-text, .game-end img, .game-end-chart-svg')]) {
    if (waiting(el)) continue
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) continue
    if (scroller?.contains(el) && (r.top < view.top - 0.5 || r.bottom > view.bottom + 0.5)) continue
    const name = (el.textContent || el.getAttribute('alt') || el.tagName).trim().slice(0, 30)
    if (r.left < EDGE - 0.5 || r.top < EDGE - 0.5 || r.right > innerWidth - EDGE + 0.5 || r.bottom > innerHeight - EDGE + 0.5) {
      out.push(`within ${EDGE}px of the edge: ${name} (${[r.left, r.top, r.right, r.bottom].map(Math.round)})`)
    }
    if (el.tagName === 'BUTTON' && (r.height < 43.5 || r.width < 43.5)) out.push(`small button: ${name}`)
  }
  // Inside the page: nothing sticks out sideways (the page only scrolls up and down)
  if (scroller && scroller.scrollWidth > scroller.clientWidth + 1) out.push(`the page scrolls sideways (${scroller.scrollWidth} > ${scroller.clientWidth})`)
  // The page stays in its own space: on screen, and clear of the tabs and the end bar
  if (view && (view.top < -0.5 || view.bottom > innerHeight + 0.5)) out.push(`the page runs off the screen (${Math.round(view.top)}–${Math.round(view.bottom)})`)
  for (const sel of ['.game-end-tabs', '.game-end-dock .game-end-buttons']) {
    const r = document.querySelector(sel)?.getBoundingClientRect()
    if (view && r && r.left < view.right && r.right > view.left && r.top < view.bottom - 0.5 && r.bottom > view.top + 0.5) out.push(`the page runs under ${sel}`)
  }
  for (const el of document.querySelectorAll('.game-end .kit-scroll .kit-text, .game-end .kit-scroll img, .game-end .kit-scroll svg')) {
    if (waiting(el)) continue
    const r = el.getBoundingClientRect()
    if (r.width && (r.left < view.left - 1 || r.right > view.right + 1)) out.push(`sticks out of the page: ${(el.textContent || el.tagName).trim().slice(0, 30)}`)
  }
  return out
}

/** The reveal's / garden's Magic chips: never overlapping or past their panel (B016), one tidy group in the middle. */
function chipProblems() {
  const out = []
  const group = document.querySelector('.game-reveal')
  if (!group) return ['no Magic chips']
  const panel = document.querySelector('.game-panel').getBoundingClientRect()
  const chips = [...group.querySelectorAll('.kit-player-chip:not(.game-reveal-sizer *)')].map((c) => [c.getAttribute('aria-label'), c.getBoundingClientRect()])
  chips.forEach(([name, a], i) => {
    if (a.right > panel.right + 0.5 || a.left < panel.left - 0.5) out.push(`chip past its panel: ${name}`)
    for (const [other, b] of chips.slice(i + 1)) {
      if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) out.push(`chips overlap: ${name} / ${other}`)
    }
  })
  const left = Math.min(...chips.map(([, r]) => r.left))
  const right = Math.max(...chips.map(([, r]) => r.right))
  const middle = (panel.left + panel.right) / 2
  if (Math.abs((left + right) / 2 - middle) > 3) out.push(`chips not centred (${Math.round((left + right) / 2)} vs ${Math.round(middle)})`)
  if (new Set(chips.map(([, r]) => Math.round(r.width))).size > 1) out.push('chips not all the same width')
  return out
}

const server = await createServer({ server: { port: PORT, strictPort: true, host: '127.0.0.1' }, logLevel: 'warn' })
await server.listen()
const browser = await chromium.launch()
let failures = 0
const notes = []
const fail = (why) => { failures++; console.log(`  FAIL ${why}`) }

try {
  for (const size of SIZES) {
    for (const file of GAMES) {
      const game = JSON.parse(readFileSync(`e2e/fixtures/${file}.json`, 'utf8')).state.game
      const tag = `${size.width}x${size.height}-${file.replace('end-', '')}`
      const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, isMobile: size.mobile, hasTouch: size.mobile })
      const errors = []
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
      page.on('pageerror', (e) => errors.push(e.message))
      const tap = (loc) => (size.mobile ? loc.tap() : loc.click())
      const check = (what, ok) => { if (!ok) fail(`${tag}: ${what}`) }
      const box = (sel) => page.locator(sel).first().boundingBox()
      const shot = async (name) => {
        await page.waitForTimeout(450) // the tab's colour change
        await page.screenshot({ path: `${OUT}/end-${tag}-${name}.png` })
        const out = await page.evaluate(problems, EDGE)
        out.forEach((p) => fail(`${tag} ${name}: ${p}`))
        console.log(`${out.length ? 'FAIL' : 'ok  '} ${tag} ${name}`)
      }
      // The page fits — nothing to scroll (a phone on its side / short window: noted if it can't)
      const fits = async (name) => {
        const over = await page.locator('.game-end-page .kit-scroll').evaluate((el) => el.scrollHeight - el.clientHeight)
        if (over <= 1) return
        if (size.mayScroll) notes.push(`${tag} ${name} scrolls ${over} px`)
        else fail(`${tag}: ${name} doesn't fit without scrolling (${over} px too tall)`)
      }
      // Desktop: the page's content fills the window (≥ 70% of its height), not floating small in the middle
      // (or, when it's the WIDTH that ran out first — the page as wide as it can go — that counts as filled too: with one
      // Highlights line instead of a list, a 3-wide podium on a 1099×846 window hits the sides before the bottom)
      const fills = async (name, sel) => {
        if (!size.desktop) return
        const r = await box(sel)
        const page = await box('.game-end-page')
        const wide = r.width >= page.width * 0.9
        check(`${name} fills the window (${Math.round(r.height)} px = ${Math.round((r.height / size.height) * 100)}% of ${size.height}; ${Math.round((r.width / page.width) * 100)}% of the width)`, r.height >= size.height * FILL || wide)
      }

      await page.goto(`http://127.0.0.1:${PORT}/`)
      await page.waitForFunction(() => window.__glyphtender?.store, null, { timeout: 15000 })
      await page.evaluate((g) => window.__glyphtender.store.getState().loadState(g), game)

      // ---- The Magic reveal, playing: calm and centred — chips in one tidy group, Skip a normal-size button ----
      await page.waitForFunction(() => document.querySelectorAll('.game-reveal .kit-player-chip-score:not(.game-reveal-sizer *)').length >= 1, null, { timeout: 20000 })
      await page.screenshot({ path: `${OUT}/end-${tag}-0-reveal.png` })
      ;(await page.evaluate(chipProblems)).forEach((p) => fail(`${tag} reveal: ${p}`))
      const skip = page.getByRole('button', { name: 'Skip' })
      const skipBox = await skip.boundingBox()
      check(`Skip is a normal-size button (${Math.round(skipBox.width)}×${Math.round(skipBox.height)})`, skipBox.height <= 60 && skipBox.width <= 200)
      const panelBox = await box('.game-panel')
      check('Skip is centred under the chips', Math.abs(skipBox.x + skipBox.width / 2 - (panelBox.x + panelBox.width / 2)) <= 3)
      console.log(`ok   ${tag} 0-reveal`)
      await tap(skip)

      const dialog = page.getByRole('dialog', { name: /Grand Glyphtender/ })
      await dialog.waitFor({ timeout: 5000 })
      await page.waitForTimeout(700) // the panel's entrance
      const screenBox = await box('.game-end')
      check(`the end screen fills the window (${[screenBox.x, screenBox.y, screenBox.width, screenBox.height].map(Math.round)})`,
        Math.abs(screenBox.x) < 1 && Math.abs(screenBox.y) < 1 && Math.abs(screenBox.width - size.width) < 1 && Math.abs(screenBox.height - size.height) < 1)
      const bar = async () => Promise.all(['☰', 'middle', 'New game'].map((_, i) => page.locator('.game-end-dock .game-end-buttons > *').nth(i).boundingBox()))
      const endBar = await bar()

      // ---- Results: the winner on screen at once; the highlights UNDER the players ----
      const winnerVisible = await page.evaluate(() => {
        const page = document.querySelector('.game-end .kit-scroll').getBoundingClientRect()
        return [...document.querySelectorAll('.game-end-player[data-winner] .game-end-art')].every((el) => {
          const r = el.getBoundingClientRect()
          return r.top >= page.top - 1 && r.bottom <= page.bottom + 1
        })
      })
      check('the winner is on screen without scrolling', winnerVisible)
      check('a hero per winner', (await page.locator('.game-end-player[data-winner]').count()) === game.winners.length)
      if (game.winners.length > 1) check('says Shared win!', await page.getByText('Shared win!').isVisible())
      check('everyone is on the results', (await page.locator('.game-end-player').count()) === game.config.players)
      const under = await page.evaluate(() => {
        const players = Math.max(...[...document.querySelectorAll('.game-end-player')].map((el) => el.getBoundingClientRect().bottom))
        const highlights = document.querySelector('.game-end-highlights')?.getBoundingClientRect()
        return !highlights || highlights.top >= players - 0.5
      })
      check('the highlights sit UNDER the players', under)
      // Place ribbons (Muzzy, 2026-10-02): every glyphling wears its place's ribbon; ties share one; no "=" / "2nd" words
      const ribbons = await page.evaluate(() => [...document.querySelectorAll('.game-end-player')].map((el) => ({
        seat: Number(el.dataset.seat), place: Number(el.querySelector('.game-end-ribbon')?.dataset.place ?? 0), text: el.innerText,
      })))
      const placeOf = (seat) => 1 + game.magic.filter((m) => m > game.magic[seat]).length
      check(`every player wears their place's ribbon (${ribbons.map((r) => `${r.seat}:${r.place}`).join(' ')})`,
        ribbons.length === game.config.players && ribbons.every((r) => r.place === placeOf(r.seat)))
      check('no place words on the results (no "=3rd", no "2nd")', ribbons.every((r) => !/=|\b\d(st|nd|rd|th)\b/.test(r.text)))
      // The Highlights title: centred on a dark strip that runs the window's whole width (painted, not scrolled)
      if (await page.locator('.game-end-highlights-strip').count()) {
        const strip = await page.evaluate(() => {
          const el = document.querySelector('.game-end-highlights-strip')
          const r = el.getBoundingClientRect(), t = el.firstElementChild.getBoundingClientRect()
          const scroller = el.closest('.kit-scroll').getBoundingClientRect()
          return { centred: Math.abs((t.left + t.right) / 2 - (r.left + r.right) / 2) < 2, scrollerWide: scroller.width >= window.innerWidth - 20,
            image: getComputedStyle(el).borderImageSource !== 'none', sideways: document.querySelector('.game-end-page .kit-scroll').scrollWidth > document.querySelector('.game-end-page .kit-scroll').clientWidth + 1 }
        })
        check('the Highlights title is centred', strip.centred)
        check('the Highlights strip runs the whole window width without sideways scroll', strip.image && strip.scrollerWide && !strip.sideways)
      }
      // The Highlights carousel: one award showing at a time; none earned → no Highlights at all
      const timed = TIMED.includes(`${size.width}x${size.height}`)
      const current = () => page.evaluate(() => {
        const items = document.querySelectorAll('.game-end-results .kit-carousel-item')
        const on = document.querySelector('.game-end-results .kit-carousel-item[data-current] .game-end-award')
        return { count: items.length, id: on ? `${on.dataset.award}:${on.dataset.holder}` : null }
      })
      const awards = await current()
      const shownAtOnce = await page.evaluate(() => {
        const view = document.querySelector('.game-end-results .kit-carousel-view')?.getBoundingClientRect()
        if (!view) return 0
        return [...document.querySelectorAll('.game-end-results .kit-carousel-item')].filter((el) => {
          const r = el.getBoundingClientRect()
          return r.right > view.left + 1 && r.left < view.right - 1
        }).length
      })
      if (awards.count) check(`the Highlights carousel shows ONE award at a time (${shownAtOnce} in view)`, shownAtOnce === 1 && awards.id !== null)
      else check('no award earned → no Highlights', (await page.locator('.game-end-highlights').count()) === 0)
      if (timed && awards.count > 1) {
        await page.waitForTimeout(TUNING.carouselSeconds * 1000 + 600)
        const next = await current()
        check(`the carousel moves on by itself (${awards.id} → ${next.id})`, next.id !== awards.id)
        await tap(page.locator('.game-end-results .kit-carousel-view'))
        const tapped = await current()
        check(`a tap moves it on (${next.id} → ${tapped.id})`, tapped.id !== next.id)
        await page.waitForTimeout(TUNING.carouselSeconds * 1000 + 600) // the usual wait: held by the tap, so no change yet
        check('a tap holds it (no change one usual wait later)', (await current()).id === tapped.id)
        await page.waitForTimeout(TUNING.carouselPauseSeconds * 1000)
        check('…then it carries on', (await current()).id !== tapped.id)
        console.log(`ok   ${tag} carousel: moves on, a tap moves + holds, then carries on`)
      }
      await fits('Results')
      await fills('Results', '.game-end-results')
      await shot('1-results')

      // ---- Story: the chart, its key under it, the moment slot under the key; drag the line → its moments ----
      await tap(page.getByRole('tab', { name: 'Story' }))
      await page.locator('.game-end-chart-svg').waitFor({ timeout: 3000 })
      await page.waitForTimeout(1900) // the lines draw themselves in (endscreen.json chartDrawSeconds)
      check('the chart has moment marks', (await page.locator('[data-marker]').count()) > 0)
      check('no Highlights carousel on the Story page (the slot shows awards instead)', (await page.locator('.game-end-story .kit-carousel').count()) === 0)
      // The scrub line (Muzzy: tapping a mark is too fiddly on a phone): drag across the chart → the line follows,
      // snapping to rounds; the slot under the key shows that round's moments ONE at a time, in a FIXED size
      // (stacking "moves the story" — Muzzy), taking turns when there are several; the page doesn't turn
      const svg = page.locator('.game-end-chart-svg')
      const slotSize = async () => ({ chart: (await box('.game-end-chart')).height, slot: (await box('.game-end-caption')).height })
      const before = await slotSize()
      // drag to the busiest round (most marks — awards win ties), so taking turns gets checked too
      const target = await page.evaluate(() => {
        const marks = [...document.querySelectorAll('[data-marker][data-x]')]
        if (!marks.length) return null
        const count = (x) => marks.filter((m) => m.dataset.x === x).length
        const m = marks.reduce((best, m) => (count(m.dataset.x) > count(best.dataset.x)
          || (count(m.dataset.x) === count(best.dataset.x) && m.dataset.award && !best.dataset.award) ? m : best))
        const r = m.getBoundingClientRect()
        return { x: r.left + r.width / 2, round: Number(m.dataset.x), all: count(m.dataset.x) }
      })
      const chartRect = await svg.boundingBox()
      const midY = chartRect.y + chartRect.height / 2
      if (size.mobile) {
        // a finger drag: touch events through CDP (touchscreen.tap only taps)
        const cdp = await page.context().newCDPSession(page)
        const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: midY }] })
        await touch('touchStart', chartRect.x + 30)
        for (let i = 1; i <= 8; i++) await touch('touchMove', chartRect.x + 30 + ((target?.x ?? chartRect.x + chartRect.width / 2) - chartRect.x - 30) * (i / 8))
        await touch('touchEnd')
      } else {
        await page.mouse.move(chartRect.x + 30, midY)
        await page.mouse.down()
        await page.mouse.move(target?.x ?? chartRect.x + chartRect.width / 2, midY, { steps: 8 })
        await page.mouse.up()
      }
      await page.waitForTimeout(300)
      check('dragging on the chart does not turn the page', (await page.getByRole('tab', { name: 'Story', selected: true }).count()) === 1)
      const scrubAt = Number(await svg.getAttribute('data-scrub'))
      const slotNow = () => page.evaluate(() => {
        const slot = document.querySelector('.game-end-caption')
        const award = slot.querySelector('.game-end-award')
        const star = document.querySelector('[data-marker="star"]')
        return { shown: slot.querySelectorAll('.game-end-moment').length, moments: Number(slot.dataset.moments), text: slot.innerText.replace(/\n/g, ' | '),
          award: award ? `${award.dataset.award}:${award.dataset.holder}` : null, star: star ? `${star.dataset.award}:${star.dataset.seat}` : null }
      })
      const s1 = await slotNow()
      if (target) {
        check(`the line lands on the dragged-to round (${scrubAt} vs ${target.round})`, scrubAt === target.round)
        check(`the slot shows ONE of that round's ${target.all} moments (“${s1.text}”)`, !/Drag the line/.test(s1.text) && s1.shown === 1 && s1.moments === target.all)
        check(`the big star is the award the slot shows (slot ${s1.award}, star ${s1.star})`, s1.award === s1.star)
        const after = await slotSize()
        check(`the chart and slot keep their size (${JSON.stringify(before)} → ${JSON.stringify(after)})`,
          Math.abs(after.chart - before.chart) < 1 && Math.abs(after.slot - before.slot) < 1)
        if (timed && target.all > 1) {
          await page.waitForTimeout(TUNING.carouselSeconds * 1000 + 600)
          const s2 = await slotNow()
          check(`several moments take turns by themselves (“${s1.text}” → “${s2.text}”)`, s2.text !== s1.text && s2.shown === 1 && s2.award === s2.star)
          check('…still without moving the chart', Math.abs((await slotSize()).chart - before.chart) < 1)
        }
      }
      await svg.focus()
      await page.keyboard.press('ArrowRight')
      check('→ moves the line a round', Number(await svg.getAttribute('data-scrub')) === Math.min(scrubAt + 1, Number(await svg.getAttribute('aria-valuemax'))))
      if (!awards.count) check('no award → no stars', (await page.locator('[data-marker="star"], [data-marker="award"]').count()) === 0)
      else check(`a star per award on the chart (${awards.count})`, (await page.locator('[data-marker="star"], [data-marker="award"]').count()) === awards.count)
      const [chartBox, keyBox, captionBox] = await Promise.all(['.game-end-chart', '.game-end-key', '.game-end-caption'].map(box))
      check('the key sits right under the chart', keyBox.y >= chartBox.y + chartBox.height - 0.5 && keyBox.y - (chartBox.y + chartBox.height) < 30
        && keyBox.x < chartBox.x + chartBox.width && keyBox.x + keyBox.width > chartBox.x)
      check('the slot sits under the key', captionBox.y >= keyBox.y + keyBox.height - 0.5 && captionBox.x < chartBox.x + chartBox.width)
      await fits('Story')
      await fills('Story', '.game-end-story')
      await shot('2-story')

      // ---- Scorecard ----
      await tap(page.getByRole('tab', { name: 'Scorecard' }))
      await page.locator('.game-scorecard').waitFor({ timeout: 3000 })
      check('the best in a row is tinted', (await page.locator('.game-scorecard td[data-best]').count()) > 0)
      // each section heading (Magic / Words / Play) sits on a darkened title bar as wide as the whole table
      const bars = await page.evaluate(() => {
        const table = document.querySelector('.game-scorecard').getBoundingClientRect()
        return [...document.querySelectorAll('.game-scorecard-bar')].map((bar) => {
          const r = bar.getBoundingClientRect()
          return { left: r.left - table.left, right: table.right - r.right, bg: getComputedStyle(bar).backgroundColor }
        })
      })
      check('3 section title bars (Magic · Words · Play)', bars.length === 3)
      check('the section title bars span the table width', bars.every((b) => Math.abs(b.left) <= 1 && Math.abs(b.right) <= 1))
      check('the section title bars are shaded', bars.every((b) => b.bg !== 'rgba(0, 0, 0, 0)' && b.bg !== 'transparent'))
      const twoLetterRow = await page.getByRole('rowheader', { name: '2-letter' }).count()
      check('the 2-letter row only when 2-letter words count', twoLetterRow === (game.config.rules.minWordLength <= 2 ? 1 : 0))
      await fits('Scorecard')
      await fills('Scorecard', '.game-scorecard')
      await shot('3-scorecard')
      // Taller than the page: the bottom edge fades (more to see); scrolled to the end, the last row clears the bar
      const scroller = page.locator('.game-end-page .kit-scroll')
      const overflows = await scroller.evaluate((el) => el.scrollHeight > el.clientHeight + 2)
      if (overflows) {
        check('more rows below: the bottom edge fades', (await scroller.getAttribute('data-more')) !== null)
        await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight))
        await page.waitForTimeout(100)
        check('scrolled to the end: no fade', (await scroller.getAttribute('data-more')) === null)
        const lastRow = await page.locator('.game-scorecard tr').last().boundingBox()
        const view = await scroller.boundingBox()
        check('the last row is fully shown, clear of the end bar', lastRow.y + lastRow.height <= Math.min(endBar[1].y, view.y + view.height) + 0.5)
        await shot('3-scorecard-end')
      }

      // ---- Swipe back (phones): Scorecard → Story ----
      if (size.mobile) {
        const pageBox = await box('.game-end-page')
        const y = pageBox.y + pageBox.height / 2
        await page.mouse.move(pageBox.x + pageBox.width * 0.2, y)
        await page.mouse.down()
        await page.mouse.move(pageBox.x + pageBox.width * 0.8, y, { steps: 6 })
        await page.mouse.up()
        check('a swipe turns the page', (await page.getByRole('tab', { name: 'Story', selected: true }).count()) === 1)
      }
      check('Menu and New game are there', (await dialog.getByRole('button', { name: 'New game' }).count()) === 1 && (await dialog.getByRole('button', { name: 'Menu' }).count()) === 1)

      // ---- See board → the finished garden, its chips and the SAME end bar; See results brings the results back ----
      await tap(dialog.getByRole('button', { name: 'See board' }))
      await dialog.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {})
      check('See board hides the results', (await page.locator('.game-end').count()) === 0)
      const garden = await box('.game-board')
      check('the board is there to look at', garden !== null && garden.width > 100 && garden.height > 100)
      const seeResults = page.getByRole('button', { name: 'See results' })
      check('a See results button', await seeResults.isVisible())
      await page.waitForTimeout(300)
      await page.screenshot({ path: `${OUT}/end-${tag}-4-board.png` })
      const boardBar = await bar()
      ;['☰', 'See board / See results', 'New game'].forEach((name, i) => {
        const [a, b] = [endBar[i], boardBar[i]]
        check(`${name}: the same rectangle on the end screen and the garden (${[a.x, a.y, a.width, a.height].map(Math.round)} vs ${[b.x, b.y, b.width, b.height].map(Math.round)})`,
          Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1 && Math.abs(a.width - b.width) <= 1 && Math.abs(a.height - b.height) <= 1)
      })
      ;(await page.evaluate(chipProblems)).forEach((p) => fail(`${tag} board: ${p}`))
      check('the garden stays clear of the end bar', garden.y + garden.height <= boardBar[1].y + 0.5)
      const chipsBox = await box('.game-reveal')
      check('the chips stay clear of the end bar', chipsBox.y + chipsBox.height <= boardBar[1].y + 0.5)
      check(`the end bar is ≥ ${EDGE}px from the edges`, boardBar.every((r) => r.x >= EDGE - 0.5 && r.x + r.width <= size.width - EDGE + 0.5 && r.y + r.height <= size.height - EDGE + 0.5))
      console.log(`ok   ${tag} 4-board`)
      await tap(seeResults)
      await dialog.waitFor({ timeout: 3000 })
      check('See results brings the results back', (await page.getByRole('tab', { name: 'Results', selected: true }).count()) === 1)
      if (errors.length) fail(`${tag} console errors: ${errors.join(' | ')}`)
      await page.close()
    }
  }

  // ---- Reduce motion: the chart is there at once ----
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await page.goto(`http://127.0.0.1:${PORT}/`)
  await page.waitForFunction(() => window.__glyphtender?.store, null, { timeout: 15000 })
  const game = JSON.parse(readFileSync('e2e/fixtures/end-3p.json', 'utf8')).state.game
  await page.evaluate((g) => window.__glyphtender.store.getState().loadState(g), game)
  await page.getByRole('dialog', { name: /Grand Glyphtender/ }).waitFor({ timeout: 5000 }) // reduce motion: the reveal starts at its end
  await page.getByRole('tab', { name: 'Story' }).click()
  await page.locator('.game-end-chart-svg').waitFor({ timeout: 3000 })
  const running = await page.evaluate(() => [...document.querySelectorAll('.game-end-chart-svg *')].filter((el) => el.getAnimations().length).length)
  if (running) fail(`reduce motion: ${running} chart parts still animating`)
  console.log(`${running ? 'FAIL' : 'ok  '} reduce motion: the chart is drawn at once`)
  await page.close()
} finally {
  await browser.close()
  await server.close()
}
if (notes.length) console.log(`\nNOTE (allowed — a phone on its side / short window):\n  ${notes.join('\n  ')}`)
console.log(failures ? `\n✗ ${failures} problem(s)` : '\n✓ end screen e2e passed')
process.exit(failures ? 1 : 0)
