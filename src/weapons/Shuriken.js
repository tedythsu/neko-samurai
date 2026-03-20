// src/weapons/Shuriken.js
import Phaser from 'phaser'
import { getOrCreate } from './_pool.js'

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
    _scale: 1.0,
  },

  upgrades: [
    { id: 'dmg',       name: '手裏剣 傷害 +20%',    desc: '', apply: s => { s.damage         *= 1.20 } },
    { id: 'firerate',  name: '手裏剣 攻擊速度 +25%', desc: '', apply: s => { s.fireRate        = Math.max(200, s.fireRate * 0.75) } },
    { id: 'multishot', name: '手裏剣 投射數 +1',     desc: '', apply: s => { s.projectileCount = Math.min(5, s.projectileCount + 1) } },
    { id: 'scale',     name: '手裏剣 體積 +30%',     desc: '', apply: s => { s._scale = Math.min(2.0, s._scale * 1.30) } },
  ],

  createTexture() { /* loaded in GameScene.preload() */ },

  fire(scene, pool, fromX, fromY, stats /*, enemies unused */) {
    for (let i = 0; i < stats.projectileCount; i++) {
      const s = getOrCreate(pool, fromX, fromY, this.texKey)
      const baseW = 28, baseH = 28
      s.setDisplaySize(baseW * stats._scale, baseH * stats._scale)
      s.body.setSize(64 * stats._scale, 64 * stats._scale, true)  // hitbox larger than visual, centered
      s.damage    = stats.damage
      s.hitSet    = new Set()
      s.spawnX    = fromX
      s.spawnY    = fromY
      s.range     = 300            // fixed travel range
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
