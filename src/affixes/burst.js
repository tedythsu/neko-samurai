// src/affixes/burst.js
import Enemy from '../entities/Enemy.js'
import Phaser from 'phaser'

export default {
  id:   'burst',
  name: '爆裂',
  desc: '命中時有機率：在周圍造成爆炸',

  onHit(enemy, damage, scene) {
    if (Math.random() > 0.20) return
    const radius = scene._affixCounts?.has('burst2') ? 60 : 40
    scene._enemies.getChildren()
      .filter(e => e.active && !e.dying && e !== enemy &&
        Phaser.Math.Distance.Between(enemy.x, enemy.y, e.x, e.y) < radius)
      .forEach(e => Enemy.takeDamage(e, damage * 0.4, enemy.x, enemy.y, [], 0))

    const g = scene.add.graphics().setDepth(10)
    g.lineStyle(2, 0xff4400, 0.8)
    g.strokeCircle(enemy.x, enemy.y, radius)
    scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() })
  },
}
