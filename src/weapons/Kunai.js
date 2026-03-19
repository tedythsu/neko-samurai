// src/weapons/Kunai.js
import Phaser from 'phaser'
import { getOrCreate } from './_pool.js'

export default {
  id: 'kunai',
  name: '苦無',
  desc: '速射型・精確追蹤',
  texKey: 'kunai-tex',

  baseStats: {
    damage: 8,
    fireRate: 350,
    projectileCount: 1,
    range: 500,
    speed: 600,
    penetrate: false,
  },

  upgrades: [
    { id: 'dmg',       name: '苦無強化', desc: '傷害 +25%',       apply: s => { s.damage         *= 1.25 } },
    { id: 'firerate',  name: '連投',     desc: '射速 +20%',       apply: s => { s.fireRate        *= 0.80 } },
    { id: 'multishot', name: '複數標的', desc: '同時鎖定 +1 敵人', apply: s => { s.projectileCount += 1 } },
    { id: 'penetrate', name: '穿透',     desc: '貫穿敵人',         apply: s => { s.penetrate = true } },
    { id: 'range',     name: '長射程',   desc: '射程 +20%',       apply: s => { s.range           *= 1.20 } },
  ],

  createTexture(scene) {
    if (scene.textures.exists('kunai-tex')) return
    const rt = scene.add.renderTexture(0, 0, 4, 14)
    rt.fill(0x666688)
    rt.saveTexture('kunai-tex')
    rt.destroy()
  },

  fire(scene, pool, fromX, fromY, stats, enemies) {
    const targets = _nearestEnemies(enemies, fromX, fromY, stats.projectileCount)
    if (targets.length === 0) return
    targets.forEach(target => {
      const s = getOrCreate(pool, fromX, fromY, this.texKey)
      s.damage    = stats.damage
      s.hitSet    = new Set()
      s.spawnX    = fromX
      s.spawnY    = fromY
      s.range     = stats.range
      s.penetrate = stats.penetrate

      const angle = Phaser.Math.Angle.Between(fromX, fromY, target.x, target.y)
      scene.physics.velocityFromAngle(
        Phaser.Math.RadToDeg(angle), stats.speed, s.body.velocity
      )
    })
  },

  update(sprite) {
    if (!sprite.active) return
    // Rotate to face travel direction for visual clarity
    sprite.rotation = Math.atan2(sprite.body.velocity.y, sprite.body.velocity.x)
    if (Phaser.Math.Distance.Between(sprite.spawnX, sprite.spawnY, sprite.x, sprite.y) >= sprite.range) {
      sprite.disableBody(true, true)
    }
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
