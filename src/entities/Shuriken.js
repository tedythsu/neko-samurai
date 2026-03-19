// src/entities/Shuriken.js
import Phaser from 'phaser'

const SPEED = 400
const SIZE  = 12

export default class Shuriken {
  static createTexture(scene) {
    if (scene.textures.exists('shuriken-tex')) return
    const rt = scene.add.renderTexture(0, 0, SIZE, SIZE)
    rt.fill(0x222244)
    rt.saveTexture('shuriken-tex')
    rt.destroy()
  }

  /**
   * Fire `count` shurikens from (fromX, fromY) toward the `count` nearest enemies.
   */
  static fire(scene, pool, fromX, fromY, enemies, count, damage) {
    const targets = Shuriken._nearestEnemies(enemies, fromX, fromY, count)
    targets.forEach(target => {
      let s = pool.getFirstDead(false)
      if (!s) {
        s = pool.create(fromX, fromY, 'shuriken-tex')
        s.setDepth(8)
        s.body.onWorldBounds = true
      }
      s.enableBody(true, fromX, fromY, true, true)
      s.damage = damage
      s.hitSet = new Set()  // enemies already hit by this shuriken

      const angle = Phaser.Math.Angle.Between(fromX, fromY, target.x, target.y)
      scene.physics.velocityFromAngle(
        Phaser.Math.RadToDeg(angle), SPEED, s.body.velocity
      )
    })
  }

  static update(sprite) {
    if (!sprite.active) return
    sprite.angle += 8
  }

  static _nearestEnemies(enemies, x, y, count) {
    return enemies
      .getChildren()
      .filter(e => e.active)
      .sort((a, b) =>
        Phaser.Math.Distance.Between(x, y, a.x, a.y) -
        Phaser.Math.Distance.Between(x, y, b.x, b.y)
      )
      .slice(0, count)
  }
}
