// THE END SCREEN, EVERY PAGE — 2, 3, 4 players and a shared win (the finished games in e2e/fixtures/end-*.json,
// made by scripts/end-fixtures.mjs) at phone-tall 390×844, phone-wide 844×390 and desktop 1440×900.
// Each: jump to the finished game (dev hook) → Skip the reveal → Results (shot) → Story, tap a mark (shot) →
// Scorecard (shot) → swipe back to Results (phones). Checks: the winner is on screen at once, nothing past a screen
// edge or sideways out of its page, buttons ≥ 44 px, the scorecard tints at least one best, every chart mark is a
// ≥ 44 px target, the 2-letter row only when 2-letter words count, no console errors; and with reduce motion on
// the chart is drawn at once (no animations running).
// Starts its OWN dev server (default port 5196 — never Muzzy's 5180) and closes only that one at the end.
//   npm run e2e:end [outDir] [port]
import { mkdirSync, readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const OUT = process.argv[2] ?? 'e2e-shots'
const PORT = Number(process.argv[3] ?? 5196)
const SIZES = [
  { name: 'phone-tall', width: 390, height: 844, mobile: true },
  { name: 'phone-wide', width: 844, height: 390, mobile: true },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
]
const GAMES = ['end-2p', 'end-3p', 'end-4p', 'end-shared-win']
mkdirSync(OUT, { recursive: true })

function problems() {
  const out = []
  for (const el of document.querySelectorAll('.kit-screen[data-dialog] button, .kit-screen[data-dialog] .kit-text')) {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height || el.closest('.kit-scroll')) continue
    const name = (el.textContent || '').trim().slice(0, 30)
    if (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) out.push(`clipped: ${name}`)
    if (el.tagName === 'BUTTON' && (r.height < 43.5 || r.width < 43.5)) out.push(`small button: ${name}`)
  }
  // Inside the page: nothing sticks out sideways (the page only scrolls up and down)
  const page = document.querySelector('.game-end .kit-scroll')
  if (page && page.scrollWidth > page.clientWidth + 1) out.push(`the page scrolls sideways (${page.scrollWidth} > ${page.clientWidth})`)
  const box = page?.getBoundingClientRect()
  for (const el of document.querySelectorAll('.game-end .kit-scroll .kit-text, .game-end .kit-scroll img, .game-end .kit-scroll svg')) {
    const r = el.getBoundingClientRect()
    if (r.width && (r.left < box.left - 1 || r.right > box.right + 1)) out.push(`sticks out of the page: ${(el.textContent || el.tagName).trim().slice(0, 30)}`)
  }
  return out
}

const server = await createServer({ server: { port: PORT, strictPort: true, host: '127.0.0.1' }, logLevel: 'warn' })
await server.listen()
const browser = await chromium.launch()
let failures = 0
const fail = (why) => { failures++; console.log(`  FAIL ${why}`) }

