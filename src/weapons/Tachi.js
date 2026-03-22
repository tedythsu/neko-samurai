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
    const doSlash = (chainMult = 1) => {
      const isChain  = chainMult < 1
      const range    = stats.range
      const damage   = stats.damage * chainMult
      const arcMult  = isChain ? 1 : (stats._arcMult || 1)
      const sweepTotal = Math.min(360, 180 * arcMult)
      const duration   = sweepTotal >= 360 ? 560 : 280

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

      const startDeg = facingDeg - sweepTotal / 2
      const hitSet   = new Set()
      let elapsed    = 0
      const SEGS     = 8

      const g = scene.add.graphics().setDepth(6)
      const bladeImg = scene.add.image(player.x, player.y, 'tachi')
        .setDepth(7).setOrigin(0.5, 1)
      bladeImg.setScale(range / bladeImg.height)

      // Guard visual during combo strike
      let guardOverlay = null
      if (!isChain && stats._comboGuard) {
        scene._tachiComboGuardActive = true
        scene._tachiComboGuardMult   = 1 - stats._comboGuard
      }

      const updateFn = (_, delta) => {
        elapsed += delta
        const t          = Math.min(elapsed / duration, 1)
        const currentDeg = startDeg + sweepTotal * t
        const leadRad    = Phaser.Math.DegToRad(currentDeg)

        bladeImg.setPosition(player.x, player.y)
        bladeImg.setRotation(leadRad + Math.PI / 2)

        g.clear()
        g.setPosition(player.x, player.y)

        g.fillStyle(0xddeeff, 0.28 * (1 - t))
        g.beginPath()
        g.moveTo(0, 0)
        for (let i = 0; i <= SEGS; i++) {
          const a = Phaser.Math.DegToRad(startDeg + sweepTotal * t * i / SEGS)
          g.lineTo(Math.cos(a) * range, Math.sin(a) * range)
        }
        g.closePath()
        g.fillPath()

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

        enemies.getChildren()
          .filter(e => e.active && !e.dying && !hitSet.has(e))
          .forEach(e => {
            if (Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y) > range) return
            const eDeg = Phaser.Math.RadToDeg(
              Phaser.Math.Angle.Between(player.x, player.y, e.x, e.y))
            const norm = ((eDeg - startDeg) % 360 + 360) % 360
            if (norm <= sweepTotal * t) {
              hitSet.add(e)
              Enemy.takeDamage(e, damage, player.x, player.y, affixes, stats.knockback ?? 120)
            }
          })

        if (elapsed >= duration) {
          scene.events.off('update', updateFn)
          g.destroy()
          bladeImg.destroy()
          if (guardOverlay) guardOverlay.destroy()
          scene._tachiComboGuardActive = false

          // 極意・連斬 — second strike
          const chance = stats._doubleStrikeChance ?? 0.35
          if (!isChain && stats._doubleStrike && hitSet.size > 0 && Math.random() < chance) {
            scene.time.delayedCall(120, () => doSlash(0.75))
          }

          // 鐮鼬・真空 — 3 wind blades
          if (!isChain && stats._windBlade) {
            _fireWindBlades(scene, player, facingDeg, damage * 0.5, affixes, enemies)
          }
        }
      }

      scene.events.on('update', updateFn)
    }

    doSlash()
  },

  update() {},
}

function _fireWindBlades(scene, player, facingDeg, damage, affixes, enemies) {
  const BLADE_SPEED = 500
  const MAX_DIST    = 500
  const spreadAngles = [-20, 0, 20]
  spreadAngles.forEach(offset => {
    const dir = Phaser.Math.DegToRad(facingDeg + offset)
    const hitSet = new Set()
    let wx = player.x, wy = player.y, dist = 0

    const sg = scene.add.graphics().setDepth(6)
    const fn = (_, dt) => {
      const step = BLADE_SPEED * dt / 1000
      wx += Math.cos(dir) * step
      wy += Math.sin(dir) * step
      dist += step
      const alpha = 1 - dist / MAX_DIST

      sg.clear().setPosition(wx, wy)
      sg.lineStyle(3, 0x88ffcc, alpha)
      sg.beginPath()
      sg.arc(0, 0, 18, dir - 0.8, dir + 0.8, false)
      sg.strokePath()

      enemies.getChildren().filter(e => e.active && !e.dying && !hitSet.has(e)).forEach(e => {
        if (Phaser.Math.Distance.Between(wx, wy, e.x, e.y) < 22) {
          hitSet.add(e)
          Enemy.takeDamage(e, damage, wx, wy, affixes, 40)
        }
      })

      if (dist >= MAX_DIST) {
        scene.events.off('update', fn)
        sg.destroy()
      }
    }
    scene.events.on('update', fn)
  })
}
