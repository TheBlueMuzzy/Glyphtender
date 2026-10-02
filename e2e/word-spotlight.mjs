// WORD SPOTLIGHT (F25) — a cast that makes 2 words and one that makes 3, at phone 390×844 and desktop 1440×900:
// while aiming (the "Cast · +N" preview) the words light up ONE AT A TIME, in order, round and round. Checks, sampling
// the real animations every ~50 ms over two loops: never two words lit at once, every word gets lit, the lit word
// changes over time in order (0 → 1 → 2 → 0 …), each word's label ("QUA +4") lights with its word and covers none of
// its letters. After the seed lands the words SCORE once, one at a time in the same order (the score sequence —
// e2e/score-sequence.mjs looks closer): never two lit, each bubble just the word, then all dark before the next turn.
// Pictures: spot-<size>-<n>w-aim-<i>-<WORD>.png, one per lit word, + spot-<size>-<n>w-after.png, for a person to look at.
// The dev hook finds the gardens (random play until such a cast exists); the planning is real store actions.
// Starts its OWN dev server (default port 5189) and closes only that one.
//   npm run e2e:spotlight [outDir] [port]
import { mkdirSync } from 'node:fs'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import anim from '../content/tuning/anim.json' with { type: 'json' }
import garden from '../content/tuning/garden.json' with { type: 'json' }

const OUT = process.argv[2] ?? 'e2e-shots'
const PORT = Number(process.argv[3] ?? 5189)
const SIZES = [
  { name: 'phone-tall', width: 390, height: 844, mobile: true },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
]
mkdirSync(OUT, { recursive: true })

const server = await createServer({ server: { port: PORT, strictPort: true, host: '127.0.0.1' }, logLevel: 'warn' })
await server.listen()
const browser = await chromium.launch()
let failures = 0
const fail = (why) => { failures++; console.log(`  FAIL ${why}`) }
const loopMs = (n) => n * (anim.spotlightHold + 2 * anim.spotlightFade) * 1000

