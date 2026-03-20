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
    behaviorFlags: { explode: true, explodeRadius: 60, explodeRange: 30 },
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

/**
 * Return { hpMult, speedMult, spawnInterval, maxEnemies } for the given
 * elapsed time in ms, linearly interpolating between PROGRESSION_BREAKPOINTS.
 * Import CFG.PROGRESSION_BREAKPOINTS from config.js.
 */
export function getDifficultyMult(elapsedMs, breakpoints) {
  const pts = breakpoints
  // Clamp to last breakpoint
  if (elapsedMs >= pts[pts.length - 1].timeMs) {
    const last = pts[pts.length - 1]
    return { hpMult: last.hpMult, speedMult: last.speedMult,
             spawnInterval: last.spawnInterval, maxEnemies: last.maxEnemies }
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    if (elapsedMs >= a.timeMs && elapsedMs < b.timeMs) {
      const t = (elapsedMs - a.timeMs) / (b.timeMs - a.timeMs)
      return {
        hpMult:        a.hpMult        + (b.hpMult        - a.hpMult)        * t,
        speedMult:     a.speedMult     + (b.speedMult     - a.speedMult)     * t,
        spawnInterval: a.spawnInterval + (b.spawnInterval - a.spawnInterval) * t,
        maxEnemies:    Math.round(a.maxEnemies + (b.maxEnemies - a.maxEnemies) * t),
      }
    }
  }
  // Unreachable: above loop covers all cases between breakpoints, clamp covers >= last.
  // Defensive fallback only.
  return { hpMult: 1, speedMult: 1, spawnInterval: 2000, maxEnemies: 20 }
}
