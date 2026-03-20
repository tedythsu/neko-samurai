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
    knockback:   0,
  },

  upgrades: [
    { id: 'dmg',    name: '鎖鎌 傷害 +25%', desc: '', apply: s => { s.damage      *= 1.25 } },
    { id: 'sickle', name: '鎖鎌 鎌刃 +1',   desc: '', apply: s => { s.sickleCount = Math.min(4, s.sickleCount + 1) } },
    { id: 'gravity',     name: '引力場', desc: '軌道內敵人緩慢被拉向玩家',              apply: s => { s._gravity = true } },
    { id: 'doubleOrbit', name: '雙軌道', desc: '新增外圈軌道（半徑140px）同等鎌刃數量', apply: s => { s._doubleOrbit = true } },
  ],

  createTexture(_scene) { /* sickles are drawn as rectangles in updateActive */ },

  fire() { /* no-op — sickles initialized lazily in updateActive */ },

  update() { /* no-op — no physics projectiles */ },

  updateActive(entry, scene, enemies, player, affixes, delta) {
    if (!entry.sickles) {
      entry.sickles  = []
      entry.damageCd = new Map()
    }

    const SICKLE_LEN     = 80
    const CHAIN_ATTACH_Y = 1.0
    const isDokuja   = entry.stats._evo === 'dokuja'
    const innerRadius = isDokuja ? 120 : SICKLE_LEN

    // Grow inner sickle array
    while (entry.sickles.length < entry.stats.sickleCount) {
      const img = scene.add.image(0, 0, 'kusarigama').setDepth(8)
      const aspect = img.width / img.height
      img.setDisplaySize(SICKLE_LEN * aspect, SICKLE_LEN).setOrigin(0.5, CHAIN_ATTACH_Y)
      entry.sickles.push(img)
    }

    const now       = scene.time.now
    const baseAngle = (now / 1000) * 180

    // Gravity pull
    if (entry.stats._gravity) {
      enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
        const dx  = player.x - e.x
        const dy  = player.y - e.y
        const len = Math.hypot(dx, dy) || 1
        if (len < 160) {
          const pull = 40 * (delta / 1000)
          e.body.velocity.x += (dx / len) * pull
          e.body.velocity.y += (dy / len) * pull
          // Cap net pull velocity so enemy is never teleported
          const spd = Math.hypot(e.body.velocity.x, e.body.velocity.y)
          if (spd > 40) {
            e.body.velocity.x = (e.body.velocity.x / spd) * 40
            e.body.velocity.y = (e.body.velocity.y / spd) * 40
          }
        }
      })
    }

    // Inner orbit
    for (let i = 0; i < entry.sickles.length; i++) {
      const sickle = entry.sickles[i]
      const angle  = Phaser.Math.DegToRad(baseAngle + (360 / entry.sickles.length) * i)
      sickle.setPosition(player.x, player.y).setRotation(angle + Math.PI / 2)
      const sx = player.x + Math.cos(angle) * innerRadius * CHAIN_ATTACH_Y
      const sy = player.y + Math.sin(angle) * innerRadius * CHAIN_ATTACH_Y

      enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
        if (Phaser.Math.Distance.Between(sx, sy, e.x, e.y) < 20) {
          const last = entry.damageCd.get(e) || 0
          if (now - last >= 200) {
            entry.damageCd.set(e, now)
            Enemy.takeDamage(e, entry.stats.damage, sx, sy, affixes, 0)
            // 毒蛇鎖鎌 evo — apply poison stack on contact
            if (isDokuja && e._statusEffects && e._statusEffects.poison) {
              const ps = e._statusEffects.poison
              ps.stacks = Math.min(ps.maxStacks ?? 10, ps.stacks + 1)
            }
          }
        }
      })
    }

    // Outer orbit (雙軌道)
    if (entry.stats._doubleOrbit) {
      if (!entry.outerSickles)  entry.outerSickles  = []
      if (!entry.outerDamageCd) entry.outerDamageCd = new Map()
      const OUTER_RADIUS = 140
      while (entry.outerSickles.length < entry.stats.sickleCount) {
        const img = scene.add.image(0, 0, 'kusarigama').setDepth(7)
        const aspect = img.width / img.height
        img.setDisplaySize(SICKLE_LEN * aspect, SICKLE_LEN).setOrigin(0.5, CHAIN_ATTACH_Y)
        entry.outerSickles.push(img)
      }
      for (let i = 0; i < entry.outerSickles.length; i++) {
        const sickle = entry.outerSickles[i]
        const angle  = Phaser.Math.DegToRad(baseAngle + (360 / entry.outerSickles.length) * i + 30)
        sickle.setPosition(player.x, player.y).setRotation(angle + Math.PI / 2)
        const sx = player.x + Math.cos(angle) * OUTER_RADIUS
        const sy = player.y + Math.sin(angle) * OUTER_RADIUS
        enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
          if (Phaser.Math.Distance.Between(sx, sy, e.x, e.y) < 20) {
            const last = entry.outerDamageCd.get(e) || 0
            if (now - last >= 200) {
              entry.outerDamageCd.set(e, now)
              Enemy.takeDamage(e, entry.stats.damage, sx, sy, affixes, 0)
            }
          }
        })
      }
    }
  },
}
