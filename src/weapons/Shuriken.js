// src/weapons/Shuriken.js
import Phaser from 'phaser'
import { getOrCreate } from './_pool.js'

export default {
  id: 'shuriken',
  name: '手裏剣',
  desc: '均衡型・全方位放射',
  texKey: 'shuriken-tex',

  baseStats: {
    damage: 20,
    fireRate: 800,
    projectileCount: 3,
    range: 300,
    speed: 400,
    penetrate: false,
  },

  upgrades: [
    { id: 'dmg',       name: '手裏剣強化', desc: '傷害 +20%',  apply: s => { s.damage         *= 1.20 } },
    { id: 'firerate',  name: '連射',       desc: '射速 +25%',  apply: s => { s.fireRate        *= 0.75 } },
    { id: 'multishot', name: '雙發',       desc: '投擲數 +1',  apply: s => { s.projectileCount += 1 } },
    { id: 'range',     name: '遠投',       desc: '射程 +25%',  apply: s => { s.range           *= 1.25 } },
  ],

  createTexture(scene) {
    if (scene.textures.exists('shuriken-tex')) return
    const rt = scene.add.renderTexture(0, 0, 12, 12)
    rt.fill(0x222244)
    rt.saveTexture('shuriken-tex')
    rt.destroy()
  },

  fire(scene, pool, fromX, fromY, stats /*, enemies unused */) {
    for (let i = 0; i < stats.projectileCount; i++) {
      const s = getOrCreate(pool, fromX, fromY, this.texKey)
      s.damage    = stats.damage
      s.hitSet    = new Set()
      s.spawnX    = fromX
      s.spawnY    = fromY
      s.range     = stats.range
      s.penetrate = stats.penetrate

      const deg = (360 / stats.projectileCount) * i
      scene.physics.velocityFromAngle(deg, stats.speed, s.body.velocity)
    }
  },

  update(sprite) {
    if (!sprite.active) return
    sprite.angle += 8
    if (Phaser.Math.Distance.Between(sprite.spawnX, sprite.spawnY, sprite.x, sprite.y) >= sprite.range) {
      sprite.disableBody(true, true)
    }
  },
}
