// src/scenes/UpgradeScene.js
import Phaser from 'phaser'

const CATEGORY = {
  weapon:    { color: 0xc8a84b, label: '武器',   text: '#c8a84b' },
  elemental: { color: 0x8888ee, label: '元素',   text: '#aaaaff' },
  proc:      { color: 0x44ccff, label: '觸發',   text: '#44ccff' },
  keystone:  { color: 0xff4444, label: '傳奇',   text: '#ff8888' },
  passive:   { color: 0x44ddbb, label: '被動',   text: '#55eedd' },
}

const ELEMENTAL_COLOR = {
  ignite:      0xff4400,
  chill:       0x88ccff,
  shock:       0xffee00,
  bleed:       0xcc44ff,
  armor_shred: 0x884400,
}

export default class UpgradeScene extends Phaser.Scene {
  constructor() { super('UpgradeScene') }

  init(data) {
    this._level    = data.level
    this._upgrades = data.upgrades
  }

  create() {
    const { width: W, height: H } = this.cameras.main

    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.80)

    const gfx = this.add.graphics()
    gfx.lineStyle(1, 0xb8943f, 0.4)
    gfx.lineBetween(W * 0.08, H * 0.19, W * 0.92, H * 0.19)
    gfx.lineBetween(W * 0.08, H * 0.85, W * 0.92, H * 0.85)

    this.add.text(W / 2, H * 0.09, `Level  ${this._level}`, {
      fontSize: '36px', color: '#c8a84b',
      fontFamily: '"Cinzel", "Palatino Linotype", serif',
      fontStyle: 'bold',
      stroke: '#3a2800', strokeThickness: 3,
    }).setOrigin(0.5)

    this.add.text(W / 2, H * 0.205, '選擇強化', {
      fontSize: '14px', color: '#6a5e40',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
    }).setOrigin(0.5)

    const cardW   = Math.min(252, (W - 120) / 3)
    const cardH   = 196
    const spacing = cardW + 22
    const startX  = W / 2 - spacing
    const cardY   = H / 2 + H * 0.025

    this._containers = []
    this._upgrades.forEach((upg, i) => {
      this._buildCard(startX + i * spacing, cardY, cardW, cardH, upg, i)
    })
  }

  _buildCard(cx, cy, w, minH, upg, idx) {
    const cat = CATEGORY[upg.target] || CATEGORY.passive
    let accent = cat.color
    if (upg.target === 'elemental' && upg.elemental) {
      accent = ELEMENTAL_COLOR[upg.elemental.id] ?? cat.color
    }

    const tmpName = this.add.text(-9999, -9999, upg.name, {
      fontSize: '15px',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
      fontStyle: 'bold',
      wordWrap: { width: w - 44, useAdvancedWrap: true },
    })
    const tmpDesc = this.add.text(-9999, -9999, upg.desc || '', {
      fontSize: '11px',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
      wordWrap: { width: w - 36, useAdvancedWrap: true },
      lineSpacing: 3,
    })
    const nameH = tmpName.height
    const descH = tmpDesc.height
    tmpName.destroy()
    tmpDesc.destroy()

    const NAME_TOP = 24
    const SEP_Y    = NAME_TOP + nameH + 10
    const DESC_TOP = SEP_Y + 10
    const h = Math.max(minH, DESC_TOP + descH + 14)

    const container = this.add.container(cx, cy)

    const bg = this.add.rectangle(0, 0, w, h, 0x0b0b1c)
      .setStrokeStyle(1, 0x2a2a42)
      .setInteractive()

    const strip = this.add.rectangle(-w / 2 + 2, 0, 4, h - 2, accent, 1)

    const badge = this.add.text(w / 2 - 10, -h / 2 + 12, cat.label, {
      fontSize: '9px', color: cat.text,
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
    }).setOrigin(1, 0)

    const nameText = this.add.text(-w / 2 + 18, -h / 2 + NAME_TOP, upg.name, {
      fontSize: '15px', color: '#f0e8d0',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
      fontStyle: 'bold',
      wordWrap: { width: w - 44, useAdvancedWrap: true },
    }).setOrigin(0, 0)

    const sepGfx = this.add.graphics()
    sepGfx.lineStyle(1, accent, 0.25)
    sepGfx.lineBetween(-w / 2 + 14, -h / 2 + SEP_Y, w / 2 - 14, -h / 2 + SEP_Y)

    const descText = this.add.text(-w / 2 + 18, -h / 2 + DESC_TOP, upg.desc || '', {
      fontSize: '11px', color: '#6a6878',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
      wordWrap: { width: w - 36, useAdvancedWrap: true },
      lineSpacing: 3,
    }).setOrigin(0, 0)

    container.add([bg, strip, badge, nameText, sepGfx, descText])
    this._containers.push(container)

    container.setAlpha(0).setY(cy + 26)
    this.tweens.add({
      targets: container, alpha: 1, y: cy,
      duration: 310, delay: idx * 85, ease: 'Back.easeOut',
    })

    bg.on('pointerover', () => {
      bg.setFillStyle(0x14142a).setStrokeStyle(1.5, accent, 0.9)
      this.tweens.add({ targets: container, scaleX: 1.04, scaleY: 1.04, duration: 100 })
    })
    bg.on('pointerout', () => {
      bg.setFillStyle(0x0b0b1c).setStrokeStyle(1, 0x2a2a42)
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 120 })
    })
    bg.on('pointerdown', () => this._choose(upg))
  }

  _choose(upgrade) {
    this._containers.forEach(c => c.getAt(0).removeInteractive())

    const last = this._containers.length - 1
    this._containers.forEach((c, i) => {
      this.tweens.add({
        targets: c, alpha: 0, y: c.y + 26,
        duration: 200, delay: i * 50, ease: 'Back.easeIn',
        onComplete: i === last ? () => {
          this.scene.get('GameScene').events.emit('upgrade-chosen', upgrade)
          this.scene.stop()
        } : undefined,
      })
    })
  }
}
