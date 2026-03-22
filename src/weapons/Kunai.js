// src/weapons/Kunai.js
import Phaser from 'phaser'
import Enemy  from '../entities/Enemy.js'
import { getOrCreate, nearestEnemies } from './_pool.js'
import { applyRicochet } from '../upgrades/projEffects.js'

const BASE_H    = 40
const HIT_HALF  = 14

export default {
  id: 'kunai',
  name: '苦無',
  texKey: 'kunai',
  iconKey: 'kunai',

  baseStats: {
    damage:          8,
    fireRate:        500,
    projectileCount: 1,
    speed:           600,
    penetrate:       false,
    knockback:       60,
    _scale:          1.0,
  },

  upgrades: [],

  createTexture() {},

  fire(scene, pool, fromX, fromY, stats, enemies) {
    const targets = nearestEnemies(enemies, fromX, fromY, stats.projectileCount)
    if (targets.length === 0) return
    targets.forEach(target => {
      const s = getOrCreate(pool, fromX, fromY, this.texKey)
      if (!s) return
      const nativeH = s.frame.realHeight
      const nativeW = s.frame.realWidth
      const h = BASE_H * stats._scale
      const w = h * (nativeW / nativeH)
      s.setDisplaySize(w, h)
      s.damage         = stats.damage
      s.hitSet         = new Set()
      s.spawnX         = fromX
      s.spawnY         = fromY
      s.range          = 500
      s.penetrate      = stats.penetrate || false
      s.knockback      = stats.knockback ?? 60
      s._hitRadius     = HIT_HALF * stats._scale
      s._homing        = stats._homing        || false
      s._pierceBonus   = stats._pierceBonus   || 0
      s._stun          = stats._stun          || false
      s._ricochet      = stats._ricochet      || false
      s._ricochetDepth = 0
      s._ricochetMax   = stats._ricochetMax
      s._pool          = pool
      s._spent         = false

      const angle = Phaser.Math.Angle.Between(fromX, fromY, target.x, target.y)
      scene.physics.velocityFromAngle(
        Phaser.Math.RadToDeg(angle), stats.speed, s.body.velocity
      )
    })
  },

  update(sprite) {
    if (!sprite.active) return
    sprite.rotation = Math.atan2(sprite.body.velocity.y, sprite.body.velocity.x) + Math.PI / 2

    if (sprite._spent) {
      sprite.disableBody(true, true)
      return
    }

    // 咒印・自動 — homing: steer toward nearest enemy each frame
    if (sprite._homing) {
      const scene   = sprite.scene
      const enemies = scene._enemies
      if (enemies) {
        const nearest = enemies.getChildren()
          .filter(e => e.active && !e.dying && !sprite.hitSet.has(e))
          .sort((a, b) =>
            Phaser.Math.Distance.Between(sprite.x, sprite.y, a.x, a.y) -
            Phaser.Math.Distance.Between(sprite.x, sprite.y, b.x, b.y))[0]
        if (nearest) {
          const speed = Math.hypot(sprite.body.velocity.x, sprite.body.velocity.y)
          const angle = Phaser.Math.Angle.Between(sprite.x, sprite.y, nearest.x, nearest.y)
          const tx = Math.cos(angle) * speed
          const ty = Math.sin(angle) * speed
          // Gradual steering (lerp velocity)
          sprite.body.velocity.x += (tx - sprite.body.velocity.x) * 0.12
          sprite.body.velocity.y += (ty - sprite.body.velocity.y) * 0.12
        }
      }
    }

    if (Phaser.Math.Distance.Between(sprite.spawnX, sprite.spawnY, sprite.x, sprite.y) >= sprite.range) {
      sprite.disableBody(true, true)
    }
  },

  updateActive(entry, scene, enemies, _player, affixes) {
    entry.projectiles.getChildren().forEach(proj => {
      if (!proj.active || proj._spent) return
      enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
        if (proj._spent || proj.hitSet.has(e)) return
        if (Phaser.Math.Distance.Between(proj.x, proj.y, e.x, e.y) < proj._hitRadius) {
          const pierceCount = proj.hitSet.size
          const dmg = proj.damage * (1 + pierceCount * (proj._pierceBonus || 0))
          proj.hitSet.add(e)
          Enemy.takeDamage(e, dmg, proj.x, proj.y, affixes, proj.knockback ?? 60)

          // 影縫・定身 — stun on hit
          if (proj._stun && Math.random() < 0.40) {
            e._stunTimer = Math.max(e._stunTimer || 0, 1000)
          }

          applyRicochet(proj, e, scene, enemies, affixes)

          const shouldPierce = proj.penetrate && proj.hitSet.size < (entry.stats._pierceMax || 999)
          if (!shouldPierce) proj._spent = true
        }
      })
    })
  },
}
