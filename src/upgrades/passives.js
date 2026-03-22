// src/upgrades/passives.js
// Passive utility upgrades — rarity: common / 保底選項

export const ALL_PASSIVES = [
  {
    id:     'speed',
    name:   '【神速・走位】',
    desc:   '移動速度 +20%',
    rarity: 'common',
    apply:  (player) => { player.speed *= 1.20 },
  },
  {
    id:      'defense',
    name:    '【金剛・護體】',
    desc:    '所有傷害降低 15%',
    rarity:  'common',
    oneTime: true,
    apply:   (_player, scene) => {
      scene._defenseBonus = (scene._defenseBonus || 0) + 0.15
    },
  },
  {
    id:      'aoe',
    name:    '【靈力・擴張】',
    desc:    '所有武器 AoE 範圍、鎖鏈半徑增加 25%',
    rarity:  'common',
    oneTime: true,
    apply:   (_player, scene) => {
      for (const entry of scene._weapons || []) {
        if (entry.stats._explodeRadius != null) entry.stats._explodeRadius *= 1.25
        if (entry.stats.range          != null) entry.stats.range          *= 1.25
        if (entry.stats._orbitRadius   != null) entry.stats._orbitRadius   *= 1.25
      }
    },
  },
  {
    id:     'pickup',
    name:   '【磁力・取物】',
    desc:   '拾取半徑增加 100%',
    rarity: 'common',
    apply:  (_player, scene) => {
      scene._orbAttractRadius = (scene._orbAttractRadius || 130) * 2
    },
  },
  {
    id:      'soul_drain',
    name:    '【魂吸・奪命】',
    desc:    '擊殺怪物時有 2% 機率回復 1 點生命值',
    rarity:  'common',
    oneTime: true,
    apply:   (_player, scene) => { scene._soulDrain = true },
  },
  {
    id:     'daimyo',
    name:   '【大名・增幅】',
    desc:   '每升一級，全局傷害提升 2%（疊加無上限）',
    rarity: 'common',
    apply:  (_player, scene) => { scene._daimyoStacks = (scene._daimyoStacks || 0) + 1 },
  },
]
