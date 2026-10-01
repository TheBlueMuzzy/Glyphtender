// FINISHED-GAME SNAPSHOTS for the end screen — 2, 3 and 4 players and a shared win, played by the engine's greedy
// sim player with the official word list, saved as Dev Kit snapshots in content/snapshots/ (` → Snapshots → Restore:
// the Magic reveal plays, then the end screen opens). The e2e end-screen shots and the Dev Kit screen previews use them.
//   node scripts/end-fixtures.mjs
// Uses Vite to load the TypeScript engine (no build needed). Picks the first seed whose game shows the full set of
// highlights and at least one tangle mark on the chart, so the pictures have something to show.
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } })
try {
  const { applyAction, newGame } = await vite.ssrLoadModule('/src/engine/engine.ts')
  const { greedyAction } = await vite.ssrLoadModule('/src/engine/sim.ts')
  const { parseWordList } = await vite.ssrLoadModule('/src/engine/words.ts')
  const { pickAwards, storyChart } = await vite.ssrLoadModule('/src/game/stats.ts')
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
  const want = { 2: 3, 3: 3, 4: 4 }
  const colour = ['Yellow', 'Blue', 'Purple', 'Pink']
  const save = (file, name, game) => {
    const winners = game.winners.map((s) => colour[s]).join(' + ')
    const snapshot = {
      _help: 'A Dev Kit snapshot: press ` → Snapshots → Restore to jump here. A finished game (greedy sim players, official words) — the Magic reveal plays, then the end screen. Made by scripts/end-fixtures.mjs.',
      name,
      savedAt: new Date().toISOString(),
      game: 'Glyphtender',
      version: `${version.version}.${version.build}`,
      summary: `turn ${game.turnCount} · over · winner ${winners} · ${game.magic.join(' / ')} Magic`,
      state: { game, trayOrder: game.hands.map((h) => h.map((_, i) => i)) },
    }
    writeFileSync(`content/snapshots/${file}.json`, JSON.stringify(snapshot, null, 2) + '\n')
    console.log(`${file}: seed ${game.config.seed}, ${game.turnCount} turns, Magic ${game.magic.join('/')}, awards ${pickAwards(game).map((a) => a.id).join(', ')}`)
  }

  for (const players of [2, 3, 4]) {
    for (let seed = 1; seed < 200; seed++) {
      const game = play(players, seed)
      const awards = pickAwards(game)
      const chart = storyChart(game, awards, 6)
      if (game.winners.length === 1 && awards.length === want[players] && chart.markers.some((m) => m.kind === 'tangle')) {
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
