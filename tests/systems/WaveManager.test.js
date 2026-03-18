import { describe, it, expect, vi } from 'vitest'
import WaveManager from '../../src/systems/WaveManager.js'
import { MAPS } from '../../src/data/maps.js'

describe('WaveManager', () => {
  it('returns correct boss at scheduled time', () => {
    const wm = new WaveManager(MAPS.bamboo_village)
    const boss = wm.getBossAt(60)
    expect(boss.boss).toBe('oni_general')
    expect(boss.hpMult).toBe(1.0)
  })

  it('returns null when no boss at time', () => {
    const wm = new WaveManager(MAPS.bamboo_village)
    expect(wm.getBossAt(45)).toBeNull()
  })

  it('detects final boss', () => {
    const wm = new WaveManager(MAPS.bamboo_village)
    const boss = wm.getBossAt(900)
    expect(boss.final).toBe(true)
  })

  it('tracks spawn rate multiplier', () => {
    const wm = new WaveManager(MAPS.bamboo_village)
    expect(wm.spawnRateMultiplier).toBe(1.0)
    wm.onBossKilled()
    expect(wm.spawnRateMultiplier).toBeCloseTo(1.15)
    // caps at 2.5
    for (let i = 0; i < 20; i++) wm.onBossKilled()
    expect(wm.spawnRateMultiplier).toBe(2.5)
  })

  it('current spawn interval respects multiplier', () => {
    const wm = new WaveManager(MAPS.bamboo_village)
    wm.onBossKilled()
    expect(wm.currentSpawnInterval).toBeCloseTo(1200 / 1.15, 0)
  })
})
