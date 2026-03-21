// src/weapons/Tachi.js
import Phaser from 'phaser'
import Enemy   from '../entities/Enemy.js'

export default {
  id: 'tachi',
  name: '太刀',
  iconKey: 'tachi-slash',
  iconFrame: 0,

  baseStats: {
    damage:    20,
    fireRate:  1500,
    range:     50,
    knockback: 120,
    // projectileCount / speed / penetrate not used by melee
  },

  upgrades: [
    { id: 'dmg',      name: '太刀 傷害 +25%',    desc: '', apply: s => { s.damage   *= 1.25 } },
    { id: 'firerate', name: '太刀 攻擊速度 +20%', desc: '', apply: s => { s.fireRate  = Math.max(200, s.fireRate * 0.80) } },
    { id: 'range',    name: '太刀 攻擊範圍 +30%', desc: '', apply: s => { s.range     = Math.min(100, s.range * 1.30) } },
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

  fire(scene, _pool, fromX, fromY, stats, enemies, player, affixes = []) {
    // 蓄力: block re-entry during pending slash
    if (stats._charge && stats._pendingCharge) return
    if (stats._charge) stats._pendingCharge = true

    const doSlash = () => {
      const isMuramasa = stats._evo === 'muramasa'
      const range  = stats.range  * (stats._charge ? 2 : 1) * (isMuramasa ? 1.5 : 1)
      const damage = stats.damage * (stats._charge ? 1.5 : 1) * (isMuramasa ? 1.3 : 1)

      // 疾旋: count nearby enemies once
      let dmgMult = 1
      if (stats._rapidVortex) {
        const nearbyCount = enemies.getChildren()
          .filter(e => e.active && !e.dying &&
            Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y) < 150).length
        dmgMult = 1 + Math.min(4, nearbyCount) * 0.25
      }

      // 旋風: whirlwind doubles slash duration
      const slashDuration = stats._whirlwind ? 800 : 500
      let facingDeg = 0
      let elapsedWhirl = 0

      const scale  = (range * 2) / 166
      const hitSet = new Set()

      const slash = scene.add.sprite(player.x, player.y, 'tachi-slash', 0)
        .setDepth(6).setOrigin(0.5, 0.5).setScale(scale)

      const onUpdate = (_, delta) => {
        if (stats._whirlwind) {
          elapsedWhirl += delta
          facingDeg = (facingDeg + delta * (360 / slashDuration)) % 360
        }
        slash.setPosition(player.x, player.y)
        enemies.getChildren()
          .filter(e => e.active && !e.dying && !hitSet.has(e) &&
            Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y) < range)
          .forEach(e => {
            hitSet.add(e)
            const killed = Enemy.takeDamage(e, damage * dmgMult, player.x, player.y, affixes, stats.knockback ?? 120)
            // 妖刀村正 evo — heal on each hit
            if (isMuramasa && scene._player) scene._player.heal(damage * 0.30)
            // 命運印記 — mark enemy for deferred explosion
            if (stats._doom) {
              e._doomTimer  = scene.time.now + 2000
              e._doomDamage = damage * dmgMult * 1.5
              e._doomRadius = 60
            }
            // 死爆 — burst on kill
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
          })
      }

      scene.events.on('update', onUpdate)
      slash.play('tachi-slash')
      scene.tweens.add({ targets: slash, angle: 360, duration: slashDuration, ease: 'Linear' })

      slash.once('animationcomplete', () => {
        scene.events.off('update', onUpdate)
        stats._pendingCharge = false

        // 殘像 (afterimage) or 妖刀村正 — leave damage zone
        if (stats._afterimage || isMuramasa) {
          const sx = player.x, sy = player.y
          const zoneW = range, zoneH = range * 0.4
          const shadowColor = isMuramasa ? 0x880000 : 0x00ccff
          const g = scene.add.graphics().setDepth(5)
          g.fillStyle(shadowColor, 0.35)
          g.fillRect(sx - zoneW / 2, sy - zoneH / 2, zoneW, zoneH)
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
            g.destroy()
          }
          scene.time.delayedCall(1000, cleanupShadow)
          scene.events.once('shutdown', cleanupShadow)
        }

        // 衝波 — expanding ring
        if (stats._shockwave) {
          const shockHit = new Set()
          const sg = scene.add.graphics().setDepth(6)
          let r = 0
          const shockFn = (_, dt) => {
            r = Math.min(range, r + range * dt / 300)
            sg.clear().setPosition(player.x, player.y)
            sg.lineStyle(3, 0x88ccff, 0.8)
            sg.strokeCircle(0, 0, r)
            enemies.getChildren().filter(e => e.active && !e.dying && !shockHit.has(e)).forEach(e => {
              const d = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y)
              if (Math.abs(d - r) < 18) {
                shockHit.add(e)
                Enemy.takeDamage(e, damage * 0.5, player.x, player.y, affixes, 0)
              }
            })
            if (r >= range) {
              scene.events.off('update', shockFn)
              sg.destroy()
            }
          }
          scene.events.on('update', shockFn)
        }

        slash.destroy()
      })
    }

    if (stats._charge) {
      scene.time.delayedCall(300, doSlash)
    } else {
      doSlash()
    }
  },

  // No projectiles to update
  update(/* sprite */) {},
}
