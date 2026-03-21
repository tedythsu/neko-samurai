// src/weapons/Kusarigama.js
import Phaser from 'phaser'
import Enemy  from '../entities/Enemy.js'

export default {
  id:      'kusarigama',
  name:    '鎖鎌',
  iconKey: 'kusarigama',

  baseStats: {
    damage:         8,
    fireRate:       0,   // always active — handled by updateActive()
    projectileCount: 1,  // number of orbiting sickles
    knockback:      0,
  },

  upgrades: [
    { id: 'dmg',    name: '鎖鎌 傷害 +25%', desc: '', apply: s => { s.damage          *= 1.25 } },
    { id: 'sickle', name: '鎖鎌 鎌刃 +1',   desc: '', apply: s => { s.projectileCount = Math.min(4, s.projectileCount + 1) } },
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
    while (entry.sickles.length < entry.stats.projectileCount) {
      const img = scene.add.image(0, 0, 'kusarigama').setDepth(8)
      const aspect = img.width / img.height
      img.setDisplaySize(SICKLE_LEN * aspect, SICKLE_LEN).setOrigin(0.5, CHAIN_ATTACH_Y)
      entry.sickles.push(img)
    }

    const now       = scene.time.now
    const baseAngle = (now / 1000) * 180

    // 疾旋: compute once per frame before all contact checks
    let rvMult = 1
    if (entry.stats._rapidVortex) {
      const nearbyCount = enemies.getChildren()
        .filter(e => e.active && !e.dying &&
          Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y) < 150).length
      rvMult = 1 + Math.min(4, nearbyCount) * 0.25
    }

    // 殘像 trail every 400ms
    if (entry.stats._afterimage) {
      if (!entry.lastTrailTime) entry.lastTrailTime = 0
      if (now >= entry.lastTrailTime + 400 && entry.sickles.length > 0) {
        entry.lastTrailTime = now
        entry.sickles.forEach(sickle => {
          const trail = scene.add.image(sickle.x, sickle.y, 'kusarigama')
            .setDisplaySize(sickle.displayWidth, sickle.displayHeight)
            .setRotation(sickle.rotation).setAlpha(0.4).setDepth(6)
          scene.tweens.add({ targets: trail, alpha: 0, duration: 300, onComplete: () => trail.destroy() })
        })
      }
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
          if (now - last >= 600) {
            entry.damageCd.set(e, now)
            const killed = Enemy.takeDamage(e, entry.stats.damage * rvMult, sx, sy, affixes, 0)
            // 毒蛇鎖鎌 evo — apply poison stack on contact
            if (isDokuja && e._statusEffects && e._statusEffects.poison) {
              const ps = e._statusEffects.poison
              ps.stacks = Math.min(ps.maxStacks ?? 10, ps.stacks + 1)
            }
            // 命運印記 — refresh timer on contact
            if (entry.stats._doom) {
              e._doomTimer  = now + 2000
              e._doomDamage = entry.stats.damage * rvMult * 1.5
              e._doomRadius = 60
            }
            // 死爆 — burst on kill
            if (killed && entry.stats._deathBurst) {
              const br = 60
              enemies.getChildren()
                .filter(en => en.active && !en.dying && en !== e &&
                  Phaser.Math.Distance.Between(e.x, e.y, en.x, en.y) < br)
                .forEach(en => Enemy.takeDamage(en, entry.stats.damage * rvMult, e.x, e.y, affixes, 0))
              const bg = scene.add.graphics().setDepth(10)
              bg.lineStyle(2, 0xff0000, 0.9)
              bg.strokeCircle(e.x, e.y, br)
              scene.tweens.add({ targets: bg, alpha: 0, duration: 250, onComplete: () => bg.destroy() })
            }
            // 衝波 — ring on kill
            if (killed && entry.stats._shockwave) {
              const shockHit = new Set()
              const sg = scene.add.graphics().setDepth(6)
              let rv = 0
              const shockFn = (_, dt) => {
                rv = Math.min(80, rv + 80 * dt / 300)
                sg.clear().setPosition(player.x, player.y)
                sg.lineStyle(3, 0xff8800, 0.8)
                sg.strokeCircle(0, 0, rv)
                enemies.getChildren().filter(en => en.active && !en.dying && !shockHit.has(en)).forEach(en => {
                  const d = Phaser.Math.Distance.Between(player.x, player.y, en.x, en.y)
                  if (Math.abs(d - rv) < 18) {
                    shockHit.add(en)
                    Enemy.takeDamage(en, entry.stats.damage * rvMult * 0.5, player.x, player.y, affixes, 0)
                  }
                })
                if (rv >= 80) {
                  scene.events.off('update', shockFn)
                  sg.destroy()
                }
              }
              scene.events.on('update', shockFn)
              scene.events.once('shutdown', () => {
                scene.events.off('update', shockFn)
                sg.destroy()
              })
            }
          }
        }
      })
    }
  },
}
