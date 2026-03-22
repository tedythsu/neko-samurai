// src/upgrades/projEffects.js
import Phaser from 'phaser'
import Enemy  from '../entities/Enemy.js'
import { getOrCreate } from '../weapons/_pool.js'

const EXPLOSION_RADIUS   = 40
const EXPLOSION_DAMAGE   = 0.4
const RICOCHET_SPEED     = 400
const RICOCHET_RANGE     = 200
const RICOCHET_DAMAGE    = 0.7
const RICOCHET_MAX_DEPTH = 2

export function applyExplosion(proj, hitEnemy, scene, enemies, affixes) {
  if (!proj._explodeRadius) return
  const explodeR = proj._explodeRadius

  // Main AoE splash
  enemies.getChildren()
    .filter(en => en.active && !en.dying && en !== hitEnemy &&
      Phaser.Math.Distance.Between(proj.x, proj.y, en.x, en.y) < explodeR)
    .forEach(en => Enemy.takeDamage(en, proj.damage * (proj._explodeMult || 1), proj.x, proj.y, affixes, 0))

  // Explosion ring visual
  const g = scene.add.graphics().setDepth(10).setPosition(proj.x, proj.y)
  g.lineStyle(2, 0xff4400, 0.8)
  g.strokeCircle(0, 0, explodeR)
  scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() })

  // 業火・殘留 — scorch zone
  if (proj._scorch) scene._createScorchZone(proj.x, proj.y, explodeR, proj.damage, affixes)

  // 貫穿・連爆 — mini explosion on each pierce
  if (proj._chainExplode) {
    enemies.getChildren()
      .filter(en => en.active && !en.dying && en !== hitEnemy &&
        Phaser.Math.Distance.Between(proj.x, proj.y, en.x, en.y) < explodeR * 0.6)
      .forEach(en => Enemy.takeDamage(en, proj.damage * 0.4, proj.x, proj.y, affixes, 0))
  }

  // 陰陽・黑洞 — gravity field
  if (proj._gravity && scene._createGravityField) {
    scene._createGravityField(proj.x, proj.y, explodeR * 1.5, affixes)
  }

  // 連爆・擴散 — secondary burst
  if (proj._secondBurst && Math.random() < 0.30) {
    scene.time.delayedCall(200, () => {
      enemies.getChildren()
        .filter(en => en.active && !en.dying && en !== hitEnemy &&
          Phaser.Math.Distance.Between(proj.x, proj.y, en.x, en.y) < explodeR)
        .forEach(en => Enemy.takeDamage(en, proj.damage * 0.6, proj.x, proj.y, affixes, 0))
      const g2 = scene.add.graphics().setDepth(10).setPosition(proj.x, proj.y)
      g2.lineStyle(3, 0xff8800, 0.9)
      g2.strokeCircle(0, 0, explodeR)
      scene.tweens.add({ targets: g2, alpha: 0, scaleX: 1.3, scaleY: 1.3, duration: 300, onComplete: () => g2.destroy() })
    })
  }
}

export function applyBurnfield(proj, scene, affixes) {
  if (!proj._scorch) return
  scene._createScorchZone(proj.x, proj.y, 35, proj.damage, affixes)
}

export function applyMiniExplosion(proj, hitEnemy, scene, enemies, affixes) {
  if (!proj._miniExplosion) return
  enemies.getChildren()
    .filter(e => e.active && !e.dying && e !== hitEnemy &&
      Phaser.Math.Distance.Between(hitEnemy.x, hitEnemy.y, e.x, e.y) < EXPLOSION_RADIUS)
    .forEach(e => Enemy.takeDamage(e, proj.damage * EXPLOSION_DAMAGE, hitEnemy.x, hitEnemy.y, affixes, 0))
  const g = scene.add.graphics().setDepth(10)
  g.lineStyle(2, 0xff6600, 0.8)
  g.strokeCircle(hitEnemy.x, hitEnemy.y, EXPLOSION_RADIUS)
  scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() })
}

export function applyRicochet(proj, hitEnemy, scene, enemies, affixes, buildExtra = null) {
  if (!proj._ricochet) return
  const maxDepth = proj._ricochetMax ?? RICOCHET_MAX_DEPTH
  if ((proj._ricochetDepth ?? 0) >= maxDepth) return
  const pool = proj._pool
  if (!pool) return

  const next = enemies.getChildren()
    .filter(e => e.active && !e.dying && !proj.hitSet.has(e))
    .sort((a, b) =>
      Phaser.Math.Distance.Between(hitEnemy.x, hitEnemy.y, a.x, a.y) -
      Phaser.Math.Distance.Between(hitEnemy.x, hitEnemy.y, b.x, b.y))[0]
  if (!next) return

  const r2 = getOrCreate(pool, hitEnemy.x, hitEnemy.y, proj.texture.key)
  if (!r2) return
  r2.setDisplaySize(proj.displayWidth, proj.displayHeight)
  r2.damage         = proj.damage * RICOCHET_DAMAGE
  r2.hitSet         = new Set([hitEnemy])
  r2.spawnX         = hitEnemy.x
  r2.spawnY         = hitEnemy.y
  r2.range          = RICOCHET_RANGE
  r2.penetrate      = false
  r2.knockback      = proj.knockback
  r2._hitRadius     = proj._hitRadius || 14
  r2._boomerang     = false
  r2._scatter       = false
  r2._scatterFired  = false
  r2._miniExplosion = proj._miniExplosion
  r2._ricochet      = true
  r2._ricochetDepth = (proj._ricochetDepth || 0) + 1
  r2._ricochetMax   = proj._ricochetMax
  r2._pool          = pool
  r2._reversed      = false

  if (buildExtra) Object.assign(r2, buildExtra(next))

  scene.physics.moveToObject(r2, next, proj._speed || RICOCHET_SPEED)
}
