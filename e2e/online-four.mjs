// A 4-PLAYER ONLINE GAME THROUGH THE REAL SCREENS AND A REAL LOCAL SERVER — four browsers (own storage = four
// different players): Ada (host, phone 390×844), Bo (desktop 1440×900), Cy (phone sideways 844×390), Di (phone 390×844).
// Play online → Ada creates a room, the other three join by the code → lobby with 4 seats (shots at all three
// sizes) → everyone ready → Start → the draft (8 glyphlings) and turns by taps, whoever's turn it is →
// Cy DROPS mid-game (his tab closes): the game waits on his turn, the others see "Away" on his portrait →
// Cy comes back by the code and gets seat 2 back → everyone plays to the end → the Magic reveal + end table on
// all four (all four names) → the host's New game takes everyone back to the lobby → Leave.
// Every WebSocket frame each browser RECEIVES is recorded: the run FAILS if one ever holds another player's
// seeds, the bag, the rng, the seed or any Magic before the game is over. Also checks every screenshot
// (nothing past a screen edge, buttons ≥ 44 px) and a clean console.
// Starts its OWN `wrangler dev` (default port 1994) and Vite (default 5312) — never 1997/1999/5180/5191 — and
// stops only those. Shots: e2e-shots/online4-<size>-<step>.png
//   npm run e2e:online4 [outDir] [vitePort] [partyPort]
import { mkdirSync } from 'node:fs'
import { leftoverPops } from './leftover-pops.mjs'
import { makePlayer, secretsIn, startServers } from './online-kit.mjs'

const OUT = process.argv[2] ?? 'e2e-shots'
const VITE_PORT = Number(process.argv[3] ?? 5312)
const PARTY_PORT = Number(process.argv[4] ?? 1994)
mkdirSync(OUT, { recursive: true })

let failures = 0
const fail = (why) => { failures++; console.log(`  FAIL ${why}`) }
const check = (what, ok) => { if (!ok) fail(what) }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const { browser, stop } = await startServers(VITE_PORT, PARTY_PORT, 'npm run e2e:online4 e2e-shots <vitePort> <partyPort>')
// (Settings → Full screen off: this check resizes a phone's window, which a full-screen page can't do — e2e:fullscreen
// covers full screen itself)
async function context(viewport, mobile) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile })
  await ctx.addInitScript(() => {
    const key = 'kit-settings:'
    localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key) ?? '{}'), fullscreen: false }))
  })
  return ctx
}
const player = async (name, viewport, mobile) => makePlayer(name, await context(viewport, mobile), { mobile }, { vitePort: VITE_PORT, out: OUT, fail })
const TALL = { width: 390, height: 844 }, WIDE = { width: 844, height: 390 }, DESK = { width: 1440, height: 900 }
const ada = await player('Ada', TALL, true)
const bo = await player('Bo', DESK, false)
const cy = await player('Cy', WIDE, true)
const di = await player('Di', TALL, true)
const everyone = [ada, bo, cy, di]
const shot = (p, label, settle) => p.shot(label, settle, 'online4')

// Is it this player's turn, with nothing in the air and nothing on its way to the server?
const open = (p) => p.page && !p.page.isClosed()
const myTurn = (p) => open(p) && p.store((s) => !!s.game && !!s.online && s.game.phase !== 'over'
  && s.game.current === s.online.mySeat && !s.waiting && !s.flying && s.scoring === null && s.wordsStatus === 'ready') // (a score sequence holds play)

