// src/weapons/Tachi.js
import Phaser from 'phaser'
import { getOrCreate } from './_pool.js'

export default {
  id: 'tachi',
  name: '太刀',
  desc: '爆発型・近距大範囲',
  texKey: 'tachi-tex',

  baseStats: {
    damage: 50,
    fireRate: 1500,
    projectileCount: 8,
    range: 150,
    speed: 350,
    penetrate: false,
  },

  upgrades: [
    { id: 'dmg',       name: '太刀強化', desc: '傷害 +25%',  apply: s => { s.damage         *= 1.25 } },
    { id: 'firerate',  name: '居合',     desc: '揮速 +20%',  apply: s => { s.fireRate        *= 0.80 } },
    { id: 'range',     name: '斬擊延伸', desc: '射程 +30%',  apply: s => { s.range           *= 1.30 } },
    { id: 'multishot', name: '刃密度',   desc: '斬擊數 +2',  apply: s => { s.projectileCount += 2 } },
  ],

  createTexture(scene) {
    if (scene.textures.exists('tachi-tex')) return
    const rt = scene.add.renderTexture(0, 0, 18, 6)
    rt.fill(0x88aaff)
    rt.saveTexture('tachi-tex')
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
    sprite.angle += 12   // faster spin than shuriken for visual impact
    if (Phaser.Math.Distance.Between(sprite.spawnX, sprite.spawnY, sprite.x, sprite.y) >= sprite.range) {
      sprite.disableBody(true, true)
    }
  },
}
