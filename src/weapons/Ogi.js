// src/weapons/Ogi.js
import Phaser from 'phaser'
import Enemy  from '../entities/Enemy.js'

export default {
  id:       'ogi',
  name:     '扇',
  iconChar: '扇',

  baseStats: {
    damage:   18,
    fireRate: 1200,
    range:    90,
    knockback: 200,
  },

  upgrades: [
    { id: 'dmg',   name: '扇 傷害 +25%',    desc: '', apply: s => { s.damage   *= 1.25 } },
    { id: 'speed', name: '扇 攻擊速度 +20%', desc: '', apply: s => { s.fireRate = Math.max(200, s.fireRate * 0.80) } },
  ],

  createTexture(_scene) { /* no persistent texture — arc is drawn with Graphics */ },

  fire(scene, _pool, fromX, fromY, stats, enemies, player, affixes = []) {
    if (stats._charge && stats._pendingCharge) return
    if (stats._charge) stats._pendingCharge = true

    const _doFire = () => {
      const isShinigami = stats._evo === 'shinigami'
      const localRange  = stats.range  * (stats._charge ? 2 : 1)
      const localDamage = stats.damage * (stats._charge ? 1.5 : 1)

      // 疾旋 multiplier
      let dmgMult = 1
      if (stats._rapidVortex) {
        const nearbyCount = enemies.getChildren()
          .filter(e => e.active && !e.dying &&
            Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y) < 150).length
        dmgMult = 1 + Math.min(4, nearbyCount) * 0.25
      }

      const hitSet = new Set()
      let elapsed  = 0
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
          g.lineTo(Math.cos(a) * localRange, Math.sin(a) * localRange)
        }
        g.closePath()
        g.fillPath()

        enemies.getChildren()
          .filter(e => e.active && !e.dying && !hitSet.has(e))
          .forEach(e => {
            const dist = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y)
            if (dist > localRange) return
            const angleDeg = Phaser.Math.RadToDeg(
              Phaser.Math.Angle.Between(player.x, player.y, e.x, e.y))
            const diff = Phaser.Math.Wrap(angleDeg - facingDeg, -180, 180)
            if (Math.abs(diff) <= 60) {
              hitSet.add(e)
              const killed = Enemy.takeDamage(e, localDamage * dmgMult, player.x, player.y, affixes, stats.knockback ?? 200)
              // 死神扇 evo — force curse on hit
              if (isShinigami && e._statusEffects && e._statusEffects.curse) {
                e._statusEffects.curse.active = true
                e._statusEffects.curse.timer  = 4000
              }
              // 命運印記
              if (stats._doom) {
                e._doomTimer  = scene.time.now + 2000
                e._doomDamage = localDamage * dmgMult * 1.5
                e._doomRadius = 60
              }
              // 死爆
              if (killed && stats._deathBurst) {
                const br = 60
                enemies.getChildren()
                  .filter(en => en.active && !en.dying && en !== e &&
                    Phaser.Math.Distance.Between(e.x, e.y, en.x, en.y) < br)
                  .forEach(en => Enemy.takeDamage(en, localDamage * dmgMult, e.x, e.y, affixes, 0))
                const bg = scene.add.graphics().setDepth(10)
                bg.lineStyle(2, 0xff0000, 0.9)
                bg.strokeCircle(e.x, e.y, br)
                scene.tweens.add({ targets: bg, alpha: 0, duration: 250, onComplete: () => bg.destroy() })
              }
            }
          })

        if (elapsed >= duration) {
          scene.events.off('update', updateFn)
          g.destroy()
          stats._pendingCharge = false

          // 殘像 afterimage zone
          if (stats._afterimage) {
            const sx = player.x, sy = player.y
            const zoneW = localRange, zoneH = localRange * 0.4
            const ag = scene.add.graphics().setDepth(5)
            ag.fillStyle(0x00ccff, 0.35)
            ag.fillRect(sx - zoneW / 2, sy - zoneH / 2, zoneW, zoneH)
            const damageCd = new Map()
            const afterHit = () => {
              const now = scene.time.now
              enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
                if (Math.abs(e.x - sx) < zoneW / 2 && Math.abs(e.y - sy) < zoneH / 2) {
                  const last = damageCd.get(e) || 0
                  if (now - last >= 300) {
                    damageCd.set(e, now)
                    Enemy.takeDamage(e, localDamage * 0.5, sx, sy, affixes, 0)
                  }
                }
              })
            }
            scene.events.on('update', afterHit)
            const cleanupAfter = () => {
              scene.events.off('update', afterHit)
              ag.destroy()
            }
            scene.time.delayedCall(1000, cleanupAfter)
            scene.events.once('shutdown', cleanupAfter)
          }

          // 衝波 — existing shockwave code
          if (stats._shockwave) {
            const shockHit = new Set()
            const sg = scene.add.graphics().setDepth(6)
            let r = 0
            const shockFn = (_, dt) => {
              r = Math.min(localRange, r + localRange * dt / 300)
              sg.clear().setPosition(player.x, player.y)
              sg.lineStyle(3, 0xff8800, 0.8)
              sg.strokeCircle(0, 0, r)
              enemies.getChildren().filter(e => e.active && !e.dying && !shockHit.has(e)).forEach(e => {
                const d = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y)
                if (Math.abs(d - r) < 18) {
                  shockHit.add(e)
                  Enemy.takeDamage(e, localDamage * 0.5, player.x, player.y, affixes, 0)
                }
              })
              if (r >= localRange) {
                scene.events.off('update', shockFn)
                sg.destroy()
              }
            }
            scene.events.on('update', shockFn)
          }
        }
      }
      scene.events.on('update', updateFn)
    }

    if (stats._charge) {
      scene.time.delayedCall(300, _doFire)
    } else {
      _doFire()
    }
  },

  update() {},
}
