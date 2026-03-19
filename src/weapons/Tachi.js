// src/weapons/Tachi.js
import Phaser from 'phaser'
import Enemy   from '../entities/Enemy.js'

export default {
  id: 'tachi',
  name: '太刀',
  desc: '爆發型・近距揮砍',

  baseStats: {
    damage:    50,
    fireRate:  1500,
    range:     150,
    // projectileCount / speed / penetrate not used by melee
  },

  upgrades: [
    { id: 'dmg',      name: '太刀強化', desc: '傷害 +25%', apply: s => { s.damage   *= 1.25 } },
    { id: 'firerate', name: '居合',     desc: '揮速 +20%', apply: s => { s.fireRate *= 0.80 } },
    { id: 'range',    name: '斬擊延伸', desc: '射程 +30%', apply: s => { s.range    *= 1.30 } },
  ],

  createTexture(scene) {
    if (scene.anims.exists('tachi-slash')) return
    scene.anims.create({
      key: 'tachi-slash',
      frames: scene.anims.generateFrameNumbers('tachi-slash', { start: 0, end: 5 }),
      frameRate: 18,   // 6 frames ≈ 333ms total
      repeat: 0,       // play once
    })
  },

  fire(scene, _pool, fromX, fromY, stats, enemies) {
    // Damage all active enemies within range
    enemies.getChildren()
      .filter(e => e.active &&
        Phaser.Math.Distance.Between(fromX, fromY, e.x, e.y) < stats.range)
      .forEach(e => Enemy.takeDamage(e, stats.damage))

    // Visual: sprite animation centered on player, scaled to match range
    const scale = (stats.range * 2) / 206   // frame is 206px wide, range is radius
    const slash = scene.add.sprite(fromX, fromY, 'tachi-slash', 0)
      .setDepth(6)
      .setOrigin(0.5, 0.5)
      .setScale(scale)
    slash.play('tachi-slash')
    slash.once('animationcomplete', () => slash.destroy())
  },

  // No projectiles to update
  update(/* sprite */) {},
}
