// src/weapons/Shuriken.js
import Phaser from 'phaser'
import Enemy  from '../entities/Enemy.js'
import { getOrCreate, nearestEnemies, rollDamage } from './_pool.js'
import { applyRicochet } from '../upgrades/projEffects.js'

const HIT_RADIUS = 28
const BOOMERANG_HIT_CD = 500

export default {
  id: 'shuriken',
  name: '手裏劍',
  texKey: 'shuriken',
  iconKey: 'shuriken',

  baseStats: {
    damage:          13,
    damageVariance:  0.20,
    fireRate:        700,
    projectileCount: 3,
    speed:           450,
    penetrate:       false,
    knockback:       60,
    _scale:          1.0,
  },

  upgrades: [],

  createTexture() {},

  fire(scene, pool, fromX, fromY, stats, enemies) {
    const count = stats.projectileCount

    // 六道・全周 — converted into orbiting blades, so no fired projectile is created.
    if (stats._omni) {
      return
    }

    const target = nearestEnemies(enemies, fromX, fromY, 1)[0]
    if (!target) return

    const centerAngle = Phaser.Math.RadToDeg(
      Phaser.Math.Angle.Between(fromX, fromY, target.x, target.y)
    )
    const SPREAD_DEG = 20

    for (let i = 0; i < count; i++) {
      const s = getOrCreate(pool, fromX, fromY, this.texKey)
      if (!s) return
      const baseW = 28, baseH = 28
      s.setDisplaySize(baseW * stats._scale, baseH * stats._scale)
      s.damage       = rollDamage(stats)
      s.hitSet       = new Set()
      s.spawnX       = fromX
      s.spawnY       = fromY
      s.range        = 300
      s.penetrate    = stats.penetrate
      s.knockback    = stats.knockback ?? 60
      s._hitRadius   = HIT_RADIUS * stats._scale
      s._pool        = pool
      s._reversed    = false
      s._returning   = false
      s._boomerang   = stats._boomerang   || false
      s._lingerZone  = stats._lingerZone  || false
      s._lingerFired = false
      s._ricochet    = stats._ricochet    || false
      s._ricochetDepth = 0
      s._ricochetMax = stats._ricochetMax
      s._weaponId    = this.id
      s._wallBounce  = scene._ricochetWall || false
      s._wallBounced = false
      s._micro       = false
      s._hitCooldowns = new Map()

      const offset = (i - (count - 1) / 2) * SPREAD_DEG
      const speed = stats.speed * (scene._projSpeedMult || 1)
      s._speed = speed
      scene.physics.velocityFromAngle(centerAngle + offset, speed, s.body.velocity)
    }
  },

  update(sprite) {
    if (!sprite.active) return
    if (sprite._orbiting) return
    sprite.angle += 8

    if (sprite._spent) {
      sprite.disableBody(true, true)
      return
    }

    if (sprite._wallBounce && !sprite._wallBounced) {
      const bounds = sprite.scene.physics.world.bounds
      let bounced = false
      if ((sprite.x <= bounds.left + 6 && sprite.body.velocity.x < 0) ||
          (sprite.x >= bounds.right - 6 && sprite.body.velocity.x > 0)) {
        sprite.body.velocity.x *= -1
        bounced = true
      }
      if ((sprite.y <= bounds.top + 6 && sprite.body.velocity.y < 0) ||
          (sprite.y >= bounds.bottom - 6 && sprite.body.velocity.y > 0)) {
        sprite.body.velocity.y *= -1
        bounced = true
      }
      if (bounced) sprite._wallBounced = true
    }

    const dist = Phaser.Math.Distance.Between(sprite.spawnX, sprite.spawnY, sprite.x, sprite.y)

    if (sprite._boomerang) {
      if (!sprite._reversed && dist >= sprite.range) {
        _reverseBoomerang(sprite)
      } else if (sprite._reversed && dist >= sprite.range) {
        // 萬劍歸宗 keystone — 360 slash on return
        const s = sprite.scene
        if (s._keystonesOwned && s._keystonesOwned.has('spell_echo')) {
          _spellEchoSlash(s, sprite.x, sprite.y, sprite.damage, s._affixes, s._enemies)
        }
        sprite.disableBody(true, true)
      }
    } else {
      if (dist >= sprite.range) {
        // 回天・滯留 — linger zone at endpoint
        if (sprite._lingerZone && !sprite._lingerFired) {
          sprite._lingerFired = true
          const sc = sprite.scene
          sc._createLingerZone(
            sprite.x,
            sprite.y,
            30,
            sprite.damage,
            sc._affixes || [],
            sprite._weaponId,
            { width: sprite.displayWidth, height: sprite.displayHeight }
          )
        }
        sprite.disableBody(true, true)
      }
    }
  },

  updateActive(entry, scene, enemies, _player, affixes) {
    if (entry.stats._omni) {
      _updateOrbitingShuriken(entry, scene, enemies, _player, affixes)
      return
    }

    entry.projectiles.getChildren().forEach(proj => {
      if (!proj.active || proj._spent) return
      enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
        if (proj._spent || proj.hitSet.has(e)) return
        if (Phaser.Math.Distance.Between(proj.x, proj.y, e.x, e.y) < proj._hitRadius) {
          if (proj._boomerang) {
            const key = e.body?.id ?? e.x
            const last = proj._hitCooldowns?.get(key) || 0
            const now = scene.time.now
            if (now - last < BOOMERANG_HIT_CD) return
            proj._hitCooldowns.set(key, now)
          }
          proj.hitSet.add(e)
          Enemy.takeDamage(e, proj.damage, proj.x, proj.y, affixes, proj.knockback ?? 60, {
            source: 'weapon',
            weaponId: this.id,
          })
          if (proj._lingerZone && !proj._lingerFired) {
            proj._lingerFired = true
            scene._createLingerZone(
              proj.x,
              proj.y,
              30,
              proj.damage,
              affixes,
              proj._weaponId,
              { width: proj.displayWidth, height: proj.displayHeight }
            )
          }
          if (scene._secondSplit && !proj._micro) {
            _spawnMicroShuriken(scene, entry.projectiles, proj, e)
          }
          applyRicochet(proj, e, scene, enemies, affixes)
          if (proj._boomerang && !proj._reversed) {
            _reverseBoomerang(proj)
            return
          }
          if (!proj.penetrate) proj._spent = true
        }
      })
    })
  },
}

