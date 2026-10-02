// FINISHED-GAME SNAPSHOTS for the end screen — 2, 3 and 4 players and a shared win, played by the engine's greedy
// sim player with the official word list, saved in e2e/fixtures/ for the e2e end-screen shots (npm run e2e:end).
// Not in content/snapshots/: everything there is bundled into the Dev Kit, which ships in live builds — these ~300 KB
// would download on every page load. (Same snapshot shape, so one can still be pasted into the Dev Kit by hand.)
//   node scripts/end-fixtures.mjs
// Uses Vite to load the TypeScript engine (no build needed). Picks the first seed whose game earned several highlights
// (3+, by at least 2 players) and has at least one tangle mark on the chart, so the pictures have something to show.
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } })
try {
  const { applyAction, newGame } = await vite.ssrLoadModule('/src/engine/engine.ts')
  const { greedyAction } = await vite.ssrLoadModule('/src/engine/sim.ts')
  const { parseWordList } = await vite.ssrLoadModule('/src/engine/words.ts')
  const { earnedAwards, storyChart } = await vite.ssrLoadModule('/src/game/stats.ts')
  const version = JSON.parse(readFileSync('version.json', 'utf8'))
  const words = parseWordList(readFileSync('public/words/words.csv', 'utf8'))

  const play = (players, seed) => {
    let state = newGame({ players, seed })
    let rng = seed * 7919
    while (state.phase !== 'over') {
      const pick = greedyAction(state, rng, words)
      rng = pick.rng
      state = applyAction(state, pick.action, words)
    }
    return state
  }
  const colour = ['Yellow', 'Blue', 'Purple', 'Pink']
  const save = (file, name, game) => {
    const winners = game.winners.map((s) => colour[s]).join(' + ')
    const snapshot = {
      _help: 'A finished game for npm run e2e:end, in the Dev Kit snapshot shape (greedy sim players, official words) — the Magic reveal plays, then the end screen. Made by scripts/end-fixtures.mjs.',
      name,
      savedAt: new Date().toISOString(),
      game: 'Glyphtender',
      version: `${version.version}.${version.build}`,
      summary: `turn ${game.turnCount} · over · winner ${winners} · ${game.magic.join(' / ')} Magic`,
      state: { game, trayOrder: game.hands.map((h) => h.map((_, i) => i)) },
    }
    writeFileSync(`e2e/fixtures/${file}.json`, JSON.stringify(snapshot, null, 2) + '\n')
    console.log(`${file}: seed ${game.config.seed}, ${game.turnCount} turns, Magic ${game.magic.join('/')}, awards ${earnedAwards(game).map((a) => a.id).join(', ')}`)
  }

  for (const players of [2, 3, 4]) {
    for (let seed = 1; seed < 200; seed++) {
      const game = play(players, seed)
      const awards = earnedAwards(game)
      const chart = storyChart(game, 6)
      if (game.winners.length === 1 && awards.length >= 3 && new Set(awards.map((a) => a.holder)).size >= 2 && chart.markers.some((m) => m.kind === 'tangle')) {
        save(`end-${players}p`, `End screen: ${players} players`, game)
        break
      }
    }
  }
  // A shared win: look for a tie at the top in 2- and 3-player games
  let tie = null
  for (let seed = 1; seed < 2000 && !tie; seed++) {
    for (const players of [2, 3]) {
      const game = play(players, seed)
      if (game.winners.length > 1) { tie = game; break }
    }
  }
  if (tie) save('end-shared-win', `End screen: shared win (${tie.config.players} players)`, tie)
  else console.log('no tie found')
} finally {
  await vite.close()
}
