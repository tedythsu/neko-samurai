// src/weapons/Tachi.js
import Phaser from 'phaser'
import Enemy  from '../entities/Enemy.js'

export default {
  id: 'tachi',
  name: '太刀',
  iconKey: 'tachi',

  baseStats: {
    damage:    20,
    fireRate:  1100,
    range:     90,
    knockback: 120,
  },

  upgrades: [],

  createTexture() { /* tachi.png loaded as static image in BootScene */ },

  fire(scene, _pool, fromX, fromY, stats, enemies, player, affixes = []) {
    if (stats._charge && stats._pendingCharge) return
    if (stats._charge) stats._pendingCharge = true

    // chainMult < 1 = second strike from 二刀連擊 (no further chaining, no charge)
    const doSlash = (chainMult = 1) => {
      const isMuramasa = stats._evo === 'muramasa'
      const isChain    = chainMult < 1
      const range      = stats.range  * (!isChain && stats._charge ? 2 : 1) * (isMuramasa ? 1.5 : 1)
      const damage     = stats.damage * (!isChain && stats._charge ? 1.5 : 1) * (isMuramasa ? 1.3 : 1) * chainMult
      // whirlwind → full 360° sweep; normal → 180° upward half-circle
      const duration   = stats._whirlwind && !isChain ? 560 : 280
      const sweepTotal = stats._whirlwind && !isChain ? 360 : 180
      const dmgMult    = 1

      // Aim toward nearest enemy; fall back to player facing
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

      // Arc starts 90° below facing, sweeps upward through facing to 90° above
      const startDeg = facingDeg - 90
      const hitSet   = new Set()
      let elapsed    = 0
      const SEGS     = 8

      const g = scene.add.graphics().setDepth(6)

      // Sword image — pivots at handle (bottom centre), blade sweeps forward
      const bladeImg = scene.add.image(player.x, player.y, 'tachi')
        .setDepth(7).setOrigin(0.5, 1)
      bladeImg.setScale(range / bladeImg.height)

      const updateFn = (_, delta) => {
        elapsed += delta
        const t          = Math.min(elapsed / duration, 1)
        const currentDeg = startDeg + sweepTotal * t
        const leadRad    = Phaser.Math.DegToRad(currentDeg)

        // Move blade with player, rotate to leading edge
        bladeImg.setPosition(player.x, player.y)
        bladeImg.setRotation(leadRad + Math.PI / 2)

        g.clear()
        g.setPosition(player.x, player.y)

        // Trailing filled arc (grows as sword sweeps, fades out)
        g.fillStyle(0xddeeff, 0.28 * (1 - t))
        g.beginPath()
        g.moveTo(0, 0)
        for (let i = 0; i <= SEGS; i++) {
          const a = Phaser.Math.DegToRad(startDeg + sweepTotal * t * i / SEGS)
          g.lineTo(Math.cos(a) * range, Math.sin(a) * range)
        }
        g.closePath()
        g.fillPath()

        // Outer arc edge stroke
        g.lineStyle(1, 0xaaccff, 0.4 * (1 - t))
        g.beginPath()
        for (let i = 0; i <= SEGS; i++) {
          const a = Phaser.Math.DegToRad(startDeg + sweepTotal * t * i / SEGS)
          const x = Math.cos(a) * range
          const y = Math.sin(a) * range
          if (i === 0) g.moveTo(x, y)
          else g.lineTo(x, y)
        }
        g.strokePath()

        // Hit detection: enemy is swept over when the arc passes their angle
        enemies.getChildren()
          .filter(e => e.active && !e.dying && !hitSet.has(e))
          .forEach(e => {
            if (Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y) > range) return
            const eDeg = Phaser.Math.RadToDeg(
              Phaser.Math.Angle.Between(player.x, player.y, e.x, e.y))
            // Normalise to [0, 360) relative to startDeg
            const norm = ((eDeg - startDeg) % 360 + 360) % 360
            if (norm <= sweepTotal * t) {
              hitSet.add(e)
              const killed = Enemy.takeDamage(e, damage * dmgMult, player.x, player.y, affixes, stats.knockback ?? 120)
              if (isMuramasa && scene._player) scene._player.heal(damage * 0.30)
              if (stats._doom) {
                e._doomTimer  = scene.time.now + 2000
                e._doomDamage = damage * dmgMult * 1.5
                e._doomRadius = 60
              }
              if (killed && stats._deathBurst) {
                const br = 60
                enemies.getChildren()
                  .filter(en => en.active && !en.dying && en !== e &&
                    Phaser.Math.Distance.Between(e.x, e.y, en.x, en.y) < br)
                  .forEach(en => Enemy.takeDamage(en, damage * dmgMult, e.x, e.y, affixes, 0))
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
          bladeImg.destroy()
          stats._pendingCharge = false

          // 二刀連擊 — 35% chance to slash again at 75% damage (no chain on second strike)
          if (!isChain && stats._doubleStrike && hitSet.size > 0 && Math.random() < 0.35) {
            scene.time.delayedCall(120, () => doSlash(0.75))
          }

          // 妖刀村正 — linger damage zone
          if (isMuramasa) {
            const sx = player.x, sy = player.y
            const zoneW = range, zoneH = range * 0.4
            const shadowColor = isMuramasa ? 0x880000 : 0x00ccff
            const gz = scene.add.graphics().setDepth(5)
            gz.fillStyle(shadowColor, 0.35)
            gz.fillRect(sx - zoneW / 2, sy - zoneH / 2, zoneW, zoneH)
            const damageCd = new Map()
            const shadowHit = () => {
              const now = scene.time.now
              enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
                if (Math.abs(e.x - sx) < zoneW / 2 && Math.abs(e.y - sy) < zoneH / 2) {
                  const last = damageCd.get(e) || 0
                  if (now - last >= 300) {
                    damageCd.set(e, now)
                    Enemy.takeDamage(e, damage * 0.5, sx, sy, affixes, 0)
                  }
                }
              })
            }
            scene.events.on('update', shadowHit)
            const cleanupShadow = () => {
              scene.events.off('update', shadowHit)
              gz.destroy()
            }
            scene.time.delayedCall(1000, cleanupShadow)
            scene.events.once('shutdown', cleanupShadow)
          }

          // 衝波 — 月牙劍氣，往斬擊方向飛出
          if (stats._shockwave) {
            const shockHit  = new Set()
            const sg        = scene.add.graphics().setDepth(7)
            const dir       = Phaser.Math.DegToRad(facingDeg)
            const SPEED     = 480   // px/s
            const MAX_DIST  = 420
            const ARC_R     = 40    // crescent radius
            const ARC_SPAN  = Math.PI * 0.7  // ±63° arc span
            let   dist      = 0
            let   wx        = player.x
            let   wy        = player.y

            const shockFn = (_, dt) => {
              dist += SPEED * dt / 1000
              wx   += Math.cos(dir) * SPEED * dt / 1000
              wy   += Math.sin(dir) * SPEED * dt / 1000
              const alpha = 1 - dist / MAX_DIST

              sg.clear().setPosition(wx, wy)

              // Outer dark halo
              sg.lineStyle(10, 0x000022, 0.35 * alpha)
              sg.beginPath()
              sg.arc(0, 0, ARC_R + 6, dir - ARC_SPAN, dir + ARC_SPAN, false)
              sg.strokePath()

              // Main crescent — dark indigo/blue
              sg.lineStyle(5, 0x223388, 0.9 * alpha)
              sg.beginPath()
              sg.arc(0, 0, ARC_R, dir - ARC_SPAN, dir + ARC_SPAN, false)
              sg.strokePath()

              // Inner highlight — bright cyan/white
              sg.lineStyle(2, 0x99ddff, alpha)
              sg.beginPath()
              sg.arc(0, 0, ARC_R - 6, dir - ARC_SPAN * 0.7, dir + ARC_SPAN * 0.7, false)
              sg.strokePath()

              // Hit detection — enemies close to the crescent centre
              enemies.getChildren().filter(e => e.active && !e.dying && !shockHit.has(e)).forEach(e => {
                if (Phaser.Math.Distance.Between(wx, wy, e.x, e.y) < ARC_R + 20) {
                  shockHit.add(e)
                  Enemy.takeDamage(e, damage * 0.6, wx, wy, affixes, 0)
                }
              })

              if (dist >= MAX_DIST) {
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
      scene.time.delayedCall(300, doSlash)
    } else {
      doSlash()
    }
  },

  update() {},
}
