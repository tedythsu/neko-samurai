// src/weapons/_pool.js

/**
 * Get a dead pooled sprite or create a new one.
 * Sets depth 8 and enables worldbounds exit detection.
 */
export function getOrCreate(pool, fromX, fromY, texKey) {
  let s = pool.getFirstDead(false)
  if (!s) {
    s = pool.create(fromX, fromY, texKey)
    s.setDepth(8)
    s.body.onWorldBounds = true
  }
  s.enableBody(true, fromX, fromY, true, true)
  return s
}
