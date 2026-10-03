import { afterEach, describe, expect, it, vi } from 'vitest'
import settingsFile from '../../content/ui/settings.json'
import { hiddenFullscreenRows, setFullscreen, startFullscreen, withFullscreenDefault } from './fullscreen'
import type { SettingsSchema } from './kit'

/** A pretend browser: touch or mouse, can go full screen or not (iPhone), opened from the home screen or not. */
function browser({ touch = false, can = true, installed = false } = {}) {
  const listeners: Record<string, (() => void)[]> = {}
  const requestFullscreen = vi.fn(() => Promise.resolve())
  const exitFullscreen = vi.fn(() => Promise.resolve())
  const media = (query: string) => ({
    matches: query.includes('display-mode') ? installed : query.includes('coarse') ? touch : query.includes('fine') ? !touch : false,
  })
  const on = (type: string, fn: () => void) => { (listeners[type] ??= []).push(fn) }
  vi.stubGlobal('window', { matchMedia: media, addEventListener: on })
  vi.stubGlobal('navigator', {})
  vi.stubGlobal('localStorage', { setItem: vi.fn(), getItem: () => null })
  vi.stubGlobal('location', { pathname: '/glyphtender/' })
  vi.stubGlobal('document', {
    fullscreenEnabled: can, fullscreenElement: null, exitFullscreen,
    documentElement: { requestFullscreen }, addEventListener: on,
  })
  return { requestFullscreen, exitFullscreen, tap: () => listeners.pointerup?.forEach((fn) => fn()) }
}

afterEach(() => vi.unstubAllGlobals())

const fullscreenDefault = (schema: SettingsSchema) =>
  schema.tabs.flatMap((t) => t.rows).find((r) => r.id === 'fullscreen')?.default

describe('full screen', () => {
  it('Settings → Full screen is on by default on phones, off on computers', () => {
    browser({ touch: true })
    expect(fullscreenDefault(withFullscreenDefault(settingsFile))).toBe(true)
    browser({ touch: false })
    expect(fullscreenDefault(withFullscreenDefault(settingsFile))).toBe(false)
  })

  it('iPhone (can\'t go full screen) shows the Add to Home Screen tip instead; installed shows neither', () => {
    browser({ can: true })
    expect(hiddenFullscreenRows()).toEqual(['fullscreenTip'])
    browser({ can: false })
    expect(hiddenFullscreenRows()).toEqual(['fullscreen'])
    browser({ installed: true })
    expect(hiddenFullscreenRows()).toEqual(['fullscreen', 'fullscreenTip'])
  })

  it('on a phone with the setting on, a tap goes full screen; with it off, taps don\'t', () => {
    const on = browser({ touch: true })
    startFullscreen(() => ({ fullscreen: true }))
    on.tap()
    expect(on.requestFullscreen).toHaveBeenCalledTimes(1)
    const off = browser({ touch: true })
    startFullscreen(() => ({ fullscreen: false }))
    off.tap()
    expect(off.requestFullscreen).not.toHaveBeenCalled()
  })

  it('a computer never goes full screen by itself — only from the button / toggle', () => {
    const pc = browser({ touch: false })
    startFullscreen(() => ({ fullscreen: true }))
    pc.tap()
    expect(pc.requestFullscreen).not.toHaveBeenCalled()
    setFullscreen(true)
    expect(pc.requestFullscreen).toHaveBeenCalledTimes(1)
  })
})
