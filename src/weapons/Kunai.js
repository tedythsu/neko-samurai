// src/weapons/Kunai.js
import Phaser from 'phaser'
import Enemy  from '../entities/Enemy.js'
import { getOrCreate } from './_pool.js'
import { doScatter } from '../upgrades/projTraits.js'

const BASE_H    = 40   // display height in px regardless of source image size
const HIT_HALF  = 14   // hit radius in px (approx half the visual width)

export default {
  id: 'kunai',
  name: '苦無',
  desc: '速射型・精確追蹤',
  texKey: 'kunai',

  baseStats: {
    damage: 8,
    fireRate: 350,
    projectileCount: 1,
    speed: 600,
    penetrate: false,
    knockback: 60,
    _scale: 1.0,
  },

  upgrades: [
    { id: 'dmg',       name: '苦無 傷害 +25%',    desc: '', apply: s => { s.damage         *= 1.25 } },
    { id: 'firerate',  name: '苦無 攻擊速度 +20%', desc: '', apply: s => { s.fireRate        = Math.max(200, s.fireRate * 0.80) } },
    { id: 'multishot', name: '苦無 投射數 +1',     desc: '', apply: s => { s.projectileCount = Math.min(5, s.projectileCount + 1) } },
    { id: 'penetrate', name: '苦無 貫穿',          desc: '', apply: s => { s.penetrate = true } },
    { id: 'scale',     name: '苦無 體積 +30%',     desc: '', apply: s => { s._scale = Math.min(2.0, s._scale * 1.30) } },
  ],

  createTexture() { /* loaded in GameScene.preload() */ },

  fire(scene, pool, fromX, fromY, stats, enemies) {
    const targets = _nearestEnemies(enemies, fromX, fromY, stats.projectileCount)
    if (targets.length === 0) return
    targets.forEach(target => {
      const s = getOrCreate(pool, fromX, fromY, this.texKey)
      // Use native frame dimensions so pooled scale doesn't affect sizing
      const nativeH = s.frame.realHeight
      const nativeW = s.frame.realWidth
      const h = BASE_H * stats._scale
      const w = h * (nativeW / nativeH)
      s.setDisplaySize(w, h)
      s.damage      = stats.damage
      s.hitSet      = new Set()
      s.spawnX      = fromX
      s.spawnY      = fromY
      s.range       = 500
      s.penetrate   = stats.penetrate || false
      s.knockback   = stats.knockback ?? 60
      s._hitRadius  = HIT_HALF * stats._scale
      s._miniExplosion = stats._miniExplosion || false
      s._ricochet      = stats._ricochet      || false
      s._ricochetDepth = 0
      s._scatter       = stats._scatter       || false
      s._scatterFired  = false
      s._pool          = pool

      const angle = Phaser.Math.Angle.Between(fromX, fromY, target.x, target.y)
      scene.physics.velocityFromAngle(
        Phaser.Math.RadToDeg(angle), stats.speed, s.body.velocity
      )
    })
  },

  update(sprite) {
    if (!sprite.active) return
    // Rotate so image top faces travel direction
    sprite.rotation = Math.atan2(sprite.body.velocity.y, sprite.body.velocity.x) + Math.PI / 2
    if (Phaser.Math.Distance.Between(sprite.spawnX, sprite.spawnY, sprite.x, sprite.y) >= sprite.range) {
      if (sprite._scatter) doScatter(sprite, sprite.scene)
      sprite.disableBody(true, true)
    }
  },

  // Manual hit detection — bypasses physics overlap body-size issues
  updateActive(entry, scene, enemies, _player, affixes) {
    entry.projectiles.getChildren().forEach(proj => {
      if (!proj.active || proj._spent) return
      enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
        if (proj.hitSet.has(e)) return
        if (Phaser.Math.Distance.Between(proj.x, proj.y, e.x, e.y) < proj._hitRadius) {
          proj.hitSet.add(e)
          Enemy.takeDamage(e, proj.damage, proj.x, proj.y, affixes, proj.knockback ?? 60)

          // 氷刃苦無 evo — freeze on hit
          if (entry.stats._evo === 'koori' && e._statusEffects && e._statusEffects.frozen) {
            e._statusEffects.frozen.active = true
            e._statusEffects.frozen.timer  = 2000
          }

          // 爆裂弾
          if (proj._miniExplosion) {
            const r = 40
            enemies.getChildren()
              .filter(en => en.active && !en.dying && en !== e &&
                Phaser.Math.Distance.Between(e.x, e.y, en.x, en.y) < r)
              .forEach(en => Enemy.takeDamage(en, proj.damage * 0.4, e.x, e.y, affixes, 0))
            const g = scene.add.graphics().setDepth(10)
            g.lineStyle(2, 0xff6600, 0.8)
            g.strokeCircle(e.x, e.y, r)
            scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() })
          }

          // 彈射
          if (proj._ricochet && proj._ricochetDepth < 2) {
            const next = enemies.getChildren()
              .filter(en => en.active && !en.dying && !proj.hitSet.has(en))
              .sort((a, b) =>
                Phaser.Math.Distance.Between(e.x, e.y, a.x, a.y) -
                Phaser.Math.Distance.Between(e.x, e.y, b.x, b.y))[0]
            if (next) {
              const r2 = getOrCreate(proj._pool, e.x, e.y, proj.texture.key)
              r2.setDisplaySize(proj.displayWidth, proj.displayHeight)
              r2.damage         = proj.damage * 0.7
              r2.hitSet         = new Set([e])
              r2.spawnX         = e.x
              r2.spawnY         = e.y
              r2.range          = 200
              r2.penetrate      = false
              r2.knockback      = proj.knockback
              r2._hitRadius     = proj._hitRadius
              r2._boomerang     = false
              r2._scatter       = proj._scatter
              r2._scatterFired  = false
              r2._miniExplosion = proj._miniExplosion
              r2._ricochet      = true
              r2._ricochetDepth = proj._ricochetDepth + 1
              r2._pool          = proj._pool
              r2._reversed      = false
              scene.physics.moveToObject(r2, next, 400)
            }
          }

          // 氷刃苦無 — pierce frozen enemies (don't expire)
          const shouldPierce = proj.penetrate || (entry.stats._evo === 'koori' && e._statusEffects?.frozen?.active)
          if (!shouldPierce) proj._spent = true
        }
      })
    })
  },
}

function _nearestEnemies(enemies, x, y, count) {
  return enemies
    .getChildren()
    .filter(e => e.active && !e.dying)
    .map(e => ({ e, d: Phaser.Math.Distance.Between(x, y, e.x, e.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map(({ e }) => e)
}
