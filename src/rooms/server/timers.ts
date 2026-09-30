// TIMERS TABLE — every server timer in one place, by name.  (Server — no React, no browser code.)
//
// Roll Better learned: five loose timer variables = timers left running after a room closed,
// and phases stuck forever. So: ONE table. Starting a name that's already running replaces it,
// stopAll() really stops everything, and a crashing timer is logged instead of killing the room.
//
//   room.timers.start('turn', 30_000, () => { ... })   // the current player's turn clock
//   room.timers.start('phase-limit', 45_000, () => { ... }) // a hard limit nothing can extend
//   room.timers.msLeft('turn')                          // how long is left (0 if not running)
//   room.timers.stop('turn')

interface RunningTimer {
  handle: ReturnType<typeof setTimeout>
  endsAt: number
}

export class Timers {
  private running = new Map<string, RunningTimer>()
  private log: (message: string) => void

  constructor(log: (message: string) => void = console.log) {
    this.log = log
  }

  /** Run `whenDone` after `ms`. A timer with the same name is replaced (never two of one kind). */
  start(name: string, ms: number, whenDone: () => void): void {
    this.stop(name)
    const handle = setTimeout(() => {
      this.running.delete(name)
      try {
        whenDone()
      } catch (error) {
        this.log(`timer "${name}" failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }, Math.max(0, ms))
    this.running.set(name, { handle, endsAt: Date.now() + Math.max(0, ms) })
  }

  stop(name: string): void {
    const timer = this.running.get(name)
    if (!timer) return
    clearTimeout(timer.handle)
    this.running.delete(name)
  }

  /** Stop every timer whose name starts with `prefix` ("" = all of them). */
  stopAll(prefix = ''): void {
    for (const name of [...this.running.keys()]) {
      if (name.startsWith(prefix)) this.stop(name)
    }
  }

  isRunning(name: string): boolean {
    return this.running.has(name)
  }

  /** Milliseconds until it fires (0 if it isn't running). */
  msLeft(name: string): number {
    const timer = this.running.get(name)
    return timer ? Math.max(0, timer.endsAt - Date.now()) : 0
  }

  /** Names of the running timers (for logs and tests). */
  names(): string[] {
    return [...this.running.keys()]
  }
}