try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, isMobile: size.mobile, hasTouch: size.mobile })
    const errors = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    const act = (fn) => page.evaluate(`(${fn})(window.__glyphtender.store.getState())`)
    const glidesDone = () => page.waitForFunction(
      () => [...document.querySelectorAll('[data-glide]')].every((g) => g.getAnimations().length === 0), null, { timeout: 3000 })

    // Each word's border group and label right now: which word, its opacity
    const moment = (kind) => page.evaluate((kind) => {
      const read = (sel) => [...document.querySelectorAll(sel)].map((el) => ({
        i: Number(el.dataset.spotWord), word: el.dataset.word ?? el.dataset.spotLabel, o: Number(getComputedStyle(el).opacity),
      }))
      return {
        borders: read(`[data-planned-words] [data-spot-of="${kind}"], [data-grown] [data-spot-of="${kind}"]`),
        labels: read(`[data-spot-labels] [data-spot-of="${kind}"]`),
      }
    }, kind)

    // Watch two whole loops: one word at a time, all of them, in order; labels with their words
    const watchCycle = async (kind, words, tag) => {
      const n = words.length
      const order = [] // the fully lit word, each time it changes
      let worst = 0
      const end = Date.now() + loopMs(n) * 2 + 300
      while (Date.now() < end) {
        const m = await moment(kind)
        if (m.borders.length !== n) { fail(`${tag}: ${m.borders.length} word groups drawn, expected ${n}`); return }
        const lit = m.borders.filter((b) => b.o > 0.02)
        worst = Math.max(worst, lit.length)
        if (lit.length > 1) fail(`${tag}: ${lit.length} words lit at once (${lit.map((b) => `${b.word}@${b.o.toFixed(2)}`).join(' ')})`)
        const full = m.borders.find((b) => b.o > 0.9)
        if (full && order[order.length - 1] !== full.i) order.push(full.i)
        if (garden.spotlightLabel) {
          for (const l of m.labels) {
            const b = m.borders.find((x) => x.i === l.i)
            if (Math.abs(l.o - b.o) > 0.15) fail(`${tag}: the label "${l.word}" is at ${l.o.toFixed(2)} but its word at ${b.o.toFixed(2)}`)
          }
        }
        await page.waitForTimeout(50)
      }
      const seen = new Set(order)
      if (seen.size !== n) fail(`${tag}: only words [${[...seen]}] were lit in two loops (of ${n})`)
      const inOrder = order.every((w, k) => k === 0 || w === (order[k - 1] + 1) % n)
      if (!inOrder) fail(`${tag}: the lit word went ${order.join(' → ')} (expected 0 → 1 → … round again)`)
      if (order.length < n + 1) fail(`${tag}: the lit word changed only ${order.length - 1} times in two loops`)
      console.log(`${seen.size === n && inOrder && worst <= 1 ? 'ok  ' : 'FAIL'} ${tag} · lit ${order.map((i) => words[i].word).join(' → ')} · max lit at once ${worst}`)
    }

    // A picture of each word lit (waits for it), and its label: right words, none of the word's letters covered
    const shotEach = async (kind, words, tag, file) => {
      for (let i = 0; i < words.length; i++) {
        await page.waitForFunction(([kind, i]) => {
          const el = document.querySelector(`[data-planned-words] [data-spot-of="${kind}"][data-spot-word="${i}"], [data-grown] [data-spot-of="${kind}"][data-spot-word="${i}"]`)
          return el && Number(getComputedStyle(el).opacity) > 0.95
        }, [kind, i], { timeout: loopMs(words.length) + 2000 })
        await page.screenshot({ path: `${OUT}/${file}-${i}-${words[i].word}.png` })
        if (!garden.spotlightLabel) continue
        const check = await page.evaluate(([kind, i, hexes]) => {
          const label = document.querySelector(`[data-spot-labels] [data-spot-of="${kind}"][data-spot-word="${i}"]`)
          if (!label) return { missing: true }
          const box = label.querySelector('rect').getBoundingClientRect()
          const covered = []
          for (const key of hexes) {
            const cell = document.querySelector(`.game-garden > polygon[data-hex="${key}"]`).getBoundingClientRect()
            const cx = cell.x + cell.width / 2, cy = cell.y + cell.height / 2, r = (cell.width / 2 / 0.97) * 0.75 // the letter
            const nx = Math.max(box.left, Math.min(cx, box.right)), ny = Math.max(box.top, Math.min(cy, box.bottom))
            if (Math.hypot(cx - nx, cy - ny) < r) covered.push(key)
          }
          const inside = box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight
          let shown = 1 // its own opacity × every group round it (the grown labels wait for the score pops)
          for (let el = label; el && el.tagName !== 'svg'; el = el.parentElement) shown *= Number(getComputedStyle(el).opacity)
          return { text: label.textContent, covered, inside, shown, px: Math.round(box.height) }
        }, [kind, i, words[i].hexes])
        const want = `${words[i].word} +${words[i].magic}`
        if (check.missing) fail(`${tag}: no label for ${words[i].word}`)
        else {
          if (check.text !== want) fail(`${tag}: the label says "${check.text}", expected "${want}"`)
          if (check.covered.length) fail(`${tag}: the label "${check.text}" covers its own letters at ${check.covered.join(' ')}`)
          if (!check.inside) fail(`${tag}: the label "${check.text}" is off the screen`)
          if (check.shown < 0.9) fail(`${tag}: the label "${check.text}" is not showing with its word (opacity ${check.shown.toFixed(2)})`)
          console.log(`${check.text === want && !check.covered.length && check.inside ? 'ok  ' : 'FAIL'} ${tag} label "${check.text}" · ${check.px}px tall · clear of its letters`)
        }
      }
    }

    await page.goto(`http://127.0.0.1:${PORT}/`)
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.getByRole('button', { name: 'Start' }).click()
    await page.waitForFunction(() => window.__glyphtender?.store.getState().wordsStatus === 'ready', null, { timeout: 15000 })

    for (const count of [2, 3]) {
      const tag = `${size.name} ${count} words`
      // A fresh 2-player game (seeds public: no handoff box over the pictures), then random play to such a cast
      await act(`(s) => s.startGame({ players: 2, seed: ${count * 7}, hideSeeds: false })`)
      let pick = null
      for (let seed = 1; seed <= 30 && !pick; seed++) pick = await page.evaluate(([n, seed]) => window.__glyphtender.findWordsTurn(n, seed), [count, seed])
      if (!pick) { fail(`${tag}: found no ${count}-word cast`); continue }
      await page.waitForTimeout(200)
      await act(`(s) => s.tapGlyphling(${pick.glyphling})`)
      const [q, r] = pick.to.split(',').map(Number)
      await act(`(s) => s.tapHex({ q: ${q}, r: ${r} })`)
      await glidesDone()
      await act(`(s) => s.tapSeed(${pick.seed})`)
      const [tq, tr] = pick.target.split(',').map(Number)
      await act(`(s) => s.tapHex({ q: ${tq}, r: ${tr} })`)
      if (!(await act('(s) => s.cast !== null'))) { fail(`${tag}: the seed was not aimed`); continue }
      // While aiming: the "Cast · +N" preview cycles the words this cast will make (the engine's, via the dev hook)
      const aim = pick.words
      const drawn = (await moment('planned')).borders.map((b) => b.word).join(' ')
      if (drawn !== aim.map((w) => w.word).join(' ')) fail(`${tag}: aiming draws [${drawn}], the cast makes [${aim.map((w) => w.word).join(' ')}]`)
      await watchCycle('planned', aim, `${tag} aiming`)
      await shotEach('planned', aim, `${tag} aiming`, `spot-${size.name}-${count}w-aim`)

      // Cast → it lands → the words it grew cycle the same way, until play moves on
      await act('(s) => s.startCast()')
      await page.waitForFunction(() => !window.__glyphtender.store.getState().flying, null, { timeout: 5000 })
      const turn = await act('(s) => ({ words: s.game.lastTurn.words.map((w) => ({ word: w.word, magic: w.magic, hexes: w.hexes.map((h) => h.q + "," + h.r) })) })')
      if (turn.words.length !== count) fail(`${tag}: the cast grew ${turn.words.length} words`)
      // The words score ONCE, one at a time, in the aiming order; bubbles say just the word; then all dark
      const order = [], bubbles = new Set()
      let worst = 0
      while (await act('(s) => s.scoring !== null')) {
        const m = await moment('grown')
        const lit = m.borders.filter((b) => b.o > 0.02)
        worst = Math.max(worst, lit.length)
        const full = m.borders.find((b) => b.o > 0.6)
        if (full && order[order.length - 1] !== full.i) order.push(full.i)
        m.labels.filter((l) => l.o > 0.6).forEach((l) => bubbles.add(l.word))
        await page.waitForTimeout(40)
      }
      const want = turn.words.map((_, i) => i).join(' ')
      if (order.join(' ') !== want) fail(`${tag} scoring: the words lit ${order.join(' → ')} (expected ${want}, once each)`)
      if (worst > 1) fail(`${tag} scoring: ${worst} words lit at once`)
      const extra = [...bubbles].filter((b) => !turn.words.some((w) => w.word === b))
      if (garden.spotlightLabel && extra.length) fail(`${tag} scoring: bubbles with more than the word: ${extra.join(', ')}`)
      const left = (await moment('grown')).borders.filter((b) => b.o > 0.01).length
      if (left) fail(`${tag}: ${left} words still lit after the score sequence`)
      await page.screenshot({ path: `${OUT}/spot-${size.name}-${count}w-after.png` })
      console.log(`${order.join(' ') === want && worst <= 1 && !left ? 'ok  ' : 'FAIL'} ${tag} scored ${order.map((i) => turn.words[i].word).join(' → ')} once each · bubbles [${[...bubbles].join(' ')}] · nothing lit after`)
    }
    if (errors.length) fail(`${size.name} console errors: ${errors.join(' | ')}`)
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}
console.log(failures ? `\n✗ ${failures} problem(s)` : '\n✓ word spotlight e2e passed')
process.exit(failures ? 1 : 0)
