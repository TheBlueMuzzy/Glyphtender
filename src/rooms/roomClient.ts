// ROOM CLIENT — opens the connection to a room's server.  (Browser only.)
// PartySocket is a WebSocket that reconnects by itself after a drop (phone locked, Wi-Fi blip…).
import PartySocket from 'partysocket'
import { getTabId } from './identity'
import type { ClientMessage } from './protocol'

/** The port `npm run party:dev` uses (partykit.json "port"). */
export const LOCAL_PARTY_PORT = 1999

/**
 * Where the room server is.
 * - Live build: VITE_PARTY_HOST (e.g. "glyphtender.thebluemuzzy.partykit.dev"), set when building.
 * - Local dev: the same computer that served the page, port 1999 — so a phone on the Wi-Fi
 *   (http://192.168.x.x:5173) reaches the PC's server too. Leave VITE_PARTY_HOST unset for local dev.
 */
export function partyHost(): string {
  const fromBuild = import.meta.env.VITE_PARTY_HOST as string | undefined
  if (fromBuild) return fromBuild
  return `${window.location.hostname}:${LOCAL_PARTY_PORT}`
}

/** Connect to the room with this code. The caller closes it. */
export function openRoomSocket(roomCode: string, host: string = partyHost()): PartySocket {
  return new PartySocket({ host, room: roomCode, id: getTabId() })
}

export function sendToRoom(socket: PartySocket, message: ClientMessage): void {
  socket.send(JSON.stringify(message))
}
