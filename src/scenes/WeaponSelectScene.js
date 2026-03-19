// src/scenes/WeaponSelectScene.js
import Phaser from 'phaser'
import { ALL_WEAPONS } from '../weapons/index.js'

export default class WeaponSelectScene extends Phaser.Scene {
  constructor() { super('WeaponSelectScene') }

  create() {
    const choices = Phaser.Utils.Array.Shuffle(ALL_WEAPONS.slice()).slice(0, 3)
    const W = this.cameras.main.width
    const H = this.cameras.main.height

    this.add.rectangle(W / 2, H / 2, W, H, 0x0d0d1a)
    this.add.text(W / 2, H * 0.12, '選擇武器', {
      fontSize: '40px', color: '#ffffff',
    }).setOrigin(0.5)

    const cardW  = Math.min(220, (W - 80) / 3)
    const cardH  = 300
    const gap    = 30
    const totalW = cardW * 3 + gap * 2
    const startX = (W - totalW) / 2

    choices.forEach((weapon, i) => {
      const cx = startX + cardW / 2 + i * (cardW + gap)
      const cy = H / 2

      const bg = this.add.rectangle(cx, cy, cardW, cardH, 0x1a1a3a)
        .setStrokeStyle(1, 0x3333aa)
        .setInteractive()

      this.add.text(cx, cy - 110, weapon.name, { fontSize: '24px', color: '#ffdd88' }).setOrigin(0.5)
      this.add.text(cx, cy - 80,  weapon.desc, {
        fontSize: '13px', color: '#aaaaff', wordWrap: { width: cardW - 20 },
      }).setOrigin(0.5)

      const s = weapon.baseStats
      const statLines = [
        [`傷害  ${s.damage}`,                    '#ff8888'],
        [`射速  ${s.fireRate}ms`,                '#88ff88'],
        ...(s.projectileCount != null ? [[`彈數  ${s.projectileCount}`, '#ffff88']] : []),
        [`射程  ${s.range}px`,                   '#88ddff'],
      ]
      statLines.forEach(([label, color], j) => {
        this.add.text(cx, cy - 30 + j * 22, label, { fontSize: '13px', color }).setOrigin(0.5)
      })

      this.add.text(cx, cy + 70, '── 升級 ──', { fontSize: '11px', color: '#555577' }).setOrigin(0.5)
      weapon.upgrades.forEach((u, j) => {
        this.add.text(cx, cy + 88 + j * 16, u.name, { fontSize: '11px', color: '#7777aa' }).setOrigin(0.5)
      })

      bg.on('pointerover', () => bg.setFillStyle(0x2a2a5a))
      bg.on('pointerout',  () => bg.setFillStyle(0x1a1a3a))
      bg.on('pointerdown', () => this.scene.start('GameScene', { weapon }))
    })
  }
}
