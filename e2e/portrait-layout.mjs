// PHONE PORTRAIT LAYOUT — the three portrait bugs from Muzzy's phone (F23 test), checked on the real screen:
//   B013 the board never moves when the prompt changes its number of lines (the prompt has a fixed frame,
//        sized for the longest message at this width) — checked across a draft and a turn, with a long note
//   B012 clear room between the board and the prompt (at least layout.json → promptGap)
//   B014 every button and the tray sit at least layout.json → bottomRoom above the bottom edge (the phone's
//        home/back gesture zone), on every size
// At phone 390×844 and 360×780 (the checks), plus landscape 844×390 and desktop 1440×900 (fit + screenshots).
// Starts its OWN dev server (default port 5196 — never Muzzy's 5180) and closes only that one at the end.
//   npm run e2e:portrait [outDir] [port]
import { mkdirSync } from 'node:fs'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import layout from '../content/tuning/layout.json' with { type: 'json' }

const OUT = process.argv[2] ?? 'e2e-shots'
const PORT = Number(process.argv[3] ?? 5196)
const SIZES = [
  { name: 'phone-tall', width: 390, height: 844, mobile: true, portrait: true },
  { name: 'phone-small', width: 360, height: 780, mobile: true, portrait: true },
  { name: 'phone-wide', width: 844, height: 390, mobile: true },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
]
mkdirSync(OUT, { recursive: true })

// Where things are right now: the board's hexes (all of them together), the prompt's frame and its words,
// the lowest button / tray, and anything clipped or overlapping
function measure() {
  const box = (r) => ({ top: r.top, bottom: r.bottom, left: r.left, right: r.right })
  const union = (els) => els.map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height)
    .reduce((u, r) => ({ top: Math.min(u.top, r.top), bottom: Math.max(u.bottom, r.bottom), left: Math.min(u.left, r.left), right: Math.max(u.right, r.right) }),
      { top: Infinity, bottom: -Infinity, left: Infinity, right: -Infinity })
  const board = union([...document.querySelectorAll('.game-garden [data-hex]')])
  const frame = box(document.querySelector('.game-prompt').getBoundingClientRect())
  // the words the player sees (not the hidden sizing copy): main line + detail line
  const shown = [...document.querySelectorAll('.game-prompt .kit-hud-text .kit-text')]
  // how many lines of words show (main line + small line), from each one's height and line height
  const lines = shown.reduce((n, t) => {
    const lh = parseFloat(getComputedStyle(t).lineHeight) || parseFloat(getComputedStyle(t).fontSize) * 1.2
    return n + Math.round(t.getBoundingClientRect().height / lh)
  }, 0)
  const boardBox = box(document.querySelector('.game-board').getBoundingClientRect())
  const words = union(shown)
  const interactive = [...document.querySelectorAll('.game button, .game-tray')].map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height)
  const lowest = Math.max(...interactive.map((r) => r.bottom))
  const clipped = [...document.querySelectorAll('.game button, .game-tray, .game-garden, .kit-hud-text .kit-text')]
    .map((e) => [e, e.getBoundingClientRect()]).filter(([, r]) => r.width && (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5))
    .map(([e]) => (e.textContent || e.getAttribute('class')).trim().slice(0, 30))
  return { board, boardBox, frame, words, lines, text: shown.map((t) => t.textContent).join(' / '), lowest, clipped, height: innerHeight }
}

const server = await createServer({ server: { port: PORT, strictPort: true, host: '127.0.0.1' }, logLevel: 'warn' })
await server.listen()
const browser = await chromium.launch()
let failures = 0
const fail = (why) => { failures++; console.log(`  FAIL ${why}`) }

