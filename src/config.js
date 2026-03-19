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
  ENEMY_HP:                 40,
  ENEMY_DAMAGE:             10,
  ENEMY_SPAWN_INTERVAL:   2000,  // ms

  // XP
  XP_PER_ENEMY:             10,
  XP_BASE:                  50,
  XP_SCALE:                1.4,

  // Waves
  WAVE_SCALE: 3,  // extra enemy added per N levels
}

/** XP required to reach `level + 1` */
export function xpThreshold(level) {
  return Math.floor(CFG.XP_BASE * Math.pow(level, CFG.XP_SCALE))
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
    apply: (player /*, scene */) => { player.speed *= 1.15 } },
  { id: 'maxhp',  name: '武者の意志', desc: '最大HP +20%',
    apply: (player /*, scene */) => { player.maxHp *= 1.20; player.heal(player.maxHp * 0.20) } },
  { id: 'regen',  name: '忍の回復',  desc: '每5秒回復1 HP',
    apply: (player, scene) => {
      scene.time.addEvent({ delay: 5000, loop: true, callback: () => player.heal(1) })
    } },
]
