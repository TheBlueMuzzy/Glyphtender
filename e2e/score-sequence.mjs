// SCORE SEQUENCE (Muzzy, 2026-10-01) — a cast that makes 3 words, at phone 390×844 and desktop 1440×900:
// after the seed lands the words score ONE AT A TIME (the aiming spotlight's order): each word's outline + a bubble
// with just the word (no points), its seeds pop their "+x" and fly into the glyphling's running total, which adds up
// word by word AND grows with every point; after the last word the final total holds, then everything fades — and
// only then does the next turn start (input is held; the pass-and-play handoff box waits for it).
// Pictures (all the parts frozen at the same moment of the one shared clock): seq-<size>-1-word1-pops ·
// 2-word1-total · 3-word2-total · 4-final-total · 5-after (nothing left) · 6-handoff (pass-and-play, after the fade).
// Checks: one word lit at a time, in order · bubbles say just the word · totals = the running sums after each word ·
// the total is bigger at each word · nothing visible after the end · no input / handoff until it has faded.
// Starts its OWN dev server (default port 5243) and closes only that one.
//   npm run e2e:score [outDir] [port]
import { mkdirSync } from 'node:fs'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import anim from '../content/tuning/anim.json' with { type: 'json' }

const OUT = process.argv[2] ?? 'e2e-shots'
const PORT = Number(process.argv[3] ?? 5243)
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
const ok = (good, what) => { if (!good) fail(what); else console.log(`ok   ${what}`) }

// Every part of the sequence: the grown words' outlines + bubbles, the seed pops, the total and its numbers
const PARTS = '[data-grown] [data-spot-of="grown"], [data-spot-labels] [data-spot-of="grown"], [data-score-pops] text, [data-score-total]'

