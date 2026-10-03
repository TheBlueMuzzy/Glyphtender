// A 3-PLAYER (or 2/4: the third argument) PASS-AND-PLAY GAME THROUGH THE REAL SCREEN — at phone-tall 390×844, phone-wide 844×390, desktop 1440×900:
// menu → Play → New game (3 players → the Large garden) → Start → draft 6 → "Pass to Yellow" → a few turns, passing the
// device each time (the tray stays hidden until "Show my seeds") → a glyphling with 1 move left shows its warning ring
// (the dev hook fast-forwards to one) → fast-forward to the end → the Magic reveal plays by itself (mid + end shots)
// → the end table → New game (the new-game screen remembers 3 players) → Start → Menu → Rules → Leave.
// A turn that grows words: its score pops play BEFORE the handoff box covers the garden, and leave nothing behind (B007).
// Turn trails: the move options and the planned path are in the CURRENT player's colour, the cast options in a lighter
// shade of it (garden.json castShade), no cast arc; once a turn has landed no trail is left (not after the handoff either).
// Checks every screenshot: nothing past a screen edge, buttons ≥ 44 px (words on one line), the prompt's words inside
// its box, no console errors.
// Side-by-side layouts (phone-wide, desktop): the right-hand column keeps one width from a normal turn through the
// reveal, even with a very long player name in the prompt (it used to shrink to the reveal's chips — F13 bug).
// Starts its OWN dev server (default port 5193 — never Muzzy's 5180) and closes only that one at the end.
//   npm run e2e:pass [outDir] [port] [players]     (players 2–4, default 3; npm run e2e:pass4 = 4 players)
// Shots are named pass-… for 3 players and pass4-… / pass2-… for the others.
import { mkdirSync } from 'node:fs'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { leftoverPops } from './leftover-pops.mjs'
import garden from '../content/tuning/garden.json' with { type: 'json' }
import { castColour } from '../src/game/castShade.ts'

