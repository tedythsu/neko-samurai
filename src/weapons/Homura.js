// src/weapons/Homura.js
import Phaser     from 'phaser'
import Enemy      from '../entities/Enemy.js'
import { getOrCreate, nearestEnemies } from './_pool.js'
import { applyExplosion } from '../upgrades/projEffects.js'

export default {
  id:       'homura',
  name:     '炎矢',
  texKey:   'homura-tex',
  iconChar: '炎',

  baseStats: {
    damage:          25,
    fireRate:        2000,
    projectileCount: 1,
    range:           700,
    speed:           200,
    penetrate:       false,
    knockback:       160,
    _explodeRadius:  80,
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
      s.damage         = stats.damage
      s.hitSet         = new Set()
      s.spawnX         = fromX
      s.spawnY         = fromY
      s.range          = stats.range
      s.penetrate      = stats.penetrate ?? false
      s.knockback      = stats.knockback ?? 160
      s._explodeRadius = stats._explodeRadius
      s._explodeMult   = 0.7
      s._scorch        = stats._scorch        || false
      s._chainExplode  = stats._chainExplode  || false
      s._gravity       = stats._gravity       || false
      s._secondBurst   = stats._secondBurst   || false
      s._pool          = pool
      s._hitRadius     = s.displayWidth * 0.5
      s._chainDepth    = 0

      const angle = Phaser.Math.Angle.Between(fromX, fromY, target.x, target.y)
      scene.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), stats.speed, s.body.velocity)
    })
  },

  update(sprite) {
    if (!sprite.active) return
    sprite.rotation += 0.1
    if (sprite._spent) { sprite.disableBody(true, true); return }
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
          proj.hitSet.add(e)
          Enemy.takeDamage(e, proj.damage, proj.x, proj.y, affixes, proj.knockback ?? 160)
          applyExplosion(proj, e, scene, enemies, affixes)
          if (!proj.penetrate) proj._spent = true
        }
      })
    })
  },
}
