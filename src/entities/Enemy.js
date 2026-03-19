// src/entities/Enemy.js
import { CFG } from '../config.js'

export default class Enemy {
  /**
   * Call once per scene to register the 'enemy-tex' texture.
   * Must be called in GameScene.create() before creating the group.
   */
  static createTexture(scene) {
    if (scene.textures.exists('enemy-tex')) return
    const rt = scene.add.renderTexture(0, 0, 40, 40)
    rt.fill(0xcc2222)
    const lbl = scene.add.text(0, 0, '鬼', {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
    })
    rt.draw(lbl, 8, 8)
    rt.saveTexture('enemy-tex')
    lbl.destroy()
    rt.destroy()
  }

  /**
   * Activate a pooled enemy at position (x, y).
   * Call from GameScene when getting an enemy from the group.
   */
  static activate(sprite, x, y) {
    sprite.enableBody(true, x, y, true, true)
    sprite.hp         = CFG.ENEMY_HP
    sprite.damageCd   = 0     // cooldown timer ms
  }

  /**
   * Per-frame update. Call in GameScene.update() for each active enemy.
   */
  static update(sprite, player, delta) {
    if (!sprite.active) return
    sprite.scene.physics.moveToObject(sprite, player.sprite, CFG.ENEMY_SPEED)
    if (sprite.damageCd > 0) sprite.damageCd -= delta
  }

  /**
   * Reduce enemy HP. Returns true if enemy died.
   */
  static takeDamage(sprite, amount) {
    sprite.hp -= amount
    if (sprite.hp <= 0) {
      const { x, y } = sprite
      sprite.disableBody(true, true)
      sprite.scene.events.emit('enemy-died', { x, y })
      return true
    }
    return false
  }

  /**
   * Deal contact damage to player (with cooldown).
   */
  static dealDamage(sprite, player) {
    if (sprite.damageCd > 0) return
    player.takeDamage(CFG.ENEMY_DAMAGE)
    sprite.damageCd = 1000   // 1 second cooldown
  }
}
