// TURN TRAILS + PLAYER-COLOUR TEMPLATES, through the real screen, at 390×844, 844×390, 1099×846 and 1440×900 —
// for a Yellow AND a Blue player (Muzzy, 2026-10-01: "the color of the movement/casting template should match the
// color of the player… if we could see the paths when other players take their turns…"):
//   landed    — right after the previous turn landed: NO trail on the board (Muzzy: "shouldn't [stick around] post cast")
//   plan-move — holding the moved glyphling: move hexes filled in MY colour + the dotted path to the planned spot
//   plan-cast — a seed aimed: the same filled template in a LIGHTER shade of my colour (garden.json castShade), the
//               dotted path, and NO cast arc (Muzzy: casts are straight-line shots)
//   replay    — another player's replayed turn drawing on (frozen at 60%: from ring → path → to ring → target ring)
// Checks the colours (cast = castColour of mine, not my plain colour), no dashed option outlines, no arc, and that the
// trail sits under the seeds and glyphlings. Starts its OWN dev server (default port 5281 — never Muzzy's 5180) and closes only that one.
//   npm run e2e:trails [outDir] [port]
import { mkdirSync } from 'node:fs'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import garden from '../content/tuning/garden.json' with { type: 'json' }
import anim from '../content/tuning/anim.json' with { type: 'json' }

const OUT = process.argv[2] ?? 'e2e-shots'
const PORT = Number(process.argv[3] ?? 5281)
const SIZES = [
  { name: 'phone-tall', width: 390, height: 844, mobile: true },
  { name: 'phone-wide', width: 844, height: 390, mobile: true },
  { name: 'laptop', width: 1099, height: 846, mobile: false },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
]
const COLOURS = ['yellow', 'blue', 'purple', 'pink']
mkdirSync(OUT, { recursive: true })

const server = await createServer({ server: { port: PORT, strictPort: true, host: '127.0.0.1' }, logLevel: 'warn' })
await server.listen()
const browser = await chromium.launch()
let failures = 0
const fail = (why) => { failures++; console.log(`  FAIL ${why}`) }

