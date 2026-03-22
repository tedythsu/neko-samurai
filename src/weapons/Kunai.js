// src/weapons/Kunai.js
import Phaser from 'phaser'
import Enemy  from '../entities/Enemy.js'
import { getOrCreate, nearestEnemies, rollDamage } from './_pool.js'
import { applyRicochet } from '../upgrades/projEffects.js'

const BASE_H    = 40
const HIT_HALF  = 14

export default {
  id: 'kunai',
  name: '苦無',
  texKey: 'kunai',
  iconKey: 'kunai',

  baseStats: {
    damage:          18,
    damageVariance:  0.20,
    fireRate:        550,
    projectileCount: 1,
    speed:           600,
    penetrate:       false,
    knockback:       60,
    _scale:          1.0,
  },

  upgrades: [],

  createTexture() {},

  fire(scene, pool, fromX, fromY, stats, enemies) {
    const target = nearestEnemies(enemies, fromX, fromY, 1)[0]
    if (!target) return
    const centerAngle = Phaser.Math.RadToDeg(
      Phaser.Math.Angle.Between(fromX, fromY, target.x, target.y)
    )
    const spreadStep = 10
    for (let i = 0; i < stats.projectileCount; i++) {
      const s = getOrCreate(pool, fromX, fromY, this.texKey)
      if (!s) continue
      const nativeH = s.frame.realHeight
      const nativeW = s.frame.realWidth
      const h = BASE_H * stats._scale
      const w = h * (nativeW / nativeH)
      s.setDisplaySize(w, h)
      s.damage         = rollDamage(stats)
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
      s._weaponId      = this.id
      s._wallBounce    = scene._ricochetWall || false
      s._wallBounced   = false
      s._micro         = false
      s._spent         = false

      const offset = (i - (stats.projectileCount - 1) / 2) * spreadStep
      const speed = stats.speed * (scene._projSpeedMult || 1)
      const angle = Phaser.Math.DegToRad(centerAngle + offset)
      scene.physics.velocityFromAngle(
        Phaser.Math.RadToDeg(angle), speed, s.body.velocity
      )
    }
  },

  update(sprite) {
    if (!sprite.active) return
    sprite.rotation = Math.atan2(sprite.body.velocity.y, sprite.body.velocity.x) + Math.PI / 2

    if (sprite._spent) {
      sprite.disableBody(true, true)
      return
    }

    if (sprite._wallBounce && !sprite._wallBounced) {
      const bounds = sprite.scene.physics.world.bounds
      let bounced = false
      if ((sprite.x <= bounds.left + 6 && sprite.body.velocity.x < 0) ||
          (sprite.x >= bounds.right - 6 && sprite.body.velocity.x > 0)) {
        sprite.body.velocity.x *= -1
        bounced = true
      }
      if ((sprite.y <= bounds.top + 6 && sprite.body.velocity.y < 0) ||
          (sprite.y >= bounds.bottom - 6 && sprite.body.velocity.y > 0)) {
        sprite.body.velocity.y *= -1
        bounced = true
      }
      if (bounced) sprite._wallBounced = true
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
          Enemy.takeDamage(e, dmg, proj.x, proj.y, affixes, proj.knockback ?? 60, {
            source: 'weapon',
            weaponId: this.id,
          })

          // 影縫・定身 — stun on hit
          if (proj._stun && Math.random() < 0.40) {
            e._stunTimer = Math.max(e._stunTimer || 0, 1000)
          }

          if (scene._secondSplit && !proj._micro) {
            _spawnMicroKunai(scene, entry.projectiles, proj, e, entry.stats)
          }

          applyRicochet(proj, e, scene, enemies, affixes)

          const shouldPierce = proj.penetrate && proj.hitSet.size < (entry.stats._pierceMax || 999)
          if (!shouldPierce) proj._spent = true
        }
      })
    })
  },
}

function _spawnMicroKunai(scene, pool, proj, enemy, stats) {
  const baseAngle = Phaser.Math.RadToDeg(
    Phaser.Math.Angle.Between(proj.x, proj.y, enemy.x, enemy.y)
  )
  ;[-18, 18].forEach(offset => {
    const micro = getOrCreate(pool, proj.x, proj.y, proj.texture.key)
    if (!micro) return
    const nativeH = micro.frame.realHeight
    const nativeW = micro.frame.realWidth
    const h = BASE_H * 0.6 * stats._scale
    micro.setDisplaySize(h * (nativeW / nativeH), h)
    micro.damage         = proj.damage * 0.35
    micro.hitSet         = new Set()
    micro.spawnX         = proj.x
    micro.spawnY         = proj.y
    micro.range          = 180
    micro.penetrate      = false
    micro.knockback      = 25
    micro._hitRadius     = HIT_HALF * 0.55 * stats._scale
    micro._homing        = false
    micro._pierceBonus   = 0
    micro._stun          = false
    micro._ricochet      = false
    micro._ricochetDepth = 0
    micro._ricochetMax   = 0
    micro._pool          = pool
    micro._weaponId      = proj._weaponId
    micro._wallBounce    = false
    micro._wallBounced   = true
    micro._micro         = true
    micro._spent         = false
    scene.physics.velocityFromAngle(baseAngle + offset, 520, micro.body.velocity)
  })
}
