// src/weapons/Tachi.js
import Phaser from 'phaser'
import Enemy   from '../entities/Enemy.js'

export default {
  id: 'tachi',
  name: '太刀',
  desc: '爆發型・近距揮砍',

  baseStats: {
    damage:    20,
    fireRate:  1500,
    range:     50,
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
      frames: scene.anims.generateFrameNumbers('tachi-slash', { start: 0, end: 7 }),
      frameRate: 16,   // 8 frames ≈ 500ms total
      repeat: 0,       // play once
    })
  },

  fire(scene, _pool, fromX, fromY, stats, enemies, player) {
    const scale  = (stats.range * 2) / 166
    const hitSet = new Set()

    const slash = scene.add.sprite(fromX, fromY, 'tachi-slash', 0)
      .setDepth(6)
      .setOrigin(0.5, 0.5)
      .setScale(scale)

    // Follow player and check hits each frame during the animation
    const onUpdate = () => {
      slash.setPosition(player.x, player.y)
      enemies.getChildren()
        .filter(e => e.active && !e.dying && !hitSet.has(e) &&
          Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y) < stats.range)
        .forEach(e => { hitSet.add(e); Enemy.takeDamage(e, stats.damage, player.x, player.y) })
    }

    scene.events.on('update', onUpdate)
    slash.play('tachi-slash')
    scene.tweens.add({ targets: slash, angle: 360, duration: 500, ease: 'Linear' })
    slash.once('animationcomplete', () => {
      scene.events.off('update', onUpdate)
      slash.destroy()
    })
  },

  // No projectiles to update
  update(/* sprite */) {},
}
