// Screenshots + a scripted move → cast → Cast of the move-cast sketch, at phone-tall, phone-wide and desktop.
// Needs the dev server: npx vite --host --port 5180. Usage: node e2e/sketch-shots.mjs <outDir>
import { chromium } from 'playwright-core'

const OUT = process.argv[2] ?? '.'
const URL = 'http://localhost:5180/sketches/move-cast/'
const SIZES = [
  { name: 'phone-tall', width: 390, height: 844, mobile: true },
  { name: 'phone-wide', width: 844, height: 390, mobile: true },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
]
const browser = await chromium.launch()
let failures = 0
for (const size of SIZES) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, isMobile: size.mobile, hasTouch: size.mobile })
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  for (const board of ['Small', 'Large']) {
    await page.goto(URL)
    await page.getByRole('button', { name: board, exact: true }).click()
    await page.waitForTimeout(300)
    const readout = await page.locator('.readout').textContent()
    await page.screenshot({ path: `${OUT}/${size.name}-${board.toLowerCase()}.png` })
    // Move: tap a yellow glyphling, tap the first glowing hex
    const tap = (loc) => (size.mobile ? loc.tap() : loc.click())
    await tap(page.locator('[data-glyph="yellow-0"]'))
    const moveDots = await page.locator('.garden circle').count()
    await tap(page.locator('.garden circle').first())
    // Cast: tap seed 0, tap the first golden hex
    await tap(page.locator('[data-slot="0"]'))
    const castDots = await page.locator('.garden circle').count()
    await page.screenshot({ path: `${OUT}/${size.name}-${board.toLowerCase()}-cast-options.png` })
    await tap(page.locator('.garden circle').nth(Math.floor(castDots / 2)))
    await page.screenshot({ path: `${OUT}/${size.name}-${board.toLowerCase()}-pending.png` })
    const castEnabled = await page.getByRole('button', { name: 'Cast', exact: true }).isEnabled()
    await tap(page.getByRole('button', { name: 'Cast', exact: true }))
    await page.waitForTimeout(200)
    await page.screenshot({ path: `${OUT}/${size.name}-${board.toLowerCase()}-throw.png` })
    const planting = await page.locator('.prompt').textContent()
    await page.waitForTimeout(1500) // seed lands, runeblossom grows
    const seedsOnBoard = await page.locator('.garden image[href*="runeblossoms"]').count()
    // Nothing may stick out past the screen edge (the tray used to clip on phones)
    const overflow = await page.evaluate(() => [...document.querySelectorAll('.seed, button')].some((el) => { const r = el.getBoundingClientRect(); return r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5 || r.left < -0.5 }))
    if (overflow) console.log('  clipped: something sticks out past the screen edge')
    const ok = planting === 'Planting…' && !overflow && moveDots > 0 && castDots > 0 && castEnabled && seedsOnBoard === 1
    if (!ok) failures++
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${size.name} ${board}: ${readout} · move options ${moveDots} · cast options ${castDots} · seeds after Cast ${seedsOnBoard}`)
  }
  if (errors.length) { failures++; console.log('console errors:', errors) }
  await page.close()
}
await browser.close()
process.exit(failures ? 1 : 0)
