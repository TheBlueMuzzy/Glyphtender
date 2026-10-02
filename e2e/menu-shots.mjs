// Screenshots of the kit menus (home, Settings → Accessibility, Credits) at phone-tall, phone-wide and desktop,
// plus a check that nothing sticks out past the screen edge and every button is a ≥ 44px target.
// Needs the dev server, e.g. npx vite --host --port 5186. Usage: node e2e/menu-shots.mjs <outDir> [baseUrl]
import { chromium } from 'playwright-core'

const OUT = process.argv[2] ?? '.'
const URL = process.argv[3] ?? 'http://localhost:5186/'
const SIZES = [
  { name: 'phone-tall', width: 390, height: 844, mobile: true },
  { name: 'phone-wide', width: 844, height: 390, mobile: true },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
]
// Anything visible poking past an edge, and any button smaller than a finger
const problems = () => [...document.querySelectorAll('.kit-screen button, .kit-screen [role=tab], .kit-text')].flatMap((el) => {
  const r = el.getBoundingClientRect()
  if (!r.width || !r.height || el.closest('.kit-scroll, [data-scroll]')) return []
  const out = []
  if (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) out.push(`clipped: ${el.textContent.trim().slice(0, 30)}`)
  if (el.tagName === 'BUTTON' && (r.height < 43.5 || r.width < 43.5)) out.push(`small target: ${el.textContent.trim().slice(0, 30)} ${Math.round(r.width)}×${Math.round(r.height)}`)
  return out
})
const browser = await chromium.launch()
let failures = 0
for (const size of SIZES) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, isMobile: size.mobile, hasTouch: size.mobile })
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  const shot = async (name) => {
    await page.waitForTimeout(600) // entrance animations finish
    await page.screenshot({ path: `${OUT}/${size.name}-${name}.png` })
    const found = await page.evaluate(problems)
    if (found.length) { failures++; console.log(`FAIL ${size.name} ${name}:`, found) } else console.log(`ok   ${size.name} ${name}`)
  }
  await page.goto(URL)
  await page.getByRole('button', { name: 'Settings' }).waitFor()
  await shot('menu')
  await page.getByRole('button', { name: 'Settings' }).click()
  await shot('settings')
  // Wide screens show tabs; narrow ones show one ◀ tab ▶ picker — step it to Accessibility
  if (await page.getByRole('tab', { name: 'Accessibility' }).count()) await page.getByRole('tab', { name: 'Accessibility' }).click()
  else for (let i = 0; i < 8 && !(await page.locator('.kit-picker').first().textContent()).includes('Accessibility'); i++) await page.locator('.kit-picker').first().locator('button').last().click()
  await shot('settings-accessibility')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  const back = await page.getByRole('button', { name: 'Settings' }).isVisible()
  if (!back) { failures++; console.log(`FAIL ${size.name}: Esc did not close Settings`) }
  if (await page.getByRole('button', { name: /Prototype/ }).count()) { failures++; console.log(`FAIL ${size.name}: the retired prototype button is back`) }
  if (errors.length) { failures++; console.log('console errors:', errors) }
  await page.close()
}
await browser.close()
process.exit(failures ? 1 : 0)
