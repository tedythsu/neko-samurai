import { describe, it, expect } from 'vitest'
import { checkResonances } from '../../src/affixes/resonances.js'

describe('checkResonances', () => {
  it('returns empty set when no affixes', () => {
    const result = checkResonances(new Map())
    expect(result.size).toBe(0)
  })

  it('activates explode_burn when burn + burst both present', () => {
    const m = new Map([['burn', 1], ['burst', 1]])
    expect(checkResonances(m).has('explode_burn')).toBe(true)
  })

  it('does NOT activate explode_burn with only burn', () => {
    const m = new Map([['burn', 2]])
    expect(checkResonances(m).has('explode_burn')).toBe(false)
  })

  it('activates toxic_chain with poison + chain', () => {
    const m = new Map([['poison', 1], ['chain', 1]])
    expect(checkResonances(m).has('toxic_chain')).toBe(true)
  })

  it('activates corrosion with burn + poison', () => {
    const m = new Map([['burn', 1], ['poison', 1]])
    expect(checkResonances(m).has('corrosion')).toBe(true)
  })

  it('activates dark_harvest with leech + curse', () => {
    const m = new Map([['leech', 1], ['curse', 1]])
    expect(checkResonances(m).has('dark_harvest')).toBe(true)
  })

  it('activates blizzard_arc with chain + chill', () => {
    const m = new Map([['chain', 1], ['chill', 1]])
    expect(checkResonances(m).has('blizzard_arc')).toBe(true)
  })

  it('activates multiple resonances simultaneously', () => {
    const m = new Map([['burn', 1], ['burst', 1], ['poison', 1], ['chain', 1]])
    const result = checkResonances(m)
    expect(result.has('explode_burn')).toBe(true)
    expect(result.has('toxic_chain')).toBe(true)
    expect(result.has('corrosion')).toBe(true)
  })
})
