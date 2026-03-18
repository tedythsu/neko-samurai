import Phaser from 'phaser'
import { CHARACTERS } from '../data/characters.js'

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, charId, metaBonuses = {}) {
    const charDef = CHARACTERS[charId]
    super(scene, x, y, charDef.spriteKey)
    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.charDef = charDef
    this._bonuses = metaBonuses

    // Stats
    const hpMult  = metaBonuses.hpMult  || 1
    const spdMult = metaBonuses.spdMult || 1
    this.maxHp    = charDef.stats.hp * hpMult
    this.hp       = this.maxHp
    this.speed    = charDef.stats.speed * spdMult
    this.luck     = charDef.stats.luck + (metaBonuses.luck || 0)
    this.atkMult  = metaBonuses.atkMult || 1
    this.xp       = 0
    this.level    = 1
    this.xpToNext = 20
    this.gold     = 0
    this.kills    = 0

    // Invincibility
    this._invincible  = false
    this._invincTime  = charId === 'yukihime' ? 750 : 500

    this.setScale(2)
    this.body.setCircle(8, 8, 8)
    this.setDepth(10)

    // Cursor keys
    this._keys = scene.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT')
  }

  update() {
    const { W, A, S, D, UP, DOWN, LEFT, RIGHT } = this._keys
    let vx = 0, vy = 0
    if (A.isDown || LEFT.isDown)  vx -= 1
    if (D.isDown || RIGHT.isDown) vx += 1
    if (W.isDown || UP.isDown)    vy -= 1
    if (S.isDown || DOWN.isDown)  vy += 1
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707 }
    this.setVelocity(vx * this.speed, vy * this.speed)
    if (vx !== 0) this.setFlipX(vx < 0)
  }

  takeDamage(amount, enemies, scene) {
    if (this._invincible) return
    this.hp = Math.max(0, this.hp - amount)
    this._invincible = true

    // Red flash overlay
    const flash = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0xff0000, 0.3).setOrigin(0).setDepth(100)
    scene.time.delayedCall(150, () => flash.destroy())

    // Blink tween
    scene.tweens.add({
      targets: this, alpha: 0.3,
      duration: 80, yoyo: true, repeat: Math.floor(this._invincTime / 160),
      onComplete: () => { this.alpha = 1; this._invincible = false },
    })

    // Knockback nearby enemies
    if (enemies) {
      enemies.getChildren().forEach(e => {
        if (!e.active) return
        const dist = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y)
        if (dist < 48) {
          const angle = Phaser.Math.Angle.Between(this.x, this.y, e.x, e.y)
          scene.tweens.add({
            targets: e,
            x: e.x + Math.cos(angle) * 30,
            y: e.y + Math.sin(angle) * 30,
            duration: 200,
          })
        }
      })
    }
  }

  gainXp(amount, metaBonuses) {
    const expMult = (metaBonuses || this._bonuses).expMult || 1
    this.xp += amount * expMult
    if (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext
      this.level++
      this.xpToNext = Math.floor(this.xpToNext * 1.3)
      return true // leveled up
    }
    return false
  }

  get isDead() { return this.hp <= 0 }
}
