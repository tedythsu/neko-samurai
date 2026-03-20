// tests/logic.test.js
import { describe, it, expect } from 'vitest'
import { CFG, xpThreshold, randomEdgePoint, PLAYER_UPGRADES } from '../src/config.js'
import Tachi       from '../src/weapons/Tachi.js'
import Ogi         from '../src/weapons/Ogi.js'
import Homura      from '../src/weapons/Homura.js'
import Ofuda       from '../src/weapons/Ofuda.js'
import Kusarigama  from '../src/weapons/Kusarigama.js'
import Kunai       from '../src/weapons/Kunai.js'
import Shuriken    from '../src/weapons/Shuriken.js'

describe('xpThreshold', () => {
  it('returns > 0 for level 1', () => {
    expect(xpThreshold(1)).toBeGreaterThan(0)
  })
  it('grows with level', () => {
    expect(xpThreshold(5)).toBeGreaterThan(xpThreshold(3))
  })
  it('equals XP_BASE at level 1 exactly', () => {
    expect(xpThreshold(1)).toBe(Math.floor(CFG.XP_BASE * 1 ** CFG.XP_SCALE))
  })
  it('level 0 returns 0 — game must start at level >= 1', () => {
    // If game initializes _level = 0, xpThreshold(0) = 0, causing infinite level-up loop.
    // This test documents the invariant: game always starts at level 1.
    expect(xpThreshold(0)).toBe(0)   // documents the danger — game init must use level 1
  })
})

describe('randomEdgePoint', () => {
  it('always produces a point on one of the four edges (1000 samples)', () => {
    for (let i = 0; i < 1000; i++) {
      const p = randomEdgePoint(1600, 1200, 20)
      // Each edge pins exactly ONE axis — only check the axis that was clamped.
      // top (y=inset): x is free → check y; bottom (y=worldH-inset): check y
      // left (x=inset): y is free → check x; right (x=worldW-inset): check x
      const onEdge = p.y === 20 || p.y === 1180 || p.x === 20 || p.x === 1580
      expect(onEdge).toBe(true)
    }
  })
})

describe('PLAYER_UPGRADES', () => {
  it('has 6 entries', () => expect(PLAYER_UPGRADES).toHaveLength(6))
  it('all have id, name, desc', () => {
    PLAYER_UPGRADES.forEach(u => {
      expect(u.id).toBeTruthy()
      expect(u.name).toBeTruthy()
      expect(u.desc).toBeTruthy()
    })
  })
  it('regen upgrade is oneTime', () => {
    const regen = PLAYER_UPGRADES.find(u => u.id === 'regen')
    expect(regen).toBeDefined()
    expect(regen.oneTime).toBe(true)
  })
})

