// src/scenes/UpgradeScene.js
import Phaser from 'phaser'

export default class UpgradeScene extends Phaser.Scene {
  constructor() { super('UpgradeScene') }

  init(data) {
    this._level    = data.level
    this._upgrades = data.upgrades   // array of 3 upgrade objects
  }

  create() {
    const { width: W, height: H } = this.cameras.main

    // Semi-transparent overlay
    this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.7)

    this.add.text(W/2, H * 0.15, `Level ${this._level}!`, {
      fontSize: '36px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0.5)

    this.add.text(W/2, H * 0.25, '選擇強化', {
      fontSize: '20px', color: '#cccccc',
    }).setOrigin(0.5)

    const cardW = Math.min(200, W * 0.28)
    const cardH = 140
    const spacing = cardW + 20
    const startX  = W/2 - spacing

    this._upgrades.forEach((upg, i) => {
      const cx = startX + i * spacing
      const cy = H / 2

      const bg = this.add.rectangle(cx, cy, cardW, cardH, 0x1a1a3e)
        .setStrokeStyle(2, 0x6666cc)
        .setInteractive()

      this.add.text(cx, cy - 30, upg.name, {
        fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5)

      this.add.text(cx, cy + 10, upg.desc, {
        fontSize: '13px', color: '#aaaaaa', wordWrap: { width: cardW - 20 },
      }).setOrigin(0.5)

      bg.on('pointerover',  () => bg.setFillColor(0x2a2a5e))
      bg.on('pointerout',   () => bg.setFillColor(0x1a1a3e))
      bg.on('pointerdown',  () => this._choose(upg))
    })
  }

  _choose(upgrade) {
    this.scene.get('GameScene').events.emit('upgrade-chosen', upgrade)
    this.scene.stop()
  }
}
