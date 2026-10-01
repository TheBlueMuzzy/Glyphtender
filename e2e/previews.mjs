// DEV KIT SCREEN PREVIEWS (F27) — every preview opens, looks right, and leaves the real game exactly as it was.
// At phone 390×844 and desktop 1440×900: start a REAL game, open its Pause menu (a real screen under the previews),
// remember everything (the store, open screens, storage, history, address) → ` → Screens → open EVERY preview
// (each variant), wait for it, screenshot it, close it (✕; one with Esc, one with the Back button) → after each:
// the real game is unchanged. Also: no console errors, no problems reported by a preview, nothing sent
// (no WebSocket, no POST from any frame), and the real Pause menu still there at the end. No scroll bar sideways
// anywhere in the Dev Kit or a preview's bar: rows that don't fit are dot carousels (◀ ▶ + dots) — checked on the
// phone: the tool tabs page with ▶ / ◀ and the selected tab is always whole in view.
// Stacked screens (Rules over Pause, …): only the top open screen shows (UI kit 0.2.8).
// Starts its OWN dev server (default port 5197 — never Muzzy's 5180) and closes only that one.
//   npm run e2e:previews [outDir] [port]
import { mkdirSync } from 'node:fs'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const OUT = process.argv[2] ?? 'e2e-shots/previews'
const PORT = Number(process.argv[3] ?? 5197)
const SIZES = [
  { name: 'phone', width: 390, height: 844, mobile: true },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
]
// How long to let a preview play before its picture (the reveal is staged; the rest only settle)
const SETTLE_MS = { reveal: 2500, handoff: 800 }
mkdirSync(OUT, { recursive: true })

/** Everything about the REAL game that a preview must never change. Runs in the page. */
function realMoment() {
  const s = window.__glyphtender.store.getState()
  const pick = ({ game, trayOrder, stats, options, handoff, revealAt, seats, move, cast, selected, online, wordsStatus, note }) =>
    ({ game, trayOrder, stats, options, handoff, revealAt, seats, move, cast, selected, online, wordsStatus, note })
  const storage = (st) => Object.fromEntries(Array.from({ length: st.length }, (_, i) => [st.key(i), st.getItem(st.key(i))]))
  const onlineState = window.__glyphtender.online.getState()
  return JSON.stringify({
    store: pick(s),
    online: { code: onlineState.code, room: onlineState.room, joinError: onlineState.joinError },
    screens: [...document.querySelectorAll('#root [role="dialog"], #root dialog')].map((d) => d.getAttribute('aria-label')),
    phase: document.querySelector('.game')?.getAttribute('data-phase') ?? null,
    local: storage(localStorage),
    session: storage(sessionStorage),
    history: history.state,
    url: location.href,
  })
}

/** Dev Kit parts that scroll sideways (there should be none — carousels instead), and carousel items cut in half
 *  on the page being shown. Runs in the page. */
