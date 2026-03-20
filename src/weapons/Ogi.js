// src/weapons/Ogi.js
import Phaser from 'phaser'
import Enemy  from '../entities/Enemy.js'

export default {
  id:   'ogi',
  name: '扇',
  desc: '扇型揮擊・廣域近戰',

  baseStats: {
    damage:   18,
    fireRate: 1200,
    range:    90,
  },

  upgrades: [
    { id: 'dmg',   name: '扇 傷害 +25%',    desc: '', apply: s => { s.damage   *= 1.25 } },
    { id: 'range', name: '扇 攻擊範圍 +20%', desc: '', apply: s => { s.range    = Math.min(180, s.range * 1.20) } },
    { id: 'speed', name: '扇 攻擊速度 +20%', desc: '', apply: s => { s.fireRate = Math.max(200, s.fireRate * 0.80) } },
  ],

  createTexture(_scene) { /* no persistent texture — arc is drawn with Graphics */ },

  fire(scene, _pool, fromX, fromY, stats, enemies, player, affixes = []) {
    const hitSet = new Set()
    let elapsed  = 0
    const activeEnemies = enemies.getChildren().filter(e => e.active && !e.dying)
    let facingDeg
    if (activeEnemies.length > 0) {
      const nearest = activeEnemies.reduce((best, e) => {
        const d = Phaser.Math.Distance.Between(fromX, fromY, e.x, e.y)
        return d < best.d ? { e, d } : best
      }, { e: null, d: Infinity }).e
      facingDeg = Phaser.Math.RadToDeg(
        Phaser.Math.Angle.Between(fromX, fromY, nearest.x, nearest.y))
    } else {
      facingDeg = player.sprite.flipX ? 180 : 0
    }

    // Fan arc Graphics object
    const g = scene.add.graphics().setDepth(6)

    const updateFn = (_, delta) => {
      elapsed += delta
      const t = Math.min(elapsed / 400, 1)

      g.clear()
      g.setPosition(player.x, player.y)
      g.fillStyle(0xff8800, 0.45 * (1 - t))
      g.beginPath()
      g.moveTo(0, 0)
      const segs = 12
      for (let i = 0; i <= segs; i++) {
        const a = Phaser.Math.DegToRad(facingDeg - 60 + 120 * i / segs)
        g.lineTo(Math.cos(a) * stats.range, Math.sin(a) * stats.range)
      }
      g.closePath()
      g.fillPath()

      // Hit check each frame during the swing
      enemies.getChildren()
        .filter(e => e.active && !e.dying && !hitSet.has(e))
        .forEach(e => {
          const dist = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y)
          if (dist > stats.range) return
          const angleDeg = Phaser.Math.RadToDeg(
            Phaser.Math.Angle.Between(player.x, player.y, e.x, e.y))
          const diff = Phaser.Math.Wrap(angleDeg - facingDeg, -180, 180)
          if (Math.abs(diff) <= 60) {
            hitSet.add(e)
            Enemy.takeDamage(e, stats.damage, player.x, player.y, affixes)
          }
        })

      if (elapsed >= 400) {
        scene.events.off('update', updateFn)
        g.destroy()
      }
    }
    scene.events.on('update', updateFn)
  },

  update() {},
}
