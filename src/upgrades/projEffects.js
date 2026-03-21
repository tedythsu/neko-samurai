// src/upgrades/projEffects.js
//
// Shared projectile hit-effect helpers.
// Used by all weapon updateActive() implementations.
//
// applyExplosion     — Homura/Ofuda AoE burst (scorch, chain, linger, evoKaku)
// applyMiniExplosion — 爆裂弾 Layer P trait
// applyRicochet      — 彈射 Layer P trait

import Phaser from 'phaser'
import Enemy  from '../entities/Enemy.js'
import { getOrCreate } from '../weapons/_pool.js'

const EXPLOSION_RADIUS   = 40
const EXPLOSION_DAMAGE   = 0.4   // × proj.damage
const RICOCHET_SPEED     = 400
const RICOCHET_RANGE     = 200
const RICOCHET_DAMAGE    = 0.7   // × proj.damage
const RICOCHET_MAX_DEPTH = 2

/**
 * applyExplosion — Homura/Ofuda AoE burst at proj's position.
 * No-op if proj._explodeRadius is falsy.
 * Handles: main splash, _scorch zone, _chainExplode, _linger zone, _evoKaku bonus splash.
 */
export function applyExplosion(proj, hitEnemy, scene, enemies, affixes) {
  if (!proj._explodeRadius) return
  const explodeR = proj._evoKaku ? proj._explodeRadius * 2.5 : proj._explodeRadius
  enemies.getChildren()
    .filter(en => en.active && !en.dying && en !== hitEnemy &&
      Phaser.Math.Distance.Between(proj.x, proj.y, en.x, en.y) < explodeR)
    .forEach(en => Enemy.takeDamage(en, proj.damage * (proj._explodeMult || 1), proj.x, proj.y, affixes, 0))

  if (proj._scorch) scene._createScorchZone(proj.x, proj.y, explodeR, proj.damage, affixes)

  if (proj._chainExplode && proj._chainDepth === 0 && Math.random() < 0.25) {
    enemies.getChildren()
      .filter(en => en.active && !en.dying && en !== hitEnemy &&
        Phaser.Math.Distance.Between(proj.x, proj.y, en.x, en.y) < proj._explodeRadius)
      .forEach(en => Enemy.takeDamage(en, proj.damage * 0.5, proj.x, proj.y, affixes, 0))
  }

  if (proj._linger) scene._createLingerZone(proj.x, proj.y, explodeR, proj.damage, affixes)

  if (proj._evoKaku) {
    enemies.getChildren()
      .filter(en => en.active && !en.dying && en !== hitEnemy &&
        Phaser.Math.Distance.Between(proj.x, proj.y, en.x, en.y) < explodeR)
      .forEach(en => Enemy.takeDamage(en, proj.damage * 0.4, proj.x, proj.y, affixes, 0))
  }
}

/**
 * 燃燒地帶 — leave a scorch zone at the projectile's hit position.
 * No-op unless proj._scorch is set (via pt_burnfield trait).
 * Homura/Ofuda use applyExplosion which already handles _scorch internally;
 * this helper is for non-explosion weapons (Kunai, Shuriken).
 */
export function applyBurnfield(proj, scene, affixes) {
  if (!proj._scorch) return
  scene._createScorchZone(proj.x, proj.y, 35, proj.damage, affixes)
}

/**
 * 爆裂弾 — small AoE splash at the hit-enemy's position.
 * No-op if proj._miniExplosion is falsy.
 */
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

/**
 * 彈射 — spawn a ricochet child toward the nearest unhit enemy.
 * No-op if proj._ricochet is falsy or depth limit is reached.
 *
 * @param {Phaser.GameObjects.Sprite} proj       The projectile that just hit.
 * @param {Phaser.GameObjects.Sprite} hitEnemy   The enemy that was hit.
 * @param {Phaser.Scene}              scene
 * @param {Phaser.GameObjects.Group}  enemies
 * @param {Array}                     affixes
 * @param {((next: Sprite) => Object) | null} buildExtra
 *   Optional factory called with the chosen target.
 *   Return value is merged onto the child sprite via Object.assign.
 *   Use this for weapon-specific fields (e.g. Ofuda's `_target`, Homura's `_explodeRadius`).
 */
export function applyRicochet(proj, hitEnemy, scene, enemies, affixes, buildExtra = null) {
  if (!proj._ricochet || (proj._ricochetDepth ?? 0) >= RICOCHET_MAX_DEPTH) return
  const pool = proj._pool
  if (!pool) return

  const next = enemies.getChildren()
    .filter(e => e.active && !e.dying && !proj.hitSet.has(e))
    .sort((a, b) =>
      Phaser.Math.Distance.Between(hitEnemy.x, hitEnemy.y, a.x, a.y) -
      Phaser.Math.Distance.Between(hitEnemy.x, hitEnemy.y, b.x, b.y))[0]
  if (!next) return

  const r2 = getOrCreate(pool, hitEnemy.x, hitEnemy.y, proj.texture.key)
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
  r2._scatter       = proj._scatter
  r2._scatterFired  = false
  r2._miniExplosion = proj._miniExplosion
  r2._ricochet      = true
  r2._ricochetDepth = (proj._ricochetDepth || 0) + 1
  r2._pool          = pool
  r2._reversed      = false

  if (buildExtra) Object.assign(r2, buildExtra(next))

  scene.physics.moveToObject(r2, next, proj._speed || RICOCHET_SPEED)
}
