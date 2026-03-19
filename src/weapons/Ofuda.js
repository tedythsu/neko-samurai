// src/weapons/Ofuda.js
import Phaser     from 'phaser'
import { getOrCreate } from './_pool.js'

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
  },

  upgrades: [
    { id: 'dmg',   name: '霊符強化', desc: '傷害 +25%', apply: s => { s.damage          *= 1.25 } },
    { id: 'speed', name: '追蹤加速', desc: '速度 +30%', apply: s => { s.speed           *= 1.30 } },
    { id: 'multi', name: '多重符',   desc: '符數 +1',   apply: s => { s.projectileCount += 1 } },
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
      s.damage        = stats.damage
      s.hitSet        = new Set()
      s.spawnX        = fromX
      s.spawnY        = fromY
      s.range         = stats.range
      s.penetrate     = false
      s._target       = target
      s._explodeRadius = 60
      s._explodeMult   = 1.5
      s._speed        = stats.speed

      const angle = Phaser.Math.Angle.Between(fromX, fromY, target.x, target.y)
      scene.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), stats.speed, s.body.velocity)
    })
  },

  update(sprite) {
    if (!sprite.active) return

    // Out of range → expire
    if (Phaser.Math.Distance.Between(sprite.spawnX, sprite.spawnY, sprite.x, sprite.y) >= sprite.range) {
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
}

function _nearestEnemies(enemies, x, y, count) {
  return enemies.getChildren()
    .filter(e => e.active && !e.dying)
    .map(e => ({ e, d: Phaser.Math.Distance.Between(x, y, e.x, e.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map(({ e }) => e)
}
