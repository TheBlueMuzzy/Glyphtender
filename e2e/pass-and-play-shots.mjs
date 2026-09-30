// A 3-PLAYER PASS-AND-PLAY GAME THROUGH THE REAL SCREEN — at phone-tall 390×844, phone-wide 844×390, desktop 1440×900:
// menu → Play → New game (3 players → the Large garden) → Start → draft 6 → "Pass to Yellow" → a few turns, passing the
// device each time (the tray stays hidden until "Show my seeds") → a glyphling with 1 move left shows its warning ring
// (the dev hook fast-forwards to one) → fast-forward to the end → the Magic reveal plays by itself (mid + end shots)
// → the end table → New game (the new-game screen remembers 3 players) → Start → Menu → Rules → Leave.
// A turn that grows words: its score pops play BEFORE the handoff box covers the garden.
// Checks every screenshot: nothing past a screen edge, buttons ≥ 44 px (words on one line), the prompt's words inside
// its box, no console errors.
// Side-by-side layouts (phone-wide, desktop): the right-hand column keeps one width from a normal turn through the
// reveal, even with a very long player name in the prompt (it used to shrink to the reveal's chips — F13 bug).
// Starts its OWN dev server (default port 5193 — never Muzzy's 5180) and closes only that one at the end.
//   npm run e2e:pass [outDir] [port]
import { mkdirSync } from 'node:fs'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const OUT = process.argv[2] ?? 'e2e-shots'
const PORT = Number(process.argv[3] ?? 5193)
const SIZES = [
  { name: 'phone-tall', width: 390, height: 844, mobile: true },
  { name: 'phone-wide', width: 844, height: 390, mobile: true },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
]
const PLAYERS = ['Yellow', 'Blue', 'Purple']
mkdirSync(OUT, { recursive: true })

