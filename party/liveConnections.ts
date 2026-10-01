// Which socket is live for each connection id — kept by the server itself, not by PartyServer.
// A phone that reconnects (Wi-Fi ↔ mobile, screen lock) reuses its id, and its NEW socket can open
// before the OLD one's close arrives. PartyServer forgets the id on that late close, which would
// drop the new, live socket too — so only the socket that is still the live one may be forgotten.
import type { PartyConnection } from '../src/rooms/server/roomServer'

export class LiveConnections<C extends PartyConnection = PartyConnection> {
  private live = new Map<string, C>()

  opened(connection: C): void {
    this.live.set(connection.id, connection)
  }

  /** A socket closed (or failed). Forget it only if it's still the live one for its id. */
  closed(connection: C): void {
    if (this.live.get(connection.id) === connection) this.live.delete(connection.id)
  }

  get(id: string): C | undefined {
    return this.live.get(id)
  }
}
