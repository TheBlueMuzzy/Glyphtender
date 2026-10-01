// npm run sim — plays lots of simulated games and prints how they went.
// Loads the TypeScript rules engine through Vite (no extra tools needed).
// Options: npm run sim -- --games 300 --player greedy
import { readFileSync } from 'node:fs'
import { runnerImport } from 'vite'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const games = Number(arg('games', 500))
const players = arg('player', 'both') === 'both' ? ['random', 'greedy'] : [arg('player')]

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const { module: sim } = await runnerImport('/src/engine/sim.ts', { root, configFile: false, logLevel: 'error' })
const { module: words } = await runnerImport('/src/engine/words.ts', { root, configFile: false, logLevel: 'error' })
const wordList = words.parseWordList(readFileSync(new URL('../public/words/words.csv', import.meta.url), 'utf8'))

const rows = []
for (const player of players) {
  const count = games
  for (const n of [2, 3, 4]) {
    for (const board of ['small', 'large']) {
      const started = Date.now()
      const s = sim.simulateMany(n, board, count, wordList, player)
      rows.push(s)
      console.log(
        `${player.padEnd(6)} ${n}p ${board.padEnd(5)} games ${String(s.games).padStart(4)} · avg turns ${String(s.avgTurns).padStart(5)} (max ${s.maxTurns})` +
          ` · bag ran out ${String(s.bagRanOutPct).padStart(5)}% · self-tangle end ${String(s.selfTanglePct).padStart(5)}%` +
          ` · turns with a word ${String(s.scoringTurnPct).padStart(4)}% · seat wins ${s.seatWinPct.map((p) => p + '%').join(' / ')}` +
          ` · Q cast ${s.qCastPct}% scored ${s.qScoredPct}% refreshed ${s.qRefreshedPct}% stuck ${s.qStuckPct}%` +
          `  (${((Date.now() - started) / 1000).toFixed(1)} s)`,
      )
    }
  }
}
console.log('\nQ (share of games): cast = planted on the board · scored = in a word that made Magic · refreshed = set aside in a refresh · stuck = still in a hand when the game ended.')
console.log('Seat wins: ties count as a win for everyone tied. Self-tangle end: the last turn tangled one of the mover\'s own glyphlings.')