try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, isMobile: size.mobile, hasTouch: size.mobile })
    const errors = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    const act = (fn) => page.evaluate(`(${fn})(window.__glyphtender.store.getState())`)
    const glidesDone = () => page.waitForFunction(
      () => [...document.querySelectorAll('[data-glide]')].every((g) => g.getAnimations().length === 0), null, { timeout: 3000 })

    await page.goto(`http://127.0.0.1:${PORT}/`)
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.getByRole('button', { name: 'Start' }).click()
    await page.waitForFunction(() => window.__glyphtender?.store.getState().wordsStatus === 'ready', null, { timeout: 15000 })

    // Plan and cast a 3-word turn (found by the dev hook; the planning is real store actions)
    const castThree = async (hideSeeds, tag) => {
      await act(`(s) => s.startGame({ players: 2, seed: 21, hideSeeds: ${hideSeeds} })`)
      let pick = null
      for (let seed = 1; seed <= 30 && !pick; seed++) pick = await page.evaluate((seed) => window.__glyphtender.findWordsTurn(3, seed), seed)
      if (!pick) { fail(`${tag}: found no 3-word cast`); return null }
      await page.waitForTimeout(200)
      await act(`(s) => s.tapGlyphling(${pick.glyphling})`)
      const [q, r] = pick.to.split(',').map(Number)
      await act(`(s) => s.tapHex({ q: ${q}, r: ${r} })`)
      await glidesDone()
      await act(`(s) => s.tapSeed(${pick.seed})`)
      const [tq, tr] = pick.target.split(',').map(Number)
      await act(`(s) => s.tapHex({ q: ${tq}, r: ${tr} })`)
      const aimed = (await page.evaluate(() => [...document.querySelectorAll('[data-planned-words] [data-spot-of="planned"]')].map((g) => g.dataset.word)))
      await act('(s) => s.startCast()')
      await page.waitForFunction(() => !window.__glyphtender.store.getState().flying, null, { timeout: 5000 })
      const turn = await act('(s) => ({ seat: s.game.lastTurn.seat, words: s.game.lastTurn.words.map((w) => w.word) })')
      return { pick, aimed, turn }
    }

    // ---- 1. My cast, seeds public (no handoff box): frozen pictures of each moment, then the end ----
    const tag = `${size.name}`
    const cast = await castThree(false, tag)
    if (!cast) continue
    ok(cast.turn.words.join(' ') === cast.aimed.join(' '), `${tag}: words score in the aiming spotlight's order (${cast.aimed.join(' → ')})`)
    // Freeze every part at the landing's first moment, read the timeline off the animations themselves
    const plan = await page.evaluate((PARTS) => {
      const all = [...document.querySelectorAll(PARTS)].flatMap((el) => el.getAnimations())
      all.forEach((a) => a.pause())
      const end = all[0]?.effect.getComputedTiming().duration ?? 0
      const timeOf = (el, k) => el.getAnimations()[0].effect.getKeyframes()[k].computedOffset * end
      const words = [...document.querySelectorAll('[data-grown] [data-spot-of="grown"]')].map((el) => ({ word: el.dataset.word, start: timeOf(el, 1) }))
      const counts = [...document.querySelectorAll('[data-score-count]')].map((el) => ({ text: el.textContent, at: timeOf(el, 1) }))
      const pops = [...document.querySelectorAll('[data-score-pop]')].map((el) => ({ at: timeOf(el, 1), fly: timeOf(el, 4) }))
      return { end, words, counts, pops, animations: all.length }
    }, PARTS)
    if (!plan.animations) { fail(`${tag}: no score sequence played`); continue }
    const at = async (ms) => page.evaluate(([PARTS, ms]) => {
      for (const el of document.querySelectorAll(PARTS)) for (const a of el.getAnimations()) { a.pause(); a.currentTime = ms }
    }, [PARTS, ms])
    // What shows right now: lit words, their bubbles, the visible total and its size, the visible seed pops
    const look = () => page.evaluate(() => {
      const shown = (el) => { let o = 1; for (let e = el; e && e.tagName !== 'svg'; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); return o }
      const lit = [...document.querySelectorAll('[data-grown] [data-spot-of="grown"]')].filter((el) => shown(el) > 0.5).map((el) => el.dataset.word)
      const bubbles = [...document.querySelectorAll('[data-spot-labels] [data-spot-of="grown"]')].filter((el) => shown(el) > 0.5).map((el) => el.querySelector('text').textContent)
      const totals = [...document.querySelectorAll('[data-score-count]')].filter((el) => shown(el) > 0.5)
      const pops = [...document.querySelectorAll('[data-score-pop]')].filter((el) => shown(el) > 0.5).map((el) => el.textContent)
      const anything = [...document.querySelectorAll('[data-grown] [data-spot-of="grown"], [data-spot-labels] [data-spot-of="grown"], [data-score-pops] text')]
        .filter((el) => shown(el) > 0.01).map((el) => el.dataset.word ?? el.textContent)
      return { lit, bubbles, total: totals.map((el) => el.textContent), height: totals[0] ? Math.round(totals[0].getBoundingClientRect().height) : 0, pops, anything }
    })
    const wordTotals = [] // the running total once each word's points are all in
    let seen = 0
    plan.words.forEach((w, i) => {
      const next = plan.words[i + 1]?.start ?? Infinity
      const inWord = plan.counts.filter((c) => c.at >= w.start && c.at < next - 1)
      seen += inWord.length
      wordTotals.push(inWord.at(-1))
    })
    ok(seen === plan.counts.length && seen === plan.pops.length, `${tag}: every seed's points arrive in the total (${plan.pops.length} pops → ${plan.counts.map((c) => c.text).join(' ')})`)

    // 1 — word 1 lit, its pops up over their letters, no total yet
    const word1Pops = plan.pops.filter((p) => p.at < (plan.words[1]?.start ?? Infinity))
    await at(Math.min(...word1Pops.map((p) => p.fly)) - 30)
    let m = await look()
    ok(m.lit.length === 1 && m.lit[0] === plan.words[0].word, `${tag} 1: only word 1 (${plan.words[0].word}) is lit — lit [${m.lit}]`)
    ok(m.bubbles.length <= 1 && (m.bubbles[0] ?? plan.words[0].word) === plan.words[0].word, `${tag} 1: its bubble says just "${plan.words[0].word}" — bubbles [${m.bubbles}]`)
    ok(m.pops.length === word1Pops.length && m.total.length === 0, `${tag} 1: word 1's seeds pop (${m.pops.join(' ')}), no total yet`)
    await page.screenshot({ path: `${OUT}/seq-${size.name}-1-word1-pops.png` })
    // 2, 3, 4 — after each word: its running total, bigger each time; word 1 still lit at 2; word 2 lit at 3
    const heights = []
    for (const [k, name] of [[0, '2-word1-total'], [1, '3-word2-total'], [plan.words.length - 1, '4-final-total']]) {
      const c = wordTotals[k]
      const settle = c.at + anim.scorePopTime * 1000 // its pop has just settled (the word fades after this)
      await at(name.startsWith('4') ? plan.end - anim.scoreTotalFade * 1000 - 100 : settle) // (4: in the final hold)
      m = await look()
      heights.push(m.height)
      ok(m.total.length === 1 && m.total[0] === c.text, `${tag} ${name}: the glyphling's total says ${c.text} — shows [${m.total}]`)
      ok(m.lit.length === 1 && m.lit[0] === plan.words[k].word, `${tag} ${name}: only ${plan.words[k].word} is lit — lit [${m.lit}]`)
      await page.screenshot({ path: `${OUT}/seq-${size.name}-${name}.png` })
    }
    ok(heights[0] < heights[1] && heights[1] < heights[2], `${tag}: the total grows — ${heights.join(' < ')} px tall at ${wordTotals.map((c) => c.text).join(', ')}`)
    // Never two words at once: sample the whole timeline
    let worst = 0
    for (let ms = 0; ms <= plan.end; ms += 40) {
      await at(ms)
      worst = Math.max(worst, (await look()).lit.length)
    }
    ok(worst <= 1, `${tag}: never two words lit at once (max ${worst})`)
    // 5 — the end: nothing from the turn is left; the store lets play go on
    await at(plan.end)
    m = await look()
    ok(m.anything.length === 0, `${tag} 5: after the fade nothing is left on the board — [${m.anything}]`)
    await page.screenshot({ path: `${OUT}/seq-${size.name}-5-after.png` })
    await page.waitForFunction(() => window.__glyphtender.store.getState().scoring === null, null, { timeout: 10000 })
    console.log(`ok   ${tag}: the store's score timer ended`)

    // ---- 2. Real time, pass-and-play (seeds hidden): no input and no handoff box until everything has faded ----
    const cast2 = await castThree(true, `${tag} pass`)
    if (cast2) {
      let overlap = 0, blockedTap = true, handoffAt = null, fadedAt = null
      const start = Date.now()
      while (Date.now() - start < 12000) {
        const s = await page.evaluate(() => {
          const shown = (el) => { let o = 1; for (let e = el; e && e.tagName !== 'svg'; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); return o }
          const left = [...document.querySelectorAll('[data-grown] [data-spot-of="grown"], [data-spot-labels] [data-spot-of="grown"], [data-score-pops] text')].filter((el) => shown(el) > 0.02).length
          const box = [...document.querySelectorAll('button')].some((b) => b.textContent === 'Show my seeds' && b.offsetParent !== null)
          return { left, box, scoring: window.__glyphtender.store.getState().scoring }
        })
        if (s.box && s.left) overlap++
        if (s.box && handoffAt === null) handoffAt = Date.now() - start
        if (!s.left && fadedAt === null && Date.now() - start > 300) fadedAt = Date.now() - start
        if (s.scoring !== null && Date.now() - start > 500 && blockedTap) {
          // a tap on the next player's glyphling while it scores does nothing (and nothing shakes)
          const id = await act('(s) => s.game.glyphlings.find((g) => g.seat === s.game.current)?.id')
          await act(`(s) => s.tapGlyphling(${id})`)
          blockedTap = await act('(s) => s.selected === null && s.nope === null')
          if (!blockedTap) fail(`${tag} pass: a tap during the score sequence picked something up`)
          blockedTap = false // only once
        }
        if (s.box) break
        await page.waitForTimeout(40)
      }
      ok(overlap === 0 && handoffAt !== null && fadedAt !== null && handoffAt >= fadedAt,
        `${tag} pass: the handoff box comes only after the fade (faded ${fadedAt} ms, box ${handoffAt} ms)`)
      await page.screenshot({ path: `${OUT}/seq-${size.name}-6-handoff.png` })
    }
    if (errors.length) fail(`${size.name} console errors: ${errors.join(' | ')}`)
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}
console.log(failures ? `\n✗ ${failures} problem(s)` : '\n✓ score sequence e2e passed')
process.exit(failures ? 1 : 0)
