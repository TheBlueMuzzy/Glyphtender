// FULL SCREEN (src/ui/fullscreen.ts; Muzzy 2026-10-03: friends opening a link on a phone should see the whole game):
//   phone (touch) — a tap anywhere goes full screen (Settings → Full screen is on by default there); the main menu
//     button then says "Leave full screen", and pressing it leaves AND turns the setting off (no tap brings it back)
//   computer — a click never goes full screen by itself; the button does; leaving turns the setting off
// (iPhone can't go full screen at all — the unit tests cover its Add to Home Screen tip.)
// Starts its OWN dev server (port 5243) and closes only that one.   npm run e2e:fullscreen
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const PORT = 5243
const server = await createServer({ server: { port: PORT, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' })
await server.listen()
const browser = await chromium.launch()
let failed = 0
const check = (name, ok) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) failed++ }
const full = (page) => page.evaluate(() => !!document.fullscreenElement)
const button = (page) => page.locator('.kit-main-menu-extra button')

try {
  // ---- a phone on its side ----
  const phone = await browser.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true })
  await phone.goto(`http://127.0.0.1:${PORT}/`)
  await phone.getByRole('button', { name: 'Play', exact: true }).waitFor()
  check('phone: not full screen before any tap', !(await full(phone)))
  await phone.touchscreen.tap(30, 30) // an empty spot
  await phone.waitForTimeout(300)
  check('phone: a tap goes full screen', await full(phone))
  check('phone: the button says Leave full screen', (await button(phone).textContent()) === 'Leave full screen')
  await button(phone).tap()
  await phone.waitForTimeout(300)
  check('phone: the button leaves full screen', !(await full(phone)))
  await phone.touchscreen.tap(30, 30)
  await phone.waitForTimeout(300)
  check('phone: after leaving with the button, a tap no longer goes full screen (setting off)', !(await full(phone)))

  // ---- a computer ----
  const pc = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await pc.goto(`http://127.0.0.1:${PORT}/`)
  await pc.getByRole('button', { name: 'Play', exact: true }).waitFor()
  await pc.mouse.click(700, 100)
  await pc.waitForTimeout(300)
  check('computer: a click does not go full screen by itself', !(await full(pc)))
  await button(pc).click()
  await pc.waitForTimeout(300)
  check('computer: the Full screen button goes full screen', await full(pc))
  await pc.evaluate(() => document.exitFullscreen())
  await pc.waitForTimeout(300)
  const saved = await pc.evaluate(() => Object.values(localStorage).map((v) => JSON.parse(v).fullscreen))
  check('computer: leaving (Esc) turns the setting off', saved.includes(false) && !saved.includes(true))
} finally {
  await browser.close()
  await server.close()
}
if (failed) { console.log(`\n✗ ${failed} problem(s)`); process.exit(1) }
console.log('\n✓ full screen e2e passed')
