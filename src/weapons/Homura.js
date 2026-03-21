// src/weapons/Homura.js
import Phaser     from 'phaser'
import Enemy      from '../entities/Enemy.js'
import { getOrCreate, nearestEnemies } from './_pool.js'
import { applyExplosion, applyMiniExplosion, applyRicochet } from '../upgrades/projEffects.js'
import { doScatter } from '../upgrades/projTraits.js'

export default {
  id:       'homura',
  name:     '炎矢',
  texKey:   'homura-tex',
  iconChar: '炎',

  baseStats: {
    damage:          25,
    fireRate:        2500,
    projectileCount: 1,
    range:           700,
    speed:           200,
    penetrate:       false,
    knockback:       160,
    _explodeRadius:  80,
  },

  upgrades: [
    { id: 'dmg',   name: '炎矢 傷害 +25%', desc: '', apply: s => { s.damage         *= 1.25 } },
    { id: 'multi', name: '炎矢 投射數 +1', desc: '', apply: s => { s.projectileCount = Math.min(5, s.projectileCount + 1) } },
  ],

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
      s._scorch       = stats._scorch || stats._evo === 'ryuen'
      s._chainExplode = stats._chainExplode
      s._chainDepth   = 0
      s._pool          = pool
      s._miniExplosion = stats._miniExplosion || false
      s._ricochet      = stats._ricochet      || false
      s._ricochetDepth = 0
      s._scatter       = stats._scatter       || false
      s._scatterFired  = false
      // 龍炎矢 evo — bigger projectile, more damage, doubled explosion
      if (stats._evo === 'ryuen') {
        s.setDisplaySize(72, 72)
        s.damage *= 1.5
        s._explodeRadius = s._explodeRadius * 2
      }
      s._hitRadius = s.displayWidth * 0.5

      const angle = Phaser.Math.Angle.Between(fromX, fromY, target.x, target.y)
      scene.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), stats.speed, s.body.velocity)
    })
  },

  update(sprite) {
    if (!sprite.active) return
    sprite.rotation += 0.1

    // Hit an enemy last frame → expire here with optional split
    if (sprite._spent) {
      if (sprite._scatter && !sprite._scatterFired) doScatter(sprite, sprite.scene, {
        _explodeRadius: (sprite._explodeRadius || 40) * 0.5,
        _speed:         300,
        range:          150,
      })
      sprite.disableBody(true, true)
      return
    }

    if (Phaser.Math.Distance.Between(sprite.spawnX, sprite.spawnY, sprite.x, sprite.y) >= sprite.range) {
      if (sprite._scatter && !sprite._scatterFired) doScatter(sprite, sprite.scene, {
        _explodeRadius: (sprite._explodeRadius || 40) * 0.5,
        _speed:         300,
        range:          150,
      })
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
          applyMiniExplosion(proj, e, scene, enemies, affixes)
          applyRicochet(proj, e, scene, enemies, affixes, next => ({
            _target:        next,
            _explodeRadius: proj._explodeRadius,
            _explodeMult:   proj._explodeMult,
            _scorch:        false,
            _chainExplode:  false,
            _chainDepth:    99,
            _linger:        false,
            _evoKaku:       false,
          }))
          if (!proj.penetrate) proj._spent = true
        }
      })
    })
  },
}

