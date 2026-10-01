// MARGINS AND EVEN SPACING (Muzzy's playtest, 2026-10-01) — checked on the real screen at 7 sizes:
//   phone 390×844 · 360×780 · phone on its side 844×390 · desktop windows 1066×1192 · 1099×846 · 1443×900 · 1920×1080
//   · a mid-game turn: the portrait, ☰, the board's hexes, the tray and the buttons are all at least MIN_EDGE from
//     every edge of the window (bottom: the tray and buttons keep layout.json bottomRoom — B014)
//   · board BESIDE the tray (wide screens): the gap edge→board and the gap tray→edge within 20% of each other, and
//     the gap board→tray close to them too ("evenly spaced between the edges"); the portrait and ☰ line up with the
//     tray's edges
//   · the Pause menu: the room left and right of its buttons the same (±2 px), and the top about the same
//   · the Dev Kit: the tool tabs on their own full-width row under the title + ✕ (all 5 fit on a desktop)
// Screenshots of each (turn, pause, Dev Kit Tuning + Screens) go to the out folder.
// Starts its OWN dev server (default port 5233 — never Muzzy's 5180/5192) and closes only that one.
//   npm run e2e:margins [outDir] [port]
import { mkdirSync } from 'node:fs'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import layout from '../content/tuning/layout.json' with { type: 'json' }

const OUT = process.argv[2] ?? 'e2e-shots/margins'
const PORT = Number(process.argv[3] ?? 5233)
const MIN_EDGE = 12 // px: nothing the player looks at or touches closer to an edge than this
const SIZES = [
  { width: 390, height: 844, mobile: true },
  { width: 360, height: 780, mobile: true },
  { width: 844, height: 390, mobile: true },
  { width: 1066, height: 1192, mobile: false },
  { width: 1099, height: 846, mobile: false },
  { width: 1443, height: 900, mobile: false },
  { width: 1920, height: 1080, mobile: false },
]
mkdirSync(OUT, { recursive: true })

/** Where the game's parts are (runs in the page). */
function parts() {
  const box = (e) => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom } }
  const union = (els) => els.map(box).filter((r) => r.right > r.left)
    .reduce((u, r) => ({ left: Math.min(u.left, r.left), top: Math.min(u.top, r.top), right: Math.max(u.right, r.right), bottom: Math.max(u.bottom, r.bottom) }),
      { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity })
  return {
    layout: document.querySelector('.game').dataset.layout,
    portrait: box(document.querySelector('.game-turn-bar .kit-avatar')),
    menu: box(document.querySelector('.game-turn-bar button[aria-label="Menu"]')),
    board: union([...document.querySelectorAll('.game-garden [data-hex]')]),
    tray: box(document.querySelector('.game-tray')),
    // the seeds themselves (the tray's box can be wider than its seeds)
    seeds: union([...document.querySelectorAll('.game-tray [data-tray-pos]')]),
    buttons: union([...document.querySelectorAll('.game-actions button')]),
    width: innerWidth,
    height: innerHeight,
  }
}

/** The Pause menu's room round its title and buttons (runs in the page). */
function pausePadding() {
  const panel = document.querySelector('.kit-modal').getBoundingClientRect()
  const menu = document.querySelector('.kit-modal .kit-menu').getBoundingClientRect()
  const title = document.querySelector('.kit-modal > .kit-text').getBoundingClientRect()
  const style = getComputedStyle(document.querySelector('.kit-modal'))
  return {
    left: menu.left - panel.left, right: panel.right - menu.right,
    top: title.top - panel.top, bottom: panel.bottom - menu.bottom,
    titleLeft: title.left - panel.left, border: parseFloat(style.borderLeftWidth) || 0,
  }
}

