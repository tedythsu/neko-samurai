// tests/logic.test.js
import { describe, it, expect } from 'vitest'
import { CFG, xpThreshold, randomEdgePoint, PLAYER_UPGRADES } from '../src/config.js'

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
  it('has 3 entries', () => expect(PLAYER_UPGRADES).toHaveLength(3))
  it('all have id, name, desc', () => {
    PLAYER_UPGRADES.forEach(u => {
      expect(u.id).toBeTruthy()
      expect(u.name).toBeTruthy()
      expect(u.desc).toBeTruthy()
    })
  })
})
