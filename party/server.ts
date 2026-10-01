// THE ONLINE SERVER — party/worker.ts hands every room to this class (Cloudflare, via PartyServer). One room code = one copy of it.
// The rooms module (src/rooms/server/) runs the room: seats, host, join, rejoin, idle players, bots.
// Glyphtender's rules are in ./glyphtenderRules.ts; what each player may see is in ./views.ts.
// Room knobs (seats, timings, turn timers) are in content/rooms.json.
//   Local:  npm run party:dev   (port 1997)   ·   Live: npm run party:deploy (see worker.ts)
// Server code only: no React, no Dev Kit, nothing that needs a browser.
import { RoomServer } from '../src/rooms/server/roomServer'
import type { PartyRoom } from '../src/rooms/server/roomServer'
import settings from '../content/rooms.json'
import { parseWordList } from '../src/engine/words'
import type { WordList } from '../src/engine/types'
import { makeRules } from './glyphtenderRules'
import type { OnlineAction, OnlineOptions, GameView } from './protocol'
import type { ServerGame } from './serverGame'
// The official word list, bundled into the server as text (scripts/server-words.mjs copies it here before each build)
import wordsText from './words.gen.txt'

// Read once per server copy, the first time a game needs it (~0.9 MB of text → a few ms)
let words: WordList | null = null
const loadWords = () => (words ??= parseWordList(wordsText))

const rules = makeRules({ words: loadWords })

export default class GlyphtenderServer extends RoomServer<ServerGame, OnlineOptions, OnlineAction, GameView, never> {
  constructor(party: PartyRoom) {
    super(party, rules, settings)
  }
}