/** The Dev Kit's header: the title row, and the tabs row under it (runs in the page). */
function devkitHeader() {
  const r = (sel) => document.querySelector(sel).getBoundingClientRect()
  const panel = r('aside.devkit'), title = r('.devkit-title'), close = r('.devkit-close'), tabs = r('.devkit-tabs')
  const view = r('.devkit-tabs .dk-carousel-view')
  const shown = [...document.querySelectorAll('.devkit-tab')].filter((t) => {
    const b = t.getBoundingClientRect()
    return b.left >= view.left - 1 && b.right <= view.right + 1
  }).length
  return {
    titleShown: title.width > 0, closeShown: close.width > 0,
    tabsBelow: tabs.top >= Math.max(title.bottom, close.bottom) - 1,
    tabsWidth: tabs.width, panelWidth: panel.width, shown, total: document.querySelectorAll('.devkit-tab').length,
  }
}

const server = await createServer({ server: { port: PORT, strictPort: true, host: '127.0.0.1' }, logLevel: 'warn' })
await server.listen()
const browser = await chromium.launch()
let failures = 0
const fail = (why) => { failures++; console.log(`  FAIL ${why}`) }
const ok = (why) => console.log(`ok   ${why}`)
const near = (a, b, share) => Math.abs(a - b) <= share * Math.max(a, b)

