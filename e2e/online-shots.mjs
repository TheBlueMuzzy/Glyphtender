// A 2-PLAYER ONLINE GAME THROUGH THE REAL SCREENS AND A REAL LOCAL SERVER — a phone (390×844, Ada, the host)
// and a desktop (1440×900, Bo) in two separate browsers (own storage = two different players):
// Play online → Create (code) / Join by code → lobby (Bo ready, one shot at 844×390) → Start → the draft and a few
// turns by taps (shots of the other player's turn arriving mid-glide) → Bo reloads mid-game and gets his seat back
// → the host's browser closes: Bo becomes host, keeps playing, a bot takes Ada's seat after botTakesOverAfterMs
// → Ada comes back by the code and takes her seat back → both play to the end → the Magic reveal + end table on
// both (just New game + Menu) → the guest's New game waits for the host; the host's New game takes BOTH back to the
// lobby → Leave. Feel checks: only the player whose turn it is sees their glyphlings pulse; the other player's
// turn pops its Magic on the watcher's screen too (word indicators on — the host's lobby option, in every view).
// Every WebSocket frame each browser RECEIVES is recorded: the run FAILS if one ever
// holds another player's seeds, the bag, the rng, the seed or any Magic before the game is over.
// Also checks every screenshot (nothing past a screen edge, buttons ≥ 44 px) and a clean console.
// Starts its OWN `wrangler dev` (default port 1995 — never 1997, where `npm run party:dev` runs) and Vite
// (default 5311) and stops only those. The page finds that server through VITE_PARTY_PORT (ui/online/session.ts).
//   npm run e2e:online [outDir] [vitePort] [partyPort]
import { spawn, execSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { createServer as netServer } from 'node:net'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { leftoverPops } from './leftover-pops.mjs'

const OUT = process.argv[2] ?? 'e2e-shots'
const VITE_PORT = Number(process.argv[3] ?? 5311)
const PARTY_PORT = Number(process.argv[4] ?? 1995)
const BOT_AFTER_MS = JSON.parse(readFileSync('content/rooms.json', 'utf8')).botTakesOverAfterMs
mkdirSync(OUT, { recursive: true })

let failures = 0
const fail = (why) => { failures++; console.log(`  FAIL ${why}`) }
const check = (what, ok) => { if (!ok) fail(what) }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- our own servers (never anyone else's) ----
const portFree = (port) => new Promise((ok) => {
  const probe = netServer().once('error', () => ok(false)).once('listening', () => probe.close(() => ok(true))).listen(port, '0.0.0.0')
})
if (!(await portFree(PARTY_PORT))) throw new Error(`Port ${PARTY_PORT} is busy — pass another: npm run e2e:online e2e-shots 5311 <port>`)
const party = spawn(`npx wrangler dev --port ${PARTY_PORT} --ip 127.0.0.1 --inspector-port 0`, { shell: true, cwd: process.cwd() })
let partyLog = ''
party.stdout.on('data', (d) => { partyLog += d })
party.stderr.on('data', (d) => { partyLog += d })
const stopParty = () => {
  try { process.platform === 'win32' ? execSync(`taskkill /PID ${party.pid} /T /F`, { stdio: 'ignore' }) : party.kill() } catch { /* already gone */ }
}
for (let t = 0; t < 120 && !/Ready on/.test(partyLog); t++) await wait(500)
if (!/Ready on/.test(partyLog)) { stopParty(); throw new Error(`wrangler dev didn't start:\n${partyLog}`) }
process.env.VITE_PARTY_PORT = String(PARTY_PORT) // the page talks to OUR server
const vite = await createServer({ server: { port: VITE_PORT, strictPort: true, host: '127.0.0.1' }, logLevel: 'warn' })
await vite.listen()
const browser = await chromium.launch()

// Everything visible must be inside the screen, and buttons big enough for a finger (as e2e:pass)
function problems() {
  const out = []
  for (const el of document.querySelectorAll('.game button, .game-tray, .game-garden, .kit-screen button, .kit-text')) {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height || el.closest('.kit-scroll, [data-scroll]')) continue
    const name = (el.textContent || el.getAttribute('class') || '').trim().slice(0, 30)
    if (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) out.push(`clipped: ${name}`)
    if (el.tagName === 'BUTTON' && (r.height < 43.5 || r.width < 43.5)) out.push(`small button: ${name} ${Math.round(r.width)}×${Math.round(r.height)}`)
  }
  return out
}

// ---- the secrecy check: every frame a browser received, before the results ----
const HIDDEN = '?'
function secretsIn(frame) {
  let message
  try { message = JSON.parse(frame) } catch { return [] }
  const out = []
  if (/persistent/i.test(frame)) out.push('a persistentId')
  if (message.type !== 'view' || !message.view) return out
  const { game, mySeat, results } = message.view
  if (game.phase === 'over') return out // the reveal: the whole truth, on purpose
  game.hands.forEach((hand, seat) => { if (seat !== mySeat && hand.some((s) => s !== HIDDEN)) out.push(`seat ${seat}'s seeds`) })
  if (game.bag.some((s) => s !== HIDDEN)) out.push('the bag')
  if (game.rng !== 0 || game.config.seed !== 0) out.push('the rng / seed')
  if ([...game.magic, ...game.tangleMagic].some((m) => m !== 0) || game.winners.length) out.push('Magic totals')
  if (game.lastTurn && (game.lastTurn.magic !== 0 || game.lastTurn.words.some((w) => w.magic !== 0))) out.push("last turn's Magic")
  if (results) out.push('results')
  return out
}

// ---- a player = a browser context (own storage) + its page ----
function player(name, context, size) {
  const me = { name, context, size, page: null, frames: [], errors: [] }
  me.open = async () => {
    const page = await context.newPage()
    page.on('console', (m) => m.type() === 'error' && me.errors.push(m.text()))
    page.on('pageerror', (e) => me.errors.push(e.message))
    page.on('websocket', (ws) => ws.on('framereceived', (f) => me.frames.push(String(f.payload))))
    await page.goto(`http://127.0.0.1:${VITE_PORT}/`)
    me.page = page
  }
  me.tap = (loc) => (size.mobile ? loc.tap() : loc.click())
  // A glyphling whose turn it is pulses (it never holds still), so Playwright's "wait until stable" would wait forever
  me.tapGlyph = (loc) => (size.mobile ? loc.tap({ force: true }) : loc.click({ force: true }))
  me.store = (fn) => me.page.evaluate(`(${fn})(window.__glyphtender.store.getState())`)
  me.room = (fn) => me.page.evaluate(`(${fn})(window.__glyphtender.online.getState())`)
  me.shot = async (label, settle = 400) => {
    await me.page.waitForFunction(() => [...document.querySelectorAll('[data-glide]')].every((g) => g.getAnimations().length === 0), null, { timeout: 4000 }).catch(() => {})
    await me.page.waitForTimeout(settle)
    const tag = `${me.page.viewportSize().width}x${me.page.viewportSize().height}`
    await me.page.screenshot({ path: `${OUT}/online-${tag}-${label}.png` })
    const out = await me.page.evaluate(problems)
    out.forEach((p) => fail(`${name} ${label}: ${p}`))
    console.log(`${out.length ? 'FAIL' : 'ok  '} ${name} ${tag} ${label}`)
  }
  return me
}

const ada = player('Ada', await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), { mobile: true })
const bo = player('Bo', await browser.newContext({ viewport: { width: 1440, height: 900 } }), { mobile: false })

