import Phaser from 'phaser'
import { WEAPONS } from '../../data/weapons.js'

export default class Shikigami {
  constructor(scene, player) {
    this.scene   = scene
    this.player  = player
    this.id      = 'shikigami'
    this.level   = 1
    this._angle  = 0
    this._timer  = 0
    this._orbs   = []
    this._updateOrbs()
  }

  get def() { return WEAPONS.shikigami.levels[this.level - 1] }
  get group() { return null }

  _updateOrbs() {
    this._orbs.forEach(o => o.destroy())
    this._orbs = []
    for (let i = 0; i < this.def.count; i++) {
      const orb = this.scene.add.circle(0, 0, 5, 0xffaa44, 0.85).setDepth(9)
      this._orbs.push(orb)
    }
  }

  update(delta, enemies) {
    this._angle += this.def.orbitSpeed * (delta / 1000)
    this._timer += delta

    const r = this.def.orbitRadius
    this._orbs.forEach((orb, i) => {
      const a = this._angle + (i * Math.PI * 2 / this.def.count)
      orb.setPosition(this.player.x + Math.cos(a) * r, this.player.y + Math.sin(a) * r)
    })

    if (this._timer < this.def.cooldown) return
    this._timer = 0

    // Damage enemies touching any orb
    enemies.getChildren().forEach(e => {
      if (!e.active) return
      for (const orb of this._orbs) {
        const dist = Phaser.Math.Distance.Between(orb.x, orb.y, e.x, e.y)
        if (dist < 14) {
          e.takeDamage(this.def.damage * (this.player.atkMult || 1))
          break
        }
      }
    })
  }

  levelUp() {
    if (this.level < WEAPONS.shikigami.levels.length) {
      this.level++
      this._updateOrbs()
    }
  }

  destroy() { this._orbs.forEach(o => o.destroy()) }
}
