// src/weapons/Ofuda.js
import Phaser     from 'phaser'
import Enemy      from '../entities/Enemy.js'
import { getOrCreate } from './_pool.js'
import { doScatter } from '../upgrades/projTraits.js'
import { applyExplosion, applyMiniExplosion, applyRicochet } from '../upgrades/projEffects.js'

export default {
  id:     'ofuda',
  name:   '霊符',
  desc:   '緩速追蹤・命中爆炸',
  texKey: 'ofuda-tex',

  baseStats: {
    damage:         30,
    fireRate:       2000,
    projectileCount: 1,
    range:          600,
    speed:          150,
    penetrate:      false,
    knockback:      80,
  },

  upgrades: [
    { id: 'dmg',   name: '霊符 傷害 +25%',  desc: '', apply: s => { s.damage          *= 1.25 } },
    { id: 'speed', name: '霊符 追蹤速度 +30%', desc: '', apply: s => { s.speed = Math.min(450, s.speed * 1.30) } },
    { id: 'multi', name: '霊符 投射數 +1',   desc: '', apply: s => { s.projectileCount = Math.min(5, s.projectileCount + 1) } },
  ],

  createTexture(scene) {
    if (scene.textures.exists('ofuda-tex')) return
    const rt = scene.add.renderTexture(0, 0, 14, 20)
    rt.fill(0x9933cc)
    rt.saveTexture('ofuda-tex')
    rt.destroy()
  },

  fire(scene, pool, fromX, fromY, stats, enemies) {
    const targets = _nearestEnemies(enemies, fromX, fromY, stats.projectileCount)
    if (targets.length === 0) return
    targets.forEach(target => {
      const s = getOrCreate(pool, fromX, fromY, this.texKey)
      s.setDisplaySize(14, 20)
      s.damage        = stats.damage
      s.hitSet        = new Set()
      s.spawnX        = fromX
      s.spawnY        = fromY
      s.range         = stats.range
      s.penetrate     = stats.penetrate ?? false
      s.knockback     = stats.knockback ?? 80
      s._target       = target
      s._explodeRadius = 60
      s._explodeMult   = 1.5
      s._speed        = stats.speed
      s._scatter      = stats._scatter || false
      s._scatterFired = false
      s._linger     = stats._linger
      s._pool          = pool
      s._miniExplosion = stats._miniExplosion || false
      s._ricochet      = stats._ricochet      || false
      s._ricochetDepth = 0
      s._evoKaku    = stats._evo === 'kaku'
      // 核符 evo — force linger and bigger explosion
      if (s._evoKaku) {
        s._linger = true
        s._explodeRadius = 60 * 2.5
      }
      s._hitRadius = 10

      const angle = Phaser.Math.Angle.Between(fromX, fromY, target.x, target.y)
      scene.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), stats.speed, s.body.velocity)
    })
  },

  update(sprite) {
    if (!sprite.active) return

    // Out of range → expire (with optional split)
    if (Phaser.Math.Distance.Between(sprite.spawnX, sprite.spawnY, sprite.x, sprite.y) >= sprite.range) {
      if (sprite._scatter && !sprite._scatterFired) {
        doScatter(sprite, sprite.scene, {
          _explodeRadius: (sprite._explodeRadius || 30) * 0.5,
          _speed:         250,
          _evoKaku:       false,
          _target:        null,
          _linger:        false,
          range:          150,
        })
      }
      sprite.disableBody(true, true)
      return
    }

    // Lost target — keep going straight
    if (!sprite._target || !sprite._target.active || sprite._target.dying) return

    // Steer toward target with 4°/frame angular velocity cap
    const targetAngle  = Phaser.Math.Angle.Between(sprite.x, sprite.y, sprite._target.x, sprite._target.y)
    const currentAngle = Math.atan2(sprite.body.velocity.y, sprite.body.velocity.x)

    let diff = targetAngle - currentAngle
    while (diff >  Math.PI) diff -= 2 * Math.PI
    while (diff < -Math.PI) diff += 2 * Math.PI

    const maxTurn  = Phaser.Math.DegToRad(4)
    const turn     = Math.min(Math.abs(diff), maxTurn) * Math.sign(diff)
    const newAngle = currentAngle + turn
    const speed    = sprite._speed || 150

    sprite.body.velocity.x = Math.cos(newAngle) * speed
    sprite.body.velocity.y = Math.sin(newAngle) * speed
    sprite.rotation = newAngle
  },

  updateActive(entry, scene, enemies, _player, affixes) {
    entry.projectiles.getChildren().forEach(proj => {
      if (!proj.active || proj._spent) return
      enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
        if (proj.hitSet.has(e)) return
        if (Phaser.Math.Distance.Between(proj.x, proj.y, e.x, e.y) < proj._hitRadius) {
          proj.hitSet.add(e)
          Enemy.takeDamage(e, proj.damage, proj.x, proj.y, affixes, proj.knockback ?? 80)
          applyExplosion(proj, e, scene, enemies, affixes)
          applyMiniExplosion(proj, e, scene, enemies, affixes)
          applyRicochet(proj, e, scene, enemies, affixes, next => ({
            _target:        next,
            _explodeRadius: proj._explodeRadius,
            _explodeMult:   proj._explodeMult,
            _linger:        false,
            _evoKaku:       false,
          }))
          if (!proj.penetrate) proj._spent = true
        }
      })
    })
  },
}

function _nearestEnemies(enemies, x, y, count) {
  return enemies.getChildren()
    .filter(e => e.active && !e.dying)
    .map(e => ({ e, d: Phaser.Math.Distance.Between(x, y, e.x, e.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map(({ e }) => e)
}
