// src/entities/Enemy.js
import { CFG } from '../config.js'

export default class Enemy {
  /**
   * Call once per scene to register the 'enemy-tex' texture.
   * Must be called in GameScene.create() before creating the group.
   */
  // Slice the kisotsu-run spritesheet (6×6 grid) into numbered frames.
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
    const dH = 100
    const dW = Math.round(dH * frame0.realWidth / frame0.realHeight)
    sprite.setTexture('kisotsu-run', 0).setDisplaySize(dW, dH)
    sprite.body.setSize(40, 60)
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
    sprite.hp -= amount

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

    if (sprite.hp <= 0) {
      const { x, y } = sprite
      sprite.scene.events.emit('enemy-died', { x, y })
      sprite.dying        = true
      sprite.body.enable  = false   // stop collisions immediately
      sprite.clearTint()
      sprite.scene.tweens.add({
        targets:  sprite,
        alpha:    0,
        duration: 500,
        ease:     'Linear',
        onComplete: () => {
          sprite.dying = false
          sprite.setAlpha(1)
          sprite.disableBody(true, true)   // return to pool
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
