// THE GAME, PLAYED THROUGH THE REAL SCREEN — at phone-tall 390×844, phone-wide 844×390 and desktop 1440×900:
// Play → Start (new-game screen) → snake draft (1 drag + 3 taps) → turns by tap (move, seed, cast, Cast · +N) and by drag, undo,
// tray reorder + shuffle, a refresh → passing the device (Show my seeds) → fast-forward to the end with the dev hook →
// Skip the Magic reveal → end table → Play again → Menu.
// Checks every screenshot: nothing past a screen edge, buttons ≥ 44 px, tray seeds real size, no console errors.
// Starts its OWN dev server (default port 5188 — never Muzzy's 5180) and closes only that one at the end.
//   npm run e2e:game [outDir] [port]
import { mkdirSync } from 'node:fs'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import layout from '../content/tuning/layout.json' with { type: 'json' }

const OUT = process.argv[2] ?? 'e2e-shots'
const PORT = Number(process.argv[3] ?? 5188)
const SIZES = [
  { name: 'phone-tall', width: 390, height: 844, mobile: true },
  { name: 'phone-wide', width: 844, height: 390, mobile: true },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
]
mkdirSync(OUT, { recursive: true })

// Everything visible must be inside the screen; buttons big enough for a finger; tray seeds real size
function problems() {
  const out = []
  for (const el of document.querySelectorAll('.game button, .game-tray, .game-garden, .kit-screen button, .kit-text')) {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height || el.closest('.kit-scroll, [data-scroll]')) continue
    const name = (el.textContent || el.getAttribute('class') || '').trim().slice(0, 30)
    if (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) out.push(`clipped: ${name}`)
    if (el.tagName === 'BUTTON' && (r.height < 43.5 || r.width < 43.5)) out.push(`small button: ${name} ${Math.round(r.width)}×${Math.round(r.height)}`)
  }
  const hex = document.querySelector('.game-garden [data-hex]')?.getBoundingClientRect().width
  const tile = document.querySelector('.game-tray polygon')?.getBoundingClientRect().width
  if (hex && tile && tile < 43.5) out.push(`tray seed too small: ${Math.round(tile)} px`)
  // Real size: at least the board's hex width (unless even 4 in a row can't fit — then ≥ 44)
  if (hex && tile && tile < hex / 0.97 - 2 && tile < 43.5) out.push(`tray seed smaller than a board hex: ${Math.round(tile)} < ${Math.round(hex)}`)
  return { out, hex: Math.round((hex ?? 0) / 0.97), tile: Math.round(tile ?? 0) }
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
    const store = (fn) => page.evaluate(`(${fn})(window.__glyphtender.store.getState())`)
    const shot = async (name) => {
      await page.waitForTimeout(250)
      await page.screenshot({ path: `${OUT}/${size.name}-${name}.png` })
      const { out, hex, tile } = await page.evaluate(problems)
      out.forEach((p) => fail(`${size.name} ${name}: ${p}`))
      console.log(`${out.length ? 'FAIL' : 'ok  '} ${size.name} ${name}${hex ? ` · board hex ${hex}px · tray seed ${tile}px` : ''}`)
    }
    // Drag with the mouse from one element's centre to another's
    const drag = async (from, to) => {
      const a = await from.boundingBox(), b = await to.boundingBox()
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
      await page.mouse.down()
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 })
      await page.mouse.up()
    }
    // Press, move a little (it becomes a drag and the options glow), then find the target and drop on it
    const dragVia = async (from, target, screenshot = false) => {
      const a = await from.boundingBox()
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
      await page.mouse.down()
      await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2, { steps: 4 })
      const b = await (await target()).boundingBox()
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 })
      if (screenshot) await page.screenshot({ path: `${OUT}/${size.name}-6-dragging.png` })
      await page.mouse.up()
    }
    // The same with a real finger (phones): the piece floats layout.dragLift px ABOVE the finger, so the finger
    // ends that far below the target
    const cdp = size.mobile ? await page.context().newCDPSession(page) : null
    const touchDragVia = async (from, target, lift = layout.dragLift) => {
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
      const a = await from.boundingBox()
      const ax = a.x + a.width / 2, ay = a.y + a.height / 2
      await touch('touchStart', ax, ay)
      for (let i = 1; i <= 4; i++) await touch('touchMove', ax + i * 5, ay)
      const b = await (await target()).boundingBox()
      const bx = b.x + b.width / 2, by = b.y + b.height / 2 + lift
      for (let i = 1; i <= 8; i++) await touch('touchMove', ax + 20 + ((bx - ax - 20) * i) / 8, ay + ((by - ay) * i) / 8)
      await page.screenshot({ path: `${OUT}/${size.name}-6-dragging.png` })
      await touch('touchEnd', bx, by)
    }
    const waitLanded = () => page.waitForFunction(() => !window.__glyphtender.store.getState().flying, null, { timeout: 5000 })
    const castButton = () => page.locator('.game-actions button').last()
    // Pass-and-play: when the device is being passed on, tap "Show my seeds" (it waits for a thrown seed to grow)
    const passIfAsked = async () => {
      if (!(await store((s) => s.handoff !== null))) return
      const show = page.getByRole('button', { name: 'Show my seeds' })
      await show.waitFor({ timeout: 5000 })
      await tap(show)
    }

    // ---- menu → Play ----
    await page.goto(`http://127.0.0.1:${PORT}/`)
    await page.getByRole('button', { name: 'Play' }).click()
    await page.getByRole('button', { name: 'Start' }).click() // the new-game screen's defaults: 2 players, Small
    await page.waitForFunction(() => window.__glyphtender?.store.getState().wordsStatus === 'ready', null, { timeout: 15000 })
    await shot('1-draft')

    // ---- snake draft: first by dragging the waiting glyphling onto a glowing hex, then by taps ----
    const option = (kind, pick) => page.locator(`[data-option="${kind}"] circle`).nth(pick)
    const optionCount = (kind) => page.locator(`[data-option="${kind}"] circle`).count()
    await drag(page.locator('[data-draft="next"]'), option('move', Math.floor((await optionCount('move')) * 0.2)))
    for (let i = 1; i < 4; i++) {
      if (i === 2) await shot('2-draft-blue')
      await tap(option('move', Math.floor((await optionCount('move')) * (i + 1) / 5)))
    }
    const drafted = await store((s) => s.game.phase === 'play' && s.game.glyphlings.length === 4)
    if (!drafted) fail(`${size.name}: the draft did not place 4 glyphlings`)
    await passIfAsked()
    await shot('3-first-turn')

    // ---- turns ----
    // Turn 1 by taps, turn 2 by drags, turn 3 checks Undo. Then keep playing until we've seen a cast that
    // grows a word (outlines + glow) and a refresh (the dev hook picks a seed + hex for that; the taps are real).
    let refreshed = false, grewWords = false, undoChecked = false
    for (let turn = 1; turn <= 3 || !refreshed || !grewWords; turn++) {
      if (turn > 30) { fail(`${size.name}: in 30 turns: words grown ${grewWords}, refreshed ${refreshed}`); break }
      const mine = await store((s) => s.game.glyphlings.filter((g) => g.seat === s.game.current && !s.game.tangled.includes(g.id)).map((g) => g.id))
      const glyph = page.locator(`[data-glyph="${mine[0]}"]`)
      // Move
      if (turn === 2) {
        if (size.mobile) await touchDragVia(glyph, () => option('move', 0))
        else await dragVia(glyph, () => option('move', 0), true)
      } else {
        await tap(glyph)
        if (turn === 1) await shot('4-move-options')
        await tap(option('move', Math.floor((await optionCount('move')) / 3)))
      }
      if (!(await store((s) => s.move !== null))) { fail(`${size.name} turn ${turn}: no move planned`); break }
      // Cast (a move-only turn if the hand is empty)
      const hasSeeds = await store((s) => s.game.hands[s.game.current].length > 0)
      if (hasSeeds) {
        const wantMagic = !grewWords && turn > 3
        const pick = await page.evaluate((m) => window.__glyphtender.findCast(m), wantMagic)
          ?? await page.evaluate((m) => window.__glyphtender.findCast(m), !wantMagic)
        const pos = await store(`(s) => s.trayOrder[s.game.current].indexOf(${pick.seed})`)
        const seedTile = page.locator(`[data-tray-pos="${pos}"]`)
        const target = () => page.locator(`[data-option="cast"] circle[data-hex="${pick.hex}"]`)
        if (turn === 2) {
          // Drag the seed: the gold options only appear once it's picked up, so the target is found mid-drag
          await dragVia(seedTile, target)
        } else {
          await tap(seedTile)
          if (turn === 1) await shot('5-cast-options')
          await tap(target())
        }
        if (!(await store((s) => s.cast !== null))) fail(`${size.name} turn ${turn}: the seed was not aimed`)
        const magic = Number((await castButton().textContent()).match(/\+(\d+)/)?.[1] ?? -1)
        if (wantMagic && magic > 0) await shot('7-planned-words')
        if (turn === 3 && !undoChecked) {
          undoChecked = true
          await tap(page.locator('.game-actions button', { hasText: 'Undo' }))
          if (await store((s) => s.cast !== null)) fail(`${size.name}: Undo did not take the seed back`)
          await tap(page.locator('.game-actions button', { hasText: 'Undo' }))
          if (await store((s) => s.move !== null)) fail(`${size.name}: Undo did not take the move back`)
          turn-- // play this turn again
          continue
        }
        await tap(castButton())
        if (wantMagic && magic > 0) {
          await page.waitForTimeout(120)
          await page.screenshot({ path: `${OUT}/${size.name}-8-throw.png` })
          await waitLanded()
          await page.waitForTimeout(350) // the runeblossom has sprouted; the words are glowing
          await page.screenshot({ path: `${OUT}/${size.name}-9-grown.png` })
          grewWords = true
        }
      } else {
        await tap(castButton()) // End turn
      }
      await waitLanded()
      if (await store((s) => s.game.phase === 'refresh')) {
        await tap(page.locator('[data-tray-pos="0"]'))
        await tap(page.locator('[data-tray-pos="2"]'))
        if (!refreshed) await shot('10-refresh')
        await tap(page.getByRole('button', { name: 'Refresh 2' }))
        if (!(await store((s) => s.game.phase !== 'refresh'))) fail(`${size.name}: refresh did not happen`)
        refreshed = true
      }
      await passIfAsked()
      if (await store((s) => s.game.phase === 'over')) break
      // Between turns: reorder the tray by dragging, and shuffle it
      if (turn === 2) {
        const before = await store((s) => s.trayOrder[s.game.current].join())
        await drag(page.locator('[data-tray-pos="0"]'), page.locator('[data-tray-pos="3"]'))
        const after = await store((s) => s.trayOrder[s.game.current].join())
        if (before === after) fail(`${size.name}: dragging in the tray did not reorder it`)
        await tap(page.getByRole('button', { name: 'Shuffle' }))
        const shuffledOk = await store((s) => [...s.trayOrder[s.game.current]].sort().join() === [...s.game.hands[s.game.current].keys()].join())
        if (!shuffledOk) fail(`${size.name}: shuffle lost a seed`)
      }
    }

    // ---- fast-forward to the end (dev hook: the engine's random player) ----
    const over = await page.evaluate(() => window.__glyphtender.playRest(7))
    if (!over) fail(`${size.name}: playRest did not finish the game`)
    // The Magic reveal starts once the last seed has grown; Skip jumps to the end and opens the end table
    await page.waitForFunction(() => window.__glyphtender.store.getState().revealAt !== null, null, { timeout: 5000 })
    await tap(page.getByRole('button', { name: 'Skip' }))
    const table = page.getByRole('dialog', { name: /Grand Glyphtender/ })
    await table.waitFor({ timeout: 5000 })
    await page.waitForTimeout(500)
    await shot('11-game-over')
    const stars = await page.getByRole('img', { name: 'Winner' }).count()
    if (stars < 1) fail(`${size.name}: no winner marked`)
    await table.getByRole('button', { name: 'Play again' }).click()
    if (!(await store((s) => s.game?.phase === 'draft'))) fail(`${size.name}: Play again did not start a new draft`)
    // Menu → Leave game → confirm → main menu
    await tap(page.getByRole('button', { name: 'Menu' }))
    await shot('12-pause')
    await page.getByRole('button', { name: 'Leave game' }).click()
    await page.getByRole('dialog', { name: 'Leave this game?' }).getByRole('button', { name: 'Leave game' }).click()
    await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 3000 })
    console.log(`ok   ${size.name} menu → leave → main menu`)

    if (errors.length) fail(`${size.name} console errors: ${errors.join(' | ')}`)
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}
console.log(failures ? `\n✗ ${failures} problem(s)` : '\n✓ game e2e passed')
process.exit(failures ? 1 : 0)
