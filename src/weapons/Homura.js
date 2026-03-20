// src/weapons/Homura.js
import Phaser     from 'phaser'
import { getOrCreate } from './_pool.js'

export default {
  id:     'homura',
  name:   '炎矢',
  desc:   '大型炎彈・爆炸傷害',
  texKey: 'homura-tex',

  baseStats: {
    damage:          25,
    fireRate:        2500,
    projectileCount: 1,
    range:           700,
    speed:           200,
    penetrate:       false,
    _explodeRadius:  80,
  },

  upgrades: [
    { id: 'dmg',    name: '炎矢 傷害 +25%',    desc: '', apply: s => { s.damage          *= 1.25 } },
    { id: 'radius', name: '炎矢 爆炸範圍 +20px', desc: '', apply: s => { s._explodeRadius = Math.min(140, s._explodeRadius + 20) } },
    { id: 'multi',  name: '炎矢 投射數 +1',     desc: '', apply: s => { s.projectileCount = Math.min(5, s.projectileCount + 1) } },
  ],

  createTexture(scene) {
    if (scene.textures.exists('homura-tex')) return
    const rt = scene.add.renderTexture(0, 0, 24, 24)
    rt.fill(0xdd2200)
    rt.saveTexture('homura-tex')
    rt.destroy()
  },

  fire(scene, pool, fromX, fromY, stats, enemies) {
    const targets = _nearestEnemies(enemies, fromX, fromY, stats.projectileCount)
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
      s._explodeRadius = stats._explodeRadius
      s._explodeMult   = 1.2

      const angle = Phaser.Math.Angle.Between(fromX, fromY, target.x, target.y)
      scene.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), stats.speed, s.body.velocity)
    })
  },

  update(sprite) {
    if (!sprite.active) return
    sprite.rotation += 0.1
    if (Phaser.Math.Distance.Between(sprite.spawnX, sprite.spawnY, sprite.x, sprite.y) >= sprite.range) {
      sprite.disableBody(true, true)
    }
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
