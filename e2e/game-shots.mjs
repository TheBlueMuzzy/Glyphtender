// THE GAME, PLAYED THROUGH THE REAL SCREEN — at phone-tall 390×844, phone-wide 844×390 and desktop 1440×900:
// Play → Start (new-game screen) → snake draft (1 drag + 3 taps) → turns by tap (move, seed, cast, Cast · +N) and by drag, undo,
// no tray drag before the move (B008: it shakes), tray reorder after the move, shuffle, a refresh → passing the device
// (Show my seeds) → fast-forward to the end with the dev hook →
// Skip the Magic reveal → end table → New game → a game with word indicators OFF → Settings → Tray position Flipped → Menu.
// Checks the move glide (a planned move and Undo slide the glyphling; 4b = frozen halfway), the turn pulse (3b), the "no"
// shake (3c, frozen mid-shake), the drop target while dragging (6), cast options (a lighter shade) + planned path in the player's colour right after the move (5a), the white
// word border (7), the score pops (9b pops · 9c flying · 9d the total; after every turn none of their numbers is left — B007) and indicators off (13: no border, plain Cast, no pops).
// Checks every screenshot: nothing past a screen edge, buttons ≥ 44 px AND about a board hex tall, the prompt inside its
// box and just above the tray, tray seeds real size, no console errors; the flipped layout (14) and its column width.
// Starts its OWN dev server (default port 5188 — never Muzzy's 5180) and closes only that one at the end.
//   npm run e2e:game [outDir] [port]
import { mkdirSync } from 'node:fs'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import layout from '../content/tuning/layout.json' with { type: 'json' }
import garden from '../content/tuning/garden.json' with { type: 'json' }
import anim from '../content/tuning/anim.json' with { type: 'json' }
import { leftoverPops } from './leftover-pops.mjs'
import { castColour } from '../src/game/castShade.ts'

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
  // The action buttons: about a board hex tall (its height: width × √3/2 — Muzzy: "finger-sized like a glyphling"), ≥ 44
  const buttonMin = hex ? Math.max(44, Math.round((hex / 0.97) * Math.sqrt(3) / 2)) : 44
  for (const b of document.querySelectorAll('.game-actions button')) {
    if (b.getBoundingClientRect().height < buttonMin - 1.5) out.push(`action button shorter than a hex: ${b.textContent} ${Math.round(b.getBoundingClientRect().height)} < ${buttonMin}`)
  }
  // The prompt: its words inside its box (layout sizes — a pop animation's scale doesn't count), just above the tray
  const prompt = document.querySelector('.game-prompt')
  for (const words of document.querySelectorAll('.game-prompt .kit-text')) {
    if (words.offsetWidth > prompt.clientWidth + 0.5 || words.scrollWidth > words.clientWidth + 0.5) out.push(`prompt overflows: ${words.textContent}`)
  }
  const trayBox = document.querySelector('.game-tray, .game-reveal')?.getBoundingClientRect()
  if (prompt && trayBox && prompt.getBoundingClientRect().bottom > trayBox.top + 1) out.push('the prompt is not above the tray')
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
    // A glyphling whose turn it is pulses (it never holds still), so Playwright's "wait until stable" would wait forever
    const tapGlyph = (loc) => (size.mobile ? loc.tap({ force: true }) : loc.click({ force: true }))
    const store = (fn) => page.evaluate(`(${fn})(window.__glyphtender.store.getState())`)
    const shot = async (name) => {
      await glidesDone()
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
      if (screenshot) {
        await checkDropTarget()
        await page.screenshot({ path: `${OUT}/${size.name}-6-drop-target.png` })
      }
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
      await checkDropTarget()
      await page.screenshot({ path: `${OUT}/${size.name}-6-drop-target.png` })
      await touch('touchEnd', bx, by)
    }
    // Moves glide (anim.json moveBase + movePerHex × hexes): is one running / wait until every glyphling has settled
    const gliding = () => page.evaluate(() => [...document.querySelectorAll('[data-glide]')].some((g) => g.getAnimations().length > 0))
    const glidesDone = () => page.waitForFunction(
      () => [...document.querySelectorAll('[data-glide]')].every((g) => g.getAnimations().length === 0), null, { timeout: 3000 })
    // Freeze the running glide halfway, take a picture, let it finish
    const midGlideShot = async (name) => {
      await page.evaluate(() => document.querySelectorAll('[data-glide]').forEach((g) => g.getAnimations().forEach((a) => {
        a.pause()
        a.currentTime = a.effect.getComputedTiming().duration / 2
      })))
      await page.screenshot({ path: `${OUT}/${size.name}-${name}.png` })
      await page.evaluate(() => document.querySelectorAll('[data-glide]').forEach((g) => g.getAnimations().forEach((a) => a.play())))
      await glidesDone()
    }
    const waitLanded = () => page.waitForFunction(() => !window.__glyphtender.store.getState().flying, null, { timeout: 5000 })
    // Freeze every animation on `selector` at `at` ms (or, below 1, a share of each one's length), picture it, let it go on
    const frozenShot = async (name, selector, at) => {
      const count = await page.evaluate(([sel, at]) => {
        let n = 0
        for (const el of document.querySelectorAll(sel)) for (const a of el.getAnimations()) {
          n++
          a.pause()
          a.currentTime = at < 1 ? a.effect.getComputedTiming().duration * at : at
        }
        return n
      }, [selector, at])
      await page.screenshot({ path: `${OUT}/${size.name}-${name}.png` })
      await page.evaluate((sel) => document.querySelectorAll(sel).forEach((el) => el.getAnimations().forEach((a) => a.play())), selector)
      return count
    }
    // The score sequence after a word grows (one shared clock — every part is one animation from the landing): the
    // first word's seeds popping "+1"/"+2" (9b), its points flying into the glyphling's total (9c), the final total (9d).
    const scorePopShots = async () => {
      const turn = await store((s) => ({ magic: s.game.lastTurn.magic, seeds: s.game.lastTurn.words.reduce((n, w) => n + w.hexes.length, 0) }))
      const pops = await page.locator('[data-score-pop]').count()
      const total = await page.locator('[data-score-count]').last().textContent()
      if (pops !== turn.seeds) fail(`${size.name}: ${pops} score pops for ${turn.seeds} seeds in the words`)
      if (total !== `+${turn.magic}`) fail(`${size.name}: the final total says ${total}, the turn made ${turn.magic}`)
      const times = await page.evaluate(() => {
        const at = (el, k) => { const a = el.getAnimations()[0]; return a.effect.getKeyframes()[k].computedOffset * a.effect.getComputedTiming().duration }
        const pop = document.querySelector('[data-score-pop]'), last = [...document.querySelectorAll('[data-score-count]')].at(-1)
        return { popped: at(pop, 4) - 30, flying: (at(pop, 4) + at(pop, 5)) / 2, total: at(last, 3) - 100 }
      })
      const parts = '[data-score-pops] text, [data-score-total], [data-spot-of="grown"]'
      await frozenShot('9b-score-pops', parts, times.popped)
      await frozenShot('9c-pops-flying', parts, times.flying)
      await frozenShot('9d-score-total', parts, times.total)
      console.log(`${pops === turn.seeds && total === `+${turn.magic}` ? 'ok  ' : 'FAIL'} ${size.name} 9b-9d score sequence · ${pops} pops → ${total}`)
    }
    // Word indicators off: plan a word-making cast (trying each glyphling and move) — plain "Cast", no border, no pops
    const indicatorsOffTurn = async () => {
      for (let tries = 0; tries < 12; tries++) {
        await page.evaluate((n) => window.__glyphtender.playUntilDanger(n), 3 + tries) // a garden with seeds on it
        await page.waitForTimeout(300)
        const mine = await store((s) => s.game.glyphlings.filter((g) => g.seat === s.game.current && !s.game.tangled.includes(g.id)).map((g) => g.id))
        for (const id of mine) {
          await tapGlyph(page.locator(`[data-glyph="${id}"]`))
          const moves = await optionCount('move')
          for (let m = 0; m < moves; m++) {
            await tap(option('move', m))
            const pick = await page.evaluate(() => window.__glyphtender.findCast(true))
            if (!pick) {
              await tapGlyph(page.locator(`[data-glyph="${id}"]`)) // pick the moved glyphling up again: its moves glow
              continue
            }
            const pos = await store(`(s) => s.trayOrder[s.game.current].indexOf(${pick.seed})`)
            await tap(page.locator(`[data-tray-pos="${pos}"]`))
            await tap(page.locator(`[data-option="cast"] circle[data-hex="${pick.hex}"]`))
            await shot('13-indicators-off')
            const label = await castButton().textContent()
            if (label !== 'Cast') fail(`${size.name}: indicators off but the button says "${label}"`)
            if (await page.locator('[data-word-hex]').count()) fail(`${size.name}: indicators off but a word has a border`)
            await tap(castButton())
            await waitLanded()
            await page.waitForTimeout(700)
            if (await page.locator('[data-score-pops]').count()) fail(`${size.name}: indicators off but the Magic popped`)
            console.log(`ok   ${size.name} 13-indicators-off · plain Cast, no border, no pops`)
            return
          }
          // none of its moves makes a word: take it back (Undo), or let go of it
          if (await store((s) => s.move !== null)) await tap(page.locator('.game-actions button', { hasText: 'Undo' }))
          else if (await store((s) => s.selected !== null)) await tapGlyph(page.locator(`[data-glyph="${id}"]`))
        }
      }
      fail(`${size.name}: found no word to make with indicators off`)
    }
    // B010: the targeted seed (next to real seeds) in each planned look — solid, nothing shows through — for Muzzy to compare.
    // Each look is sent the way the Dev Kit's Tuning tab sends an edit; the file's own look comes back at the end.
    const plannedLookShots = async () => {
      const planned = page.locator('[data-planned-seed] image')
      if ((await planned.getAttribute('opacity')) !== null) fail(`${size.name}: B010: the targeted seed is see-through (opacity)`)
      if (!(await planned.getAttribute('filter'))) fail(`${size.name}: B010: the targeted seed has no planned look`)
      // the default (moonlit) keeps the letter legible: a brightness gradient map, not a pale wash over everything
      if (garden.plannedSeedLook === 'moonlit' && !(await page.locator('#planned-seed-look feFuncR[type="table"]').count()))
        fail(`${size.name}: B010: the moonlit look isn't drawn (no gradient map in the filter)`)
      if (size.name === 'phone-wide') return
      const tune = (data) => page.evaluate((data) => window.dispatchEvent(new CustomEvent('devkit:tuning', { detail: { file: 'garden', data } })), data)
      for (const look of ['moonlit', 'stencil', 'misty', 'greyed', 'dimmed']) {
        await tune({ ...garden, plannedSeedLook: look })
        await page.waitForTimeout(200)
        await page.screenshot({ path: `${OUT}/b010-${look}-${size.width}x${size.height}.png` })
      }
      await tune(garden)
      console.log(`ok   ${size.name} B010 planned seed looks · solid (filter, no opacity) · ${garden.plannedSeedLook} drawn · shots b010-*`)
    }
    // B011: Refresh 2 (the 1st and 3rd seeds in the tray set aside) plays out on the tray — they shrink away, the new seeds grow into
    // their places — and only THEN does play pass on (the handoff). Slowed right down (sent as the Dev Kit would) so
    // each stage can be caught and pictured; the file's own timings come back at the end.
    const refreshPlaysOut = async (twoSeeds) => {
      const tuneAnim = (data) => page.evaluate((data) => window.dispatchEvent(new CustomEvent('devkit:tuning', { detail: { file: 'anim', data } })), data)
      await tuneAnim({ ...anim, refreshShrinkTime: 1.2, refreshGrowTime: 1.2, refreshStagger: 0.2, refreshPause: 0.3 })
      const moment = () => page.evaluate(() => {
        const s = window.__glyphtender.store.getState()
        return {
          fx: s.refreshFx, phase: s.game.phase, current: s.game.current, handoff: s.handoff !== null,
          showSeeds: [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Show my seeds')),
          animated: [...document.querySelectorAll('[data-refresh-slot]')].filter((g) => g.getAnimations().length > 0).map((g) => Number(g.dataset.refreshSlot)),
        }
      })
      const seat = await store((s) => s.game.current)
      await tap(page.getByRole('button', { name: 'Refresh 2' }))
      const out = await moment()
      const places = twoSeeds.join()
      if (out.fx?.stage !== 'out' || out.fx.slots.join() !== places) fail(`${size.name}: B011: Refresh 2 did not start shrinking tray places ${places} (${JSON.stringify(out.fx)})`)
      if (out.animated.join() !== places) fail(`${size.name}: B011: shrinking animations on tray places [${out.animated}], expected [${places}]`)
      await tap(page.locator('[data-tray-pos][data-hand]').first()) // locked while it plays: this sets nothing aside
      if ((await store((s) => s.setAside.length)) !== 2) fail(`${size.name}: B011: a tray tap got through during the refresh`)
      await page.waitForTimeout(700)
      await page.screenshot({ path: `${OUT}/${size.name}-10b-refresh-shrinking.png` })
      await page.waitForFunction(() => window.__glyphtender.store.getState().refreshFx?.stage === 'in', null, { timeout: 5000 })
      const grow = await moment()
      if (grow.animated.join() !== grow.fx.newSlots.join() || !twoSeeds.every((p) => grow.fx.newSlots.includes(p))) {
        fail(`${size.name}: B011: growing animations on tray places [${grow.animated}], new seeds in [${grow.fx.newSlots}]`)
      }
      await page.waitForTimeout(600)
      await page.screenshot({ path: `${OUT}/${size.name}-10c-refresh-growing.png` })
      const mid = await moment()
      for (const m of [out, grow, mid]) {
        if (m.fx && (m.handoff || m.showSeeds || m.phase !== 'refresh' || m.current !== seat)) fail(`${size.name}: B011: play passed on before the refresh finished playing out`)
      }
      await page.waitForFunction(() => window.__glyphtender.store.getState().refreshFx === null, null, { timeout: 5000 })
      const after = await moment()
      if (after.phase === 'refresh' || after.current === seat) fail(`${size.name}: B011: play didn't pass on after the refresh`)
      await tuneAnim(anim)
      console.log(`ok   ${size.name} B011 refresh: shrink [${out.animated}] → grow [${grow.animated}] → then ${after.handoff ? 'the handoff' : 'the next player'}`)
    }
    // While dragging over a legal hex: its "drop here" mark shows on that hex
    const checkDropTarget = async () => {
      const lit = await page.evaluate(() => document.querySelector('[data-drop-target][visibility="visible"]')?.getAttribute('data-drop-hex') ?? null)
      if (!lit) fail(`${size.name}: no drop-target highlight under the dragged piece`)
      else console.log(`ok   ${size.name} 6-drop-target · ${lit}`)
    }
    const castButton = () => page.locator('.game-actions button').last()
    // Pass-and-play: when the device is being passed on, tap "Show my seeds" (it waits for a thrown seed to grow)
    const passIfAsked = async () => {
      if (!(await store((s) => s.handoff !== null))) return
      const show = page.getByRole('button', { name: 'Show my seeds' })
      await show.waitFor({ timeout: 5000 })
      await tap(show)
    }

    // B007: after every turn, once its score pops have played, none of their numbers may still show
    const noPopsLeft = async (when) => {
      const left = await leftoverPops(page)
      if (left.length) fail(`${size.name} ${when}: score numbers still on the board after the pops finished: ${left.join(' ')}`)
    }

    // ---- menu → Play ----
    await page.goto(`http://127.0.0.1:${PORT}/`)
    await page.getByRole('button', { name: 'Play', exact: true }).click()
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

    // ---- whose turn: your movable glyphlings pulse gently until one moves ----
    const pulsing = await frozenShot('3b-turn-pulse', '[data-pulse]', 0.5)
    const pulseIds = await store((s) => s.game.glyphlings.filter((g) => g.seat === s.game.current && !s.game.tangled.includes(g.id)).length)
    if (pulsing !== pulseIds) fail(`${size.name}: ${pulsing} glyphlings pulse at the start of the turn (expected ${pulseIds})`)
    else console.log(`ok   ${size.name} 3b-turn-pulse · ${pulsing} pulsing`)

    // ---- the "no" shake: tapping another player's glyphling ----
    const theirs = await store((s) => s.game.glyphlings.find((g) => g.seat !== s.game.current).id)
    await tapGlyph(page.locator(`[data-glyph="${theirs}"]`))
    const shaking = await frozenShot('3c-no-shake', `[data-shake="${theirs}"]`, 0.2)
    if (shaking !== 1) fail(`${size.name}: tapping another player's glyphling did not shake it`)
    else console.log(`ok   ${size.name} 3c-no-shake`)
    if (await store((s) => s.selected !== null)) fail(`${size.name}: another player's glyphling was picked up`)

    // ---- turns ----
    // Turn 1 by taps, turn 2 by drags, turn 3 checks Undo. Then keep playing until we've seen a cast that
    // grows a word (outlines + glow) and a refresh (the dev hook picks a seed + hex for that; the taps are real).
    let refreshed = false, grewWords = false, undoChecked = false
    for (let turn = 1; turn <= 3 || !refreshed || !grewWords; turn++) {
      if (turn > 30) { fail(`${size.name}: in 30 turns: words grown ${grewWords}, refreshed ${refreshed}`); break }
      const mine = await store((s) => s.game.glyphlings.filter((g) => g.seat === s.game.current && !s.game.tangled.includes(g.id)).map((g) => g.id))
      const glyph = page.locator(`[data-glyph="${mine[0]}"]`)
      // Before the move a tray seed can't be dragged at all — not even to reorder the tray — it shakes "no" (B008)
      if (turn === 1) {
        const before = await store((s) => ({ order: s.trayOrder[s.game.current].join(), nopes: s.nope?.count ?? 0 }))
        await drag(page.locator('[data-tray-pos="0"]'), page.locator('[data-tray-pos="3"]'))
        const after = await store((s) => ({ order: s.trayOrder[s.game.current].join(), nope: s.nope, selected: s.selected }))
        if (before.order !== after.order) fail(`${size.name}: B008: a tray seed was dragged (reordered) before the move`)
        if (after.selected) fail(`${size.name}: B008: dragging a tray seed before the move picked it up`)
        if (after.nope?.kind !== 'hand' || after.nope.count <= before.nopes) fail(`${size.name}: B008: dragging a tray seed before the move did not shake "no"`)
        else console.log(`ok   ${size.name} B008 no tray drag before the move (it shakes)`)
      }
      // Move
      if (turn === 2) {
        if (size.mobile) await touchDragVia(glyph, () => option('move', 0))
        else await dragVia(glyph, () => option('move', 0), true)
      } else {
        if (turn === 1 && !size.mobile) {
          // B005: only the main mouse button plays — a right- or middle-click picks nothing up
          for (const button of ['right', 'middle']) {
            await glyph.click({ button, force: true })
            if (await store((s) => s.selected !== null)) fail(`${size.name}: a ${button}-click picked up a glyphling`)
          }
        }
        await tapGlyph(glyph)
        if (turn === 1) await shot('4-move-options')
        await tap(option('move', Math.floor((await optionCount('move')) / 3)))
        if (turn === 1) {
          if (!(await gliding())) fail(`${size.name}: the planned move did not glide`)
          else await midGlideShot('4b-gliding')
          // the moved glyphling's cast range shows straight away, before a seed is picked — the filled template in a
          // lighter shade of the player's colour (castShade, no dashed outline), and a dotted path from where it stood
          const gold = await optionCount('cast')
          const withSeeds = await store((s) => s.game.hands[s.game.current].length > 0)
          if (withSeeds && gold === 0) fail(`${size.name}: no cast hexes right after the move`)
          const look = await page.evaluate(() => ({
            options: [...new Set([...document.querySelectorAll('[data-option="cast"] > polygon[data-hex]')].map((el) => el.getAttribute('fill')))].join(),
            rings: document.querySelectorAll('[data-option="cast"] polygon[stroke-dasharray]').length,
            trail: document.querySelector('[data-trail="plan"] [data-trail-part="path"] > :last-child')?.getAttribute('stroke') ?? null,
          }))
          const colour = garden[['yellow', 'blue', 'purple', 'pink'][await store((s) => s.game.current)]]
          const tint = castColour(colour, garden.background, garden.castShade)
          if (withSeeds && (look.options !== tint || look.rings !== 0)) fail(`${size.name}: cast options not filled in ${tint} (a lighter ${colour}) without dashes (${JSON.stringify(look)})`)
          if (look.trail !== colour) fail(`${size.name}: no dotted path in the player's colour from the glyphling's spot (${look.trail})`)
          else console.log(`ok   ${size.name} 5a cast options in ${tint} (lighter ${colour}) + planned path in ${colour}`)
          await shot('5a-cast-range-after-move')
        }
      }
      if (!(await store((s) => s.move !== null))) { fail(`${size.name} turn ${turn}: no move planned`); break }
      // Once the move is planned, dragging in the tray reorders it (turn 4: after B008's "no" before the move)
      if (turn === 4 && (await store((s) => s.game.hands[s.game.current].length >= 4))) {
        const before = await store((s) => s.trayOrder[s.game.current].join())
        await drag(page.locator('[data-tray-pos="0"]'), page.locator('[data-tray-pos="3"]'))
        const after = await store((s) => s.trayOrder[s.game.current].join())
        if (before === after) fail(`${size.name}: dragging in the tray after the move did not reorder it`)
        // (the reorder drag leaves that seed picked up — B004 — tap it again to put it down)
        const held = await store((s) => (s.selected?.kind === 'seed' ? s.trayOrder[s.game.current].indexOf(s.selected.index) : -1))
        if (held >= 0) await tap(page.locator(`[data-tray-pos="${held}"]`))
      }
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
        if (wantMagic && magic > 0) {
          await shot('7-planned-words')
          const borders = await page.locator('[data-planned-words] [data-word-hex]').count()
          if (borders < 2) fail(`${size.name}: the planned word has no white border (${borders} hexes)`)
          await plannedLookShots()
        }
        if (turn === 3 && !undoChecked) {
          undoChecked = true
          await tap(page.locator('.game-actions button', { hasText: 'Undo' }))
          if (await store((s) => s.cast !== null)) fail(`${size.name}: Undo did not take the seed back`)
          await tap(page.locator('.game-actions button', { hasText: 'Undo' }))
          if (await store((s) => s.move !== null)) fail(`${size.name}: Undo did not take the move back`)
          if (!(await gliding())) fail(`${size.name}: Undo did not glide the glyphling back`)
          await glidesDone()
          turn-- // play this turn again
          continue
        }
        // The tray never re-sorts on a cast: note every seed's place now, check them after the landing
        const trayBefore = await store((s) => ({ seat: s.game.current, letters: s.trayOrder[s.game.current].map((i) => s.game.hands[s.game.current][i] ?? '_') }))
        await tap(castButton())
        if (wantMagic && magic > 0) {
          await page.waitForTimeout(120)
          await page.screenshot({ path: `${OUT}/${size.name}-8-throw.png` })
          await waitLanded()
          await page.waitForTimeout(350) // the runeblossom has sprouted; its words score one at a time, then fade
          await page.screenshot({ path: `${OUT}/${size.name}-9-grown.png` })
          await scorePopShots()
          grewWords = true
        }
        await waitLanded()
        const trayAfter = await store(`(s) => s.trayOrder[${trayBefore.seat}].map((i) => s.game.hands[${trayBefore.seat}][i] ?? '_')`)
        const moved = trayBefore.letters.flatMap((l, p) => (p !== pos && trayAfter[p] !== l ? [p] : []))
        if (moved.length) fail(`${size.name} turn ${turn}: the tray re-sorted on the cast: ${trayBefore.letters.join('')} → ${trayAfter.join('')}`)
        else if (turn <= 2) console.log(`ok   ${size.name} turn ${turn}: tray kept its order on the cast · ${trayBefore.letters.join('')} → ${trayAfter.join('')}`)
      } else {
        await tap(castButton()) // End turn
      }
      await waitLanded()
      if (await store((s) => s.game.phase === 'refresh')) {
        const twoSeeds = await store((s) => s.trayOrder[s.game.current].flatMap((i, p) => (i >= 0 ? [p] : [])).filter((_, n) => n === 0 || n === 2))
        for (const p of twoSeeds) await tap(page.locator(`[data-tray-pos="${p}"][data-hand]`))
        if (!refreshed) await shot('10-refresh')
        if (!refreshed) await refreshPlaysOut(twoSeeds)
        else await tap(page.getByRole('button', { name: 'Refresh 2' }))
        await page.waitForFunction(() => window.__glyphtender.store.getState().refreshFx === null, null, { timeout: 8000 })
        if (!(await store((s) => s.game.phase !== 'refresh'))) fail(`${size.name}: refresh did not happen`)
        refreshed = true
      }
      await passIfAsked()
      await noPopsLeft(`after turn ${turn}`)
      if (await store((s) => s.game.phase === 'over')) break
      // Between turns: shuffle the tray
      if (turn === 2) {
        await tap(page.getByRole('button', { name: 'Shuffle' }))
        const shuffledOk = await store((s) => s.trayOrder[s.game.current].filter((i) => i >= 0).sort().join() === [...s.game.hands[s.game.current].keys()].join())
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
    const stars = await page.locator('.game-end-player[data-winner]').count()
    if (stars < 1) fail(`${size.name}: no winner marked`)
    // B005: closed results stay closed (nothing reopens them by itself); the Results button brings them back
    await page.keyboard.press('Escape')
    await tap(page.getByRole('button', { name: 'Results' }))
    await table.waitFor({ timeout: 3000 })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(2000)
    if (await table.isVisible()) fail(`${size.name}: the end table reopened by itself after it was closed`)
    await tap(page.getByRole('button', { name: 'Results' }))
    await table.waitFor({ timeout: 3000 })
    if (await table.getByRole('button', { name: 'Play again' }).count()) fail(`${size.name}: the end table still has Play again`)
    await table.getByRole('button', { name: 'New game' }).click()
    // ---- New game → the new-game screen: this time word indicators OFF ----
    await page.getByRole('button', { name: 'Start' }).waitFor({ timeout: 3000 })
    if (await store((s) => s.game !== null)) fail(`${size.name}: New game did not leave the finished game`)
    await page.getByRole('switch', { name: 'Word indicators' }).click()
    await page.screenshot({ path: `${OUT}/${size.name}-12a-new-game-indicators-off.png` })
    await page.getByRole('button', { name: 'Start' }).click()
    if (!(await store((s) => s.options.wordIndicators === false))) fail(`${size.name}: word indicators did not turn off`)
    while (await store((s) => s.game.phase === 'draft')) await tap(option('move', Math.floor((await optionCount('move')) / 2)))
    await passIfAsked()
    await indicatorsOffTurn()
    await passIfAsked()
    if (await store((s) => s.game.phase === 'refresh')) await tap(page.getByRole('button', { name: 'Keep all' }))
    await passIfAsked()

    // ---- Settings → Gameplay → Tray position: Flipped (the tray above the board / on its left) ----
    const sideBefore = await page.evaluate(() => document.querySelector('.game').dataset.layout === 'side')
    const columnBefore = await page.evaluate(() => Math.round(document.querySelector('.game-panel').getBoundingClientRect().width))
    await tap(page.getByRole('button', { name: 'Menu' }))
    await shot('12-pause')
    await page.getByRole('button', { name: 'Settings' }).click()
    // (a tab bar on big screens; phones step through the tabs with ◀ Audio ▶)
    const gameplayTab = page.getByRole('tab', { name: 'Gameplay' })
    if (await gameplayTab.isVisible()) await gameplayTab.click()
    else {
      for (let i = 0; i < 8 && !(await page.getByRole('group', { name: 'Settings' }).textContent()).includes('Gameplay'); i++) {
        await page.getByRole('button', { name: 'Next Settings' }).click()
      }
    }
    await page.getByRole('button', { name: 'Next Tray position' }).click()
    await page.screenshot({ path: `${OUT}/${size.name}-14a-settings-tray.png` })
    await page.keyboard.press('Escape') // Settings
    await page.keyboard.press('Escape') // Pause
    await shot('14-flipped')
    const flipped = await page.evaluate(() => {
      const board = document.querySelector('.game-board').getBoundingClientRect()
      const panel = document.querySelector('.game-panel').getBoundingClientRect()
      const side = document.querySelector('.game').dataset.layout === 'side'
      return { side, ok: side ? panel.right <= board.left + 1 : panel.bottom <= board.top + 1, column: Math.round(panel.width) }
    })
    if (!flipped.ok) fail(`${size.name}: flipped, but the tray is not ${flipped.side ? 'left of' : 'above'} the board`)
    if (sideBefore && flipped.column !== columnBefore) fail(`${size.name}: the side column changed width when flipped (${columnBefore} → ${flipped.column})`)
    console.log(`${flipped.ok ? 'ok  ' : 'FAIL'} ${size.name} 14-flipped · column ${columnBefore} → ${flipped.column}`)
    // Menu → Leave game → confirm → main menu
    await tap(page.getByRole('button', { name: 'Menu' }))
    await page.getByRole('button', { name: 'Leave game' }).click()
    await page.getByRole('dialog', { name: 'Leave this game?' }).getByRole('button', { name: 'Leave game' }).click()
    await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 3000 })
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