const OUT = process.argv[2] ?? 'e2e-shots'
const PORT = Number(process.argv[3] ?? 5193)
const COUNT = Number(process.argv[4] ?? 3)
if (![2, 3, 4].includes(COUNT)) throw new Error(`Players must be 2–4, got ${process.argv[4]}`)
const TAG = COUNT === 3 ? 'pass' : `pass${COUNT}`
const SIZES = [
  { name: 'phone-tall', width: 390, height: 844, mobile: true },
  { name: 'phone-wide', width: 844, height: 390, mobile: true },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
]
const PLAYERS = ['Yellow', 'Blue', 'Purple', 'Pink'].slice(0, COUNT)
const BOARD = COUNT === 2 ? 'small' : 'large' // content/data/boards.json → defaultForPlayers
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
  // B016: the reveal's Magic chips never run into each other or past their panel (a chip never shrinks)
  const panel = document.querySelector('.game-reveal')?.getBoundingClientRect()
  const chips = [...document.querySelectorAll('.game-reveal .kit-player-chip:not(.game-reveal-sizer *)')].map((c) => [c.getAttribute('aria-label'), c.getBoundingClientRect()])
  chips.forEach(([name, a], i) => {
    if (a.right > panel.right + 0.5 || a.left < panel.left - 0.5) out.push(`reveal chip past its panel: ${name}`)
    for (const [other, b] of chips.slice(i + 1)) {
      if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) out.push(`reveal chips overlap: ${name} / ${other}`)
    }
  })
  // the prompt's words wrap inside their box (layout sizes, so a pop animation's scale doesn't count)
  const box = document.querySelector('.game-prompt')
  for (const words of document.querySelectorAll('.game-prompt .kit-text')) {
    if (words.offsetWidth > box.clientWidth + 0.5 || words.scrollWidth > words.clientWidth + 0.5) out.push(`prompt overflows: ${words.textContent}`)
  }
  // the glyphling beside the prompt is the player it's for (the one to move, or the one the device goes to), in their colour
  const s = window.__glyphtender.store.getState()
  if (s.game && s.game.phase !== 'over') {
    const want = s.handoff?.seat ?? s.game.current
    const icon = document.querySelector('.game-prompt-icon')
    const avatar = icon?.querySelector('.kit-avatar')
    const bar = document.querySelector('.game-turn-bar .kit-avatar')
    if (!avatar || !avatar.checkVisibility({ visibilityProperty: true })) out.push('no glyphling beside the prompt')
    else {
      if (icon.dataset.seat !== String(want)) out.push(`the prompt's glyphling is seat ${icon.dataset.seat}, not ${want}`)
      const colour = (el) => getComputedStyle(el).getPropertyValue('--kit-avatar-color').trim()
      if (!colour(avatar) || colour(avatar) !== colour(bar)) out.push(`the prompt's glyphling colour ${colour(avatar)} ≠ the turn bar's ${colour(bar)}`)
    }
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
      await page.screenshot({ path: `${OUT}/${TAG}-${size.name}-${name}.png` })
      const out = await page.evaluate(problems)
      out.forEach((p) => fail(`${size.name} ${name}: ${p}`))
      console.log(`${out.length ? 'FAIL' : 'ok  '} ${size.name} ${name}`)
    }
    const option = (kind, pick) => page.locator(`[data-option="${kind}"] circle`).nth(pick)
    const optionCount = (kind) => page.locator(`[data-option="${kind}"] circle`).count()
    const waitLanded = () => page.waitForFunction(() => !window.__glyphtender.store.getState().flying, null, { timeout: 5000 })
    const traySeeds = () => page.locator('.game-tray image').count()
    const side = () => page.evaluate(() => document.querySelector('.game').dataset.layout === 'side')
    // The turn trail on the board (mode, seat, its colours) and the option hexes' colours
    const trailNow = () => page.evaluate(() => {
      const t = document.querySelector('[data-trail]')
      return {
        mode: t?.getAttribute('data-trail') ?? null, seat: t ? Number(t.getAttribute('data-trail-seat')) : null,
        strokes: t ? [...new Set([...t.querySelectorAll('[data-trail-part] > :last-child')].map((el) => el.getAttribute('stroke')))].join() : '',
        arc: !!t?.querySelector('[data-trail-part="arc"]'),
        options: [...new Set([...document.querySelectorAll('[data-option] > polygon[data-hex]')].map((el) => el.getAttribute('fill')))].join(),
      }
    })
    const colourOf = (seat) => garden[PLAYERS[seat].toLowerCase()]
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

    // ---- menu → Play → New game: COUNT players (3 and 4 → the Large garden) ----
    await page.goto(`http://127.0.0.1:${PORT}/`)
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    for (let n = 2; n < COUNT; n++) await page.getByRole('button', { name: 'Next Players' }).click()
    // Hide seeds is OFF by default (players opt in) — switch it on: this script is about the handoff
    const hide = page.getByRole('switch', { name: 'Hide seeds between turns' })
    check('Hide seeds starts off', (await hide.getAttribute('aria-checked')) === 'false')
    await hide.click()
    check('Hide seeds switched on', (await hide.getAttribute('aria-checked')) === 'true')
    check(`${COUNT} players picks the ${BOARD} garden`, (await page.locator('.kit-picker-value', { hasText: new RegExp(BOARD, 'i') }).count()) === 1)
    await shot('1-new-game')
    await page.getByRole('button', { name: 'Start' }).click()
    await page.waitForFunction(() => window.__glyphtender?.store.getState().wordsStatus === 'ready', null, { timeout: 15000 })
    check(`a ${COUNT}-player game on the ${BOARD} garden`, await store(`(s) => s.game.config.players === ${COUNT} && s.game.config.boardName === '${BOARD}'`))

    // ---- the snake draft: 2 glyphlings each ----
    const glyphlings = COUNT * 2
    for (let i = 0; i < glyphlings; i++) {
      if (i === COUNT) await shot('2-draft')
      await tap(option('move', Math.floor(((await optionCount('move')) * (i + 1)) / (glyphlings + 2))))
    }
    check(`${glyphlings} glyphlings placed`, await store(`(s) => s.game.phase === 'play' && s.game.glyphlings.length === ${glyphlings}`))
    await handoff('3-handoff-first')

    // ---- a few turns, passing the device each time ----
    let popShot = false
    for (let turn = 1; turn <= Math.max(4, COUNT + 1); turn++) {
      const mine = await store((s) => s.game.glyphlings.filter((g) => g.seat === s.game.current && !s.game.tangled.includes(g.id)).map((g) => g.id))
      await tapGlyph(page.locator(`[data-glyph="${mine[0]}"]`))
      const seat = await store((s) => s.game.current)
      check(`turn ${turn}: ${PLAYERS[seat]}'s move options are in ${PLAYERS[seat]}'s colour`, (await trailNow()).options === colourOf(seat))
      await tap(option('move', Math.floor((await optionCount('move')) / 2)))
      const pick = await page.evaluate(() => window.__glyphtender.findCast(true) ?? window.__glyphtender.findCast(false))
      if (pick) {
        const pos = await store(`(s) => s.trayOrder[s.game.current].indexOf(${pick.seed})`)
        await tap(page.locator(`[data-tray-pos="${pos}"]`))
        await tap(page.locator(`[data-option="cast"] circle[data-hex="${pick.hex}"]`))
        const plan = await trailNow()
        check(`turn ${turn}: ${PLAYERS[seat]}'s planned path in their colour, no arc, cast options a lighter shade of it (${JSON.stringify(plan)})`,
          plan.mode === 'plan' && plan.seat === seat && plan.strokes === colourOf(seat) && !plan.arc
          && plan.options === castColour(colourOf(seat), garden.background, garden.castShade))
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
            await page.screenshot({ path: `${OUT}/${TAG}-${size.name}-4a-pops-before-handoff.png` })
          }
        }
      }
      if (await store((s) => s.game.phase === 'refresh')) {
        check('no handoff before the refresh', await store((s) => s.handoff === null))
        await tap(page.getByRole('button', { name: 'Keep all' }))
      }
      await handoff(turn === 2 ? '4-handoff' : null)
      // The turn just played left no trail behind (Muzzy: "the dotted line/paths … shouldn't [stick around] post cast")
      const last = await trailNow()
      check(`turn ${turn}: after the handoff no trail is left from ${PLAYERS[seat]}'s turn (${JSON.stringify(last)})`, last.mode === null)
      if (turn === 2) await page.screenshot({ path: `${OUT}/${TAG}-${size.name}-4c-after-handoff-no-trail.png` })
      // B007: the pops played before the handoff — none of their numbers may still be on the board after it
      const left = await leftoverPops(page)
      check(`turn ${turn}: no score numbers left on the board (${left.join(' ')})`, left.length === 0)
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
    check('Magic is secret as the reveal starts', (await page.evaluate(() => [...document.querySelectorAll('.game-reveal [data-reveal-seat] > .kit-player-chip')].filter((c) => c.textContent.includes('Magic ?')).length)) === COUNT)
    check('a Skip button while it plays', await page.getByRole('button', { name: 'Skip' }).isVisible())
    const steps = await page.evaluate(() => document.querySelectorAll('[data-reveal]').length)
    check('the reveal is drawn on the board', steps === 1)
    // Mid-reveal: once the first player's Magic is counting
    await page.waitForFunction(() => document.querySelectorAll('.game-reveal .kit-player-chip-score:not(.game-reveal-sizer *)').length >= 1, null, { timeout: 20000 })
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
      await page.screenshot({ path: `${OUT}/${TAG}-${size.name}-7b-reveal-long-name.png` })
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
    // The end screen (F26): everyone on the first page — every player's glyphling on screen without scrolling, the winner
    // big (the highlights under them may scroll on a phone on its side)
    check(`the end screen shows ${COUNT} players`, (await table.locator('.game-end-player').count()) === COUNT)
    check('a winner is shown big', (await table.locator('.game-end-player[data-winner]').count()) >= 1)
    const allInView = await page.evaluate(() => {
      const box = document.querySelector('.game-end .kit-scroll').getBoundingClientRect()
      return [...document.querySelectorAll('.game-end-player .game-end-art')].every((a) => { const r = a.getBoundingClientRect(); return r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5 })
    })
    check('every player is on the first page without scrolling', allInView)
    // the breakdown is one tab away
    await tap(table.getByRole('tab', { name: 'Scorecard' }))
    check('the scorecard has a column per player', (await table.locator('.game-scorecard th[scope="col"]').count()) === COUNT)
    if (COUNT === 4) await shot('9b-end-scorecard', 500)
    await tap(table.getByRole('tab', { name: 'Results' }))

    // ---- New game (no Play again any more): the new-game screen, remembering the player count ----
    check('no Play again on the end table', (await table.getByRole('button', { name: 'Play again' }).count()) === 0)
    await tap(table.getByRole('button', { name: 'New game' }))
    await page.getByRole('button', { name: 'Start' }).waitFor({ timeout: 3000 })
    check(`the new-game screen remembers ${COUNT} players`, (await page.locator('.kit-picker-value', { hasText: String(COUNT) }).count()) === 1)
    await page.getByRole('button', { name: 'Start' }).click()
    check(`New game → Start: ${COUNT} players on the ${BOARD} garden`,
      await store(`(s) => s.game.phase === 'draft' && s.game.config.players === ${COUNT} && s.game.config.boardName === '${BOARD}'`))

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
console.log(failures ? `\n✗ ${failures} problem(s)` : `\n✓ pass-and-play e2e passed (${COUNT} players)`)
process.exit(failures ? 1 : 0)
