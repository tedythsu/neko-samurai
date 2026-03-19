// src/entities/Shuriken.js
import Phaser from 'phaser'
import { CFG } from '../config.js'

export default class Shuriken {
  static createTexture(scene) {
    if (scene.textures.exists('shuriken-tex')) return
    const rt = scene.add.renderTexture(0, 0, CFG.SHURIKEN_SIZE, CFG.SHURIKEN_SIZE)
    rt.fill(0x222244)
    rt.saveTexture('shuriken-tex')
    rt.destroy()
  }

  /**
   * Fire `count` shurikens in evenly-spaced angles around the player.
   * Each shuriken deactivates after travelling CFG.SHURIKEN_RANGE px.
   */
  static fire(scene, pool, fromX, fromY, count, damage) {
    for (let i = 0; i < count; i++) {
      let s = pool.getFirstDead(false)
      if (!s) {
        s = pool.create(fromX, fromY, 'shuriken-tex')
        s.setDepth(8)
        s.body.onWorldBounds = true
      }
      s.enableBody(true, fromX, fromY, true, true)
      s.damage  = damage
      s.hitSet  = new Set()
      s.spawnX  = fromX
      s.spawnY  = fromY

      const deg = (360 / count) * i
      scene.physics.velocityFromAngle(deg, CFG.SHURIKEN_SPEED, s.body.velocity)
    }
  }

  static update(sprite) {
    if (!sprite.active) return
    sprite.angle += 8
    // Deactivate once range exceeded
    if (Phaser.Math.Distance.Between(sprite.spawnX, sprite.spawnY, sprite.x, sprite.y) >= CFG.SHURIKEN_RANGE) {
      sprite.disableBody(true, true)
    }
  }
}