describe('weapon upgrade caps', () => {
  it('Tachi fireRate never drops below 200ms', () => {
    const upg = Tachi.upgrades.find(u => u.id === 'firerate')
    expect(upg).toBeDefined()
    const s = { ...Tachi.baseStats }
    for (let i = 0; i < 20; i++) upg.apply(s)
    expect(s.fireRate).toBeGreaterThanOrEqual(200)
  })
  it('Tachi range capped at 2× base', () => {
    const upg = Tachi.upgrades.find(u => u.id === 'range')
    expect(upg).toBeDefined()
    const s = { ...Tachi.baseStats }
    for (let i = 0; i < 20; i++) upg.apply(s)
    expect(s.range).toBeLessThanOrEqual(Tachi.baseStats.range * 2)
  })
  it('Ogi fireRate never drops below 200ms', () => {
    const upg = Ogi.upgrades.find(u => u.id === 'speed')
    expect(upg).toBeDefined()
    const s = { ...Ogi.baseStats }
    for (let i = 0; i < 20; i++) upg.apply(s)
    expect(s.fireRate).toBeGreaterThanOrEqual(200)
  })
  it('Ogi range capped at 2× base', () => {
    const upg = Ogi.upgrades.find(u => u.id === 'range')
    expect(upg).toBeDefined()
    const s = { ...Ogi.baseStats }
    for (let i = 0; i < 20; i++) upg.apply(s)
    expect(s.range).toBeLessThanOrEqual(Ogi.baseStats.range * 2)
  })
  it('Homura projectileCount capped at 5', () => {
    const upg = Homura.upgrades.find(u => u.id === 'multi')
    expect(upg).toBeDefined()
    const s = { ...Homura.baseStats }
    for (let i = 0; i < 20; i++) upg.apply(s)
    expect(s.projectileCount).toBeLessThanOrEqual(5)
  })
  it('Homura _explodeRadius capped at base + 60', () => {
    const upg = Homura.upgrades.find(u => u.id === 'radius')
    expect(upg).toBeDefined()
    const s = { ...Homura.baseStats }
    for (let i = 0; i < 20; i++) upg.apply(s)
    expect(s._explodeRadius).toBeLessThanOrEqual(Homura.baseStats._explodeRadius + 60)
  })
  it('Ofuda projectileCount capped at 5', () => {
    const upg = Ofuda.upgrades.find(u => u.id === 'multi')
    expect(upg).toBeDefined()
    const s = { ...Ofuda.baseStats }
    for (let i = 0; i < 20; i++) upg.apply(s)
    expect(s.projectileCount).toBeLessThanOrEqual(5)
  })
  it('Kusarigama sickleCount capped at 4', () => {
    const upg = Kusarigama.upgrades.find(u => u.id === 'sickle')
    expect(upg).toBeDefined()
    const s = { ...Kusarigama.baseStats }
    for (let i = 0; i < 20; i++) upg.apply(s)
    expect(s.sickleCount).toBeLessThanOrEqual(4)
  })
  it('Kunai fireRate never drops below 200ms', () => {
    const upg = Kunai.upgrades.find(u => u.id === 'firerate')
    expect(upg).toBeDefined()
    const s = { ...Kunai.baseStats }
    for (let i = 0; i < 20; i++) upg.apply(s)
    expect(s.fireRate).toBeGreaterThanOrEqual(200)
  })
  it('Kunai projectileCount capped at 5', () => {
    const upg = Kunai.upgrades.find(u => u.id === 'multishot')
    expect(upg).toBeDefined()
    const s = { ...Kunai.baseStats }
    for (let i = 0; i < 20; i++) upg.apply(s)
    expect(s.projectileCount).toBeLessThanOrEqual(5)
  })
  it('Kunai _scale capped at 2.0', () => {
    const upg = Kunai.upgrades.find(u => u.id === 'scale')
    expect(upg).toBeDefined()
    const s = { ...Kunai.baseStats }
    for (let i = 0; i < 20; i++) upg.apply(s)
    expect(s._scale).toBeLessThanOrEqual(2.0)
  })
  it('Shuriken fireRate never drops below 200ms', () => {
    const upg = Shuriken.upgrades.find(u => u.id === 'firerate')
    expect(upg).toBeDefined()
    const s = { ...Shuriken.baseStats }
    for (let i = 0; i < 20; i++) upg.apply(s)
    expect(s.fireRate).toBeGreaterThanOrEqual(200)
  })
  it('Shuriken projectileCount capped at 5', () => {
    const upg = Shuriken.upgrades.find(u => u.id === 'multishot')
    expect(upg).toBeDefined()
    const s = { ...Shuriken.baseStats }
    for (let i = 0; i < 20; i++) upg.apply(s)
    expect(s.projectileCount).toBeLessThanOrEqual(5)
  })
  it('Shuriken _scale capped at 2.0', () => {
    const upg = Shuriken.upgrades.find(u => u.id === 'scale')
    expect(upg).toBeDefined()
    const s = { ...Shuriken.baseStats }
    for (let i = 0; i < 20; i++) upg.apply(s)
    expect(s._scale).toBeLessThanOrEqual(2.0)
  })
})