// Is it this player's turn, with nothing in the air and nothing on its way to the server?
const myTurn = (p) => p.page && !p.page.isClosed() && p.store((s) => !!s.game && !!s.online && s.game.phase !== 'over'
  && s.game.current === s.online.mySeat && !s.waiting && !s.flying && s.wordsStatus === 'ready')

// One turn through the screen: a draft placement, Keep all on a refresh (Refresh 1 the first time), or move + cast (Magic if it can) + Cast
let refreshSeen = false
async function playTurn(p) {
  const { page } = p
  const option = (kind) => page.locator(`[data-option="${kind}"] circle`)
  const phase = await p.store((s) => s.game.phase)
  if (phase === 'draft') {
    const count = await option('move').count()
    await p.tap(option('move').nth(Math.floor(count * (0.25 + Math.random() * 0.5))))
  } else if (phase === 'refresh' && !refreshSeen) {
    // B011, once: Refresh 1 plays out on MY tray (shrink, then the server's new seed grows in), then play passes on
    refreshSeen = true
    await p.tap(page.locator('[data-tray-pos="1"]'))
    await p.tap(page.getByRole('button', { name: 'Refresh 1' }))
    const fx = await p.store((s) => s.refreshFx)
    check(`${p.name}: B011 my refresh shrinks tray place 1 (${JSON.stringify(fx)})`, fx?.stage === 'out' && fx.slots.join() === '1')
    await page.waitForFunction(() => window.__glyphtender.store.getState().refreshFx?.stage === 'in', null, { timeout: 5000 })
      .catch(() => fail(`${p.name}: B011 the new seeds never grew in`))
    await page.waitForFunction(() => window.__glyphtender.store.getState().refreshFx === null, null, { timeout: 5000 })
    check(`${p.name}: B011 play passed on after my refresh`, await p.store((s) => s.game.phase !== 'refresh'))
    console.log(`ok   ${p.name} B011 refresh played out on my tray`)
  } else if (phase === 'refresh') {
    await p.tap(page.getByRole('button', { name: 'Keep all' }))
  } else {
    const mine = await p.store((s) => s.game.glyphlings.filter((g) => g.seat === s.game.current && !s.game.tangled.includes(g.id)).map((g) => g.id))
    await p.tapGlyph(page.locator(`[data-glyph="${mine[Math.floor(Math.random() * mine.length)]}"]`))
    const count = await option('move').count()
    await p.tap(option('move').nth(Math.floor(Math.random() * count)))
    const pick = await page.evaluate(() => window.__glyphtender.findCast(true) ?? window.__glyphtender.findCast(false))
    if (pick) {
      const pos = await p.store(`(s) => s.trayOrder[s.online.mySeat].indexOf(${pick.seed})`)
      await p.tap(page.locator(`[data-tray-pos="${pos}"]`))
      await p.tap(page.locator(`[data-option="cast"] circle[data-hex="${pick.hex}"]`))
    }
    await p.tap(page.locator('.game-actions button').last()) // Cast (or End turn)
  }
  await page.waitForFunction(() => { const s = window.__glyphtender.store.getState(); return !s.flying && !s.waiting }, null, { timeout: 10000 })
}

