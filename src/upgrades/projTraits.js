// src/upgrades/projTraits.js
import Phaser from 'phaser'
import { getOrCreate } from '../weapons/_pool.js'

export const PROJ_WEAPON_IDS = new Set(['shuriken', 'kunai', 'homura'])

export const ALL_PROJ_TRAITS = [
  {
    id: 'pt_explosionRange',
    name: '爆炸範圍 +25px',
    desc: '{weapon} 爆炸範圍擴大',
    oneTime: true, minLevel: 3,
    relevant: stats => stats._explodeRadius != null,
    apply(stats) { if (stats._explodeRadius != null) stats._explodeRadius += 25 },
  },
  {
    id: 'pt_burnfield',
    name: '燃燒地帶',
    desc: '{weapon} 命中落點留下燃燒地帶',
    oneTime: true, minLevel: 5,
    apply(stats) { stats._scorch = true },
  },
  {
    id: 'pt_boomerang',
    name: '回旋',
    desc: '{weapon} 飛至最大射程後反彈飛回',
    oneTime: true, minLevel: 5,
    apply(stats) { stats._boomerang = true },
  },
  {
    id: 'pt_scatter',
    name: '分裂',
    desc: '{weapon} 到達射程時分裂成多個',
    oneTime: true, minLevel: 7,
    apply(stats) { stats._scatter = true },
  },
  {
    id: 'pt_pierce',
    name: '穿透',
    desc: '{weapon} 命中敵人後不消失，穿透所有目標',
    oneTime: true, minLevel: 3,
    apply(stats) { stats.penetrate = true },
  },
  {
    id: 'pt_explosion',
    name: '爆裂弾',
    desc: '{weapon} 命中時在周圍爆炸',
    oneTime: true, minLevel: 5,
    relevant: stats => stats._explodeRadius == null,
    apply(stats) { stats._miniExplosion = true },
  },
  {
    id: 'pt_ricochet',
    name: '彈射',
    desc: '{weapon} 命中後向最近敵人彈射',
    oneTime: true, minLevel: 5,
    apply(stats) { stats._ricochet = true },
  },
]

/**
 * Spawn 3 small scatter children from a dying/expiring projectile.
 * @param {Phaser.GameObjects.Sprite} proj  — the expiring projectile
 * @param {Phaser.Scene}              scene — pass sprite.scene from update()
 * @param {Object}                    extraProps — weapon-specific overrides merged onto children
 */
export function doScatter(proj, scene, extraProps = {}) {
  if (proj._scatterFired) return
  proj._scatterFired = true
  const pool = proj._pool
  if (!pool) return
  const baseAngle = Math.atan2(proj.body.velocity.y, proj.body.velocity.x)
  for (let i = -1; i <= 1; i++) {
    const s = getOrCreate(pool, proj.x, proj.y, proj.texture.key)
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
    s._ricochetDepth = 99   // scatter children cannot ricochet
    Object.assign(s, extraProps)
    const angle = baseAngle + Phaser.Math.DegToRad(i * 45)
    scene.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), 400, s.body.velocity)
  }
}
