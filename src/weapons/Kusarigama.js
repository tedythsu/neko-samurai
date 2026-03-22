// src/weapons/Kusarigama.js
import Phaser from 'phaser'
import Enemy  from '../entities/Enemy.js'
import { rollDamage } from './_pool.js'

export default {
  id:      'kusarigama',
  name:    '鎖鎌',
  iconKey: 'kusarigama',

  baseStats: {
    damage:         28,
    damageVariance: 0.12,
    fireRate:       0,
    projectileCount: 1,
    knockback:       0,
  },

  upgrades: [],

  createTexture() {},

  fire() {},
  update() {},

  updateActive(entry, scene, enemies, player, affixes, delta) {
    if (!entry.sickles) {
      entry.sickles     = []
      entry.damageCd    = new Map()
      entry._deflectCd  = 0
    }

    const SICKLE_LEN  = 80
    const CHAIN_Y     = 1.0
    const innerRadius = entry.stats._orbitRadius || SICKLE_LEN

    // Grow sickle array
    while (entry.sickles.length < entry.stats.projectileCount) {
      const img = scene.add.image(0, 0, 'kusarigama').setDepth(8)
      const aspect = img.width / img.height
      img.setDisplaySize(SICKLE_LEN * aspect, SICKLE_LEN).setOrigin(0.5, CHAIN_Y)
      entry.sickles.push(img)
    }

    const now       = scene.time.now
    const baseAngle = (now / 1000) * 180

    // 不壞・化勁 — periodic repel pulse every 2s
    if (entry.stats._deflect) {
      entry._deflectCd = (entry._deflectCd || 0) + (delta || 16)
      if (entry._deflectCd >= 2000) {
        entry._deflectCd = 0
        enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
          if (Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y) < innerRadius + 30) {
            const dx = e.x - player.x, dy = e.y - player.y
            const len = Math.hypot(dx, dy) || 1
            e.body.velocity.x = (dx / len) * 300
            e.body.velocity.y = (dy / len) * 300
            e.knockbackTimer = 200
          }
        })
        // Visual pulse
        const pg = scene.add.graphics().setDepth(7)
        pg.lineStyle(3, 0x00aaff, 0.8)
        pg.strokeCircle(player.x, player.y, innerRadius + 30)
        scene.tweens.add({ targets: pg, alpha: 0, scaleX: 1.3, scaleY: 1.3, duration: 300, onComplete: () => pg.destroy() })
      }
    }

    // Inner orbit positions
    const sicklePositions = []
    for (let i = 0; i < entry.sickles.length; i++) {
      const sickle = entry.sickles[i]
      const angle  = Phaser.Math.DegToRad(baseAngle + (360 / entry.sickles.length) * i)
      sickle.setPosition(player.x, player.y).setRotation(angle + Math.PI / 2)
      const sx = player.x + Math.cos(angle) * innerRadius * CHAIN_Y
      const sy = player.y + Math.sin(angle) * innerRadius * CHAIN_Y
      sicklePositions.push({ sx, sy, isHeavy: entry.stats._heavyBall && i === 0 })

      enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
        const hitR = entry.stats._heavyBall && i === 0 ? 35 : 20
        if (Phaser.Math.Distance.Between(sx, sy, e.x, e.y) < hitR) {
          const last = entry.damageCd.get(e) || 0
          if (now - last >= 550) {
            entry.damageCd.set(e, now)
            const rolledDmg = rollDamage(entry.stats)
            // 重鎚・碎裂 — heavy ball: extra damage + strong knockback
            const dmgMult = (entry.stats._heavyBall && i === 0) ? 2.0 : 1.0
            const kb      = entry.stats._aoeKnockback ? 200 : (entry.stats._heavyBall && i === 0 ? 300 : 0)
            Enemy.takeDamage(e, rolledDmg * dmgMult, sx, sy, affixes, kb, {
              source: 'weapon',
              weaponId: 'kusarigama',
            })

            // 重鎚・碎裂 heavy ball — mini AoE splash
            if (entry.stats._heavyBall && i === 0) {
              enemies.getChildren().filter(en => en.active && !en.dying && en !== e &&
                Phaser.Math.Distance.Between(sx, sy, en.x, en.y) < 40)
                .forEach(en => Enemy.takeDamage(en, rolledDmg, sx, sy, affixes, 150, {
                  source: 'weapon',
                  weaponId: 'kusarigama',
                }))
            }
          }
        }
      })
    }

    // 雷獄・連結 — arc lightning between sickle positions and nearby enemies
    if (entry.stats._arcLightning && entry.sickles.length >= 1) {
      if (!entry._arcLightCd) entry._arcLightCd = 0
      entry._arcLightCd += (delta || 16)
      if (entry._arcLightCd >= 800) {
        entry._arcLightCd = 0
        sicklePositions.forEach(({ sx, sy }) => {
          const nearby = enemies.getChildren().filter(e => e.active && !e.dying &&
            Phaser.Math.Distance.Between(sx, sy, e.x, e.y) < innerRadius * 1.4)
          nearby.forEach(e => {
            Enemy.takeDamage(e, rollDamage(entry.stats) * 0.5, sx, sy, affixes, 0, {
              source: 'weapon',
              weaponId: 'kusarigama',
            })
            const g = scene.add.graphics().setDepth(9)
            g.lineStyle(2, 0xffff44, 0.8)
            g.lineBetween(sx, sy, e.x, e.y)
            scene.tweens.add({ targets: g, alpha: 0, duration: 150, onComplete: () => g.destroy() })
          })
        })
      }
    }
  },
}
