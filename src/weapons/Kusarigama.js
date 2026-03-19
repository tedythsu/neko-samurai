// src/weapons/Kusarigama.js
import Phaser from 'phaser'
import Enemy  from '../entities/Enemy.js'

export default {
  id:   'kusarigama',
  name: '鎖鎌',
  desc: '環繞軌道・持續接觸傷害',

  baseStats: {
    damage:      8,
    fireRate:    0,      // always active — handled by updateActive()
    sickleCount: 1,
  },

  upgrades: [
    { id: 'dmg',    name: '鎌強化', desc: '傷害 +25%', apply: s => { s.damage      *= 1.25 } },
    { id: 'sickle', name: '多鎌',   desc: '鎌刃 +1',   apply: s => { s.sickleCount += 1 } },
  ],

  createTexture(_scene) { /* sickles are drawn as rectangles in updateActive */ },

  fire() { /* no-op — sickles initialized lazily in updateActive */ },

  update() { /* no-op — no physics projectiles */ },

  updateActive(entry, scene, enemies, player, affixes, delta) {
    // Lazy-init sickle sprites
    if (!entry.sickles) {
      entry.sickles  = []
      entry.damageCd = new Map()
    }

    // Grow sickle array if sickleCount increased via upgrade
    while (entry.sickles.length < entry.stats.sickleCount) {
      entry.sickles.push(
        scene.add.rectangle(0, 0, 20, 8, 0x00cccc).setDepth(8)
      )
    }

    const now       = scene.time.now
    const baseAngle = (now / 1000) * 180   // full rotation every 2s

    for (let i = 0; i < entry.sickles.length; i++) {
      const sickle  = entry.sickles[i]
      const angle   = Phaser.Math.DegToRad(baseAngle + (360 / entry.sickles.length) * i)
      const sx      = player.x + Math.cos(angle) * 80
      const sy      = player.y + Math.sin(angle) * 80
      sickle.setPosition(sx, sy).setRotation(angle)

      enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
        if (Phaser.Math.Distance.Between(sx, sy, e.x, e.y) < 20) {
          const last = entry.damageCd.get(e) || 0
          if (now - last >= 200) {
            entry.damageCd.set(e, now)
            Enemy.takeDamage(e, entry.stats.damage, sx, sy, affixes)
          }
        }
      })
    }
  },
}