// One turn through the screen: a draft placement, Keep all on a refresh, or move + cast (Magic if it can) + Cast
async function playTurn(p) {
  const { page } = p
  const option = (kind) => page.locator(`[data-option="${kind}"] circle`)
  const phase = await p.store((s) => s.game.phase)
  if (phase === 'draft') {
    const count = await option('move').count()
    await p.tap(option('move').nth(Math.floor(count * (0.25 + Math.random() * 0.5))))
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

/** Whoever's turn it is plays, until done() says stop. */
async function playUntil(players, done, seconds = 120) {
  const until = Date.now() + seconds * 1000
  while (!(await done())) {
    if (Date.now() > until) return fail(`gave up waiting after ${seconds} s`)
    let played = false
    for (const p of players) {
      if (!(await myTurn(p))) continue
      await playTurn(p)
      played = true
    }
    if (!played) await wait(250)
  }
}
const turnCount = (p) => p.store((s) => s.game?.turnCount ?? -1)
const phaseOf = (p) => p.store((s) => s.game?.phase ?? null)

try {
  // ---- Ada creates a room ----
  await ada.open()
  await ada.tap(ada.page.getByRole('button', { name: 'Play online' }))
  await ada.page.getByRole('textbox', { name: 'Your name' }).fill('Ada')
  await ada.tap(ada.page.getByRole('button', { name: 'Create a room' }))
  await ada.page.getByText(/^Room [A-Z]{4}$/).waitFor({ timeout: 10000 })
  const code = await ada.room((s) => s.code)
  console.log(`     room ${code}`)

  // ---- Bo, Cy, Di join by the code, one after another, and get ready ----
  for (const p of [bo, cy, di]) {
    await p.open()
    await p.tap(p.page.getByRole('button', { name: 'Play online' }))
    await p.page.getByRole('textbox', { name: 'Your name' }).fill(p.name)
    await p.page.locator('.kit-roomcode-box').first().click()
    await p.page.keyboard.type(code)
    await p.tap(p.page.getByRole('button', { name: 'Join', exact: true }))
    await p.page.getByRole('button', { name: 'I’m ready' }).waitFor({ timeout: 10000 })
    if (p === di) await shot(di, '1-lobby-guest-4-seats')
    await p.tap(p.page.getByRole('button', { name: 'I’m ready' }))
  }
  await ada.page.waitForFunction(() => window.__glyphtender.online.getState().room?.room?.seats?.length === 4, null, { timeout: 10000 })
    .catch(() => fail('the host never saw 4 seats'))
  await ada.page.waitForFunction(() => !document.querySelector('.kit-modal button:last-child')?.disabled, null, { timeout: 10000 })
  // The host's lobby with 4 seats at every size
  for (const size of [TALL, WIDE, DESK]) {
    await ada.page.setViewportSize(size)
    await shot(ada, '1-lobby-host-4-seats')
    for (const name of ['Ada', 'Bo', 'Cy', 'Di']) check(`the lobby lists ${name} (${size.width}x${size.height})`, (await ada.page.getByText(name, { exact: true }).count()) > 0)
  }
  await ada.page.setViewportSize(TALL)
  await ada.tap(ada.page.getByRole('button', { name: 'Start game' }))

  // ---- the game: the draft, then turns by taps ----
  for (const p of everyone) await p.page.waitForFunction(() => window.__glyphtender.store.getState().wordsStatus === 'ready' && window.__glyphtender.store.getState().game, null, { timeout: 15000 })
  const seats = []
  for (const p of everyone) seats.push(await p.store((s) => s.online.mySeat))
  check(`seats in join order: Ada 0, Bo 1, Cy 2, Di 3 (${seats.join(' ')})`, seats.join() === '0,1,2,3')
  check('a 4-player game on the Large garden', await ada.store((s) => s.game.config.players === 4 && s.game.config.boardName === 'large'))
  check('no handoff screen online', await ada.store((s) => s.handoff === null))
  await shot(cy, '2-draft')
  await playUntil(everyone, async () => (await phaseOf(ada)) !== 'draft')
  check('8 glyphlings placed', await ada.store((s) => s.game.glyphlings.length === 8))
  await playUntil(everyone, async () => (await turnCount(ada)) >= 6, 240)
  for (const p of everyone) await shot(p, '3-mid-game')
  // Every screen agrees whose turn it is
  const currents = new Set()
  for (const p of everyone) currents.add(await p.store((s) => s.game.current))
  check(`all four screens agree whose turn it is (${[...currents].join(' ')})`, currents.size === 1)

  // ---- Cy drops mid-game (his tab closes): the game waits on his turn, the others see "Away" ----
  await cy.page.close()
  console.log('ok   Cy dropped')
  const others = [ada, bo, di]
  await playUntil(others, async () => (await ada.store((s) => s.game.phase === 'over' || s.game.current === 2)), 120)
  const cyTurn = await ada.store((s) => s.game.current === 2)
  check('the game reached Cy\'s turn while he was away', cyTurn)
  if (cyTurn) {
    const away = (p) => p.page.locator('.game-turn-bar [data-seat-status="away"]').count()
    await ada.page.waitForFunction(() => document.querySelector('.game-turn-bar [data-seat-status="away"]'), null, { timeout: 5000 }).catch(() => {})
    for (const p of others) check(`${p.name} sees "Away" on Cy's portrait`, (await away(p)) > 0)
    for (const p of others) await shot(p, '4-cy-away')
    await wait(1500)
    check('the game waits for Cy (nobody else can play)', !(await myTurn(ada)) && !(await myTurn(bo)) && !(await myTurn(di)))
  }
  // ---- Cy comes back by the code and takes seat 2 back ----
  await cy.open()
  await cy.tap(cy.page.getByRole('button', { name: 'Play online' }))
  await cy.page.locator('.kit-roomcode-box').first().click()
  await cy.page.keyboard.type(code)
  await cy.tap(cy.page.getByRole('button', { name: 'Join', exact: true }))
  const back = await cy.page.waitForFunction(() => window.__glyphtender.store.getState().online?.mySeat === 2, null, { timeout: 15000 }).then(() => true, () => false)
  check('Cy is back in seat 2', back)
  if (back) {
    await cy.page.waitForFunction(() => window.__glyphtender.store.getState().wordsStatus === 'ready', null, { timeout: 15000 })
    await shot(cy, '5-cy-back')
    console.log('ok   Cy is back in seat 2')
  }
  await playUntil(everyone, async () => (await ada.store((s) => s.game.phase === 'over' || s.game.current !== 2)), 60)
  check('no "Away" once Cy is back', (await ada.page.locator('.game-turn-bar [data-seat-status]').count()) === 0)

  // ---- play it out (B007 checked now and then), then the Magic reveal and the end table on all four ----
  let lastPopCheck = 0
  await playUntil(everyone, async () => {
    const turns = await turnCount(ada)
    if (turns >= lastPopCheck + 10) {
      lastPopCheck = turns
      for (const p of everyone) {
        const left = await leftoverPops(p.page)
        check(`${p.name}: no score numbers left on the board (${left.join(' ')})`, left.length === 0)
      }
    }
    for (const p of everyone) if ((await phaseOf(p)) !== 'over') return false
    return true
  }, 600)
  for (const p of everyone) {
    check(`${p.name} sees everyone's Magic at the end`, await p.store((s) => s.game.magic.length === 4 && s.game.magic.some((m) => m > 0)))
    await p.page.waitForTimeout(1500)
    await shot(p, '6-reveal', 0)
    await p.tap(p.page.getByRole('button', { name: 'Skip' })) // the end table opens by itself after the reveal
    await p.page.getByRole('dialog').getByRole('button', { name: 'New game' }).waitFor()
    await shot(p, '7-end-table')
    const table = p.page.getByRole('dialog')
    check(`${p.name}'s end screen has 4 players`, (await table.locator('.game-end-player').count()) === 4)
    check(`${p.name}'s end screen marks their own card "You"`, (await table.getByText('You', { exact: true }).count()) === 1)
    for (const name of ['Ada', 'Bo', 'Cy', 'Di']) check(`${p.name}'s end table has ${name}`, (await table.getByText(name, { exact: true }).count()) > 0)
  }
  // The host's New game takes everyone back to the lobby, 4 seats
  await ada.tap(ada.page.getByRole('dialog').getByRole('button', { name: 'New game' }))
  for (const p of everyone) {
    const inLobby = await p.page.getByRole('button', { name: 'Leave' }).waitFor({ timeout: 10000 }).then(() => true, () => false)
    check(`${p.name} is back in the lobby after the host's New game`, inLobby && (await p.store((s) => s.game === null)))
  }
  check('4 seats in the lobby again', await ada.room((s) => s.room?.room?.seats?.length === 4))
  await shot(ada, '8-back-in-lobby')
  for (const p of everyone) {
    await p.tap(p.page.getByRole('button', { name: 'Leave' }))
    await p.page.getByRole('button', { name: 'Play online' }).waitFor({ timeout: 5000 })
    check(`${p.name} left the room`, await p.room((s) => s.code === null))
  }

  // ---- the secrecy check over every frame each browser received ----
  for (const p of everyone) {
    const views = p.frames.filter((f) => f.includes('"type":"view"')).length
    const leaks = p.frames.flatMap((f) => secretsIn(f))
    check(`${p.name} received views (${views})`, views > 10)
    check(`${p.name} got the results`, p.frames.some((f) => f.includes('"results":{')))
    leaks.forEach((what) => fail(`${p.name} received ${what} before the end`))
    console.log(`${leaks.length ? 'FAIL' : 'ok  '} secrecy: ${p.name} — ${p.frames.length} frames, ${views} views, ${leaks.length} leaks`)
    // A dropped page can log a failed socket; anything else is a real error
    const errors = p.errors.filter((e) => !/WebSocket/.test(e))
    errors.forEach((e) => fail(`${p.name} console: ${e}`))
  }
} catch (error) {
  fail(error.stack ?? String(error))
} finally {
  await stop()
}
console.log(failures ? `\n${failures} problem(s)` : '\nall good (4 players online)')
process.exit(failures ? 1 : 0)
