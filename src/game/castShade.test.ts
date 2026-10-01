import { describe, expect, it } from 'vitest'
import { castColour, mixColour } from './castShade'

describe('cast shade', () => {
  it('mixes one colour towards another', () => {
    expect(mixColour('#000000', 'white', 0.5)).toBe('#808080')
    expect(mixColour('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mixColour('#f2c14e', '#ffffff', 0)).toBe('#f2c14e')
    expect(mixColour('#f2c14e', '#10162a', 1)).toBe('#10162a')
  })

  it('a positive shade lightens towards white, a negative one darkens towards the night', () => {
    expect(castColour('#5fd4f2', '#10162a', 0.5)).toBe(mixColour('#5fd4f2', 'white', 0.5))
    expect(castColour('#5fd4f2', '#10162a', -0.5)).toBe(mixColour('#5fd4f2', '#10162a', 0.5))
  })
})
