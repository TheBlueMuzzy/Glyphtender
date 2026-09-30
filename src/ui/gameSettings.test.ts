import { describe, expect, it } from 'vitest'
import settings from '../../content/ui/settings.json'
import { defaultValues } from './kit'
import { fromSettings, settingsChanged, useGameSettings } from './gameSettings'

describe('the game’s own settings', () => {
  it('Tray position is a Gameplay row, Standard by default (tall: tray below · wide: right)', () => {
    const row = settings.tabs.find((t) => t.id === 'gameplay')!.rows.find((r) => r.id === 'trayPosition')!
    expect(row).toMatchObject({ type: 'selector', options: ['Standard', 'Flipped'], default: 'Standard' })
    expect(fromSettings(defaultValues(settings))).toEqual({ trayFlipped: false })
  })

  it('changing it in Settings flips the game screen at once', () => {
    settingsChanged({ ...defaultValues(settings), trayPosition: 'Flipped' })
    expect(useGameSettings.getState().trayFlipped).toBe(true)
    settingsChanged({ ...defaultValues(settings), trayPosition: 'Standard' })
    expect(useGameSettings.getState().trayFlipped).toBe(false)
  })
})
