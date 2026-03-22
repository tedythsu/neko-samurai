// src/upgrades/elementals.js
// Elemental ailment system
// ignite / chill → rarity: 'rare'  (出現自遊戲開始)
// shock / bleed / armor_shred → rarity: 'epic' (minTimeMs 2 分鐘後解鎖)
// poison → rarity: 'rare' (minTimeMs 1 分鐘後解鎖)
// holy → rarity: 'rare' (minTimeMs 2 分鐘後解鎖)
//
// onHit(enemy, damage, scene) — called from Enemy.takeDamage affix pipeline

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
        const dur = 4000 * (enemy.scene?._ailmentDurMult || 1)
        se.ignite.active = true
        se.ignite.timer  = Math.max(se.ignite.timer, dur)
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
      const durMult = enemy.scene?._ailmentDurMult || 1
      se.chill.active = true
      se.chill.timer  = Math.max(se.chill.timer, 2000 * durMult)
      se.chill.stacks = (se.chill.stacks || 0) + 1
      if (se.chill.stacks >= 5) {
        se.frozen.active = true
        se.frozen.timer  = 2000 * durMult
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
      const dur = 3000 * (enemy.scene?._ailmentDurMult || 1)
      se.shock.active = true
      se.shock.timer  = Math.max(se.shock.timer, dur)
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
      const dur = 3000 * (enemy.scene?._ailmentDurMult || 1)
      se.bleed.active = true
      se.bleed.timer  = Math.max(se.bleed.timer, dur)
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
  {
    id:         'poison',
    name:       '【毒：腐化】',
    desc:       '攻擊有 30% 機率使敵人中毒，每秒扣除最大生命 1%；中毒的敵人死亡後爆出毒霧傳染周邊',
    rarity:     'rare',
    minTimeMs:  1 * 60 * 1000,
    onHit(enemy) {
      if (Math.random() < 0.30) {
        const se = enemy._statusEffects
        if (!se) return
        if (!se.poison) se.poison = { active: false, timer: 0, _accum: 0 }
        const dur = 5000 * (enemy.scene?._ailmentDurMult || 1)
        se.poison.active = true
        se.poison.timer  = Math.max(se.poison.timer, dur)
      }
    },
  },
  {
    id:         'holy',
    name:       '【聖：淨化】',
    desc:       '攻擊附帶神聖光傷害，對精英怪傷害 +30%，且有機率施加短暫遲緩',
    rarity:     'rare',
    minTimeMs:  2 * 60 * 1000,
    onHit(enemy, damage, scene) {
      // +30% bonus damage vs elite enemies (sizeMult > 1.0)
      const isElite = (enemy._typeConfig?.sizeMult || 1.0) > 1.0
      if (isElite && !enemy.dying) {
        const bonusDmg = Math.round(damage * 0.30)
        if (bonusDmg >= 1) {
          enemy.hp -= bonusDmg
          if (scene) {
            const offset = Math.round(Math.random() * 20 - 10)
            const txt = scene.add.text(enemy.x + offset, enemy.y - 40, `+${bonusDmg}`, {
              fontSize: '14px', color: '#ffffaa', stroke: '#554400', strokeThickness: 2,
            }).setDepth(15).setOrigin(0.5)
            scene.tweens.add({
              targets: txt, y: txt.y - 24, alpha: 0, duration: 700,
              ease: 'Power1', onComplete: () => txt.destroy(),
            })
          }
        }
      }
      // 25% chance to apply a brief chill (strip speed buff)
      if (Math.random() < 0.25) {
        const se = enemy._statusEffects
        if (se) {
          se.chill.active = true
          se.chill.timer  = Math.max(se.chill.timer, 1000)
        }
      }
    },
  },
]
