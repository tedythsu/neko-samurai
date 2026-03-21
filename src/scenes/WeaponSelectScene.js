// src/scenes/WeaponSelectScene.js
import Phaser from 'phaser'
import { ALL_WEAPONS } from '../weapons/index.js'

const ACCENT_COLORS = [0xd47c3a, 0x3a8fd4, 0x5ab84c, 0xc44ab8]

export default class WeaponSelectScene extends Phaser.Scene {
  constructor() { super('WeaponSelectScene') }

  create() {
    const choices = Phaser.Utils.Array.Shuffle(ALL_WEAPONS.slice()).slice(0, 3)
    const W = this.cameras.main.width
    const H = this.cameras.main.height

    // Background
    this.add.rectangle(W / 2, H / 2, W, H, 0x07070f)

    // Decorative rules
    const gfx = this.add.graphics()
    gfx.lineStyle(1, 0xb8943f, 0.4)
    gfx.lineBetween(W * 0.06, H * 0.205, W * 0.94, H * 0.205)
    gfx.lineBetween(W * 0.06, H * 0.84,  W * 0.94, H * 0.84)

    // Sub-title
    this.add.text(W / 2, H * 0.10, '猫の侍伝', {
      fontSize: '13px', color: '#5a4e34',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
    }).setOrigin(0.5)

    // Main title
    this.add.text(W / 2, H * 0.148, '武器選擇', {
      fontSize: '32px', color: '#f0e6d0',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
      fontStyle: 'bold',
      stroke: '#1a1008', strokeThickness: 4,
    }).setOrigin(0.5)

    // Cards
    const cardW  = Math.min(230, (W - 120) / 3)
    const cardH  = 200
    const gap    = 28
    const totalW = cardW * 3 + gap * 2
    const startX = (W - totalW) / 2 + cardW / 2
    const cardY  = H * 0.505

    choices.forEach((weapon, i) => {
      this._buildCard(startX + i * (cardW + gap), cardY, cardW, cardH, weapon, i)
    })
  }

  _buildCard(cx, cy, w, h, weapon, idx) {
    const accent = ACCENT_COLORS[idx % ACCENT_COLORS.length]
    const container = this.add.container(cx, cy)

    // Background
    const bg = this.add.rectangle(0, 0, w, h, 0x0d0d1e)
      .setStrokeStyle(1, 0x252535)
      .setInteractive()

    // Top accent strip
    const strip = this.add.rectangle(0, -h / 2 + 3, w, 6, accent, 1)

    // Icon
    const iconY = -28
    let icon
    if (weapon.iconKey) {
      icon = this.add.image(0, iconY, weapon.iconKey, weapon.iconFrame ?? undefined)
      const maxDim = Math.max(icon.width, icon.height)
      icon.setScale(72 / maxDim)
    } else {
      icon = this.add.text(0, iconY, weapon.iconChar ?? '?', {
        fontSize: '52px',
        fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
        color: '#f0e6d0',
      }).setOrigin(0.5, 0.5)
    }

    // Weapon name
    const nameText = this.add.text(0, h / 2 - 42, weapon.name, {
      fontSize: '22px', color: '#f0e6d0',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0)

    container.add([bg, strip, icon, nameText])

    // Entrance animation
    container.setAlpha(0).setY(cy + 22)
    this.tweens.add({
      targets: container, alpha: 1, y: cy,
      duration: 360, delay: idx * 95, ease: 'Back.easeOut',
    })

    // Hover
    bg.on('pointerover', () => {
      bg.setFillStyle(0x141428).setStrokeStyle(1.5, accent, 0.85)
      this.tweens.add({ targets: container, scaleX: 1.03, scaleY: 1.03, duration: 100 })
    })
    bg.on('pointerout', () => {
      bg.setFillStyle(0x0d0d1e).setStrokeStyle(1, 0x252535)
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 120 })
    })
    bg.on('pointerdown', () => this.scene.start('GameScene', { weapon }))
  }
}
