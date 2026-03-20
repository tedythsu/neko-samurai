// src/weapons/Shuriken.js
import Phaser from 'phaser'
import Enemy  from '../entities/Enemy.js'
import { getOrCreate } from './_pool.js'

const HIT_RADIUS = 28   // manual overlap radius in px (independent of body size)

export default {
  id: 'shuriken',
  name: '手裏剣',
  desc: '均衡型・全方位放射',
  texKey: 'shuriken',

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
    { id: 'scale',     name: '手裏剣 體積 +30%',     desc: '', apply: s => { s._scale = Math.min(2.0, s._scale * 1.30) } },
    { id: 'boomerang', name: '回転刃', desc: '抵達射程後反彈飛回', apply: s => { s._boomerang = true } },
    { id: 'scatter',   name: '散花',   desc: '消失時分裂成3個小手裏剣（0.4倍傷害）', apply: s => { s._scatter = true } },
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
        // Reverse velocity
        sprite.body.velocity.x *= -1
        sprite.body.velocity.y *= -1
        sprite._reversed = true
      } else if (sprite._reversed && dist <= 30) {
        // Back near spawn — expire
        if (sprite._scatter) _doScatter(sprite)
        sprite.disableBody(true, true)
      }
    } else {
      if (dist >= sprite.range) {
        if (sprite._scatter) _doScatter(sprite)
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

function _doScatter(proj) {
  if (!proj._pool || proj._scatterFired) return
  proj._scatterFired = true
  const baseAngle = Math.atan2(proj.body.velocity.y, proj.body.velocity.x)
  const scene     = proj.scene
  for (let i = -1; i <= 1; i++) {
    const s = getOrCreate(proj._pool, proj.x, proj.y, 'shuriken')
    s.setDisplaySize(proj.displayWidth * 0.5, proj.displayHeight * 0.5)
    s.damage     = proj.damage * 0.4
    s.hitSet     = new Set()
    s.spawnX     = proj.x
    s.spawnY     = proj.y
    s.range      = 120
    s.penetrate  = false
    s.knockback  = 0
    s._hitRadius = (proj._hitRadius || 14) * 0.5
    s._boomerang = false
    s._scatter   = false
    s._pool      = proj._pool
    s._reversed  = false
    const angle  = baseAngle + Phaser.Math.DegToRad(i * 45)
    scene.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), 400, s.body.velocity)
  }
}
