// Shared by the online e2e scripts (online-shots.mjs: 2 players, online-four.mjs: 4 players):
// our own servers, the screenshot checks, the secrecy check and "a player = a browser context".
import { spawn, execSync } from 'node:child_process'
import { createServer as netServer } from 'node:net'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const portFree = (port) => new Promise((ok) => {
  const probe = netServer().once('error', () => ok(false)).once('listening', () => probe.close(() => ok(true))).listen(port, '0.0.0.0')
})

/** Starts OUR OWN `wrangler dev` on partyPort and Vite on vitePort (never anyone else's) + a Chromium.
 *  stop() closes only those. The page finds that server through VITE_PARTY_PORT (ui/online/session.ts).
 *  Each run keeps its OWN storage (--persist-to .wrangler/state-e2e-<port>): two wrangler devs sharing
 *  .wrangler/state lock each other (SQLITE_BUSY) and crash — e.g. Muzzy's play server. */
export async function startServers(vitePort, partyPort, usage) {
  if (!(await portFree(partyPort))) throw new Error(`Port ${partyPort} is busy — pass another: ${usage}`)
  if (!(await portFree(vitePort))) throw new Error(`Port ${vitePort} is busy — pass another: ${usage}`)
  const party = spawn(`npx wrangler dev --port ${partyPort} --ip 127.0.0.1 --inspector-port 0 --persist-to .wrangler/state-e2e-${partyPort}`, { shell: true, cwd: process.cwd() })
  let partyLog = ''
  party.stdout.on('data', (d) => { partyLog += d })
  party.stderr.on('data', (d) => { partyLog += d })
  const stopParty = () => {
    try { process.platform === 'win32' ? execSync(`taskkill /PID ${party.pid} /T /F`, { stdio: 'ignore' }) : party.kill() } catch { /* already gone */ }
  }
  for (let t = 0; t < 120 && !/Ready on/.test(partyLog); t++) await wait(500)
  if (!/Ready on/.test(partyLog)) { stopParty(); throw new Error(`wrangler dev didn't start:\n${partyLog}`) }
  process.env.VITE_PARTY_PORT = String(partyPort) // the page talks to OUR server
  const vite = await createServer({ server: { port: vitePort, strictPort: true, host: '127.0.0.1' }, logLevel: 'warn' })
  await vite.listen()
  const browser = await chromium.launch()
  const stop = async () => {
    await browser.close().catch(() => {})
    await vite.close().catch(() => {})
    stopParty()
  }
  return { browser, stop }
}

// Everything visible must be inside the screen, and buttons big enough for a finger (as e2e:pass)
export function problems() {
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
export function secretsIn(frame) {
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
  // the game log (every turn's words + Magic + running totals) is sent empty until the end (D48)
  if ((game.log && (game.log.turns.length || game.log.end)) || /totalsAfter|ownMagic/.test(frame)) out.push('the game log')
  // …and what a rival could have spelled on a cast's hex (the Weed toss award reads their hand): log-only (pendingLog)
  if (game.pendingLog || /"blocked"|"mobility"/.test(frame)) out.push("the log's pending facts")
  return out
}

/** A player = a browser context (own storage = a different player) + its page. Every WebSocket frame it
 *  receives is kept in .frames (across reloads and re-opened tabs), console errors in .errors. */
export function makePlayer(name, context, size, { vitePort, out, fail }) {
  const me = { name, context, size, page: null, frames: [], errors: [] }
  me.open = async () => {
    const page = await context.newPage()
    page.on('console', (m) => m.type() === 'error' && me.errors.push(m.text()))
    page.on('pageerror', (e) => me.errors.push(e.message))
    page.on('websocket', (ws) => ws.on('framereceived', (f) => me.frames.push(String(f.payload))))
    await page.goto(`http://127.0.0.1:${vitePort}/`)
    me.page = page
  }
  me.tap = (loc) => (size.mobile ? loc.tap() : loc.click())
  // A glyphling whose turn it is pulses (it never holds still), so Playwright's "wait until stable" would wait forever
  me.tapGlyph = (loc) => (size.mobile ? loc.tap({ force: true }) : loc.click({ force: true }))
  me.store = (fn) => me.page.evaluate(`(${fn})(window.__glyphtender.store.getState())`)
  me.room = (fn) => me.page.evaluate(`(${fn})(window.__glyphtender.online.getState())`)
  me.shot = async (label, settle = 400, prefix = 'online') => {
    await me.page.waitForFunction(() => [...document.querySelectorAll('[data-glide]')].every((g) => g.getAnimations().length === 0), null, { timeout: 4000 }).catch(() => {})
    await me.page.waitForTimeout(settle)
    const tag = `${me.page.viewportSize().width}x${me.page.viewportSize().height}`
    await me.page.screenshot({ path: `${out}/${prefix}-${tag}-${label}.png` })
    const found = await me.page.evaluate(problems)
    found.forEach((p) => fail(`${name} ${label}: ${p}`))
    console.log(`${found.length ? 'FAIL' : 'ok  '} ${name} ${tag} ${label}`)
  }
  return me
}
