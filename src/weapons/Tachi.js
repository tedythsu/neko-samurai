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

  // No texture needed for melee
  createTexture(/* scene */) {},

  fire(scene, _pool, fromX, fromY, stats, enemies) {
    // Damage all active enemies within range
    enemies.getChildren()
      .filter(e => e.active &&
        Phaser.Math.Distance.Between(fromX, fromY, e.x, e.y) < stats.range)
      .forEach(e => Enemy.takeDamage(e, stats.damage))

    // Visual: fading ring at player position
    const ring = scene.add.graphics().setDepth(6)
    ring.lineStyle(3, 0x88aaff, 1)
    ring.strokeCircle(fromX, fromY, stats.range)
    scene.tweens.add({
      targets: ring,
      alpha: 0,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 280,
      ease: 'Sine.Out',
      onComplete: () => ring.destroy(),
    })
  },

  // No projectiles to update
  update(/* sprite */) {},
}
