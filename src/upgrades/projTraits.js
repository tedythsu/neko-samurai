// src/upgrades/projTraits.js
import Phaser from 'phaser'
import { getOrCreate } from '../weapons/_pool.js'

export const PROJ_WEAPON_IDS = new Set(['shuriken', 'kunai', 'homura'])
export const ALL_PROJ_TRAITS = []

/**
 * Spawn 3 small scatter children from a dying/expiring projectile.
 */
export function doScatter(proj, scene, extraProps = {}) {
  if (proj._scatterFired) return
  proj._scatterFired = true
  const pool = proj._pool
  if (!pool) return
  const baseAngle = Math.atan2(proj.body.velocity.y, proj.body.velocity.x)
  for (let i = -1; i <= 1; i++) {
    const s = getOrCreate(pool, proj.x, proj.y, proj.texture.key)
    if (!s) continue
    s.setDisplaySize(proj.displayWidth * 0.5, proj.displayHeight * 0.5)
    s.damage         = proj.damage * 0.4
    s.hitSet         = new Set()
    s.spawnX         = proj.x
    s.spawnY         = proj.y
    s.range          = 120
    s.penetrate      = false
    s.knockback      = 0
    s._hitRadius     = (proj._hitRadius || 14) * 0.5
    s._boomerang     = false
    s._scatter       = false
    s._scatterFired  = true
    s._pool          = pool
    s._reversed      = false
    s._miniExplosion = false
    s._ricochet      = false
    s._ricochetDepth = 99
    Object.assign(s, extraProps)
    const angle = baseAngle + Phaser.Math.DegToRad(i * 45)
    scene.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), 400, s.body.velocity)
  }
}
