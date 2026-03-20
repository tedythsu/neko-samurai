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
    const cardH  = 330
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

    // Weapon name
    const nameText = this.add.text(0, -h / 2 + 22, weapon.name, {
      fontSize: '21px', color: '#f0e6d0',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0)

    // Description
    const descText = this.add.text(0, -h / 2 + 54, weapon.desc, {
      fontSize: '11px', color: '#6a6880',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
      wordWrap: { width: w - 28 }, align: 'center',
    }).setOrigin(0.5, 0)

    // Divider
    const divGfx = this.add.graphics()
    divGfx.lineStyle(1, accent, 0.3)
    divGfx.lineBetween(-w / 2 + 16, -h / 2 + 90, w / 2 - 16, -h / 2 + 90)

    // Stats
    const s = weapon.baseStats
    const statDefs = [
      ['傷害', String(Math.round(s.damage)),         '#e07070'],
      ['速度', `${s.fireRate}ms`,                    '#70c070'],
      ...(s.projectileCount != null ? [['彈數', String(s.projectileCount), '#d4d470']] : []),
      ...(s.sickleCount     != null ? [['鎌刃', String(s.sickleCount),     '#d4a060']] : []),
    ]

    let sy = -h / 2 + 102
    const statElems = statDefs.flatMap(([label, val, col]) => {
      const lbl = this.add.text(-w / 2 + 18, sy, label, {
        fontSize: '11px', color: '#555570',
        fontFamily: '"Noto Serif JP", serif',
      }).setOrigin(0, 0)
      const val_ = this.add.text(w / 2 - 18, sy, val, {
        fontSize: '11px', color: col,
        fontFamily: '"Cinzel", "Palatino Linotype", serif',
      }).setOrigin(1, 0)
      sy += 19
      return [lbl, val_]
    })

    // Upgrade header
    const upgY = sy + 10
    const upgHeader = this.add.text(0, upgY, '── 升級 ──', {
      fontSize: '10px', color: '#3a384e',
      fontFamily: '"Noto Serif JP", serif',
    }).setOrigin(0.5, 0)

    let uy = upgY + 16
    const upgElems = weapon.upgrades.slice(0, 5).map(u => {
      const t = this.add.text(0, uy, u.name, {
        fontSize: '10px', color: '#4e4c66',
        fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
        wordWrap: { width: w - 28 }, align: 'center',
      }).setOrigin(0.5, 0)
      uy += 17
      return t
    })

    container.add([bg, strip, nameText, descText, divGfx, ...statElems, upgHeader, ...upgElems])

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
