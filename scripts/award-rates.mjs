// npm run sim:awards — how often MINDLESS play earns each end-of-game award (research/sims.md, 2026-10-02).
// The sim players don't position or block on purpose (random = any legal action; greedy = the most Magic of 20 random
// turns), so this is a FLOOR check: an award these players earn often is too easy — earned by accident — and its
// threshold goes up. It can't say how often skilled play earns them: re-tune with the beta AI personalities.
// Options: --games 200 (per row) --tune '{"lockdownMinDrop":6}' (try other thresholds)
import { readFileSync } from 'node:fs'
import { runnerImport } from 'vite'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const games = Number(arg('games', 200))
const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const load = async (path) => (await runnerImport(path, { root, configFile: false, logLevel: 'error' })).module
const sim = await load('/src/engine/sim.ts')
const engine = await load('/src/engine/engine.ts')
const stats = await load('/src/game/stats.ts')
const words = (await load('/src/engine/words.ts')).parseWordList(readFileSync(new URL('../public/words/words.csv', import.meta.url), 'utf8'))
const tuning = { ...JSON.parse(readFileSync(new URL('../content/tuning/endscreen.json', import.meta.url), 'utf8')), ...JSON.parse(arg('tune', '{}')) }
const ids = Object.keys(tuning.awardOrder)

/** One whole game by the sim's player (the same as sim.ts simulateGame, keeping the finished state). */
function play(players, boardName, seed, style) {
  let state = engine.newGame({ players, boardName, seed })
  let rng = seed ^ 0x5eed
  while (state.phase !== 'over') {
    const pick = style === 'greedy' ? sim.greedyAction(state, rng, words) : sim.randomAction(state, rng)
    rng = pick.rng
    state = engine.applyAction(state, pick.action, words)
  }
  return state
}

const totals = { random: Object.fromEntries(ids.map((id) => [id, 0])), greedy: Object.fromEntries(ids.map((id) => [id, 0])) }
const counted = { random: 0, greedy: 0 }
const perGame = { random: 0, greedy: 0 }
console.log(`${games} games per row · share of games where each award was earned (by anyone)\n`)
console.log(['style', 'game', ...ids].join('\t'))
for (const style of ['random', 'greedy']) {
  for (const players of [2, 3, 4]) {
    for (const board of ['small', 'large']) {
      const hits = Object.fromEntries(ids.map((id) => [id, 0]))
      for (let i = 0; i < games; i++) {
        const game = play(players, board, i + 1, style)
        const awards = stats.earnedAwards(game, tuning)
        perGame[style] += awards.length
        for (const id of new Set(awards.map((a) => a.id))) hits[id]++
      }
      counted[style] += games
      for (const id of ids) totals[style][id] += hits[id]
      console.log([style, `${players}p ${board}`, ...ids.map((id) => `${Math.round((1000 * hits[id]) / games) / 10}%`)].join('\t'))
    }
  }
}
console.log('\nAll rows:')
for (const id of ids) {
  const pct = (style) => `${(Math.round((1000 * totals[style][id]) / counted[style]) / 10).toFixed(1)}%`
  console.log(`${id.padEnd(15)} random ${pct('random').padStart(6)}   greedy ${pct('greedy').padStart(6)}`)
}
console.log(`awards per game: random ${(perGame.random / counted.random).toFixed(2)} · greedy ${(perGame.greedy / counted.greedy).toFixed(2)}`)