function sidewaysProblems() {
  const out = []
  for (const el of document.querySelectorAll('aside.devkit *, dialog.devkit-preview *')) {
    if (el.tagName === 'IFRAME' || el.closest('iframe')) continue
    const x = getComputedStyle(el).overflowX
    if ((x === 'auto' || x === 'scroll') && el.scrollWidth > el.clientWidth + 1) out.push(`scrolls sideways: ${el.className}`)
  }
  for (const view of document.querySelectorAll('.dk-carousel-view')) {
    if (!view.offsetParent) continue // (a hidden panel)
    const box = view.getBoundingClientRect()
    const clipped = Number(/inset\([^ ]+ ([\d.]+)px/.exec(view.style.clipPath)?.[1] ?? 0) // the page's window
    const right = box.right - clipped
    for (const item of view.querySelector('.dk-carousel-track').children) {
      const r = item.getBoundingClientRect()
      const inside = r.left >= box.left - 1 && r.right <= right + 1
      const outside = r.right <= box.left + 1 || r.left >= right - 1
      if (!inside && !outside && r.width <= box.width) out.push(`half-shown in a carousel: ${(item.textContent || '').trim().slice(0, 20)}`)
    }
  }
  return out
}

const server = await createServer({ server: { port: PORT, strictPort: true, host: '127.0.0.1' }, logLevel: 'warn' })
await server.listen()
const browser = await chromium.launch()
let failures = 0
const fail = (why) => { failures++; console.log(`  FAIL ${why}`) }
let shots = 0

try {
  for (const size of SIZES) {
    console.log(`--- ${size.name} ${size.width}×${size.height}`)
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, isMobile: size.mobile, hasTouch: size.mobile })
    const errors = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    const sockets = []
    page.on('websocket', (ws) => { if (!ws.url().includes('/@vite') && !ws.url().includes('token=')) sockets.push(ws.url()) })
    const sends = []
    page.on('request', (r) => { if (!['GET', 'HEAD'].includes(r.method())) sends.push(`${r.method()} ${r.url()}`) })

    // A real game, with its Pause menu open on top
    await page.goto(`http://127.0.0.1:${PORT}/`)
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await page.waitForFunction(() => window.__glyphtender?.store.getState().game !== null && window.__glyphtender.store.getState().wordsStatus === 'ready')
    await page.getByRole('button', { name: 'Menu' }).click()
    await page.waitForTimeout(400)
    const before = await page.evaluate(realMoment)
    if (!JSON.parse(before).screens.length) fail('the real Pause menu did not open')
    await page.screenshot({ path: `${OUT}/${size.name}-0-real-before.png` })

    // ` → Screens
    await page.keyboard.press('Backquote')
    // (a tab on another carousel page: ▶ to it first, like a person would)
    const tabInView = (name) => page.evaluate((name) => {
      const view = document.querySelector('.devkit-tabs .dk-carousel-view').getBoundingClientRect()
      const tab = [...document.querySelectorAll('.devkit-tab')].find((t) => t.textContent === name).getBoundingClientRect()
      return tab.left >= view.left - 1 && tab.right <= view.right + 1
    }, name)
    for (let i = 0; i < 6 && !(await tabInView('Screens')); i++) {
      await page.getByRole('button', { name: 'Next tools' }).click()
      await page.waitForTimeout(250)
    }
    await page.getByRole('tab', { name: 'Screens' }).click()
    const buttons = page.locator('.devkit [data-preview]')
    await buttons.first().waitFor()
    const list = await buttons.evaluateAll((els) => els.map((b) => ({ id: b.dataset.preview, variant: b.dataset.variant ?? '', label: b.textContent })))
    console.log(`  ${list.length} previews to open`)
    await page.waitForTimeout(300) // the carousel turns to the Screens tab
    await page.screenshot({ path: `${OUT}/${size.name}-0-screens-tab.png` })
    ;(await page.evaluate(sidewaysProblems)).forEach((p) => fail(`Dev Kit: ${p}`))
    const tabWhole = async () => page.evaluate(() => {
      const view = document.querySelector('.devkit-tabs .dk-carousel-view').getBoundingClientRect()
      const tab = document.querySelector('.devkit-tab[aria-selected="true"]').getBoundingClientRect()
      return tab.left >= view.left - 1 && tab.right <= view.right + 1
    })
    if (!(await tabWhole())) fail('Dev Kit: the selected tab is not whole in view')
    // A phone can't fit every tool tab: ◀ ▶ + dots page through them (no scroll bar)
    if (size.mobile) {
      const prev = page.getByRole('button', { name: 'Previous tools' })
      if (!(await prev.isVisible())) fail('phone: the Dev Kit tabs have no ◀ ▶ (they do not all fit)')
      else {
        const dot = () => page.locator('.devkit-tabs .dk-carousel-dot[aria-current="true"]').getAttribute('aria-label')
        const was = await dot()
        await prev.click()
        await page.waitForTimeout(300)
        if ((await dot()) === was) fail('phone: ◀ did not turn the Dev Kit tabs')
        for (let i = 0; i < 6 && !(await tabInView('Color')); i++) { await prev.click(); await page.waitForTimeout(250) }
        if (!(await tabInView('Color'))) fail('phone: ◀ to the first page does not show Color')
        await page.screenshot({ path: `${OUT}/${size.name}-0-tabs-page1.png` })
        ;(await page.evaluate(sidewaysProblems)).forEach((p) => fail(`Dev Kit (tabs turned): ${p}`))
        for (let i = 0; i < 6 && !(await tabInView('Screens')); i++) {
          await page.getByRole('button', { name: 'Next tools' }).click()
          await page.waitForTimeout(250)
        }
        if (!(await tabInView('Screens'))) fail('phone: ▶ did not bring Screens back')
      }
    }

    for (const [n, item] of list.entries()) {
      const name = `${item.id}${item.variant ? `-${item.variant}` : ''}`
      const selector = `.devkit [data-preview="${item.id}"]${item.variant ? `[data-variant="${item.variant}"]` : ''}`
      await page.locator(selector).click()
      const overlay = page.locator('dialog.devkit-preview')
      await overlay.waitFor()
      // The frame: wait until the preview says it's up
      let frame = null
      for (let i = 0; i < 100 && !frame; i++) {
        frame = page.frames().find((f) => f.url().includes(`devkit-preview=${item.id}`))
        if (!frame) await page.waitForTimeout(100)
      }
      if (!frame) { fail(`${name}: no preview frame`); continue }
      await frame.waitForFunction(() => window.__devkitPreview?.ready || window.__devkitPreview?.problems.length, null, { timeout: 20000 })
      await page.waitForTimeout(SETTLE_MS[item.id] ?? 600)
      const status = await frame.evaluate(() => window.__devkitPreview)
      if (status.problems.length) fail(`${name}: the preview reported ${status.problems.join(' · ')}`)
      if (status.counts.sends) fail(`${name}: the sandbox had to block ${status.counts.sends} send(s)`)
      if (!(await overlay.getByText('Preview', { exact: true }).isVisible())) fail(`${name}: no PREVIEW badge`)
      // Something drew in the frame
      const drawn = await frame.evaluate(() => document.getElementById('root')?.children.length ?? 0)
      if (!drawn) fail(`${name}: the frame drew nothing`)
      // Only the TOP open screen of the stack shows (UI kit 0.2.8): e.g. Rules opened from Pause — no Pause panel
      // peeking out behind it. (Layer 0 is the game / home page; the rest are the open screens, newest last.)
      const stack = await frame.evaluate(() => {
        const open = [...document.querySelectorAll('.kit-layer')].slice(1)
        const shown = (layer) => [...layer.querySelectorAll('.kit-screen')].some((el) => getComputedStyle(el).visibility === 'visible')
        const top = open.at(-1)?.querySelector('.kit-screen')
        return { open: open.length, shown: open.map(shown), topDim: top ? getComputedStyle(top).backgroundColor : '' }
      })
      if (stack.open > 1 && !(stack.shown.slice(0, -1).every((v) => !v) && stack.shown.at(-1))) {
        fail(`${name}: ${stack.open} screens open and not only the top one shows (${JSON.stringify(stack.shown)})`)
      }
      if (item.id === 'rules' && stack.open !== 2) fail(`${name}: expected Pause + Rules open (got ${stack.open})`)
      // …and the top one carries the dim over the game (the dim of the one under it is hidden with it)
      if (stack.open > 1 && /^(transparent|rgba\(0, 0, 0, 0\))$/.test(stack.topDim)) fail(`${name}: the top screen doesn't dim the game`)
      await page.screenshot({ path: `${OUT}/${size.name}-${String(n + 1).padStart(2, '0')}-${name}.png` })
      shots++
      ;(await page.evaluate(sidewaysProblems)).forEach((p) => fail(`${name} preview bar: ${p}`))

      // Inside the sandbox things still work — they just can't reach out: Start on the new-game screen saves the
      // choices (blocked, kept in the frame) and deals a game IN THE FRAME; the real game below doesn't notice
      if (item.id === 'new-game') {
        await frame.getByRole('button', { name: 'Start', exact: true }).click()
        await frame.waitForFunction(() => window.__glyphtender === undefined && document.querySelector('.game') !== null)
        const counts = await frame.evaluate(() => window.__devkitPreview.counts)
        if (counts.saves < 1) fail(`${name}: Start inside the preview saved nothing — the save should have been caught`)
        await page.screenshot({ path: `${OUT}/${size.name}-${String(n + 1).padStart(2, '0')}-${name}-started.png` })
      }

      // Close: mostly ✕; one by Esc, one by the Back button
      const how = n === 1 ? 'Esc' : n === 2 ? 'Back' : '✕'
      if (how === 'Esc') await page.keyboard.press('Escape')
      else if (how === 'Back') await page.evaluate(() => history.back())
      else await overlay.getByRole('button', { name: 'Close the preview' }).click()
      await overlay.waitFor({ state: 'detached', timeout: 5000 }).catch(() => fail(`${name}: ${how} did not close the preview`))
      await page.waitForTimeout(300) // let a history step (✕ / Esc step back over the preview's entry) land
      const after = await page.evaluate(realMoment)
      if (after !== before) {
        fail(`${name} (closed by ${how}): the real game changed`)
        const a = JSON.parse(before), b = JSON.parse(after)
        for (const key of Object.keys(a)) if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) console.log(`    changed: ${key}`)
      }
      if (!(await page.locator('aside.devkit').isVisible())) fail(`${name}: the Dev Kit panel closed with the preview`)
      console.log(`  ok   ${name} (closed by ${how}; sandbox ${JSON.stringify(status.counts)})`)
    }

    // Back in the real game: close the Dev Kit — the real Pause menu is still there
    await page.keyboard.press('Backquote')
    await page.waitForTimeout(300)
    if (!(await page.locator('#root').getByText('Paused').first().isVisible().catch(() => false))) fail('the real Pause menu is gone')
    await page.screenshot({ path: `${OUT}/${size.name}-z-real-after.png` })
    if (sockets.length) fail(`WebSockets opened: ${sockets.join(', ')}`)
    if (sends.length) fail(`requests that send: ${sends.join(', ')}`)
    if (errors.length) fail(`console errors: ${errors.slice(0, 5).join(' | ')}`)
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}
console.log(failures ? `FAIL — ${failures} problem(s)` : `PASS — ${shots} preview screenshots in ${OUT}/, the real game untouched every time`)
process.exit(failures ? 1 : 0)
