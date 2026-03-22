// src/weapons/_pool.js
import Phaser from 'phaser'

/**
 * Get a dead pooled sprite or create a new one.
 * Sets depth 8 and enables worldbounds exit detection.
 */
export function getOrCreate(pool, fromX, fromY, texKey) {
  let s = pool.getFirstDead(false)
  if (!s) {
    s = pool.create(fromX, fromY, texKey)
    if (!s) return null
    s.setDepth(8)
    s.body.onWorldBounds = true
  }
  s.enableBody(true, fromX, fromY, true, true)
  s._spent = false
  return s
}

/**
 * Return up to `count` nearest active enemies sorted by distance.
 */
export function nearestEnemies(enemies, x, y, count) {
  return enemies
    .getChildren()
    .filter(e => e.active && !e.dying)
    .map(e => ({ e, d: Phaser.Math.Distance.Between(x, y, e.x, e.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map(({ e }) => e)
}