try {
  for (const size of SIZES) {
    for (const file of GAMES) {
      const game = JSON.parse(readFileSync(`e2e/fixtures/${file}.json`, 'utf8')).state.game
      const tag = `${file.replace('end-', '')}-${size.name}`
      const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, isMobile: size.mobile, hasTouch: size.mobile })
      const errors = []
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
      page.on('pageerror', (e) => errors.push(e.message))
      const tap = (loc) => (size.mobile ? loc.tap() : loc.click())
      const check = (what, ok) => { if (!ok) fail(`${tag}: ${what}`) }
      const shot = async (name) => {
        await page.waitForTimeout(450) // the tab's colour change
        await page.screenshot({ path: `${OUT}/end-${tag}-${name}.png` })
        const out = await page.evaluate(problems)
        out.forEach((p) => fail(`${tag} ${name}: ${p}`))
        console.log(`${out.length ? 'FAIL' : 'ok  '} ${tag} ${name}`)
      }
      await page.goto(`http://127.0.0.1:${PORT}/`)
      await page.waitForFunction(() => window.__glyphtender?.store, null, { timeout: 15000 })
      await page.evaluate((g) => window.__glyphtender.store.getState().loadState(g), game)
      await tap(page.getByRole('button', { name: 'Skip' }))
      const dialog = page.getByRole('dialog', { name: /Grand Glyphtender/ })
      await dialog.waitFor({ timeout: 5000 })
      await page.waitForTimeout(700) // the panel's entrance

      // ---- Results: the winner on screen at once ----
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
      await shot('1-results')

      // ---- Story: the chart, then tap a mark → its caption ----
      await tap(page.getByRole('tab', { name: 'Story' }))
      await page.locator('.game-end-chart-svg').waitFor({ timeout: 3000 })
      await page.waitForTimeout(1900) // the lines draw themselves in (endscreen.json chartDrawSeconds)
      const marks = page.locator('[data-marker]')
      const count = await marks.count()
      check('the chart has moment marks', count > 0)
      const small = await page.evaluate(() => [...document.querySelectorAll('[data-marker]')].filter((m) => {
        const r = m.getBoundingClientRect()
        return r.width < 43.5 || r.height < 43.5
      }).length)
      check('every mark is a finger-sized target', small === 0)
      if (count) {
        await tap(marks.last()) // the one drawn on top
        const caption = await page.locator('.game-end-caption').innerText()
        check(`tapping a mark tells what happened (“${caption}”)`, !/Tap a mark/.test(caption) && caption.length > 5)
      }
      await shot('2-story')

      // ---- Scorecard ----
      await tap(page.getByRole('tab', { name: 'Scorecard' }))
      await page.locator('.game-scorecard').waitFor({ timeout: 3000 })
      check('the best in a row is tinted', (await page.locator('.game-scorecard td[data-best]').count()) > 0)
      const twoLetterRow = await page.getByRole('rowheader', { name: '2-letter' }).count()
      check('the 2-letter row only when 2-letter words count', twoLetterRow === (game.config.rules.minWordLength <= 2 ? 1 : 0))
      await shot('3-scorecard')
      // Taller than the page: the bottom edge fades (more to see); scrolled to the end, the last row clears the buttons
      const scroller = page.locator('.game-end-page .kit-scroll')
      const overflows = await scroller.evaluate((el) => el.scrollHeight > el.clientHeight + 2)
      if (overflows) {
        check('more rows below: the bottom edge fades', (await scroller.getAttribute('data-more')) !== null)
        await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight))
        await page.waitForTimeout(100)
        check('scrolled to the end: no fade', (await scroller.getAttribute('data-more')) === null)
        const lastRow = await page.locator('.game-scorecard tr').last().boundingBox()
        const buttons = await page.locator('.game-end-buttons').boundingBox()
        const view = await scroller.boundingBox()
        check('the last row is fully shown, clear of Menu / New game', lastRow.y + lastRow.height <= Math.min(buttons.y > view.y ? buttons.y : Infinity, view.y + view.height)) // (phone on its side: the buttons sit up top)
        await shot('3-scorecard-end')
      }

      // ---- Swipe back (phones): Scorecard → Story ----
      if (size.mobile) {
        const box = await page.locator('.game-end-page').boundingBox()
        const y = box.y + box.height / 2
        await page.mouse.move(box.x + box.width * 0.2, y)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width * 0.8, y, { steps: 6 })
        await page.mouse.up()
        check('a swipe turns the page', (await page.getByRole('tab', { name: 'Story', selected: true }).count()) === 1)
      }
      check('Menu and New game are there', (await dialog.getByRole('button', { name: 'New game' }).count()) === 1 && (await dialog.getByRole('button', { name: 'Menu' }).count()) === 1)
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
console.log(failures ? `\n✗ ${failures} problem(s)` : '\n✓ end screen e2e passed')
process.exit(failures ? 1 : 0)
