// src/upgrades/weaponStatUpgrades.js
// Universal weapon stat upgrades — shown based on what the active weapon supports.

export const WEAPON_STAT_UPGRADES = [
  {
    id:    'dmg',
    name:  '傷害 +25%',
    desc:  '{weapon} 傷害 +25%',
    apply: s => { s.damage *= 1.25 },
  },
  {
    id:       'firerate',
    name:     '攻擊速度 +20%',
    desc:     '{weapon} 攻擊速度 +20%',
    relevant: s => s.fireRate > 0,
    apply:    s => { s.fireRate = Math.max(200, s.fireRate * 0.80) },
  },
  {
    id:       'multishot',
    name:     '投射數 +1',
    desc:     '{weapon} 同時投射數 +1',
    relevant: s => s.projectileCount != null,
    apply:    s => { s.projectileCount = Math.min(5, s.projectileCount + 1) },
  },
  {
    id:       'range',
    name:     '攻擊範圍 +15%',
    desc:     '{weapon} 攻擊範圍 +15%',
    relevant: s => s.range != null,
    apply:    s => { s.range *= 1.15 },
  },
]