try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, isMobile: size.mobile, hasTouch: size.mobile })
    const errors = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    const tap = (loc) => (size.mobile ? loc.tap({ force: true }) : loc.click({ force: true }))
    const store = (fn) => page.evaluate(`(${fn})(window.__glyphtender.store.getState())`)
    const option = (kind, pick) => page.locator(`[data-option="${kind}"] circle`).nth(pick)
    const optionCount = (kind) => page.locator(`[data-option="${kind}"] circle`).count()
    const seen = []
    // Picture + measure one moment; every moment: nothing clipped, buttons clear of the bottom edge (B014)
    const moment = async (name) => {
      await page.waitForTimeout(350) // the prompt's pop and any glide settle
      if (!(await page.locator('.game-prompt').count())) {
        await page.screenshot({ path: `${OUT}/portrait-${size.name}-${name}-NO-PROMPT.png` })
        return fail(`${size.name} ${name}: no prompt on the screen`)
      }
      if (size.portrait || name === 'turn') await page.screenshot({ path: `${OUT}/portrait-${size.name}-${name}.png` })
      const m = await page.evaluate(measure)
      m.clipped.forEach((what) => fail(`${size.name} ${name}: clipped: ${what}`))
      const room = m.height - m.lowest
      if (room < layout.bottomRoom - 0.5) fail(`${size.name} ${name}: B014: the lowest button/tray is ${Math.round(room)}px from the bottom edge (needs ≥ ${layout.bottomRoom})`)
      if (m.words.top < m.frame.top - 0.5 || m.words.bottom > m.frame.bottom + 0.5) fail(`${size.name} ${name}: B013: the prompt's words spill out of its frame`)
      seen.push({ name, ...m })
      console.log(`     ${size.name} ${name}: board ${Math.round(m.board.top)}–${Math.round(m.board.bottom)} · frame ${Math.round(m.frame.top)}–${Math.round(m.frame.bottom)} · ${m.lines} line(s) "${m.text}" · ${Math.round(room)}px under the lowest button`)
    }

    await page.goto(`http://127.0.0.1:${PORT}/`)
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    // Hide seeds is off by default — switch it on, so the handoff's "Pass to …" prompt is measured too
    await page.getByRole('switch', { name: 'Hide seeds between turns' }).click()
    await page.getByRole('button', { name: 'Start' }).click()
    await page.waitForFunction(() => window.__glyphtender?.store.getState().wordsStatus === 'ready', null, { timeout: 15000 })
    await moment('draft')
    for (let i = 0; i < 4; i++) await tap(option('move', Math.floor((await optionCount('move')) * (i + 1) / 5)))
    if (await store((s) => s.handoff !== null)) await tap(page.getByRole('button', { name: 'Show my seeds' }))
    await moment('turn')
    const mine = await store((s) => s.game.glyphlings.find((g) => g.seat === s.game.current).id)
    await tap(page.locator(`[data-glyph="${mine}"]`))
    await moment('move-held')
    await tap(option('move', 0))
    await moment('cast')
    // the longest note there is, under the prompt (as a tapped tangled glyphling would show it)
    await page.evaluate(() => window.__glyphtender.store.setState({ note: 'tangled' }))
    await moment('long-note')
    await page.evaluate(() => window.__glyphtender.store.setState({ note: null }))
    // a cast that makes no Magic → the refresh question (2 lines + a small line on a phone), then Keep all → pass on
    const pick = await page.evaluate(() => window.__glyphtender.findCast(false) ?? window.__glyphtender.findCast(true))
    const pos = await store(`(s) => s.trayOrder[s.game.current].indexOf(${pick.seed})`)
    await tap(page.locator(`[data-tray-pos="${pos}"]`))
    await tap(page.locator(`[data-option="cast"] circle[data-hex="${pick.hex}"]`))
    await moment('aimed')
    await tap(page.locator('.game-actions button').last())
    await page.waitForFunction(() => !window.__glyphtender.store.getState().flying, null, { timeout: 5000 })
    if (await store((s) => s.game.phase === 'refresh')) {
      await moment('refresh')
      await tap(page.getByRole('button', { name: 'Keep all' }))
      await page.waitForFunction(() => window.__glyphtender.store.getState().refreshFx === null, null, { timeout: 5000 })
    }
    if (await store((s) => s.handoff !== null)) await moment('handoff')
    // a long online name in the prompt (lobby names can be long): the frame grows for it BEFORE it shows
    await page.evaluate(() => {
      const s = window.__glyphtender.store.getState()
      window.__glyphtender.store.setState({ note: null, seats: s.seats.map((seat, i) => (i === 0 ? { ...seat, name: 'Bartholomew the Gardener' } : seat)) })
    })
    await page.waitForTimeout(350)
    const named = await page.evaluate(measure)

    if (size.portrait) {
      // B013: the board stays put while the prompt's line count changes (from the first turn on: the draft's
      // tray holds 2 seeds, a turn's holds 8 — that one change of tray size is not the prompt's doing)
      const turns = seen.filter((m) => m.name !== 'draft')
      const lineCounts = new Set(seen.map((m) => m.lines))
      const tops = turns.map((m) => Math.round(m.board.top * 2) / 2)
      const frames = seen.map((m) => Math.round(m.frame.bottom - m.frame.top))
      if (lineCounts.size < 2) fail(`${size.name}: B013 not exercised — the prompt was always ${[...lineCounts]} line(s)`)
      if (new Set(tops).size > 1) fail(`${size.name}: B013: the board moved with the prompt (top ${tops.join(' → ')})`)
      if (new Set(frames).size > 1) fail(`${size.name}: B013: the prompt frame changed height (${frames.join(' → ')})`)
      else console.log(`${new Set(tops).size > 1 ? 'FAIL' : 'ok  '} ${size.name} B013 board top ${tops[0]} for prompts of ${[...lineCounts].join(' and ')} lines`)
      // B012: room between the board's box and the prompt frame (layout.json promptGap); and what the eye sees,
      // the board's hexes to the nearest words
      const gap = Math.min(...seen.map((m) => m.frame.top - m.boardBox.bottom))
      const seenGap = Math.min(...seen.map((m) => m.words.top - m.board.bottom))
      if (gap < layout.promptGap - 0.5) fail(`${size.name}: B012: only ${Math.round(gap)}px between the board and the prompt (needs ≥ ${layout.promptGap})`)
      else console.log(`ok   ${size.name} B012 ${Math.round(gap)}px between the board's box and the prompt · ${Math.round(seenGap)}px from the hexes to the words`)
    }
    // the long name: the frame makes room before it's needed (the board may move ONCE, on the name change — never with the text)
    if (named.words.bottom > named.frame.bottom + 0.5) fail(`${size.name}: a long player name spills out of the prompt frame`)
    console.log(`ok   ${size.name} B014 ≥ ${Math.round(Math.min(...seen.map((m) => m.height - m.lowest)))}px under the lowest button (needs ≥ ${layout.bottomRoom})`)
    if (errors.length) fail(`${size.name}: console errors: ${errors.join(' | ')}`)
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}
console.log(failures ? `\n✗ ${failures} failure(s)` : '\n✓ portrait layout ok')
process.exit(failures ? 1 : 0)
