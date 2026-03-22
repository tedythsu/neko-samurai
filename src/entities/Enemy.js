// src/entities/Enemy.js
import Phaser from 'phaser'
import { CFG } from '../config.js'

export default class Enemy {
  static createTexture(scene) {
    const tex = scene.textures.get('kisotsu-run')
    if (tex.has(0)) return
    const src = tex.source[0]
    const fw  = Math.floor(src.width  / 6)
    const fh  = Math.floor(src.height / 6)
    let idx = 0
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++)
        tex.add(idx++, 0, c * fw, r * fh, fw, fh)

    if (!scene.textures.exists('dust-particle')) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false })
      g.fillStyle(0xffffff)
      g.fillCircle(3, 3, 3)
      g.generateTexture('dust-particle', 6, 6)
      g.destroy()
    }
  }

  static activate(sprite, x, y, typeConfig = null, diffMult = null) {
    const type = typeConfig || { id: 'kisotsu', baseTint: null, hpMult: 1.0, speedMult: 1.0, sizeMult: 1.0, behaviorFlags: {} }
    const dm   = diffMult   || { hpMult: 1.0, speedMult: 1.0 }

    sprite.enableBody(true, x, y, true, true)
    sprite.hp             = CFG.ENEMY_HP * type.hpMult * dm.hpMult
    sprite.maxHp          = sprite.hp
    sprite.damageCd       = 0
    sprite.knockbackTimer = 0
    sprite.dying          = false
    sprite._frame         = 0
    sprite._timer         = 0
    sprite._baseTint      = type.baseTint
    sprite._typeConfig    = type
    sprite._speed         = CFG.ENEMY_SPEED * type.speedMult * dm.speedMult
    sprite._stunTimer     = 0
    sprite._armorShred    = 0
    sprite._outputMult    = 1.0
    sprite._inSanctuaryAura = false
    sprite._darkAura        = false

    sprite.setAlpha(1)
    if (type.baseTint !== null) {
      sprite.setTint(type.baseTint)
    } else {
      sprite.clearTint()
    }

    sprite._statusEffects = {
      chill:  { active: false, timer: 0, stacks: 0 },
      frozen: { active: false, timer: 0 },
      ignite: { active: false, timer: 0, dps: 0, _accum: 0 },
      shock:  { active: false, timer: 0 },
      bleed:  { active: false, timer: 0, _accum: 0 },
    }

    const frame0 = sprite.scene.textures.get('kisotsu-run').frames[0]
    const dH = Math.round(64 * type.sizeMult)
    const dW = Math.round(dH * frame0.realWidth / frame0.realHeight)
    sprite.setTexture('kisotsu-run', 0).setDisplaySize(dW, dH)

    const bodyW = Math.round(18 * type.sizeMult)
    const bodyH = Math.round(38 * type.sizeMult)
    sprite.body.setSize(bodyW, bodyH)

    if (type.behaviorFlags.explode) {
      sprite._pulseTween = sprite.scene.tweens.add({
        targets: sprite, alpha: { from: 0.6, to: 1.0 },
        yoyo: true, repeat: -1, duration: 350,
      })
    } else {
      sprite._pulseTween = null
    }
  }

  static update(sprite, player, delta) {
    if (!sprite.active || sprite.dying) return

    if (sprite.knockbackTimer > 0) {
      sprite.knockbackTimer -= delta
    } else {
      const se      = sprite._statusEffects
      const stunned = (sprite._stunTimer || 0) > 0
      if (stunned) sprite._stunTimer -= delta
      const frozen  = se && se.frozen.active
      const chilled = se && se.chill.active
      const inAura  = sprite._inSanctuaryAura
      const baseSpeed = sprite._speed ?? CFG.ENEMY_SPEED
      const speed     = stunned ? 0
                      : frozen  ? 0
                      : chilled ? baseSpeed * 0.5
                      : inAura  ? baseSpeed * 0.7
                      : baseSpeed
      if (speed > 0) sprite.scene.physics.moveToObject(sprite, player.sprite, speed)
    }

    sprite.setFlipX(player.x < sprite.x)

    if (!sprite.dying && sprite._typeConfig?.behaviorFlags?.explode) {
      const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, player.x, player.y)
      if (dist < sprite._typeConfig.behaviorFlags.explodeRange) {
        player.takeDamage(CFG.ENEMY_DAMAGE * 2)
        if (sprite._pulseTween) { sprite._pulseTween.stop(); sprite._pulseTween = null }
        Enemy._triggerDeath(sprite)
        return
      }
    }

    if (sprite.damageCd > 0) sprite.damageCd -= delta
    Enemy.updateStatus(sprite, delta)

    const frozen = sprite._statusEffects && sprite._statusEffects.frozen.active
    if (!frozen && !(sprite._stunTimer > 0)) {
      sprite._timer += delta
      while (sprite._timer >= 1000 / 12) {
        sprite._timer -= 1000 / 12
        sprite._frame  = (sprite._frame + 1) % 36
        sprite.setFrame(sprite._frame)
      }
    }
  }

  static updateStatus(sprite, delta) {
    const se = sprite._statusEffects
    if (!se) return
    const scene = sprite.scene

    // Ignite DoT
    if (se.ignite && se.ignite.active) {
      se.ignite.timer -= delta
      const dmg = se.ignite.dps * (delta / 1000)
      sprite.hp -= dmg
      se.ignite._accum = (se.ignite._accum || 0) + dmg
      if (se.ignite._accum >= 1) {
        const shown = Math.floor(se.ignite._accum)
        se.ignite._accum -= shown
        Enemy.showDamageNumber(sprite, shown, '#ff6600')
      }
      if (se.ignite.timer <= 0) { se.ignite.active = false; se.ignite.dps = 0 }
      if (sprite.hp <= 0 && !sprite.dying) Enemy._triggerDeath(sprite)
    }

    // Bleed DoT — scales with enemy speed
    if (se.bleed && se.bleed.active) {
      se.bleed.timer -= delta
      const speedRatio = (sprite._speed || CFG.ENEMY_SPEED) / CFG.ENEMY_SPEED
      const dmg = 4 * speedRatio * (delta / 1000)
      sprite.hp -= dmg
      se.bleed._accum = (se.bleed._accum || 0) + dmg
      if (se.bleed._accum >= 1) {
        const shown = Math.floor(se.bleed._accum)
        se.bleed._accum -= shown
        Enemy.showDamageNumber(sprite, shown, '#cc88ff')
      }
      if (se.bleed.timer <= 0) se.bleed.active = false
      if (sprite.hp <= 0 && !sprite.dying) Enemy._triggerDeath(sprite)
    }

    // Shock timer
    if (se.shock && se.shock.active) {
      se.shock.timer -= delta
      if (se.shock.timer <= 0) se.shock.active = false
    }

    // Chill timer
    if (se.chill.active) {
      se.chill.timer -= delta
      if (se.chill.timer <= 0) { se.chill.active = false; se.chill.stacks = 0 }
    }

    // Frozen timer
    if (se.frozen.active) {
      se.frozen.timer -= delta
      if (se.frozen.timer <= 0) se.frozen.active = false
    }

    Enemy._applyStatusTint(sprite)
  }

  static _applyStatusTint(sprite) {
    if (sprite.dying) { sprite.clearTint(); return }
    const se = sprite._statusEffects
    if (!se) return
    if (se.ignite && se.ignite.active)           { sprite.setTint(0xff4400); return }
    if (se.bleed  && se.bleed.active)            { sprite.setTint(0xcc44ff); return }
    if (se.shock  && se.shock.active)            { sprite.setTint(0xffff44); return }
    if (se.chill.active || se.frozen.active)     { sprite.setTint(0x88ccff); return }
    if (sprite._baseTint !== null && sprite._baseTint !== undefined) {
      sprite.setTint(sprite._baseTint)
    } else {
      sprite.clearTint()
    }
  }

  static _hasStatusTint(sprite) {
    const se = sprite._statusEffects
    if (!se) return false
    return (se.ignite?.active) || (se.bleed?.active) || (se.shock?.active) ||
           se.chill.active || se.frozen.active
  }

  static _triggerDeath(sprite) {
    if (sprite.dying) return
    sprite._doomTimer = null
    const { x, y } = sprite
    const scene     = sprite.scene

    scene.events.emit('enemy-died', { x, y })
    sprite.dying = true
    if (sprite._pulseTween) { sprite._pulseTween.stop(); sprite._pulseTween = null }
    sprite.clearTint()

    // Soul drain proc
    if (scene._soulDrain && Math.random() < 0.02) {
      scene._player?.heal(1)
    }

    scene.time.delayedCall(150, () => {
      if (sprite.dying) sprite.body.enable = false
    })

    const emitter = scene.add.particles(x, y, 'dust-particle', {
      speed:    { min: 60, max: 220 },
      angle:    { min: 0, max: 360 },
      scale:    { start: 1.2, end: 0 },
      alpha:    { start: 1,   end: 0 },
      lifespan: 500,
      quantity: 12,
      tint:     [0x9B8765, 0x7A6245, 0x5C4033, 0xC8A87A],
      emitting: false,
    })
    emitter.setDepth(7)
    emitter.explode(12)
    scene.time.delayedCall(600, () => emitter.destroy())

    scene.tweens.add({
      targets:  sprite,
      alpha:    0,
      duration: 100,
      ease:     'Linear',
      onComplete: () => {
        // Reset all status effects
        sprite._armorShred = 0
        sprite._outputMult = 1.0
        sprite._stunTimer  = 0
        sprite._inSanctuaryAura = false
        sprite._darkAura   = false
        const se = sprite._statusEffects
        if (se) {
          se.chill.active = false; se.chill.timer = 0; se.chill.stacks = 0
          se.frozen.active = false; se.frozen.timer = 0
          if (se.ignite) { se.ignite.active = false; se.ignite.timer = 0; se.ignite.dps = 0; se.ignite._accum = 0 }
          if (se.shock)  { se.shock.active  = false; se.shock.timer  = 0 }
          if (se.bleed)  { se.bleed.active  = false; se.bleed.timer  = 0; se.bleed._accum = 0 }
        }
        sprite.dying = false
        sprite.setAlpha(1)
        sprite.disableBody(true, true)
      },
    })
  }

  static showDamageNumber(sprite, amount, color) {
    if (!amount || amount < 1) return
    const scene = sprite.scene
    const txt = scene.add.text(
      sprite.x + Phaser.Math.Between(-12, 12),
      sprite.y - 20,
      `${Math.round(amount)}`,
      { fontSize: '14px', color, stroke: '#000000', strokeThickness: 2 }
    ).setDepth(15).setOrigin(0.5)
    scene.tweens.add({
      targets: txt, y: txt.y - 28, alpha: 0, duration: 750,
      ease: 'Power1', onComplete: () => txt.destroy(),
    })
  }

  static takeDamage(sprite, amount, fromX, fromY, affixes = [], knockback = 80) {
    if (sprite.dying) return false

    const se    = sprite._statusEffects
    const scene = sprite.scene

    // Global damage multipliers
    let dmgMult = 1.0
    if (scene._glassCannon) dmgMult *= 3.0
    if (scene._ironWillMult) dmgMult *= scene._ironWillMult
    // Daimyo: +2% per stack per level
    if (scene._daimyoStacks) dmgMult *= (1 + scene._daimyoStacks * 0.02 * ((scene._level || 1) - 1))
    // Shock: +30% damage taken
    if (se?.shock?.active) dmgMult *= 1.30
    // Armor shred: amplify by shred amount
    if (sprite._armorShred) dmgMult *= (1 + sprite._armorShred)
    // Ice-Thunder keystone: double damage on frozen targets
    if (scene._keystonesOwned?.has('ice_thunder') && se?.frozen?.active) dmgMult *= 2.0
    // Dark aura: +25% damage to aura-marked enemies
    if (sprite._darkAura) dmgMult *= 1.25
    // Boss chest bonus (kijo kill reward)
    if (scene._bossChestBonus) dmgMult *= scene._bossChestBonus

    const critBonus  = scene._critBonus   || 0
    const critDmgBon = scene._critDmgBonus || 0
    const critChance = Math.min(1.0, CFG.CRIT_CHANCE + critBonus)
    const critMult   = CFG.CRIT_MULTIPLIER + critDmgBon
    const isCrit     = Math.random() < critChance

    const damage = Math.round(amount * dmgMult * (isCrit ? critMult : 1))
    sprite.hp -= damage

    // Culling — execute below 15% of base HP
    if (scene._procsOwned?.has('culling') && sprite.hp > 0 && sprite.maxHp > 0 && sprite.hp < sprite.maxHp * 0.15) {
      sprite.hp = 0
    }

    // Life leech — recover 1% of damage as HP
    if (scene._procsOwned?.has('life_leech') && scene._player) {
      scene._player.heal(damage * 0.01)
    }

    // Floating damage number
    const txt = sprite.scene.add.text(
      sprite.x + Phaser.Math.Between(-10, 10),
      sprite.y - 24,
      `${damage}`,
      isCrit
        ? { fontSize: '32px', color: '#ff2222', stroke: '#330000', strokeThickness: 5, fontStyle: 'bold' }
        : { fontSize: '24px', color: '#ffffff', stroke: '#333333', strokeThickness: 4 }
    ).setDepth(15).setOrigin(0.5)
    sprite.scene.tweens.add({
      targets:  txt,
      y:        txt.y - 48,
      alpha:    0,
      duration: isCrit ? 900 : 700,
      ease:     'Power2',
      onComplete: () => txt.destroy(),
    })

    // Knockback
    if (knockback > 0 && fromX !== undefined && fromY !== undefined) {
      const dx  = sprite.x - fromX
      const dy  = sprite.y - fromY
      const len = Math.hypot(dx, dy) || 1
      sprite.body.velocity.x = (dx / len) * knockback
      sprite.body.velocity.y = (dy / len) * knockback
      sprite.knockbackTimer  = knockback > 150 ? 240 : 140
    }

    // Hit flash
    if (!Enemy._hasStatusTint(sprite)) {
      sprite.setTint(0xff4444)
      sprite.scene.time.delayedCall(120, () => {
        if (sprite.active && !sprite.dying) Enemy._applyStatusTint(sprite)
      })
    }

    // Hit spark
    const sparks = sprite.scene.add.particles(sprite.x, sprite.y, 'dust-particle', {
      speed:    { min: 120, max: 280 },
      angle:    { min: 0, max: 360 },
      scale:    { start: 1.8, end: 0 },
      alpha:    { start: 1,   end: 0 },
      lifespan: 300,
      quantity: 8,
      tint:     [0xffee00, 0xff8800, 0xff3300],
      emitting: false,
    })
    sparks.setDepth(9)
    sparks.explode(8)
    sprite.scene.time.delayedCall(400, () => sparks.destroy())

    // Affix pipeline (elemental onHit hooks)
    for (const affix of affixes) {
      if (affix.onHit) affix.onHit(sprite, damage, sprite.scene)
    }

    if (sprite.hp <= 0) {
      Enemy._triggerDeath(sprite)
      return true
    }
    return false
  }

  static dealDamage(sprite, player) {
    if (sprite.damageCd > 0 || sprite.dying) return
    const scene = sprite.scene

    let dmgToPlayer = CFG.ENEMY_DAMAGE * (sprite._outputMult ?? 1.0)

    // Glass cannon — player takes double damage
    if (scene._glassCannon) dmgToPlayer *= 2

    // Iron body shield — absorb one hit
    if (scene._ironBodyShield) {
      scene._ironBodyShield = false
      sprite.damageCd = 1000
      return
    }

    // Tachi combo guard — reduce damage during combo
    if (scene._tachiComboGuardActive && scene._tachiComboGuardMult != null) {
      dmgToPlayer *= scene._tachiComboGuardMult
    }

    // Defense bonus — reduce incoming damage
    if (scene._defenseBonus) dmgToPlayer *= (1 - scene._defenseBonus)

    player.takeDamage(Math.max(1, Math.round(dmgToPlayer)))
    sprite.damageCd = 1000

    // Thorns — reflect 300% damage back to enemy
    if (scene._procsOwned?.has('thorns')) {
      const thornsDmg = CFG.ENEMY_DAMAGE * 3
      const dx = sprite.x - player.x, dy = sprite.y - player.y
      const len = Math.hypot(dx, dy) || 1
      sprite.body.velocity.x = (dx / len) * 250
      sprite.body.velocity.y = (dy / len) * 250
      sprite.knockbackTimer  = 200
      Enemy.takeDamage(sprite, thornsDmg, player.x, player.y, scene._affixes || [], 0)
    }
  }
}
