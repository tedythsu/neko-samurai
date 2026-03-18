import { describe, it, expect, beforeEach } from 'vitest'
import MetaProgress from '../../src/systems/MetaProgress.js'

const mockStorage = {}
const ls = { getItem: k => mockStorage[k] ?? null, setItem: (k,v) => { mockStorage[k]=v } }

describe('MetaProgress', () => {
  let mp
  beforeEach(() => { Object.keys(mockStorage).forEach(k=>delete mockStorage[k]); mp = new MetaProgress(ls) })

  it('returns default save when storage empty', () => {
    const s = mp.load()
    expect(s.version).toBe(1)
    expect(s.souls).toBe(0)
    expect(s.nodes.atk).toBe(0)
  })

  it('saves and reloads correctly', () => {
    mp.addSouls(150)
    mp.save()
    const mp2 = new MetaProgress(ls)
    expect(mp2.load().souls).toBe(150)
  })

  it('upgrades a node and deducts souls', () => {
    mp.addSouls(200)
    const ok = mp.upgradeNode('atk')
    expect(ok).toBe(true)
    expect(mp.data.nodes.atk).toBe(1)
    expect(mp.data.souls).toBe(120) // 200 - 80
  })

  it('rejects upgrade when insufficient souls', () => {
    const ok = mp.upgradeNode('atk')
    expect(ok).toBe(false)
  })

  it('rejects upgrade at max level', () => {
    mp.addSouls(9999)
    for (let i = 0; i < 5; i++) mp.upgradeNode('atk')
    const ok = mp.upgradeNode('atk')
    expect(ok).toBe(false)
  })

  it('migrates v0 save by filling missing fields', () => {
    mockStorage['neko_meta_v1'] = JSON.stringify({ version: 0, souls: 50 })
    const s = mp.load()
    expect(s.nodes.atk).toBe(0)
    expect(s.souls).toBe(50)
  })
})
