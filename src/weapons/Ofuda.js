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
    knockback:      80,
  },

  upgrades: [
    { id: 'dmg',   name: '霊符 傷害 +25%',  desc: '', apply: s => { s.damage          *= 1.25 } },
    { id: 'speed', name: '霊符 追蹤速度 +30%', desc: '', apply: s => { s.speed = Math.min(450, s.speed * 1.30) } },
    { id: 'multi', name: '霊符 投射數 +1',   desc: '', apply: s => { s.projectileCount = Math.min(5, s.projectileCount + 1) } },
    { id: 'split',  name: '分裂', desc: '射程到達後分裂成3個小符（0.5倍傷害、無追蹤）', apply: s => { s._split = true } },
    { id: 'linger', name: '滯留', desc: '命中爆炸後留下2秒輻射區（0.2倍傷害/300ms）',   apply: s => { s._linger = true } },
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
      s._split      = stats._split
      s._splitFired = false
      s._linger     = stats._linger
      s._evoKaku    = stats._evo === 'kaku'
      // 核符 evo — force linger and bigger explosion
      if (s._evoKaku) {
        s._linger = true
        s._explodeRadius = 60 * 2.5
      }

      const angle = Phaser.Math.Angle.Between(fromX, fromY, target.x, target.y)
      scene.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), stats.speed, s.body.velocity)
    })
  },

  update(sprite) {
    if (!sprite.active) return

    // Out of range → expire (with optional split)
    if (Phaser.Math.Distance.Between(sprite.spawnX, sprite.spawnY, sprite.x, sprite.y) >= sprite.range) {
      if (sprite._split && !sprite._splitFired) {
        sprite._splitFired = true
        _doSplit(sprite)
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
}

function _nearestEnemies(enemies, x, y, count) {
  return enemies.getChildren()
    .filter(e => e.active && !e.dying)
    .map(e => ({ e, d: Phaser.Math.Distance.Between(x, y, e.x, e.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map(({ e }) => e)
}

function _doSplit(proj) {
  const scene     = proj.scene
  const baseAngle = Math.atan2(proj.body.velocity.y, proj.body.velocity.x)
  const group     = scene._weapons.find(w => w.weapon.id === 'ofuda')?.projectiles
  if (!group) return
  for (let i = -1; i <= 1; i++) {
    const s = getOrCreate(group, proj.x, proj.y, 'ofuda-tex')
    s.setDisplaySize(proj.displayWidth * 0.5, proj.displayHeight * 0.5)
    s.damage         = proj.damage * 0.5
    s.hitSet         = new Set()
    s.spawnX         = proj.x
    s.spawnY         = proj.y
    s.range          = 150
    s.penetrate      = false
    s._target        = null
    s._explodeRadius = 30
    s._explodeMult   = 1.5
    s._speed         = 250
    s._split         = false
    s._splitFired    = true
    s._linger        = false
    s._evoKaku       = false
    const angle = baseAngle + Phaser.Math.DegToRad(i * 45)
    scene.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), 250, s.body.velocity)
  }
}
