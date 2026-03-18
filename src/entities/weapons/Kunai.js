import Phaser from 'phaser'
import { WEAPONS } from '../../data/weapons.js'

export default class Kunai {
  constructor(scene, player) {
    this.scene   = scene
    this.player  = player
    this.id      = 'kunai'
    this.level   = 1
    this._timer  = 0
    this._group  = scene.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize: 20, runChildUpdate: false })
  }

  get def() { return WEAPONS.kunai.levels[this.level - 1] }
  get group() { return this._group }

  update(delta, enemies) {
    this._timer += delta
    if (this._timer < this.def.cooldown) return
    this._timer = 0

    const allEnemies = enemies.getChildren().filter(e => e.active)
    if (allEnemies.length === 0) return

    // Sort by distance, shoot at closest N
    allEnemies.sort((a, b) => {
      const da = Phaser.Math.Distance.Between(this.player.x, this.player.y, a.x, a.y)
      const db = Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y)
      return da - db
    })

    const targets = allEnemies.slice(0, this.def.count)
    targets.forEach(target => {
      const proj = this._group.get(this.player.x, this.player.y, 'weapon_kunai')
      if (!proj) return
      proj.setActive(true).setVisible(true).setScale(1.5).setDepth(8)
      proj._pierce = this.def.pierce
      proj._damage = this.def.damage * (this.player.atkMult || 1)
      proj._hit = new Set()
      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x, target.y)
      this.scene.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), this.def.speed, proj.body.velocity)
      proj.setRotation(angle)
      // Auto-destroy after 1.5s
      this.scene.time.delayedCall(1500, () => { if (proj.active) { proj.setActive(false).setVisible(false) } })
    })
  }

  levelUp() { if (this.level < WEAPONS.kunai.levels.length) this.level++ }
}