/** Whoever's turn it is plays, until done() says stop. `watch` = take a shot of the other player's turn arriving. */
async function playUntil(players, done, { seconds = 120, watch = null } = {}) {
  const until = Date.now() + seconds * 1000
  while (!(await done())) {
    if (Date.now() > until) return fail(`gave up waiting after ${seconds} s`)
    let played = false
    for (const p of players) {
      if (!(await myTurn(p))) continue
      const watcher = players.find((other) => other !== p)
      if (!feel.pulseChecked && watcher && (await p.store((s) => s.game.phase === 'play'))) {
        // Whose turn: only the player to move sees their glyphlings pulse — never on the other screen
        await p.page.waitForTimeout(100)
        const pulses = (who) => who.page.evaluate(() => [...document.querySelectorAll('[data-pulse]')].filter((g) => g.getAnimations().length > 0).length)
        const mine = await pulses(p), theirs = await pulses(watcher)
        check(`${p.name}'s glyphlings pulse on their turn (${mine})`, mine > 0)
        check(`nothing pulses on ${watcher.name}'s screen while ${p.name} plays (${theirs})`, theirs === 0)
        console.log(`${mine > 0 && theirs === 0 ? 'ok  ' : 'FAIL'} turn pulse: ${p.name} ${mine} · ${watcher.name} ${theirs}`)
        feel.pulseChecked = true
      }
      await playTurn(p)
      played = true
      if (watch && watcher && (await p.store((s) => s.game.phase === 'play' || s.game.phase === 'refresh'))) {
        // The watcher's board replays the move: the glyphling glides first — picture it halfway
        const arrived = await watcher.page.waitForFunction(() => { const s = window.__glyphtender.store.getState(); return s.move && s.game.current !== s.online.mySeat }, null, { timeout: 5000 }).then(() => true, () => false)
        if (arrived && !watch.done.has(watcher.name)) {
          watch.done.add(watcher.name)
          await watcher.page.waitForTimeout(60)
          await watcher.page.screenshot({ path: `${OUT}/online-${watcher.page.viewportSize().width}x${watcher.page.viewportSize().height}-4-incoming-turn.png` })
          console.log(`ok   ${watcher.name} 4-incoming-turn (mid-glide)`)
        }
      }
      // A turn that grew words: its Magic pops on the watcher's screen too, once the replayed seed lands
      if (watcher && !feel.popsSeen && (await p.store((s) => s.game.lastTurn?.seat === s.online.mySeat && s.game.lastTurn.words.length > 0))) {
        const popped = await watcher.page.waitForFunction(() => document.querySelectorAll('[data-score-pop]').length > 0, null, { timeout: 8000 }).then(() => true, () => false)
        if (popped) {
          feel.popsSeen = true
          await watcher.page.waitForTimeout(300)
          await watcher.page.screenshot({ path: `${OUT}/online-${watcher.page.viewportSize().width}x${watcher.page.viewportSize().height}-4b-incoming-pops.png` })
          console.log(`ok   ${watcher.name} 4b-incoming-pops (${p.name}'s turn)`)
        }
      }
      // B007 (mid-game turns): once a turn's pops have played — on the caster's screen and the watcher's replay —
      // none of their numbers may still be on the board
      if (watch) {
        for (const who of [p, watcher].filter(Boolean)) {
          const left = await leftoverPops(who.page)
          check(`${who.name}: no score numbers left on the board after the pops (${left.join(' ')})`, left.length === 0)
        }
      }
    }
    if (!played) await wait(250)
  }
}
const turnCount = (p) => p.store((s) => s.game?.turnCount ?? -1)
const feel = { pulseChecked: false, popsSeen: false }

