import { WEAPONS } from '../data/weapons.js'
import { PASSIVES } from '../data/upgrades.js'

const RARITY_BASE = { common: 0.70, rare: 0.25, epic: 0.05 }

function calcRarityWeights(luck) {
  const stacks = Math.floor(luck / 10)
  let common = Math.max(0.30, RARITY_BASE.common - stacks * 0.05)
  let rare   = Math.min(0.50, RARITY_BASE.rare   + stacks * 0.03)
  let epic   = Math.min(0.20, RARITY_BASE.epic   + stacks * 0.02)
  const total = common + rare + epic
  return { common: common/total, rare: rare/total, epic: epic/total }
}

function pickRarity(luck) {
  const w = calcRarityWeights(luck)
  const r = Math.random()
  if (r < w.epic) return 'epic'
  if (r < w.epic + w.rare) return 'rare'
  return 'common'
}

export default class UpgradeSystem {
  constructor({ weapons = Object.keys(WEAPONS), passives = Object.keys(PASSIVES) } = {}) {
    this._weaponIds = weapons
    this._passiveIds = passives
  }

  drawCards({ luck = 0, weapons = [] } = {}) {
    const weaponLevels = Object.fromEntries(weapons.map(w => [w.id, w.level]))
    const pool = []

    // Weapon upgrades (not at max)
    for (const id of this._weaponIds) {
      const def = WEAPONS[id]; if (!def) continue
      const cur = weaponLevels[id] ?? 0
      if (cur > 0 && cur < def.levels.length) {
        pool.push({ type: 'weapon', id, name: def.name, level: cur + 1, rarity: cur >= 3 ? 'rare' : 'common' })
      }
    }

    // New weapons (not yet held)
    for (const id of this._weaponIds) {
      const def = WEAPONS[id]; if (!def) continue
      if (!weaponLevels[id]) {
        pool.push({ type: 'weapon', id, name: def.name, level: 1, rarity: 'common' })
      }
    }

    // Passives
    for (const id of this._passiveIds) {
      const def = PASSIVES[id]; if (!def) continue
      pool.push({ type: 'passive', id, name: def.name, rarity: def.rarity, effect: def.effect })
    }

    if (pool.length === 0) return []

    // Draw 3 unique cards
    const drawn = []
    const used = new Set()
    let attempts = 0
    while (drawn.length < 3 && attempts < 100) {
      attempts++
      const rarity = pickRarity(luck)
      const candidates = pool.filter(c => c.rarity === rarity && !used.has(c.id))
      if (candidates.length === 0) continue
      const card = candidates[Math.floor(Math.random() * candidates.length)]
      drawn.push(card)
      used.add(card.id)
    }
    // Fallback: fill remaining from any pool
    if (drawn.length < 3) {
      const remaining = pool.filter(c => !used.has(c.id))
      drawn.push(...remaining.slice(0, 3 - drawn.length))
    }
    return drawn
  }
}