// Everything visible must be inside the screen, and buttons big enough for a finger
function problems() {
  const out = []
  for (const el of document.querySelectorAll('.game button, .game-tray, .game-garden, .kit-screen button, .kit-text')) {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height || el.closest('.kit-scroll, [data-scroll]')) continue
    const name = (el.textContent || el.getAttribute('class') || '').trim().slice(0, 30)
    if (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) out.push(`clipped: ${name}`)
    if (el.tagName === 'BUTTON' && (r.height < 43.5 || r.width < 43.5)) out.push(`small button: ${name} ${Math.round(r.width)}×${Math.round(r.height)}`)
    // a button whose words wrapped onto a second line (buttons can be tall now — a board hex — so count the lines)
    if (el.tagName === 'BUTTON' && el.textContent.trim()) {
      const range = document.createRange()
      range.selectNodeContents(el)
      const lines = new Set([...range.getClientRects()].map((line) => Math.round(line.top)))
      if (lines.size > 1) out.push(`button words wrapped: ${name}`)
    }
  }
  // the prompt's words wrap inside their box (layout sizes, so a pop animation's scale doesn't count)
  const box = document.querySelector('.game-prompt')
  for (const words of document.querySelectorAll('.game-prompt .kit-text')) {
    if (words.offsetWidth > box.clientWidth + 0.5 || words.scrollWidth > words.clientWidth + 0.5) out.push(`prompt overflows: ${words.textContent}`)
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
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, isMobile: size.mobile, hasTouch: size.mobile })
    const errors = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    const tap = (loc) => (size.mobile ? loc.tap() : loc.click())
    // A glyphling whose turn it is pulses (it never holds still), so Playwright's "wait until stable" would wait forever
    const tapGlyph = (loc) => (size.mobile ? loc.tap({ force: true }) : loc.click({ force: true }))
    const store = (fn) => page.evaluate(`(${fn})(window.__glyphtender.store.getState())`)
    const check = (what, ok) => { if (!ok) fail(`${size.name}: ${what}`) }
    const shot = async (name, settle = 400) => {
      // Moves glide (anim.json moveBase + movePerHex × hexes): picture the glyphlings once they have settled
      await page.waitForFunction(
        () => [...document.querySelectorAll('[data-glide]')].every((g) => g.getAnimations().length === 0), null, { timeout: 3000 })
      await page.waitForTimeout(settle)
      await page.screenshot({ path: `${OUT}/pass-${size.name}-${name}.png` })
      const out = await page.evaluate(problems)
      out.forEach((p) => fail(`${size.name} ${name}: ${p}`))
      console.log(`${out.length ? 'FAIL' : 'ok  '} ${size.name} ${name}`)
    }
    const option = (kind, pick) => page.locator(`[data-option="${kind}"] circle`).nth(pick)
    const optionCount = (kind) => page.locator(`[data-option="${kind}"] circle`).count()
    const waitLanded = () => page.waitForFunction(() => !window.__glyphtender.store.getState().flying, null, { timeout: 5000 })
    const traySeeds = () => page.locator('.game-tray image').count()
    const side = () => page.evaluate(() => document.querySelector('.game').dataset.layout === 'side')
    const columnWidth = () => page.evaluate(() => Math.round(document.querySelector('.game-panel').getBoundingClientRect().width))

    // The handoff: "Pass to <player>" over the dimmed garden, no seeds in the tray until "Show my seeds"
    const handoff = async (screenshot) => {
      const seat = await store((s) => s.handoff?.seat ?? -1)
      if (seat < 0) return fail(`${size.name}: expected the device to be passed on`)
      const who = PLAYERS[seat]
      const show = page.getByRole('button', { name: 'Show my seeds' })
      await show.waitFor({ timeout: 8000 }) // after a throw it waits for the seed to grow and its score pops to finish
      check(`the handoff names ${who}`, await page.getByRole('dialog', { name: `Pass to ${who}` }).isVisible())
      check('the tray is hidden during the handoff', (await traySeeds()) === 0)
      if (screenshot) await shot(screenshot)
      await tap(show)
      check('Show my seeds shows the seeds', (await traySeeds()) > 0)
    }

    // ---- menu → Play → New game: 3 players, the Large garden ----
    await page.goto(`http://127.0.0.1:${PORT}/`)
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.getByRole('button', { name: 'Next Players' }).click()
    check('3 players picks the Large garden', (await page.locator('.kit-picker-value', { hasText: 'Large' }).count()) === 1)
    await shot('1-new-game')
    await page.getByRole('button', { name: 'Start' }).click()
    await page.waitForFunction(() => window.__glyphtender?.store.getState().wordsStatus === 'ready', null, { timeout: 15000 })
    check('a 3-player game on the Large garden', await store((s) => s.game.config.players === 3 && s.game.config.boardName === 'large'))

    // ---- the snake draft: 6 glyphlings ----
    for (let i = 0; i < 6; i++) {
      if (i === 3) await shot('2-draft')
      await tap(option('move', Math.floor(((await optionCount('move')) * (i + 1)) / 8)))
    }
    check('6 glyphlings placed', await store((s) => s.game.phase === 'play' && s.game.glyphlings.length === 6))
    await handoff('3-handoff-first')

    // ---- a few turns, passing the device each time ----
    let popShot = false
    for (let turn = 1; turn <= 4; turn++) {
      const mine = await store((s) => s.game.glyphlings.filter((g) => g.seat === s.game.current && !s.game.tangled.includes(g.id)).map((g) => g.id))
      await tapGlyph(page.locator(`[data-glyph="${mine[0]}"]`))
      await tap(option('move', Math.floor((await optionCount('move')) / 2)))
      const pick = await page.evaluate(() => window.__glyphtender.findCast(true) ?? window.__glyphtender.findCast(false))
      if (pick) {
        const pos = await store(`(s) => s.trayOrder[s.game.current].indexOf(${pick.seed})`)
        await tap(page.locator(`[data-tray-pos="${pos}"]`))
        await tap(page.locator(`[data-option="cast"] circle[data-hex="${pick.hex}"]`))
      }
      await tap(page.locator('.game-actions button').last()) // Cast (or End turn)
      await waitLanded()
      if (await store((s) => s.handoff?.afterGrow === true)) {
        // everyone watches the seed grow (and its words' Magic pop) first: the handoff box waits for it
        check('the handoff box waits for the seed to grow', !(await page.getByRole('button', { name: 'Show my seeds' }).isVisible()))
        if (await store((s) => s.game.lastTurn.words.length > 0)) {
          check('the score pops play before the handoff', (await page.locator('[data-score-pops]').count()) === 1)
          await page.waitForTimeout(1200)
          check('the handoff box still waits while the pops play', !(await page.getByRole('button', { name: 'Show my seeds' }).isVisible()))
          if (!popShot) {
            popShot = true
            await page.screenshot({ path: `${OUT}/pass-${size.name}-4a-pops-before-handoff.png` })
          }
        }
      }
      if (await store((s) => s.game.phase === 'refresh')) {
        check('no handoff before the refresh', await store((s) => s.handoff === null))
        await tap(page.getByRole('button', { name: 'Keep all' }))
      }
      await handoff(turn === 2 ? '4-handoff' : null)
      if (turn === 2) await shot('5-next-turn')
    }
    const turnColumn = await columnWidth()

    // ---- danger cue: fast-forward until a glyphling has only one move left ----
    let danger = false
    for (let seed = 5; seed < 25 && !danger; seed++) danger = await page.evaluate((n) => window.__glyphtender.playUntilDanger(n), seed)
    check('reached a glyphling with 1 move left', danger)
    await page.locator('[data-danger="warning"]').first().waitFor({ timeout: 3000 })
    await shot('6-danger')

    // ---- the end: the Magic reveal plays by itself ----
    check('the game ended', await page.evaluate(() => window.__glyphtender.playRest(9)))
    await page.waitForFunction(() => window.__glyphtender.store.getState().revealAt !== null, null, { timeout: 5000 })
    check('Magic is secret as the reveal starts', (await page.getByText('Magic ?').count()) === 3)
    check('a Skip button while it plays', await page.getByRole('button', { name: 'Skip' }).isVisible())
    const steps = await page.evaluate(() => document.querySelectorAll('[data-reveal]').length)
    check('the reveal is drawn on the board', steps === 1)
    // Mid-reveal: once the first player's Magic is counting
    await page.waitForFunction(() => document.querySelectorAll('.game-reveal .kit-player-chip-score').length >= 1, null, { timeout: 20000 })
    await shot('7-reveal-mid', 800) // after the prompt's pop (a brief scale-up of its full-width line) has settled
    if (await side()) {
      check(`the side column keeps its width in the reveal (turn ${turnColumn}px, reveal ${await columnWidth()}px)`, (await columnWidth()) === turnColumn)
      // a very long player name in the prompt ("Counting …'s Magic"): it wraps, the column doesn't move
      const names = await store((s) => s.seats.map((seat) => seat.name))
      await page.evaluate(() => {
        const { store } = window.__glyphtender
        store.setState({ seats: store.getState().seats.map((seat) => ({ ...seat, name: 'Bartholomew the Greatest Gardener of the Tangled Glade' })) })
      })
      await page.waitForTimeout(400)
      await page.screenshot({ path: `${OUT}/pass-${size.name}-7b-reveal-long-name.png` })
      check('the side column keeps its width with a long name', (await columnWidth()) === turnColumn)
      // only the prompt is checked here: the Magic chips don't shorten names (a kit PlayerChip matter)
      // (layout sizes, not the on-screen box: the prompt's pop animation scales it up for a moment)
      const prompt = await page.evaluate(() => {
        const box = document.querySelector('.game-prompt')
        const words = document.querySelector('.game-prompt .kit-text')
        const inside = words.offsetWidth <= box.clientWidth + 0.5 && words.scrollWidth <= words.clientWidth + 0.5
        return { inside: inside && box.getBoundingClientRect().right <= innerWidth + 0.5, lines: words.offsetHeight }
      })
      check(`the long prompt wraps inside the column (${prompt.lines}px tall)`, prompt.inside)
      console.log(`${prompt.inside ? 'ok  ' : 'FAIL'} ${size.name} 7b-reveal-long-name`)
      await page.evaluate((back) => {
        const { store } = window.__glyphtender
        store.setState({ seats: store.getState().seats.map((seat, i) => ({ ...seat, name: back[i] })) })
      }, names)
    }
    // The end of the reveal: the winner announced, just before the end table opens
    await page.getByText(/Grand Glyphtender/).first().waitFor({ timeout: 20000 })
    await shot('8-reveal-end', 800)
    const table = page.getByRole('dialog', { name: /Grand Glyphtender/ })
    await table.waitFor({ timeout: 10000 })
    await shot('9-end-table', 700)
    check('the end table lists 3 players', (await table.locator('.kit-listrow').count()) === 3)
    check('the end table shows the stats', (await table.getByText(/Best turn/).count()) === 3)
    check('a winner is starred', (await table.getByRole('img', { name: 'Winner' }).count()) >= 1)

    // ---- New game (no Play again any more): the new-game screen, remembering 3 players ----
    check('no Play again on the end table', (await table.getByRole('button', { name: 'Play again' }).count()) === 0)
    await tap(table.getByRole('button', { name: 'New game' }))
    await page.getByRole('button', { name: 'Start' }).waitFor({ timeout: 3000 })
    check('the new-game screen remembers 3 players', (await page.locator('.kit-picker-value', { hasText: '3' }).count()) === 1)
    await page.getByRole('button', { name: 'Start' }).click()
    check('New game → Start: 3 players on the Large garden',
      await store((s) => s.game.phase === 'draft' && s.game.config.players === 3 && s.game.config.boardName === 'large'))

    // ---- Menu → Rules → back → Leave → the main menu ----
    await tap(page.getByRole('button', { name: 'Menu' }))
    await page.getByRole('button', { name: 'Rules' }).click()
    await shot('10-rules')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Leave game' }).click()
    await page.getByRole('dialog', { name: 'Leave this game?' }).getByRole('button', { name: 'Leave game' }).click()
    await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 3000 })
    console.log(`ok   ${size.name} new game → menu → leave`)

    if (errors.length) fail(`${size.name} console errors: ${errors.join(' | ')}`)
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}
console.log(failures ? `\n✗ ${failures} problem(s)` : '\n✓ pass-and-play e2e passed')
process.exit(failures ? 1 : 0)
