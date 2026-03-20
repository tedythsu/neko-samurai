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
    { id: 'dmg',    name: '鎖鎌 傷害 +25%', desc: '', apply: s => { s.damage      *= 1.25 } },
    { id: 'sickle', name: '鎖鎌 鎌刃 +1',   desc: '', apply: s => { s.sickleCount = Math.min(4, s.sickleCount + 1) } },
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
    const SICKLE_LEN     = 80   // chain length in px (orbit radius)
    // CHAIN_ATTACH_Y: where the chain connects on the image (1.0 = absolute bottom pixel).
    // If the artwork has bottom padding, lower this value (e.g. 0.85) until the chain
    // visually connects to the player center.
    const CHAIN_ATTACH_Y = 1.0

    while (entry.sickles.length < entry.stats.sickleCount) {
      const img = scene.add.image(0, 0, 'kusarigama').setDepth(8)
      const aspect = img.width / img.height
      img.setDisplaySize(SICKLE_LEN * aspect, SICKLE_LEN)
          .setOrigin(0.5, CHAIN_ATTACH_Y)
      entry.sickles.push(img)
    }

    const now       = scene.time.now
    const baseAngle = (now / 1000) * 180   // full rotation every 2s

    for (let i = 0; i < entry.sickles.length; i++) {
      const sickle  = entry.sickles[i]
      const angle   = Phaser.Math.DegToRad(baseAngle + (360 / entry.sickles.length) * i)
      // Anchor (CHAIN_ATTACH_Y point on image) sits at player center; image extends outward
      sickle.setPosition(player.x, player.y).setRotation(angle + Math.PI / 2)
      // Collision point = tip of sickle (CHAIN_ATTACH_Y fraction of length from player)
      const sx = player.x + Math.cos(angle) * SICKLE_LEN * CHAIN_ATTACH_Y
      const sy = player.y + Math.sin(angle) * SICKLE_LEN * CHAIN_ATTACH_Y

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
