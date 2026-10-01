// THE ONLINE SERVER'S FRONT DOOR — Cloudflare runs this file (wrangler.json "main") on Muzzy's own account.
// It hands every room to GlyphtenderServer (./server.ts), which knows nothing about Cloudflare.
//   Local:  npm run party:dev   (port 1997)   ·   Live: npm run party:deploy (Muzzy's call — it's public)
//
// PartyServer (the open-source successor of PartyKit) gives us PartyKit's rooms on plain Cloudflare:
// one room code = one Durable Object = one copy of the server, at /parties/main/<room code> —
// the same address PartySocket already uses, so the game's client didn't change.
import { Server, routePartykitRequest } from 'partyserver'
import type { Connection } from 'partyserver'
import GlyphtenderServer from './server'

// The class name is the address: "Main" → /parties/main/… (PartySocket's default). Keep it in step with wrangler.json.
export class Main extends Server {
  private room!: GlyphtenderServer

  onStart() {
    this.room = new GlyphtenderServer({ id: this.name, getConnection: (id) => this.getConnection(id) })
  }

  onConnect(connection: Connection) {
    this.room.onConnect(connection)
  }

  onMessage(connection: Connection, message: string | ArrayBuffer) {
    this.room.onMessage(message, connection)
  }

  onClose(connection: Connection) {
    this.room.onClose(connection)
  }
}

export default {
  async fetch(request: Request, env: Record<string, unknown>): Promise<Response> {
    return (await routePartykitRequest(request, env)) ?? new Response('Not found', { status: 404 })
  },
}
