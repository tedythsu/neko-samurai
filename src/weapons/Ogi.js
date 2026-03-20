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
    knockback: 200,
  },

  upgrades: [
    { id: 'dmg',   name: '扇 傷害 +25%',    desc: '', apply: s => { s.damage   *= 1.25 } },
    { id: 'range', name: '扇 攻擊範圍 +20%', desc: '', apply: s => { s.range    = Math.min(180, s.range * 1.20) } },
    { id: 'speed', name: '扇 攻擊速度 +20%', desc: '', apply: s => { s.fireRate = Math.max(200, s.fireRate * 0.80) } },
    { id: 'whirlwind', name: '旋風', desc: '扇形持續旋轉一整圈（800ms）',            apply: s => { s._whirlwind = true } },
    { id: 'shockwave', name: '衝波', desc: '結束後發出擴張衝擊波（0.5倍傷害）',     apply: s => { s._shockwave = true } },
  ],

  createTexture(_scene) { /* no persistent texture — arc is drawn with Graphics */ },

  fire(scene, _pool, fromX, fromY, stats, enemies, player, affixes = []) {
    const isShinigami = stats._evo === 'shinigami'
    const hitSet  = new Set()
    let elapsed   = 0
    const duration = stats._whirlwind ? 800 : 400
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

    const g = scene.add.graphics().setDepth(6)

    const updateFn = (_, delta) => {
      elapsed += delta
      const t = Math.min(elapsed / duration, 1)

      // 旋風: rotate facing angle each frame for full 360
      if (stats._whirlwind) facingDeg = (facingDeg + delta * (360 / duration)) % 360

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
            Enemy.takeDamage(e, stats.damage, player.x, player.y, affixes, stats.knockback ?? 200)
            // 死神扇 evo — force curse on hit
            if (isShinigami && e._statusEffects && e._statusEffects.curse) {
              e._statusEffects.curse.active = true
              e._statusEffects.curse.timer  = 4000
            }
          }
        })

      if (elapsed >= duration) {
        scene.events.off('update', updateFn)
        g.destroy()

        // 衝波 — expanding ring after swing
        if (stats._shockwave) {
          const shockHit = new Set()
          const sg = scene.add.graphics().setDepth(6)
          let r = 0
          const shockFn = (_, dt) => {
            r = Math.min(stats.range, r + stats.range * dt / 300)
            sg.clear().setPosition(player.x, player.y)
            sg.lineStyle(3, 0xff8800, 0.8)
            sg.strokeCircle(0, 0, r)
            enemies.getChildren().filter(e => e.active && !e.dying && !shockHit.has(e)).forEach(e => {
              const d = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y)
              if (Math.abs(d - r) < 18) {
                shockHit.add(e)
                Enemy.takeDamage(e, stats.damage * 0.5, player.x, player.y, affixes, 0)
              }
            })
            if (r >= stats.range) {
              scene.events.off('update', shockFn)
              sg.destroy()
            }
          }
          scene.events.on('update', shockFn)
        }
      }
    }
    scene.events.on('update', updateFn)
  },

  update() {},
}