try {
  for (const size of SIZES) {
    const name = `${size.width}x${size.height}`
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, isMobile: size.mobile, hasTouch: size.mobile })
    const errors = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    const tap = (loc) => (size.mobile ? loc.tap({ force: true }) : loc.click({ force: true }))
    const option = (kind, pick) => page.locator(`[data-option="${kind}"] circle`).nth(pick)
    const optionCount = (kind) => page.locator(`[data-option="${kind}"] circle`).count()

    // A mid-game turn: draft done, the first player's seeds showing
    await page.goto(`http://127.0.0.1:${PORT}/`)
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await page.waitForFunction(() => window.__glyphtender?.store.getState().wordsStatus === 'ready', null, { timeout: 15000 })
    for (let i = 0; i < 4; i++) await tap(option('move', Math.floor((await optionCount('move')) * (i + 1) / 5)))
    if (await page.evaluate(() => window.__glyphtender.store.getState().handoff !== null)) await tap(page.getByRole('button', { name: 'Show my seeds' }))
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT}/${name}-1-turn.png` })
    const m = await page.evaluate(parts)

    // Every part clear of every edge
    const edges = (r) => ({ left: r.left, top: r.top, right: m.width - r.right, bottom: m.height - r.bottom })
    const closest = []
    for (const [what, r] of Object.entries({ portrait: m.portrait, menu: m.menu, board: m.board, tray: m.tray, buttons: m.buttons })) {
      const e = edges(r)
      const sides = what === 'tray' || what === 'buttons' ? ['left', 'top', 'right'] : ['left', 'top', 'right', 'bottom']
      for (const side of sides) if (e[side] < MIN_EDGE - 0.5) fail(`${name}: the ${what} is ${Math.round(e[side])}px from the ${side} edge (needs ≥ ${MIN_EDGE})`)
      if ((what === 'tray' || what === 'buttons') && e.bottom < layout.bottomRoom - 0.5) fail(`${name}: B014: the ${what} is ${Math.round(e.bottom)}px from the bottom (needs ≥ ${layout.bottomRoom})`)
      closest.push(`${what} ${Math.round(Math.min(...sides.map((s) => e[s])))}`)
    }
    console.log(`     ${name} (${m.layout}) closest to an edge: ${closest.join(' · ')}`)

    if (m.layout === 'side') {
      // Even gaps: edge → board's hexes, board → tray, tray → edge (the tray's seeds or its buttons, whichever is wider)
      const content = { left: Math.min(m.seeds.left, m.buttons.left), right: Math.max(m.seeds.right, m.buttons.right) }
      const left = m.board.left, middle = content.left - m.board.right, right = m.width - content.right
      const gaps = `left ${Math.round(left)} · middle ${Math.round(middle)} · right ${Math.round(right)}`
      if (!near(left, right, 0.2)) fail(`${name}: the left and right gaps aren't even (${gaps})`)
      else if (!near(middle, (left + right) / 2, 0.35)) fail(`${name}: the gap between the board and the tray doesn't match the edges (${gaps})`)
      else ok(`${name} even gaps: ${gaps}`)
      // the turn bar lines up with the tray: the portrait over its left edge, ☰ over its right
      const lined = Math.abs(m.portrait.left - m.seeds.left) <= 8 && Math.abs(m.menu.right - m.seeds.right) <= 8
      if (!lined) fail(`${name}: the portrait (${Math.round(m.portrait.left)}) and ☰ (${Math.round(m.menu.right)}) don't line up with the tray (${Math.round(m.seeds.left)}–${Math.round(m.seeds.right)})`)
    }

    // The Pause menu: even padding round the title and buttons
    await page.getByRole('button', { name: 'Menu' }).click()
    await page.locator('.kit-modal .kit-menu').waitFor()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}/${name}-2-pause.png` })
    const p = await page.evaluate(pausePadding)
    const pads = `left ${Math.round(p.left)} · right ${Math.round(p.right)} · top ${Math.round(p.top)} · bottom ${Math.round(p.bottom)}`
    if (Math.abs(p.left - p.right) > 2) fail(`${name}: the Pause menu's room left and right of the buttons differs (${pads})`)
    else if (Math.abs(p.left - p.bottom) > 2 || Math.abs(p.titleLeft - p.left) > 2) fail(`${name}: the Pause menu's padding isn't even (${pads})`)
    else ok(`${name} Pause menu padding even: ${pads}`)

    // The Dev Kit: title + ✕ on top, the tabs on their own full-width row
    await page.keyboard.press('Backquote')
    await page.locator('aside.devkit .devkit-tabs').waitFor()
    const toTab = async (tab) => {
      for (let i = 0; i < 6; i++) {
        const inView = await page.evaluate((tab) => {
          const v = document.querySelector('.devkit-tabs .dk-carousel-view').getBoundingClientRect()
          const t = [...document.querySelectorAll('.devkit-tab')].find((el) => el.textContent === tab).getBoundingClientRect()
          return t.left >= v.left - 1 && t.right <= v.right + 1
        }, tab)
        if (inView) break
        await page.getByRole('button', { name: 'Next tools' }).click()
        await page.waitForTimeout(250)
      }
      await page.getByRole('tab', { name: tab }).click()
      await page.waitForTimeout(400)
    }
    await toTab('Tuning')
    await page.screenshot({ path: `${OUT}/${name}-3-devkit-tuning.png` })
    const d = await page.evaluate(devkitHeader)
    const failedBefore = failures
    if (!d.titleShown || !d.closeShown) fail(`${name}: Dev Kit title or ✕ missing`)
    if (!d.tabsBelow) fail(`${name}: the Dev Kit tabs aren't on their own row under the title`)
    if (d.tabsWidth < d.panelWidth - 24) fail(`${name}: the Dev Kit tabs row isn't the panel's full width (${Math.round(d.tabsWidth)} of ${Math.round(d.panelWidth)})`)
    if (!size.mobile && d.shown < d.total) fail(`${name}: only ${d.shown} of ${d.total} Dev Kit tabs fit on a desktop`)
    if (size.mobile && d.shown < 4) fail(`${name}: only ${d.shown} Dev Kit tabs fit per page on a phone (4 should)`)
    console.log(`${failures > failedBefore ? '     ' : 'ok   '}${name} Dev Kit: tabs row ${Math.round(d.tabsWidth)}/${Math.round(d.panelWidth)} px, ${d.shown} of ${d.total} tabs in view`)
    await toTab('Screens')
    await page.screenshot({ path: `${OUT}/${name}-4-devkit-screens.png` })

    if (errors.length) fail(`${name}: console errors: ${errors.join(' | ')}`)
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}
console.log(failures ? `\n✗ ${failures} failure(s)` : '\n✓ margins and spacing ok')
process.exit(failures ? 1 : 0)
