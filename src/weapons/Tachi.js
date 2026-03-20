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
    knockback: 120,
    // projectileCount / speed / penetrate not used by melee
  },

  upgrades: [
    { id: 'dmg',      name: '太刀 傷害 +25%',    desc: '', apply: s => { s.damage   *= 1.25 } },
    { id: 'firerate', name: '太刀 攻擊速度 +20%', desc: '', apply: s => { s.fireRate  = Math.max(200, s.fireRate * 0.80) } },
    { id: 'range',    name: '太刀 攻擊範圍 +30%', desc: '', apply: s => { s.range     = Math.min(100, s.range * 1.30) } },
    { id: 'iaijutsu', name: '居合', desc: '延遲0.3秒→範圍×2、傷害×1.5（不可重疊蓄力）', apply: s => { s._iaijutsu = true } },
    { id: 'shadow',   name: '殘影', desc: '揮擊後留下1秒傷害殘影（0.6倍傷害，300ms間隔）', apply: s => { s._shadow = true } },
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
    // 居合: block re-entry during pending slash
    if (stats._iaijutsu && stats._pendingSlash) return
    if (stats._iaijutsu) stats._pendingSlash = true

    const doSlash = () => {
      const isMuramasa = stats._evo === 'muramasa'
      const range  = stats.range * (stats._iaijutsu ? 2 : 1) * (isMuramasa ? 1.5 : 1)
      const damage = stats.damage * (stats._iaijutsu ? 1.5 : 1) * (isMuramasa ? 1.3 : 1)

      const scale  = (range * 2) / 166
      const hitSet = new Set()

      const slash = scene.add.sprite(player.x, player.y, 'tachi-slash', 0)
        .setDepth(6).setOrigin(0.5, 0.5).setScale(scale)

      const onUpdate = () => {
        slash.setPosition(player.x, player.y)
        enemies.getChildren()
          .filter(e => e.active && !e.dying && !hitSet.has(e) &&
            Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y) < range)
          .forEach(e => {
            hitSet.add(e)
            Enemy.takeDamage(e, damage, player.x, player.y, affixes, stats.knockback ?? 120)
            // 妖刀村正 evo — heal on each hit
            if (isMuramasa && scene._player) scene._player.heal(damage * 0.30)
          })
      }

      scene.events.on('update', onUpdate)
      slash.play('tachi-slash')
      scene.tweens.add({ targets: slash, angle: 360, duration: 500, ease: 'Linear' })

      slash.once('animationcomplete', () => {
        scene.events.off('update', onUpdate)
        stats._pendingSlash = false

        // 殘影 or 妖刀村正 — leave damage zone at player position
        if (stats._shadow || isMuramasa) {
          const sx = player.x, sy = player.y
          const zoneW = range, zoneH = range * 0.4
          const shadowColor = isMuramasa ? 0x880000 : 0x4400aa
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
                  Enemy.takeDamage(e, damage * 0.6, sx, sy, affixes, 0)
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

        slash.destroy()
      })
    }

    if (stats._iaijutsu) {
      scene.time.delayedCall(300, doSlash)
    } else {
      doSlash()
    }
  },

  // No projectiles to update
  update(/* sprite */) {},
}
