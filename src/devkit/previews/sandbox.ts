// THE PREVIEW SANDBOX — runs first thing inside a preview frame (frame.tsx), so the copy of the game in the
// frame can't reach anything the real game (or the world) would notice. The frame is a separate page: its
// own JavaScript, own stores, own screen stack. What it still SHARES with the real game is blocked here:
//   saves    localStorage / sessionStorage writes stay in the frame (reads see them; the real storage never changes)
//   network  WebSockets never connect; fetch / XHR / sendBeacon may only GET (pictures, a word list); BroadcastChannel is mute
//   history  pushState / replaceState / back / forward do nothing (the frame shares the tab's Back button)
//   sound    <audio>/<video> play() and Web Audio stay silent
//   workers  no service worker registration (it would control the real page too)
// Every blocked thing is counted (sandboxCounts) — the Screens tab shows the counts and the e2e checks them.
// This only ever runs inside the frame; it changes the frame's own copies of these browser objects.

export interface SandboxCounts {
  saves: number
  sends: number
  sounds: number
  history: number
}

type Win = Window & typeof globalThis

/** What was blocked so far in this frame. */
export const sandboxCounts: SandboxCounts = { saves: 0, sends: 0, sounds: 0, history: 0 }
const failing: string[] = [] // GETs whose address contains one of these fail (sandbox.failRequests)
let changed: (() => void) | null = null
const count = (what: keyof SandboxCounts) => {
  sandboxCounts[what]++
  changed?.()
}

/** Make GET requests whose address contains this text fail (e.g. a word list that "didn't load"). */
export function failRequests(urlPart: string) {
  failing.push(urlPart)
}

const urlOf = (input: RequestInfo | URL) => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
const methodOf = (input: RequestInfo | URL, init?: RequestInit) =>
  (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase()

/** Blocks everything listed at the top, in this window. onChange runs after each block (to report the counts). */
export function installSandbox(win: Win = window as Win, onChange?: () => void) {
  changed = onChange ?? null

  // Saves: each storage gets its own in-frame layer. A key written here reads back here; the real storage is untouched.
  const layers = new WeakMap<Storage, Map<string, string | null>>() // null = removed in the frame
  const layerOf = (s: Storage) => {
    let layer = layers.get(s)
    if (!layer) layers.set(s, (layer = new Map()))
    return layer
  }
  const proto = win.Storage.prototype
  const realGet = proto.getItem
  proto.getItem = function (key: string) {
    const layer = layerOf(this)
    return layer.has(key) ? layer.get(key)! : realGet.call(this, key)
  }
  proto.setItem = function (key: string, value: string) {
    count('saves')
    layerOf(this).set(String(key), String(value))
  }
  proto.removeItem = function (key: string) {
    count('saves')
    layerOf(this).set(String(key), null)
  }
  proto.clear = function () {
    count('saves')
    for (let i = 0; i < this.length; i++) layerOf(this).set(this.key(i)!, null)
  }

  // Network: only GETs leave the frame
  const realFetch = win.fetch?.bind(win)
  win.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = methodOf(input, init)
    if (method !== 'GET' && method !== 'HEAD') {
      count('sends')
      throw new TypeError(`Dev Kit preview: ${method} blocked (a preview never sends anything)`)
    }
    if (failing.some((part) => urlOf(input).includes(part))) throw new TypeError('Dev Kit preview: this request is set to fail')
    return realFetch(input, init)
  }
  const xhr = win.XMLHttpRequest?.prototype
  if (xhr) {
    const realOpen = xhr.open
    const realSend = xhr.send
    xhr.open = function (this: XMLHttpRequest & { _method?: string }, method: string, ...rest: unknown[]) {
      this._method = String(method).toUpperCase()
      return (realOpen as (...a: unknown[]) => void).call(this, method, ...rest)
    } as typeof xhr.open
    xhr.send = function (this: XMLHttpRequest & { _method?: string }, body?: Document | XMLHttpRequestBodyInit | null) {
      if (this._method && this._method !== 'GET' && this._method !== 'HEAD') {
        count('sends')
        throw new TypeError(`Dev Kit preview: ${this._method} blocked`)
      }
      return realSend.call(this, body)
    }
  }
  if (win.navigator.sendBeacon) win.navigator.sendBeacon = () => { count('sends'); return false }
  // A WebSocket that never connects: it stays "connecting", and anything sent is dropped (and counted)
  class SandboxSocket extends EventTarget {
    static CONNECTING = 0
    static OPEN = 1
    static CLOSING = 2
    static CLOSED = 3
    readonly CONNECTING = 0
    readonly OPEN = 1
    readonly CLOSING = 2
    readonly CLOSED = 3
    readyState = 0
    url: string
    protocol = ''
    extensions = ''
    bufferedAmount = 0
    binaryType: BinaryType = 'blob'
    onopen = null
    onclose = null
    onerror = null
    onmessage = null
    constructor(url: string | URL) {
      super()
      this.url = String(url)
    }
    send() { count('sends') }
    close() { this.readyState = 3 }
  }
  win.WebSocket = SandboxSocket as unknown as typeof WebSocket
  if (win.BroadcastChannel) win.BroadcastChannel.prototype.postMessage = function () { count('sends') }

  // History: the frame shares the tab's Back button, so it may not add or move entries
  const blockHistory = () => count('history')
  win.history.pushState = blockHistory
  win.history.replaceState = blockHistory
  win.history.back = blockHistory
  win.history.forward = blockHistory
  win.history.go = blockHistory

  // Sound
  if (win.HTMLMediaElement) win.HTMLMediaElement.prototype.play = function () { count('sounds'); return Promise.resolve() }
  if (win.AudioContext) {
    const RealAudio = win.AudioContext
    win.AudioContext = class extends RealAudio {
      constructor(options?: AudioContextOptions) {
        super(options)
        void this.suspend()
      }
      resume() { count('sounds'); return Promise.resolve() }
    }
  }

  // Service workers control every page of the site, the real game included
  if (win.navigator.serviceWorker) {
    win.navigator.serviceWorker.register = () => Promise.reject(new Error('Dev Kit preview: no service worker in a preview'))
  }

  win.open = () => null // no new tabs or windows from a preview
}
