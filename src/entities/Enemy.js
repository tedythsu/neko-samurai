// src/entities/Enemy.js
import Phaser from 'phaser'
import { CFG } from '../config.js'

export default class Enemy {
  // Slice kisotsu-run (6×6) into numbered frames and generate dust-particle texture.
  // Call once in GameScene.create() before creating the enemy group.
  static createTexture(scene) {
    const tex = scene.textures.get('kisotsu-run')
    if (tex.has(0)) return   // already sliced (guard for scene restart)
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

  /**
   * Activate a pooled enemy at position (x, y).
   * Call from GameScene when getting an enemy from the group.
   */
  static activate(sprite, x, y) {
    sprite.enableBody(true, x, y, true, true)
    sprite.hp             = CFG.ENEMY_HP
    sprite.damageCd       = 0
    sprite.knockbackTimer = 0
    sprite.dying          = false
    sprite._frame         = 0
    sprite._timer         = 0
    sprite.setAlpha(1).clearTint()
    sprite._statusEffects = {
      burn:   { stacks: 0, timer: 0, dps: 5 },
      poison: { stacks: 0, timer: 0 },
      chill:  { active: false, timer: 0 },
      curse:  { active: false, timer: 0 },
    }
    const frame0 = sprite.scene.textures.get('kisotsu-run').frames[0]
    const dH = 64
    const dW = Math.round(dH * frame0.realWidth / frame0.realHeight)
    sprite.setTexture('kisotsu-run', 0).setDisplaySize(dW, dH)
    sprite.body.setSize(18, 38)
  }

  /**
   * Per-frame update. Call in GameScene.update() for each active enemy.
   */
  static update(sprite, player, delta) {
    if (!sprite.active || sprite.dying) return

    if (sprite.knockbackTimer > 0) {
      sprite.knockbackTimer -= delta
    } else {
      const chilled = sprite._statusEffects && sprite._statusEffects.chill.active
      sprite.scene.physics.moveToObject(sprite, player.sprite, chilled ? CFG.ENEMY_SPEED * 0.5 : CFG.ENEMY_SPEED)
    }

    sprite.setFlipX(player.x < sprite.x)
    if (sprite.damageCd > 0) sprite.damageCd -= delta
    Enemy.updateStatus(sprite, delta)

    sprite._timer += delta
    while (sprite._timer >= 1000 / 12) {
      sprite._timer -= 1000 / 12
      sprite._frame  = (sprite._frame + 1) % 36
      sprite.setFrame(sprite._frame)
    }
  }

  static updateStatus(sprite, delta) {
    const se = sprite._statusEffects
    if (!se) return

    const scene      = sprite.scene
    const corrosion  = scene._resonances && scene._resonances.has('corrosion')
    const corrMult   = corrosion ? 1.5 : 1.0

    // Burn DoT
    if (se.burn.stacks > 0 && se.burn.timer > 0) {
      se.burn.timer -= delta
      sprite.hp     -= se.burn.dps * corrMult * (delta / 1000)
      if (se.burn.timer <= 0) se.burn.stacks = 0
      if (sprite.hp <= 0 && !sprite.dying) Enemy._triggerDeath(sprite)
    }

    // Poison DoT
    if (se.poison.stacks > 0 && se.poison.timer > 0 && !sprite.dying) {
      se.poison.timer -= delta
      sprite.hp       -= 3 * se.poison.stacks * corrMult * (delta / 1000)
      if (se.poison.timer <= 0) se.poison.stacks = 0
      if (sprite.hp <= 0 && !sprite.dying) Enemy._triggerDeath(sprite)
    }

    // Chill timer
    if (se.chill.active) {
      se.chill.timer -= delta
      if (se.chill.timer <= 0) se.chill.active = false
    }

    // Curse timer
    if (se.curse.active) {
      se.curse.timer -= delta
      if (se.curse.timer <= 0) se.curse.active = false
    }

    // Update visible tint based on status priority
    Enemy._applyStatusTint(sprite)
  }

  static _applyStatusTint(sprite) {
    if (sprite.dying)                                    { sprite.clearTint(); return }
    const se = sprite._statusEffects
    if (!se)                                             return
    if (se.burn.stacks > 0 && se.burn.timer > 0)        { sprite.setTint(0xff6600); return }
    if (se.poison.stacks > 0 && se.poison.timer > 0)    { sprite.setTint(0x44cc44); return }
    if (se.chill.active)                                 { sprite.setTint(0x88ccff); return }
    if (se.curse.active)                                 { sprite.setTint(0xaa44aa); return }
    sprite.clearTint()
  }

  static _hasStatusTint(sprite) {
    const se = sprite._statusEffects
    if (!se) return false
    return (se.burn.stacks > 0 && se.burn.timer > 0)   ||
           (se.poison.stacks > 0 && se.poison.timer > 0) ||
           se.chill.active || se.curse.active
  }

  static _triggerDeath(sprite) {
    if (sprite.dying) return
    const { x, y } = sprite
    const scene     = sprite.scene

    scene.events.emit('enemy-died', { x, y })
    sprite.dying = true
    sprite.clearTint()

    // Resonance: explode_burn — burning enemies explode on death
    if (scene._resonances && scene._resonances.has('explode_burn') &&
        sprite._statusEffects && sprite._statusEffects.burn.stacks > 0) {
      scene._enemies.getChildren()
        .filter(e => e.active && !e.dying && e !== sprite &&
          Phaser.Math.Distance.Between(x, y, e.x, e.y) < 60)
        .forEach(e => Enemy.takeDamage(e, CFG.ENEMY_HP * 0.3, x, y, []))
    }

    // Resonance: dark_harvest — cursed enemies explode on death + heal
    if (scene._resonances && scene._resonances.has('dark_harvest') &&
        sprite._statusEffects && sprite._statusEffects.curse.active) {
      scene._enemies.getChildren()
        .filter(e => e.active && !e.dying && e !== sprite &&
          Phaser.Math.Distance.Between(x, y, e.x, e.y) < 50)
        .forEach(e => Enemy.takeDamage(e, 15, x, y, []))
      if (scene._player) scene._player.heal(5)
    }

    // Delay physics disable so knockback plays out
    scene.time.delayedCall(150, () => {
      if (sprite.dying) sprite.body.enable = false
    })

    // Dust particle burst
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

    // Fade out then return to pool
    scene.tweens.add({
      targets:  sprite,
      alpha:    0,
      duration: 100,
      ease:     'Linear',
      onComplete: () => {
        // Full reset — activate() will re-initialize on next spawn, but clear here
        // to prevent stale state if any code path bypasses activate()
        if (sprite._statusEffects) {
          sprite._statusEffects.burn.stacks   = 0
          sprite._statusEffects.burn.timer    = 0
          sprite._statusEffects.poison.stacks = 0
          sprite._statusEffects.poison.timer  = 0
          sprite._statusEffects.chill.active  = false
          sprite._statusEffects.chill.timer   = 0
          sprite._statusEffects.curse.active  = false
          sprite._statusEffects.curse.timer   = 0
        }
        sprite.dying = false
        sprite.setAlpha(1)
        sprite.disableBody(true, true)
      },
    })
  }

  /**
   * Reduce enemy HP. Returns true if enemy died.
   */
  static takeDamage(sprite, amount, fromX, fromY, affixes = []) {
    if (sprite.dying) return false

    const se = sprite._statusEffects

    // Lucky affix: passive crit boost (handle before damage calc)
    const luckyCount = affixes.filter(a => a.id === 'lucky').length
    const critChance = Math.min(1.0, CFG.CRIT_CHANCE + luckyCount * 0.15)
    const critMult   = CFG.CRIT_MULTIPLIER + luckyCount * 0.5
    const isCrit     = Math.random() < critChance

    // Curse: +25% damage if target is cursed
    const curseMult = (se && se.curse.active) ? 1.25 : 1.0

    const damage = Math.round(amount * curseMult * (isCrit ? critMult : 1))
    sprite.hp -= damage

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

    // Knockback impulse — push enemy away from hit source
    if (fromX !== undefined && fromY !== undefined) {
      const dx  = sprite.x - fromX
      const dy  = sprite.y - fromY
      const len = Math.hypot(dx, dy) || 1
      sprite.body.velocity.x = (dx / len) * 250
      sprite.body.velocity.y = (dy / len) * 250
      sprite.knockbackTimer  = 150
    }

    // Hit flash (red tint, 120ms)
    if (!Enemy._hasStatusTint(sprite)) {
      sprite.setTint(0xff4444)
      sprite.scene.time.delayedCall(120, () => {
        if (sprite.active && !sprite.dying) Enemy._applyStatusTint(sprite)
      })
    }

    // Hit spark burst
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

    // Affix pipeline
    for (const affix of affixes) {
      if (affix.id !== 'lucky') affix.onHit(sprite, damage, sprite.scene)
    }

    if (sprite.hp <= 0) {
      Enemy._triggerDeath(sprite)
      return true
    }
    return false
  }

  /**
   * Deal contact damage to player (with cooldown).
   */
  static dealDamage(sprite, player) {
    if (sprite.damageCd > 0 || sprite.dying) return
    player.takeDamage(CFG.ENEMY_DAMAGE)
    sprite.damageCd = 1000
  }
}