function _reverseBoomerang(sprite) {
  sprite.body.velocity.x *= -1
  sprite.body.velocity.y *= -1
  sprite._reversed = true
  sprite._returning = true
  sprite.spawnX = sprite.x
  sprite.spawnY = sprite.y
}

function _spellEchoSlash(scene, x, y, damage, affixes, enemies) {
  const RANGE = 80
  const g = scene.add.graphics().setDepth(8).setPosition(x, y)
  g.fillStyle(0x8844ff, 0.25)
  g.fillCircle(0, 0, RANGE)
  scene.tweens.add({ targets: g, alpha: 0, duration: 400, onComplete: () => g.destroy() })
  enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
    if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < RANGE)
      Enemy.takeDamage(e, damage, x, y, affixes, 80, { source: 'weapon', weaponId: 'shuriken' })
  })
}

function _updateOrbitingShuriken(entry, scene, enemies, player, affixes) {
  const count = Math.max(1, entry.stats.projectileCount || 1)
  const radius = entry.stats._orbitRadius || 92
  const baseW = 28 * entry.stats._scale
  const baseH = 28 * entry.stats._scale
  const now = scene.time.now
  const angularSpeed = 210

  while (entry.projectiles.getChildren().filter(s => s.active && s._orbiting).length < count) {
    const s = getOrCreate(entry.projectiles, player.x, player.y, entry.weapon.texKey)
    if (!s) break
    s.setDisplaySize(baseW, baseH)
    s.damage       = rollDamage(entry.stats) * (entry.stats._orbitDamageMult || 0.80)
    s.hitSet       = new Set()
    s.spawnX       = player.x
    s.spawnY       = player.y
    s.range        = 0
    s.penetrate    = true
    s.knockback    = entry.stats.knockback ?? 60
    s._hitRadius   = HIT_RADIUS * entry.stats._scale
    s._pool        = entry.projectiles
    s._reversed    = false
    s._boomerang   = false
    s._lingerZone  = false
    s._lingerFired = true
    s._ricochet    = false
    s._ricochetDepth = 0
    s._ricochetMax = 0
    s._weaponId    = entry.weapon.id
    s._wallBounce  = false
    s._wallBounced = true
    s._micro       = false
    s._orbiting    = true
    s._orbitId     = Phaser.Utils.String.UUID()
    s._orbitHitCd  = new Map()
    s.body.enable  = false
  }

  const orbiting = entry.projectiles.getChildren().filter(s => s.active && s._orbiting)
  orbiting.forEach((proj, i) => {
    const angle = Phaser.Math.DegToRad((now / 1000) * angularSpeed + (360 / orbiting.length) * i)
    proj.x = player.x + Math.cos(angle) * radius
    proj.y = player.y + Math.sin(angle) * radius
    proj.angle += 10
    proj.damage = rollDamage(entry.stats) * (entry.stats._orbitDamageMult || 0.80)

    enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
      if (Phaser.Math.Distance.Between(proj.x, proj.y, e.x, e.y) >= proj._hitRadius) return
      const lastHit = proj._orbitHitCd.get(e) || 0
      if (now - lastHit < (entry.stats._orbitHitCooldown || 500)) return
      proj._orbitHitCd.set(e, now)
      Enemy.takeDamage(e, proj.damage, proj.x, proj.y, affixes, proj.knockback ?? 60, {
        source: 'weapon',
        weaponId: entry.weapon.id,
      })
    })
  })
}

function _spawnMicroShuriken(scene, pool, proj, enemy) {
  const baseAngle = Phaser.Math.RadToDeg(
    Phaser.Math.Angle.Between(proj.x, proj.y, enemy.x, enemy.y)
  )
  ;[-22, 22].forEach(offset => {
    const micro = getOrCreate(pool, proj.x, proj.y, proj.texture.key)
    if (!micro) return
    micro.setDisplaySize(proj.displayWidth * 0.65, proj.displayHeight * 0.65)
    micro.damage         = proj.damage * 0.33
    micro.hitSet         = new Set()
    micro.spawnX         = proj.x
    micro.spawnY         = proj.y
    micro.range          = 160
    micro.penetrate      = false
    micro.knockback      = 20
    micro._hitRadius     = HIT_RADIUS * 0.55
    micro._pool          = pool
    micro._reversed      = false
    micro._boomerang     = false
    micro._lingerZone    = false
    micro._lingerFired   = true
    micro._ricochet      = false
    micro._ricochetDepth = 0
    micro._ricochetMax   = 0
    micro._weaponId      = proj._weaponId
    micro._wallBounce    = false
    micro._wallBounced   = true
    micro._micro         = true
    scene.physics.velocityFromAngle(baseAngle + offset, 460, micro.body.velocity)
  })
}
