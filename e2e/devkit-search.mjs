// DEV KIT SEARCH + SECTIONS (Dev Kit 0.5.0) — Muzzy: "it's SOO hard to find attributes … if the devkit is difficult
// to use, it becomes useless."
// At phone 390×844 and desktop 1440×900, over a real game: ` → Tuning (sections closed, chips at the top) → type
// "fade", "trail", "pop" and an in-word fragment ("otlig", inside spotLIGHt): the results filter (every row shown
// matches, the count matches the rows), the typed text is highlighted → tap a section title in the results: the
// search clears, Tuning shows, that section is open and scrolled to the top of the panel → close + open a section
// by its title → ✕ and Esc clear the search (Esc doesn't close the panel while there's a search). Also: the search
// box is ≥ 16 px (no zoom on a phone), nothing scrolls sideways, no console errors. Screenshots in the out folder.
// Starts its OWN dev server (default port 5241 — never Muzzy's) and closes only that one.
//   npm run e2e:devkit-search [outDir] [port]
import { mkdirSync } from 'node:fs'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const OUT = process.argv[2] ?? 'e2e-shots/devkit-search'
const PORT = Number(process.argv[3] ?? 5241)
const SIZES = [
  { name: 'phone', width: 390, height: 844, mobile: true },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
]
const QUERIES = ['fade', 'trail', 'pop', 'otlig']
mkdirSync(OUT, { recursive: true })

/** What the results show right now. Runs in the page. */
function results() {
  const panel = document.querySelector('aside.devkit')
  const shown = (el) => el.offsetParent !== null
  const rows = [...panel.querySelectorAll('.devkit-body:not([hidden]) .dk-section-body > div > .tt-row, .devkit-body:not([hidden]) .dk-section-body > .ct-row')].filter(shown)
  const sections = [...panel.querySelectorAll('.devkit-body:not([hidden]) .dk-section')].filter(shown)
  return {
    count: panel.querySelector('.dk-search-count')?.textContent ?? '',
    rows: rows.length,
    // a row matches when it has a highlight itself, or sits in a section whose title matched
    unmatched: rows
      .filter((r) => !r.querySelector('mark.dk-hit') && !r.closest('.dk-section').querySelector('.dk-section-head mark.dk-hit'))
      .map((r) => r.textContent.slice(0, 40)),
    marks: [...panel.querySelectorAll('mark.dk-hit')].map((m) => m.textContent.toLowerCase()),
    sections: sections.map((s) => s.dataset.dkSection),
    none: panel.querySelector('.dk-results-none')?.textContent ?? null,
  }
}

/** Dev Kit parts that scroll sideways (there should be none). Runs in the page. */
function sideways() {
  const out = []
  for (const el of document.querySelectorAll('aside.devkit *')) {
    const x = getComputedStyle(el).overflowX
    if ((x === 'auto' || x === 'scroll') && el.scrollWidth > el.clientWidth + 1) out.push(el.className)
  }
  const panel = document.querySelector('aside.devkit')
  if (panel.scrollWidth > panel.clientWidth + 1) out.push('the panel itself')
  return out
}

/** Where a section's title sits in the scrolling area: px from its top (0 ≈ snapped to the top). Runs in the page. */
function sectionTop(id) {
  const el = [...document.querySelectorAll('[data-dk-section]')].find((s) => s.dataset.dkSection === id)
  const scroller = document.querySelector('.devkit-scroll')
  if (!el || !scroller) return null
  return { top: Math.round(el.getBoundingClientRect().top - scroller.getBoundingClientRect().top), open: el.dataset.open === 'true', scrolled: scroller.scrollTop }
}

const server = await createServer({ server: { port: PORT, strictPort: true, host: '127.0.0.1' }, logLevel: 'warn' })
await server.listen()
const browser = await chromium.launch()
let failures = 0
const fail = (why) => { failures++; console.log(`  FAIL ${why}`) }