try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, isMobile: size.mobile, hasTouch: size.mobile })
    const errors = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    const tap = (loc) => (size.mobile ? loc.tap({ force: true }) : loc.click({ force: true }))
    const store = (fn) => page.evaluate(`(${fn})(window.__glyphtender.store.getState())`)
    const settle = () => page.waitForFunction(
      () => [...document.querySelectorAll('[data-glide]')].every((g) => g.getAnimations().length === 0), null, { timeout: 3000 })
    const shot = async (name) => {
      await settle()
      await page.waitForTimeout(250)
      await page.screenshot({ path: `${OUT}/${size.name}-trail-${name}.png` })
    }
    // What the board shows: the trail (mode, seat, colour, strength) and the option hexes (kind, colour)
    const board = () => page.evaluate(() => {
      const trail = document.querySelector('[data-trail]')
      const strokes = trail ? [...trail.querySelectorAll('[data-trail-part] > :last-child')].map((el) => el.getAttribute('stroke')) : []
      const parts = trail ? [...trail.querySelectorAll('[data-trail-part]')].map((el) => el.getAttribute('data-trail-part')) : []
      const options = [...document.querySelectorAll('[data-option]')]
      const svg = document.querySelector('.game-garden')
      const order = trail ? [...svg.children].indexOf(trail) : -1
      const firstPiece = [...svg.children].findIndex((el) => el.matches('.game-seed, [data-glide], [data-planned-seed]'))
      return {
        mode: trail?.getAttribute('data-trail') ?? null, seat: trail ? Number(trail.getAttribute('data-trail-seat')) : null,
        strokes: [...new Set(strokes)], parts, opacity: trail ? Number(getComputedStyle(trail).opacity) : null,
        under: order >= 0 && (firstPiece < 0 || order < firstPiece),
        options: options.map((o) => ({ kind: o.getAttribute('data-option'), fill: o.querySelector('polygon').getAttribute('fill'), dot: o.querySelector('circle')?.getAttribute('fill'), dashed: !!o.querySelector('[stroke-dasharray]') })),
      }
    })
    const expectTrail = (b, mode, seat, parts, where) => {
      if (b.parts.includes('arc')) fail(`${size.name} ${where}: a cast arc is drawn (casts are straight-line shots — no arc)`)
      const colour = garden[COLOURS[seat]]
      if (b.mode !== mode || b.seat !== seat) return fail(`${size.name} ${where}: trail ${b.mode} of seat ${b.seat}, expected ${mode} of seat ${seat}`)
      if (b.strokes.join() !== colour) fail(`${size.name} ${where}: trail drawn in ${b.strokes}, expected ${COLOURS[seat]} ${colour}`)
      for (const p of parts) if (!b.parts.includes(p)) fail(`${size.name} ${where}: the trail has no ${p}`)
      if (!b.under) fail(`${size.name} ${where}: the trail is drawn over the seeds / glyphlings`)
      console.log(`ok   ${size.name} ${where} · ${mode} trail in ${COLOURS[seat]} · ${b.parts.join(' → ')} · opacity ${b.opacity}`)
    }
    // Move options = the player's colour; cast options = the same template in castShade's lighter (or darker) shade
    const castTint = (colour) => page.evaluate(([c, night, shade]) => import('/src/game/castShade.ts').then((m) => m.castColour(c, night, shade)),
      [colour, garden.background, garden.castShade])
    const expectOptions = async (b, kind, seat, where) => {
      const colour = kind === 'cast' ? await castTint(garden[COLOURS[seat]]) : garden[COLOURS[seat]]
      const mine = b.options.filter((o) => o.kind === kind)
      if (!mine.length) return fail(`${size.name} ${where}: no ${kind} options lit`)
      if (kind === 'cast' && garden.castShade !== 0 && colour === garden[COLOURS[seat]]) fail(`${size.name} ${where}: cast options look just like move options (castShade 0)`)
      if (mine.some((o) => o.fill !== colour || o.dot !== colour)) fail(`${size.name} ${where}: ${kind} options not in ${colour} (${[...new Set(mine.map((o) => o.fill))]})`)
      if (mine.some((o) => o.dashed)) fail(`${size.name} ${where}: ${kind} options have a dashed outline`)
      else console.log(`ok   ${size.name} ${where} · ${mine.length} ${kind} options filled in ${colour} (${COLOURS[seat]}${kind === 'cast' ? `, castShade ${garden.castShade}` : ''})`)
    }

    await page.goto(`http://127.0.0.1:${PORT}/`)
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.getByRole('button', { name: 'Start' }).click()
    await page.waitForFunction(() => window.__glyphtender?.store.getState().wordsStatus === 'ready', null, { timeout: 15000 })
    while (await store((s) => s.game.phase === 'draft')) await tap(page.locator('[data-option="move"] circle').first())
    if (await store((s) => s.handoff !== null)) await tap(page.getByRole('button', { name: 'Show my seeds' }))

    // A mid-game garden with Yellow to play and a word to make (the dev hook jumps there; the turn before was Blue's).
    // Of a few, the one whose move + cast go furthest (the trail shows best); then the store jumps back to it.
    let turn = null, best = null
    const far = (t, from) => { const d = (a, b) => { const [q1, r1] = a.split(',').map(Number), [q2, r2] = b.split(',').map(Number); return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(q1 + r1 - q2 - r2)) / 2 }; return d(from, t.to) + d(t.to, t.target) }
    for (let seed = 1; seed < 20 && !(best && seed > 8); seed++) {
      await page.evaluate((n) => window.__glyphtender.store.getState().startGame({ players: 2, seed: 10 + n, hideSeeds: false }), seed)
      await page.evaluate(() => import('/src/engine/engine.ts').then(({ legalDraftHexes }) => { // a quick draft
        const s = window.__glyphtender.store
        while (s.getState().game.phase === 'draft') s.getState().tapHex(legalDraftHexes(s.getState().game)[0])
      }))
      const found = await page.evaluate((n) => window.__glyphtender.findWordsTurn(1, n), seed)
      if (!found || !(await store((s) => s.game.current === 0 && s.game.lastTurn?.seat === 1))) continue
      const from = await store(`(s) => { const g = s.game.glyphlings.find((x) => x.id === ${found.glyphling}).hex; return g.q + ',' + g.r }`)
      if (!best || far(found, from) > best.far) best = { turn: found, far: far(found, from), game: await store((s) => s.game) }
    }
    if (best) {
      turn = best.turn
      await page.evaluate((game) => window.__glyphtender.store.getState().loadState(game), best.game)
    }
    if (!turn) fail(`${size.name}: no mid-game garden with Yellow to play`)

    for (const seat of turn ? [0, 1] : []) {
      const who = COLOURS[seat]
      if (seat === 1) {
        // Yellow's word-making turn is cast for real; Blue plays next. Blue's turn: the first that casts (engine options)
        await page.evaluate((t) => { // plan Yellow's turn again (the replay check took it back) and cast it
          const s = () => window.__glyphtender.store.getState()
          const hex = (k) => { const [q, r] = k.split(',').map(Number); return { q, r } }
          s().tapGlyphling(t.glyphling)
          s().tapHex(hex(t.to))
          s().tapSeed(t.seed)
          s().tapHex(hex(t.target))
          s().startCast()
        }, turn)
        await page.waitForFunction(() => !window.__glyphtender.store.getState().flying, null, { timeout: 5000 })
        // (its score sequence plays out and fades before Blue can play)
        await page.waitForFunction(() => window.__glyphtender.store.getState().scoring === null, null, { timeout: 15000 })
        await page.waitForTimeout(400)
        if (!(await store((s) => s.game.current === 1 && s.game.lastTurn.seat === 0))) { fail(`${size.name}: Yellow's turn didn't pass to Blue`); break }
        turn = await page.evaluate(() => import('/src/engine/engine.ts').then(({ legalMoves, legalCasts }) => {
          const game = window.__glyphtender.store.getState().game
          const key = (h) => `${h.q},${h.r}`
          const steps = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2
          let pick = null, best = -1 // the move + cast that go furthest (the trail shows best)
          for (const g of game.glyphlings.filter((x) => x.seat === game.current)) {
            for (const to of legalMoves(game, g.id)) {
              for (const target of legalCasts(game, g.id, to)) {
                const far = steps(g.hex, to) + steps(to, target)
                if (far > best) { best = far; pick = { glyphling: g.id, to: key(to), seed: 0, target: key(target) } }
              }
            }
          }
          return pick
        }))
        if (!turn) { fail(`${size.name}: Blue has no turn that casts`); break }
      }
      await page.evaluate(() => window.__glyphtender.store.setState({ handoff: null }))
      const before = await store((s) => s.game.lastTurn.seat)

      // landed: the previous player's turn has landed — no trail stays on the board
      await shot(`${who}-to-play-landed`)
      const landed = await board()
      if (landed.mode !== null) fail(`${size.name}: a trail (${landed.mode}, seat ${landed.seat}) is still on the board after seat ${before}'s turn landed`)
      else console.log(`ok   ${size.name} ${who} to play · no trail left from seat ${before}'s landed turn`)

      // plan-move: move, then pick the moved glyphling up again (its moves glow in my colour + the dotted path)
      await tap(page.locator(`[data-glyph="${turn.glyphling}"]`))
      await expectOptions(await board(), 'move', seat, `${who} holding a glyphling`)
      await tap(page.locator(`[data-option="move"] circle[data-hex="${turn.to}"]`))
      await tap(page.locator(`[data-glyph="${turn.glyphling}"]`))
      await shot(`${who}-plan-move`)
      const planMove = await board()
      expectTrail(planMove, 'plan', seat, ['path'], `${who} plan-move`)
      await expectOptions(planMove, 'move', seat, `${who} plan-move`)
      await tap(page.locator(`[data-glyph="${turn.glyphling}"]`)) // let go: the cast rings show

      // plan-cast: aim the seed (the lighter cast template + the dotted path — no arc)
      const pos = await store(`(s) => s.trayOrder[s.game.current].indexOf(${turn.seed})`)
      await tap(page.locator(`[data-tray-pos="${pos}"]`))
      await tap(page.locator(`[data-option="cast"] circle[data-hex="${turn.target}"]`))
      await shot(`${who}-plan-cast`)
      const planCast = await board()
      expectTrail(planCast, 'plan', seat, ['path'], `${who} plan-cast`)
      await expectOptions(planCast, 'cast', seat, `${who} plan-cast`)
      if (seat === 1 && (size.name === 'laptop' || size.name === 'phone-tall')) {
        // Purple and pink on the same night board (sent as the Dev Kit's Tuning tab would; the file's colours come back)
        const tune = (data) => page.evaluate((data) => window.dispatchEvent(new CustomEvent('devkit:tuning', { detail: { file: 'garden', data } })), data)
        for (const other of ['purple', 'pink']) {
          await tune({ ...garden, blue: garden[other] })
          await page.waitForTimeout(200)
          await page.screenshot({ path: `${OUT}/${size.name}-trail-${other}-plan-cast.png` })
        }
        await tune(garden)
      }

      // replay: as another player's turn arrives online (the store's `trail`, set by onlinePlay.ts) — frozen mid draw-on
      await page.evaluate(() => { const s = window.__glyphtender.store.getState(); s.undo(); s.undo() })
      await settle() // the Undo glide home
      await page.evaluate((t) => {
        const s = window.__glyphtender.store.getState()
        const g = s.game.glyphlings.find((x) => x.id === t.glyphling)
        const hex = (k) => { const [q, r] = k.split(',').map(Number); return { q, r } }
        window.__glyphtender.store.setState({ trail: { seat: g.seat, glyphlingId: g.id, from: g.hex, to: hex(t.to), target: hex(t.target) } })
      }, turn)
      await page.waitForTimeout(50)
      // freeze every part at 60% of trailLead (they all run on the same clock from the start)
      const drawing = await page.evaluate((ms) => {
        const anims = [...document.querySelectorAll('[data-trail] [data-draw]')].flatMap((el) => el.getAnimations())
        anims.forEach((a) => { a.pause(); a.currentTime = ms })
        return anims.length
      }, 0.6 * 1000 * anim.trailLead)
      await page.screenshot({ path: `${OUT}/${size.name}-trail-${who}-replay-mid.png` })
      if (!drawing) fail(`${size.name}: the replayed trail didn't draw on (no animations)`)
      expectTrail(await board(), 'live', seat, ['from', 'path', 'to', 'target'], `${who} replay (drawing on: ${drawing} parts)`)
      await page.evaluate(() => document.querySelectorAll('[data-trail] [data-draw]').forEach((el) => el.getAnimations().forEach((a) => a.finish())))
      await page.screenshot({ path: `${OUT}/${size.name}-trail-${who}-replay-drawn.png` })
      await page.evaluate(() => window.__glyphtender.store.setState({ trail: null }))
    }
    if (errors.length) fail(`${size.name}: console errors: ${errors.slice(0, 3).join(' | ')}`)
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}
console.log(failures ? `\n${failures} FAILED` : '\nall trail checks passed')
process.exit(failures ? 1 : 0)
