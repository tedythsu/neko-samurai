import Phaser from 'phaser'
import { WEAPONS } from '../../data/weapons.js'

export default class Tachi {
  constructor(scene, player) {
    this.scene  = scene
    this.player = player
    this.id     = 'tachi'
    this.level  = 1
    this._timer = 0
    // Visual slash arc
    this._slashGfx = scene.add.graphics().setDepth(9)
  }

  get def() { return WEAPONS.tachi.levels[this.level - 1] }
  get group() { return null } // arc uses graphics, not sprites

  update(delta, enemies) {
    this._timer += delta
    if (this._timer < this.def.cooldown) return
    this._timer = 0

    const arcRad = Phaser.Math.DegToRad(this.def.arc)
    const startAngle = -arcRad / 2
    const range = this.def.range * 2

    // Draw slash
    this._slashGfx.clear()
    this._slashGfx.fillStyle(0xffffc0, 0.5)
    this._slashGfx.slice(this.player.x, this.player.y, range, startAngle, startAngle + arcRad, false)
    this._slashGfx.fillPath()
    this.scene.time.delayedCall(120, () => this._slashGfx.clear())

    // Damage enemies in arc
    enemies.getChildren().forEach(e => {
      if (!e.active) return
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y)
      if (dist <= range) {
        const dmg = this.def.damage * (this.player.atkMult || 1)
        e.takeDamage(dmg)
      }
    })
  }

  levelUp() { if (this.level < WEAPONS.tachi.levels.length) this.level++ }
}
