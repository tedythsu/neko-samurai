// src/entities/Enemy.js
import Phaser from 'phaser'
import { CFG } from '../config.js'

export default class Enemy {
  /**
   * Call once per scene to register the 'enemy-tex' texture.
   * Must be called in GameScene.create() before creating the group.
   */
  // Slice the kisotsu-run spritesheet (6×6 grid) into numbered frames.
  // Also generates the dust-particle texture used by the death effect.
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
      sprite.scene.physics.moveToObject(sprite, player.sprite, CFG.ENEMY_SPEED)
    }

    sprite.setFlipX(player.x < sprite.x)
    if (sprite.damageCd > 0) sprite.damageCd -= delta

    sprite._timer += delta
    while (sprite._timer >= 1000 / 12) {
      sprite._timer -= 1000 / 12
      sprite._frame  = (sprite._frame + 1) % 36
      sprite.setFrame(sprite._frame)
    }
  }

  /**
   * Reduce enemy HP. Returns true if enemy died.
   */
  static takeDamage(sprite, amount, fromX, fromY) {
    if (sprite.dying) return false

    const isCrit   = Math.random() < CFG.CRIT_CHANCE
    const damage   = isCrit ? Math.round(amount * CFG.CRIT_MULTIPLIER) : amount
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
    sprite.setTint(0xff4444)
    sprite.scene.time.delayedCall(120, () => {
      if (sprite.active && !sprite.dying) sprite.clearTint()
    })

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

    if (sprite.hp <= 0) {
      const { x, y } = sprite
      sprite.scene.events.emit('enemy-died', { x, y })
      sprite.dying = true
      sprite.clearTint()

      // Delay physics disable so knockback velocity plays out first
      sprite.scene.time.delayedCall(150, () => {
        if (sprite.dying) sprite.body.enable = false
      })

      // Dust particle burst
      const emitter = sprite.scene.add.particles(x, y, 'dust-particle', {
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
      sprite.scene.time.delayedCall(600, () => emitter.destroy())

      // Quick sprite fade-out (100ms) then return to pool
      sprite.scene.tweens.add({
        targets:  sprite,
        alpha:    0,
        duration: 100,
        ease:     'Linear',
        onComplete: () => {
          sprite.dying = false
          sprite.setAlpha(1)
          sprite.disableBody(true, true)
        },
      })
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
