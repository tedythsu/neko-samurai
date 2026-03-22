// src/config.js

export const CFG = {
  // Arena
  WORLD_WIDTH:  1600,
  WORLD_HEIGHT: 1200,

  // Player
  PLAYER_SPEED:            200,
  PLAYER_HP_MAX:           100,

  // Enemy base values (used as reference; actual stats come from WAVE_CONFIGS)
  ENEMY_SPEED:              80,
  ENEMY_HP:                 35,
  ENEMY_DAMAGE:             10,
  ENEMY_SPAWN_INTERVAL:   1500,  // ms

  // XP
  ORB_ATTRACT_RADIUS:      130,   // px — orb starts flying toward player
  ORB_COLLECT_RADIUS:       30,   // px — orb is collected

  // Combat
  CRIT_CHANCE:     0.10,  // 10% base crit chance
  CRIT_MULTIPLIER: 2.00,  // crit deals 2× damage

  // Weapon slots
  MAX_WEAPONS: 1,

  // Level cap
  MAX_LEVEL: 15,
}

// 十波次配置 — 每波 60 秒，單一兵種（足輕），數值由波次決定
// hp: 絕對生命值  speed: 移動速度(px/s)  damage: 碰撞傷害
// scale: 顯示縮放倍率  spawnInterval: 補兵間隔(ms, trickle)  maxEnemies: 最大在場數
// xpDrop: 每隻掉落XP  surgeSize: 波次開始時衝入總數（分3批，各批延遲1.5s）
export const WAVE_CONFIGS = [
  // 第壱波 (0-1min)  極速割草：一刀死，開場立刻塞滿螢幕
  { timeMs:       0, hp:    30, speed:  64, damage:   1, scale: 1.0, spawnInterval:  600, maxEnemies: 50, xpDrop:  10, surgeSize: 24 },
  // 第弐波 (1-2min)  追逐感：跑速略超玩家，全面衝鋒
  { timeMs:   60000, hp:    65, speed:  88, damage:   1, scale: 1.0, spawnInterval:  700, maxEnemies: 55, xpDrop:  15, surgeSize: 27 },
  // 第参波 (2-3min)  生存壓力：血厚，持續壓迫
  { timeMs:  120000, hp:   120, speed:  80, damage:   5, scale: 1.0, spawnInterval:  900, maxEnemies: 55, xpDrop:  30, surgeSize: 18 },
  // 第肆波 (3-4min)  重裝壓境：硬且慢，螢幕被塞滿
  { timeMs:  180000, hp:   220, speed:  64, damage:  15, scale: 1.0, spawnInterval: 1000, maxEnemies: 50, xpDrop:  40, surgeSize: 15 },
  // 第伍波 (4-5min)  中場高潮：精英群體型 1.5×，數量仍多
  { timeMs:  240000, hp:   380, speed:  96, damage:  20, scale: 1.5, spawnInterval: 1000, maxEnemies: 40, xpDrop:  50, surgeSize: 18 },
  // 第陸波 (5-6min)  閃擊波次：極快衝鋒，密集如雨
  { timeMs:  300000, hp:   200, speed: 120, damage:  10, scale: 1.0, spawnInterval:  500, maxEnemies: 65, xpDrop:  60, surgeSize: 30 },
  // 第漆波 (6-7min)  死亡威脅：撞一次扣大量血，仍大量出現
  { timeMs:  360000, hp:   320, speed:  80, damage:  50, scale: 1.0, spawnInterval:  800, maxEnemies: 60, xpDrop:  75, surgeSize: 18 },
  // 第捌波 (7-8min)  全面衝突：數值全面提升，螢幕爆炸
  { timeMs:  420000, hp:   600, speed:  96, damage:  30, scale: 1.0, spawnInterval:  700, maxEnemies: 70, xpDrop:  80, surgeSize: 21 },
  // 第玖波 (8-9min)  百鬼夜行：鋪天蓋地，割草高潮
  { timeMs:  480000, hp:   360, speed: 128, damage:  15, scale: 1.0, spawnInterval:  300, maxEnemies: 90, xpDrop:  90, surgeSize: 45 },
  // 第拾波 (9-10min) 終極死鬥：2.5×巨敵 + 快速補充
  { timeMs:  540000, hp:  2200, speed:  72, damage: 100, scale: 2.5, spawnInterval: 1200, maxEnemies: 30, xpDrop: 100, surgeSize: 15 },
]

/** Return the active wave config for the given elapsed time (step function). */
export function getWaveConfig(elapsedMs) {
  for (let i = WAVE_CONFIGS.length - 1; i >= 0; i--) {
    if (elapsedMs >= WAVE_CONFIGS[i].timeMs) return WAVE_CONFIGS[i]
  }
  return WAVE_CONFIGS[0]
}

/** Return the 0-based wave index (0-9) for the given elapsed time. */
export function getWaveIndex(elapsedMs) {
  for (let i = WAVE_CONFIGS.length - 1; i >= 0; i--) {
    if (elapsedMs >= WAVE_CONFIGS[i].timeMs) return i
  }
  return 0
}

// Wave display names (漢数字)
export const WAVE_NAMES = [
  '第壹波', '第貮波', '第叄波', '第肆波', '第伍波',
  '第陸波', '第柒波', '第捌波', '第玖波', '第拾波',
]

/**
 * XP required to reach `level + 1`
 * 15 級滿級制 — 前快後慢：
 *   Wave 1 (0-1min)   Lv1→5   開場爆發：5 殺即升，60s 達 Lv5
 *   Waves 2-3 (1-3min) Lv5→8   中場建立：每 40s 升一級
 *   Waves 4-6 (3-6min) Lv8→11  緩慢成長：每 60s 升一級
 *   Waves 7-8 (6-8min) Lv11→13 關鍵選擇：每 60-70s 升一級
 *   Waves 9-10 (8-10min) Lv13→15 最終進化：每 90s 升一級
 */
export function xpThreshold(level) {
  if (level === 1)  return   50   // 5 kills @10xp  → ~5s
  if (level === 2)  return  150   // 15 kills @10xp → ~15s
  if (level === 3)  return  200   // 20 kills @10xp → ~20s
  if (level === 4)  return  300   // 30 kills @10xp → ~30s → Lv5 at ~60s
  if (level === 5)  return  750   // ~50 kills @15xp, wave 2, ~33s
  if (level === 6)  return  750   // ~50 kills @15xp              ~33s
  if (level === 7)  return 1200   // ~40 kills @30xp, wave 3,     ~50s → Lv8 at ~3min
  if (level === 8)  return 1600   // ~40 kills @40xp, wave 4,     ~60s
  if (level === 9)  return 2000   // ~40 kills @50xp, wave 5,     ~60s
  if (level === 10) return 2400   // ~40 kills @60xp, wave 6,     ~60s → Lv11 at ~6min
  if (level === 11) return 3750   // ~50 kills @75xp, wave 7,     ~60s
  if (level === 12) return 4000   // ~50 kills @80xp, wave 8,     ~65s → Lv13 at ~8min
  if (level === 13) return 5400   // ~60 kills @90xp, wave 9,     ~90s
  if (level === 14) return 6000   // ~60 kills @100xp, wave 10,   ~90s → Lv15 at ~10min
  return Infinity                  // Lv 15 = 滿級
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
