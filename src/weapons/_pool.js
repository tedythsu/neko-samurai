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
 * Roll a damage value within the weapon's variance band.
 * stats.damage is the base (affected by upgrades); damageVariance is a fixed ±fraction.
 * e.g. variance=0.35, damage=20 → rolls U(13, 27), average stays 20.
 */
export function rollDamage(stats) {
  const v = stats.damageVariance || 0
  if (!v) return stats.damage
  return stats.damage * (1 - v + Math.random() * v * 2)
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