try {
  // ---- Ada creates a room ----
  await ada.open()
  await ada.tap(ada.page.getByRole('button', { name: 'Play online' }))
  await ada.page.getByRole('textbox', { name: 'Your name' }).fill('Ada')
  await ada.shot('0-play-online')
  await ada.tap(ada.page.getByRole('button', { name: 'Create a room' }))
  await ada.page.getByText(/^Room [A-Z]{4}$/).waitFor({ timeout: 10000 })
  const code = await ada.room((s) => s.code)
  console.log(`     room ${code}`)

  // ---- Bo joins by the code (typed into the code boxes), readies up ----
  await bo.open()
  await bo.page.setViewportSize({ width: 844, height: 390 })
  await bo.tap(bo.page.getByRole('button', { name: 'Play online' }))
  await bo.page.getByRole('textbox', { name: 'Your name' }).fill('Bo')
  await bo.page.locator('.kit-roomcode-box').first().click()
  await bo.page.keyboard.type(code.toLowerCase())
  await bo.shot('0-join')
  await bo.tap(bo.page.getByRole('button', { name: 'Join', exact: true }))
  await bo.page.getByRole('button', { name: 'I’m ready' }).waitFor({ timeout: 10000 })
  await bo.shot('1-lobby-guest')
  await bo.tap(bo.page.getByRole('button', { name: 'I’m ready' }))
  await bo.page.setViewportSize({ width: 1440, height: 900 })
  await bo.shot('1-lobby-guest')
  const start = ada.page.getByRole('button', { name: 'Start game' })
  await ada.page.waitForFunction(() => !document.querySelector('.kit-modal button:last-child')?.disabled, null, { timeout: 10000 })
  await ada.shot('1-lobby-host')
  await ada.tap(start)

  // ---- the game: the draft, then a few turns by taps ----
  for (const p of [ada, bo]) await p.page.waitForFunction(() => window.__glyphtender.store.getState().wordsStatus === 'ready' && window.__glyphtender.store.getState().game, null, { timeout: 15000 })
  check('Ada is Yellow (seat 0), Bo is Blue (seat 1)', (await ada.store((s) => s.online.mySeat)) === 0 && (await bo.store((s) => s.online.mySeat)) === 1)
  check('no handoff screen online', await ada.store((s) => s.handoff === null))
  check('word indicators on (the host’s lobby option) on both screens', (await ada.store((s) => s.options.wordIndicators)) && (await bo.store((s) => s.options.wordIndicators)))
  await ada.shot('2-draft')
  await playUntil([ada, bo], async () => (await ada.store((s) => s.game.phase)) !== 'draft')
  const watch = { done: new Set() }
  await playUntil([ada, bo], async () => (await turnCount(ada)) >= 4 && (await turnCount(bo)) >= 4 && feel.popsSeen, { watch, seconds: 240 })
  check('the other player’s turn popped its Magic on the watcher’s screen', feel.popsSeen)
  await ada.shot('3-mid-game')
  await bo.shot('3-mid-game')

  // ---- Bo reloads mid-game: straight back into his seat ----
  const boBefore = await bo.store((s) => ({ seat: s.online.mySeat, version: s.online.version }))
  await bo.page.reload()
  await bo.page.waitForFunction(() => window.__glyphtender?.store.getState().online, null, { timeout: 15000 })
  check('after a reload Bo is back in his seat, same game', await bo.store(`(s) => s.online.mySeat === ${boBefore.seat} && s.online.version >= ${boBefore.version}`))

  // ---- the host's browser closes: Bo becomes host and keeps playing; a bot takes Ada's seat ----
  await ada.page.close()
  await bo.page.waitForFunction(() => window.__glyphtender.online.getState().room?.isHost, null, { timeout: 10000 })
  console.log(`ok   host moved to Bo · waiting ${BOT_AFTER_MS / 1000} s for a bot to take Ada's seat`)
  const before = await turnCount(bo)
  await playUntil([bo], async () => (await turnCount(bo)) >= before + 3 || (await bo.store((s) => s.game.phase === 'over')), { seconds: BOT_AFTER_MS / 1000 + 60 })
  check('the game went on without the host', (await turnCount(bo)) > before)

  // ---- Ada comes back (a new tab: joins by the code) and takes her seat back ----
  await ada.open()
  await ada.tap(ada.page.getByRole('button', { name: 'Play online' }))
  await ada.page.locator('.kit-roomcode-box').first().click()
  await ada.page.keyboard.type(code)
  await ada.tap(ada.page.getByRole('button', { name: 'Join', exact: true }))
  await ada.page.waitForFunction(() => window.__glyphtender.store.getState().online?.mySeat === 0, null, { timeout: 15000 })
  console.log('ok   Ada is back in seat 0')

  // ---- play it out, then the Magic reveal and the end table on both ----
  await playUntil([ada, bo], async () => (await ada.store((s) => s.game?.phase === 'over')) && (await bo.store((s) => s.game?.phase === 'over')), { seconds: 400 })
  for (const p of [ada, bo]) {
    check(`${p.name} sees everyone's Magic at the end`, await p.store((s) => s.game.magic.some((m) => m > 0)))
    await p.page.waitForTimeout(1500)
    await p.shot('5-reveal', 0)
    await p.tap(p.page.getByRole('button', { name: 'Skip' })) // the end table opens by itself after the reveal
    await p.page.getByRole('dialog').getByRole('button', { name: 'New game' }).waitFor()
    await p.shot('6-end-table')
    check(`${p.name}'s end table has both names`, (await p.page.getByText('Ada', { exact: true }).count()) > 0 && (await p.page.getByText('Bo', { exact: true }).count()) > 0)
    check(`${p.name}'s end table has no Play again`, (await p.page.getByRole('dialog').getByRole('button', { name: 'Play again' }).count()) === 0)
  }
  // New game: the guest waits for the host; the host's takes everyone back to the lobby
  const host = (await bo.room((s) => s.room?.isHost)) ? bo : ada
  const guest = host === bo ? ada : bo
  await guest.tap(guest.page.getByRole('dialog').getByRole('button', { name: 'New game' }))
  await guest.page.getByText('Waiting for the host to start the next game…').waitFor({ timeout: 3000 }).catch(() => fail(`${guest.name}: no "waiting for the host" after New game`))
  check(`${guest.name} (guest) stays at the end table after New game`, await guest.store((s) => s.game?.phase === 'over'))
  await host.tap(host.page.getByRole('dialog').getByRole('button', { name: 'New game' }))
  for (const p of [ada, bo]) {
    const inLobby = await p.page.getByRole('button', { name: 'Leave' }).waitFor({ timeout: 10000 }).then(() => true, () => false)
    check(`${p.name} is back in the lobby after the host's New game`, inLobby && (await p.store((s) => s.game === null)))
    await p.shot('7-back-in-lobby')
  }
  // Leave the room (through useRoom.leave) → the main menu
  for (const p of [ada, bo]) {
    await p.tap(p.page.getByRole('button', { name: 'Leave' }))
    await p.page.getByRole('button', { name: 'Play online' }).waitFor({ timeout: 5000 })
    check(`${p.name} left the room`, await p.room((s) => s.code === null))
  }

  // ---- the secrecy check over every frame each browser received ----
  for (const p of [ada, bo]) {
    const views = p.frames.filter((f) => f.includes('"type":"view"')).length
    const leaks = p.frames.flatMap((f) => secretsIn(f))
    check(`${p.name} received views (${views})`, views > 10)
    check(`${p.name} got the results`, p.frames.some((f) => f.includes('"results":{')))
    leaks.forEach((what) => fail(`${p.name} received ${what} before the end`))
    console.log(`${leaks.length ? 'FAIL' : 'ok  '} secrecy: ${p.name} — ${p.frames.length} frames, ${views} views, ${leaks.length} leaks`)
    // A dropped host's page and a reload can log a failed socket; anything else is a real error
    const errors = p.errors.filter((e) => !/WebSocket/.test(e))
    errors.forEach((e) => fail(`${p.name} console: ${e}`))
  }
} catch (error) {
  fail(error.stack ?? String(error))
} finally {
  await browser.close()
  await vite.close()
  stopParty()
}
console.log(failures ? `\n${failures} problem(s)` : '\nall good')
process.exit(failures ? 1 : 0)
