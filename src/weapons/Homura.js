// src/weapons/Homura.js
import Phaser     from 'phaser'
import Enemy      from '../entities/Enemy.js'
import { getOrCreate, nearestEnemies, rollDamage } from './_pool.js'
import { applyExplosion } from '../upgrades/projEffects.js'

export default {
  id:       'homura',
  name:     '炎矢',
  texKey:   'homura-tex',
  iconChar: '炎',

  baseStats: {
    damage:          48,
    damageVariance:  0.30,
    fireRate:        1950,
    projectileCount: 1,
    range:           700,
    speed:           280,
    penetrate:       false,
    knockback:       140,
    _explodeRadius:  78,
  },

  upgrades: [],

  createTexture(scene) {
    if (scene.textures.exists('homura-tex')) return
    const rt = scene.add.renderTexture(0, 0, 24, 24)
    rt.fill(0xdd2200)
    rt.saveTexture('homura-tex')
    rt.destroy()
  },

  fire(scene, pool, fromX, fromY, stats, enemies) {
    const targets = nearestEnemies(enemies, fromX, fromY, stats.projectileCount)
    if (targets.length === 0) return
    targets.forEach(target => {
      const s = getOrCreate(pool, fromX, fromY, this.texKey)
      if (!s) return
      s.setDisplaySize(24, 24)
      s.damage         = rollDamage(stats)
      s.hitSet         = new Set()
      s.spawnX         = fromX
      s.spawnY         = fromY
      s.range          = stats.range
      s.penetrate      = stats.penetrate ?? false
      s.knockback      = stats.knockback ?? 160
      s._explodeRadius = stats._explodeRadius
      s._explodeMult   = 0.72
      s._scorch        = stats._scorch        || false
      s._chainExplode  = stats._chainExplode  || false
      s._gravity       = stats._gravity       || false
      s._secondBurst   = stats._secondBurst   || false
      s._pool          = pool
      s._wallBounce    = scene._ricochetWall || false
      s._wallBounced   = false
      s._weaponId      = this.id
      s._hitRadius     = s.displayWidth * 0.5
      s._chainDepth    = 0
      s._affixes       = scene._affixes || []
      s._target        = target

      const angle = Phaser.Math.Angle.Between(fromX, fromY, target.x, target.y)
      const speed = stats.speed * (scene._projSpeedMult || 1)
      s._speed = speed
      scene.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), speed, s.body.velocity)
    })
  },

  update(sprite) {
    if (!sprite.active) return
    sprite.rotation += 0.1
    if (sprite._spent) { sprite.disableBody(true, true); return }

    if (sprite._target?.active && !sprite._target?.dying && sprite.body) {
      const desiredAngle = Phaser.Math.Angle.Between(sprite.x, sprite.y, sprite._target.x, sprite._target.y)
      const curVel = sprite.body.velocity
      const curSpeed = Math.max(1, Math.hypot(curVel.x, curVel.y))
      const desiredX = Math.cos(desiredAngle) * curSpeed
      const desiredY = Math.sin(desiredAngle) * curSpeed
      curVel.x = Phaser.Math.Linear(curVel.x, desiredX, 0.08)
      curVel.y = Phaser.Math.Linear(curVel.y, desiredY, 0.08)
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
    if (Phaser.Math.Distance.Between(sprite.spawnX, sprite.spawnY, sprite.x, sprite.y) >= sprite.range) {
      applyExplosion(sprite, null, sprite.scene, sprite.scene._enemies, sprite._affixes || [])
      sprite.disableBody(true, true)
    }
  },

  updateActive(entry, scene, enemies, _player, affixes) {
    entry.projectiles.getChildren().forEach(proj => {
      if (!proj.active || proj._spent) return
      enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
        if (proj._spent || proj.hitSet.has(e)) return
        if (Phaser.Math.Distance.Between(proj.x, proj.y, e.x, e.y) < proj._hitRadius) {
          proj.hitSet.add(e)
          Enemy.takeDamage(e, proj.damage, proj.x, proj.y, affixes, proj.knockback ?? 160, {
            source: 'weapon',
            weaponId: this.id,
          })
          applyExplosion(proj, e, scene, enemies, affixes)
          const shouldPierce = proj.penetrate && proj.hitSet.size < (entry.stats._pierceMax || 999)
          if (!shouldPierce) proj._spent = true
        }
      })
    })
  },
}
