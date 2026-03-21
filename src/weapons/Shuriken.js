// src/weapons/Shuriken.js
import Phaser from 'phaser'
import Enemy  from '../entities/Enemy.js'
import { getOrCreate } from './_pool.js'
import { doScatter } from '../upgrades/projTraits.js'
import { applyMiniExplosion, applyRicochet } from '../upgrades/projEffects.js'

const HIT_RADIUS = 28   // manual overlap radius in px (independent of body size)

export default {
  id: 'shuriken',
  name: '手裏剣',
  texKey: 'shuriken',
  iconKey: 'shuriken',

  baseStats: {
    damage: 10,
    fireRate: 800,
    projectileCount: 3,
    speed: 400,
    penetrate: false,
    knockback: 60,
    _scale: 1.0,
  },

  upgrades: [
    { id: 'dmg',       name: '手裏剣 傷害 +20%',    desc: '', apply: s => { s.damage         *= 1.20 } },
    { id: 'firerate',  name: '手裏剣 攻擊速度 +25%', desc: '', apply: s => { s.fireRate        = Math.max(200, s.fireRate * 0.75) } },
    { id: 'multishot', name: '手裏剣 投射數 +1',     desc: '', apply: s => { s.projectileCount = Math.min(5, s.projectileCount + 1) } },
  ],

  createTexture() { /* loaded in GameScene.preload() */ },

  fire(scene, pool, fromX, fromY, stats /*, enemies unused */) {
    for (let i = 0; i < stats.projectileCount; i++) {
      const s = getOrCreate(pool, fromX, fromY, this.texKey)
      const baseW = 28, baseH = 28
      s.setDisplaySize(baseW * stats._scale, baseH * stats._scale)
      s.damage    = stats.damage
      s.hitSet    = new Set()
      s.spawnX    = fromX
      s.spawnY    = fromY
      s.range     = 300
      s.penetrate = stats.penetrate
      s.knockback = stats.knockback ?? 60
      s._hitRadius = HIT_RADIUS * stats._scale
      s._pool = pool
      s._reversed = false
      s._boomerang     = stats._boomerang     || false
      s._scatter       = stats._scatter       || false
      s._scatterFired  = false
      s._miniExplosion = stats._miniExplosion || false
      s._ricochet      = stats._ricochet      || false
      s._ricochetDepth = 0

      const deg = (360 / stats.projectileCount) * i
      scene.physics.velocityFromAngle(deg, stats.speed, s.body.velocity)
    }
  },

  update(sprite) {
    if (!sprite.active) return
    sprite.angle += 8

    const dist = Phaser.Math.Distance.Between(sprite.spawnX, sprite.spawnY, sprite.x, sprite.y)

    if (sprite._boomerang) {
      if (!sprite._reversed && dist >= sprite.range) {
        sprite.body.velocity.x *= -1
        sprite.body.velocity.y *= -1
        sprite._reversed = true
      } else if (sprite._reversed && dist <= 30) {
        if (sprite._scatter) doScatter(sprite, sprite.scene)
        sprite.disableBody(true, true)
      }
    } else {
      if (dist >= sprite.range) {
        if (sprite._scatter) doScatter(sprite, sprite.scene)
        sprite.disableBody(true, true)
      }
    }
  },

  // Manual hit detection — bypasses Phaser physics overlap so body size doesn't matter
  updateActive(entry, scene, enemies, _player, affixes) {
    entry.projectiles.getChildren().forEach(proj => {
      if (!proj.active || proj._spent) return
      enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
        if (proj.hitSet.has(e)) return
        if (Phaser.Math.Distance.Between(proj.x, proj.y, e.x, e.y) < proj._hitRadius) {
          proj.hitSet.add(e)
          Enemy.takeDamage(e, proj.damage, proj.x, proj.y, affixes, proj.knockback ?? 60)
          applyMiniExplosion(proj, e, scene, enemies, affixes)
          applyRicochet(proj, e, scene, enemies, affixes)

          // 雷轟剣 evo — 100% chain bounce, bounces = projectileCount
          if (entry.stats._evo === 'raikou') {
            const bounces = entry.stats.projectileCount || 3
            let src = e
            for (let b = 0; b < bounces; b++) {
              const next = enemies.getChildren()
                .filter(en => en.active && !en.dying && !proj.hitSet.has(en) &&
                  Phaser.Math.Distance.Between(src.x, src.y, en.x, en.y) < 120)
                .sort((a, bb) =>
                  Phaser.Math.Distance.Between(src.x, src.y, a.x, a.y) -
                  Phaser.Math.Distance.Between(src.x, src.y, bb.x, bb.y))[0]
              if (!next) break
              proj.hitSet.add(next)
              Enemy.takeDamage(next, proj.damage * 0.5, src.x, src.y, affixes, 0)
              // Lightning visual
              const g = scene.add.graphics().setDepth(10)
              g.lineStyle(2, 0xffff44, 0.9)
              g.lineBetween(src.x, src.y, next.x, next.y)
              scene.time.delayedCall(120, () => g.destroy())
              src = next
            }
          }
          if (!proj.penetrate) proj._spent = true
        }
      })
    })
  },
}
