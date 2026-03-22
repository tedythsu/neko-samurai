// src/config.js

export const CFG = {
  // Arena
  WORLD_WIDTH:  1600,
  WORLD_HEIGHT: 1200,

  // Player
  PLAYER_SPEED:            200,
  PLAYER_HP_MAX:           100,

  // Enemy
  ENEMY_SPEED:              80,
  ENEMY_HP:                 35,
  ENEMY_DAMAGE:             10,
  ENEMY_SPAWN_INTERVAL:   1500,  // ms

  // XP
  XP_PER_ENEMY:             15,
  ORB_ATTRACT_RADIUS:      130,   // px — orb starts flying toward player
  ORB_COLLECT_RADIUS:       30,   // px — orb is collected
  XP_BASE:                  35,
  XP_SCALE:                1.35,

  // Waves
  WAVE_SCALE: 3,  // extra enemy added per N levels

  // Combat
  CRIT_CHANCE:     0.10,  // 10% base crit chance
  CRIT_MULTIPLIER: 2.00,  // crit deals 2× damage

  // Weapon slots
  MAX_WEAPONS: 1,
}

// 10 分鐘遊戲用難度曲線 — 前快後重
export const PROGRESSION_BREAKPOINTS = [
  { timeMs:  0 * 60000, spawnInterval: 1500, hpMult: 1.0, speedMult: 1.0,  maxEnemies: 25 },
  { timeMs:  2 * 60000, spawnInterval: 1200, hpMult: 1.8, speedMult: 1.1,  maxEnemies: 35 },
  { timeMs:  5 * 60000, spawnInterval:  900, hpMult: 3.5, speedMult: 1.25, maxEnemies: 45 },
  { timeMs:  7 * 60000, spawnInterval:  700, hpMult: 5.5, speedMult: 1.35, maxEnemies: 55 },
  { timeMs:  9 * 60000, spawnInterval:  500, hpMult: 8.0, speedMult: 1.45, maxEnemies: 65 },
]

/**
 * XP required to reach `level + 1`
 * 四段式曲線配合 10 分鐘 50 級節奏：
 *   Phase 1 (Lv  1-12) ~10s/lv  — 快速成型
 *   Phase 2 (Lv 13-35) ~15s/lv  — 機制擴張
 *   Phase 3 (Lv 36-45) ~30s/lv  — 質變收割
 *   Phase 4 (Lv 46-50) ~50s/lv  — 最終決戰
 */
export function xpThreshold(level) {
  if (level <= 12) return 80  + level * 15                    // 95 → 260
  if (level <= 35) return 500 + (level - 12) * 75            // 575 → 2225
  if (level <= 45) return 2500 + (level - 35) * 300          // 2800 → 5500
  return 5500 + (level - 45) * 500                            // 6000 → 7500
}

// 稀有度：基礎抽取權重
export const RARITY_WEIGHTS = { common: 6.0, rare: 2.5, epic: 1.2, legendary: 0.3 }

// 稀有度：UI 顏色
export const RARITY_UI = {
  common:    { border: 0x666666, text: '#aaaaaa', label: '普通' },
  rare:      { border: 0x2266cc, text: '#4488ff', label: '稀有' },
  epic:      { border: 0x8822cc, text: '#cc66ff', label: '史詩' },
  legendary: { border: 0xcc8800, text: '#ffaa00', label: '傳奇' },
}

/** Random edge spawn point — returns { x, y } inside world bounds */
export function randomEdgePoint(worldW, worldH, inset = 20) {
  const edge = Math.floor(Math.random() * 4)
  switch (edge) {
    case 0: return { x: Math.random() * worldW,  y: inset }               // top
    case 1: return { x: Math.random() * worldW,  y: worldH - inset }      // bottom
    case 2: return { x: inset,                   y: Math.random() * worldH } // left
    default: return { x: worldW - inset,         y: Math.random() * worldH } // right
  }
}

export const PLAYER_UPGRADES = [
  { id: 'speed',  name: '疾風',      desc: '移速 +15%',
    apply: (player) => { player.speed *= 1.15 } },
  { id: 'maxhp',  name: '武者の意志', desc: '最大HP +20%',
    apply: (player) => { player.maxHp *= 1.20; player.heal(player.maxHp * 0.20) } },
  { id: 'regen', name: '武者の気', desc: '未受傷4秒後每秒回復最大HP 1.5%', oneTime: true,
    apply: (player, scene) => {
      scene._regenActive = true
      scene._regenTimer  = 0
    } },
  { id: 'crit_rate', name: '武者の眼', desc: '爆擊率 +10%', oneTime: true,
    apply: (player, scene) => { scene._critBonus = (scene._critBonus || 0) + 0.10 } },
  { id: 'crit_dmg',  name: '必殺の型', desc: '爆擊傷害 +30%', oneTime: true,
    apply: (player, scene) => { scene._critDmgBonus = (scene._critDmgBonus || 0) + 0.30 } },
  { id: 'crit_combo', name: '活殺奥義', desc: '爆擊率+5% 爆擊傷害+20%', oneTime: true,
    apply: (player, scene) => {
      scene._critBonus    = (scene._critBonus    || 0) + 0.05
      scene._critDmgBonus = (scene._critDmgBonus || 0) + 0.20
    } },
]
