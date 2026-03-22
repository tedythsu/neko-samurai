// src/upgrades/elementals.js
// Elemental ailment system
// ignite / chill → rarity: 'rare'  (出現自遊戲開始)
// shock / bleed / armor_shred → rarity: 'epic' (minTimeMs 2 分鐘後解鎖)

export const ALL_ELEMENTALS = [
  {
    id:     'ignite',
    name:   '【火：點燃】',
    desc:   '攻擊有 40% 機率造成燃燒（攻擊力 20%），持續 4 秒',
    rarity: 'rare',
    onHit(enemy, damage) {
      if (Math.random() < 0.40) {
        const se = enemy._statusEffects
        if (!se) return
        if (!se.ignite) se.ignite = { active: false, timer: 0, dps: 0, _accum: 0 }
        se.ignite.active = true
        se.ignite.timer  = Math.max(se.ignite.timer, 4000)
        se.ignite.dps    = Math.max(se.ignite.dps, damage * 0.20)
      }
    },
  },
  {
    id:     'chill',
    name:   '【冰：遲緩／霜凍】',
    desc:   '降低怪物移速 50%，疊滿 5 層觸發凍結 2 秒',
    rarity: 'rare',
    onHit(enemy) {
      const se = enemy._statusEffects
      if (!se) return
      se.chill.active = true
      se.chill.timer  = Math.max(se.chill.timer, 2000)
      se.chill.stacks = (se.chill.stacks || 0) + 1
      if (se.chill.stacks >= 5) {
        se.frozen.active = true
        se.frozen.timer  = 2000
        se.chill.stacks  = 0
      }
    },
  },
  {
    id:         'shock',
    name:       '【雷：感電／超載】',
    desc:       '受影響的怪物承受傷害提升 30%，偶爾產生 0.1 秒停頓',
    rarity:     'epic',
    minTimeMs:  2 * 60 * 1000,   // 2 分鐘後解鎖
    onHit(enemy) {
      const se = enemy._statusEffects
      if (!se) return
      if (!se.shock) se.shock = { active: false, timer: 0 }
      se.shock.active = true
      se.shock.timer  = Math.max(se.shock.timer, 3000)
      if (Math.random() < 0.20) {
        enemy.knockbackTimer = Math.max(enemy.knockbackTimer || 0, 100)
      }
    },
  },
  {
    id:         'bleed',
    name:       '【風：撕裂／流血】',
    desc:       '怪物移動速度越快，受到的流血傷害越高',
    rarity:     'epic',
    minTimeMs:  2 * 60 * 1000,
    onHit(enemy) {
      const se = enemy._statusEffects
      if (!se) return
      if (!se.bleed) se.bleed = { active: false, timer: 0, _accum: 0 }
      se.bleed.active = true
      se.bleed.timer  = Math.max(se.bleed.timer, 3000)
    },
  },
  {
    id:         'armor_shred',
    name:       '【暗：腐蝕／破甲】',
    desc:       '每次命中降低敵人防禦力（最高 50%），並降低怪物 15% 輸出',
    rarity:     'epic',
    minTimeMs:  2 * 60 * 1000,
    onHit(enemy) {
      if (enemy._armorShred === undefined) enemy._armorShred = 0
      enemy._armorShred = Math.min(0.50, (enemy._armorShred || 0) + 0.10)
      if (enemy._outputMult === undefined) enemy._outputMult = 1.0
      enemy._outputMult = Math.max(0.40, enemy._outputMult * 0.85)
    },
  },
]
