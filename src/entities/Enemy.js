import Phaser from 'phaser'
import { ENEMIES } from '../data/enemies.js'

const FAR_THRESHOLD = 400 // px — beyond this, skip arcade physics

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'enemy_oni')
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.setActive(false).setVisible(false)
  }

  spawn(x, y, enemyId, hpOverride) {
    const def = ENEMIES[enemyId]
    this.setActive(true).setVisible(true).setPosition(x, y)
    this.enemyId   = enemyId
    this.enemyDef  = def
    this.hp        = hpOverride ?? def.hp
    this.maxHp     = this.hp
    this.speed     = def.speed
    this.damage    = def.damage
    this._isBoss   = def.isBoss || false
    this._behavior = def.behavior || 'chase'
    this._dashCooldown = 0

    const s = def.isBoss ? 2.5 : 1.5
    this.setScale(s)
    this.setTexture(def.isBoss ? 'enemy_boss' : 'enemy_oni')
    this.setTint(def.color)
    this.body.setCircle(def.size * 0.6)
    this.setDepth(5)
    return this
  }

  update(player, delta) {
    if (!this.active || !player?.active) return

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y)

    if (dist > FAR_THRESHOLD) {
      // Lightweight vector movement — skip arcade physics
      const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y)
      this.x += Math.cos(angle) * this.speed * (delta / 1000)
      this.y += Math.sin(angle) * this.speed * (delta / 1000)
      this.body.reset(this.x, this.y)
      return
    }

    if (this._behavior === 'dash' && this._dashCooldown <= 0 && dist < 150) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y)
      this.scene.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), this.speed * 4, this.body.velocity)
      this._dashCooldown = 3000
    } else {
      this.scene.physics.moveToObject(this, player, this.speed)
      this._dashCooldown -= delta
    }
  }

  takeDamage(amount) {
    this.hp -= amount
    this.setTint(0xffffff)
    this.scene.time.delayedCall(80, () => { if (this.active) this.setTint(this.enemyDef.color) })
    if (this.hp <= 0) { this.die(); return true }
    return false
  }

  die() {
    this.setActive(false).setVisible(false)
    this.body.reset(0, 0)
  }
}