try {
  for (const size of SIZES) {
    console.log(`--- ${size.name} ${size.width}×${size.height}`)
    const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, isMobile: size.mobile, hasTouch: size.mobile })
    const page = await context.newPage()
    const errors = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    const shot = (name) => page.screenshot({ path: `${OUT}/${size.name}-${name}.png` })

    // A real game underneath
    await page.goto(`http://127.0.0.1:${PORT}/`)
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await page.waitForFunction(() => window.__glyphtender?.store.getState().game !== null)

    // ` → Tuning: sections closed, chips at the top
    await page.keyboard.press('Backquote')
    const panel = page.locator('aside.devkit')
    await page.getByRole('tab', { name: 'Tuning' }).click()
    await page.waitForTimeout(300)
    const heads = panel.locator('.devkit-body:not([hidden]) .dk-section-btn')
    const sectionCount = await heads.count()
    if (sectionCount < 10) fail(`expected the Tuning sections, found ${sectionCount}`)
    const openAtStart = await panel.locator('.devkit-body:not([hidden]) .dk-section[data-open]').count()
    if (openAtStart) fail(`${openAtStart} sections open at the start (they start closed)`)
    if (!(await panel.locator('.dk-index .dk-chip').first().isVisible())) fail('no section chips at the top of Tuning')
    console.log(`  ${sectionCount} sections`)
    await shot('1-tuning-sections')

    // The search box: pinned, ≥ 16 px
    const box = page.getByRole('searchbox', { name: 'Search settings' })
    const fontPx = await box.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    if (fontPx < 16) fail(`search box font is ${fontPx}px (a phone zooms in under 16)`)

    for (const q of QUERIES) {
      await box.fill(q)
      await page.waitForTimeout(150)
      const r = await page.evaluate(results)
      const n = Number(/\d+/.exec(r.count)?.[0] ?? 0)
      if (!r.rows) fail(`"${q}": no results`)
      if (n !== r.rows) fail(`"${q}": the count says ${r.count} but ${r.rows} rows show`)
      if (r.unmatched.length) fail(`"${q}": rows without a match: ${r.unmatched.slice(0, 3).join(' | ')}`)
      if (!r.marks.some((m) => m.includes(q))) fail(`"${q}": the typed text isn't highlighted`)
      if (!(await panel.getByRole('heading', { name: /^Tuning · \d+$/ }).isVisible())) fail(`"${q}": no "Tuning · n" results heading`)
      console.log(`  ok   "${q}": ${r.count} in ${r.sections.length} sections`)
      await shot(`2-search-${q}`)
      ;(await page.evaluate(sideways)).forEach((p) => fail(`"${q}": scrolls sideways: ${p}`))
    }

    // Tap a section title in the results → search cleared, Tuning shown, section open + snapped to the top.
    // (A section far down the list, so it really has to scroll.)
    await box.fill('margin')
    await page.waitForTimeout(150)
    const target = 'tuning:Layout & margins'
    await panel.locator(`[data-dk-section="${target}"] .dk-section-btn`).click()
    await page.waitForTimeout(900) // the smooth scroll
    if ((await box.inputValue()) !== '') fail('tapping a section title did not clear the search')
    if ((await page.getByRole('tab', { name: 'Tuning' }).getAttribute('aria-selected')) !== 'true') fail('Tuning is not the tab shown')
    const at = await page.evaluate(sectionTop, target)
    if (!at?.open) fail('the tapped section is not open')
    if (!at || Math.abs(at.top) > 12) fail(`the tapped section is not snapped to the top (it's ${at?.top}px down)`)
    if (!at?.scrolled) fail('the panel did not scroll to the section')
    console.log(`  ok   tap "Layout & margins" → open, ${at?.top}px from the top (scrolled ${at?.scrolled}px)`)
    await shot('3-went-to-section')

    // Collapse it, then expand it, by its title
    const head = panel.locator(`[data-dk-section="${target}"] .dk-section-btn`)
    await head.click()
    if ((await page.evaluate(sectionTop, target))?.open) fail('tapping an open section title did not close it')
    if ((await head.getAttribute('aria-expanded')) !== 'false') fail('closed section: aria-expanded is not false')
    await head.click()
    if (!(await page.evaluate(sectionTop, target))?.open) fail('tapping a closed section title did not open it')
    console.log('  ok   close / open a section by its title')

    // A chip opens + scrolls to its section
    await page.locator('.devkit-scroll').evaluate((el) => { el.scrollTop = 0 })
    await panel.locator('.dk-index .dk-chip').first().click()
    await page.waitForTimeout(700)
    const firstId = await panel.locator('.devkit-body:not([hidden]) .dk-section').first().getAttribute('data-dk-section')
    if (!(await page.evaluate(sectionTop, firstId))?.open) fail('a chip did not open its section')

    // ✕ clears; Esc clears (and leaves the panel open); the next Esc closes it
    await box.fill('pop')
    await page.getByRole('button', { name: 'Clear the search' }).click()
    if ((await box.inputValue()) !== '') fail('✕ did not clear the search')
    if (!(await panel.locator('.dk-index').isVisible())) fail('after ✕ the normal view (chips) is not back')
    await box.fill('trail')
    await page.keyboard.press('Escape')
    if ((await box.inputValue()) !== '') fail('Esc did not clear the search')
    if (!(await panel.isVisible())) fail('Esc with a search closed the panel (it should only clear)')
    await shot('4-cleared')
    await page.keyboard.press('Escape')
    if (await panel.isVisible()) fail('the second Esc did not close the panel')
    console.log('  ok   ✕ / Esc clear the search; the next Esc closes')

    // Nothing found
    await page.keyboard.press('Backquote')
    await box.fill('zzqx')
    await page.waitForTimeout(150)
    if (!(await page.evaluate(results)).none) fail('no "Nothing matches" note for a search with no results')
    await box.fill('')

    // Colours: the Color tab joins the search (UI colours) and garden colours have pickers in Tuning
    await box.fill('colour')
    await page.waitForTimeout(150)
    const colourTabs = await panel.locator('.dk-results-tab').allTextContents()
    if (!colourTabs.some((t) => t.startsWith('Color'))) fail(`"colour": the Color tab is not in the results (${colourTabs.join(', ')})`)
    if (!(await panel.locator('.devkit-body:not([hidden]) .tt-row-colour input[type=color]').first().isVisible())) fail('"colour": no colour pickers in Tuning results')
    await shot('5-search-colour')
    await box.fill('')

    if (errors.length) fail(`console errors: ${errors.slice(0, 5).join(' | ')}`)
    await context.close()
  }
} finally {
  await browser.close()
  await server.close()
}
console.log(failures ? `FAIL — ${failures} problem(s)` : `PASS — Dev Kit search + sections at phone and desktop; screenshots in ${OUT}/`)
process.exit(failures ? 1 : 0)
