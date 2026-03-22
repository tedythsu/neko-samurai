// src/enemies/EnemyTypes.js
// Five enemy type configs. unlockMs = when the type enters the spawn pool.
// baseTint: null = no tint (clearTint). hpMult/speedMult/sizeMult are
// multiplied against CFG.ENEMY_HP / CFG.ENEMY_SPEED / base display size.
export const ENEMY_TYPES = [
  {
    id:        'kisotsu',
    unlockMs:  0,
    baseTint:  null,       // no tint
    hpMult:    1.0,
    speedMult: 1.0,
    sizeMult:  1.0,
    behaviorFlags: {},
  },
  {
    id:        'hayate',
    unlockMs:  3 * 60 * 1000,
    baseTint:  0x44ff88,   // green
    hpMult:    0.5,
    speedMult: 2.0,
    sizeMult:  0.75,
    behaviorFlags: {},
  },
  {
    id:        'yoroi',
    unlockMs:  6 * 60 * 1000,
    baseTint:  0xcc6622,   // orange-brown
    hpMult:    4.0,
    speedMult: 0.5,
    sizeMult:  1.5,
    behaviorFlags: {},
  },
  {
    id:        'bakuha',
    unlockMs:  9 * 60 * 1000,
    baseTint:  0xff2200,   // red
    hpMult:    0.7,
    speedMult: 1.3,
    sizeMult:  1.0,
    behaviorFlags: { explode: true, explodeRadius: 60, explodeRange: 30 },  // explodeRange: trigger distance from player; explodeRadius: AoE blast radius
  },
  {
    id:        'jonin',
    unlockMs:  12 * 60 * 1000,
    baseTint:  0xffcc00,   // gold
    hpMult:    2.5,
    speedMult: 1.4,
    sizeMult:  1.2,
    behaviorFlags: {},
  },
]

// getDifficultyMult removed — replaced by getWaveConfig() in config.js
