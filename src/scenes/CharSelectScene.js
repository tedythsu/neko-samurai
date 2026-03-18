import Phaser from 'phaser'
import { CHARACTERS } from '../data/characters.js'
import MetaProgress from '../systems/MetaProgress.js'

export default class CharSelectScene extends Phaser.Scene {
  constructor() { super('CharSelectScene') }

  create() {
    const { width: W, height: H } = this.scale
    const mp = new MetaProgress()
    mp.load()

    this.add.rectangle(0, 0, W, H, 0x0d0d1a).setOrigin(0)
    this.add.text(W/2, 20, '選擇貓咪武士', { fontSize: '10px', color: '#f0d040', fontFamily: 'monospace' }).setOrigin(0.5)

    const chars = Object.values(CHARACTERS)
    chars.forEach((char, i) => {
      const x = W * 0.25 + i * (W * 0.5)
      const locked = char.locked && !mp.isUnlocked(char.id)

      const card = this.add.rectangle(x, H/2, 90, 120, locked ? 0x1a1a2e : 0x1a1a3e)
      this.add.graphics().lineStyle(1, locked ? 0x444444 : 0xf0d04066).strokeRect(x - 45, H/2 - 60, 90, 120)

      if (locked) {
        this.add.text(x, H/2, '🔒', { fontSize: '24px' }).setOrigin(0.5)
        this.add.text(x, H/2 + 30, '需武魂解鎖', { fontSize: '6px', color: '#666666', fontFamily: 'monospace' }).setOrigin(0.5)
      } else {
        this.add.image(x, H/2 - 20, char.spriteKey).setScale(2)
        this.add.text(x, H/2 + 10, char.name, { fontSize: '8px', color: '#f0e8d0', fontFamily: 'monospace' }).setOrigin(0.5)
        this.add.text(x, H/2 + 22, char.breed, { fontSize: '6px', color: '#888888', fontFamily: 'monospace' }).setOrigin(0.5)
        this.add.text(x, H/2 + 38, `HP: ${char.stats.hp}  SPD: ${char.stats.speed}`, { fontSize: '6px', color: '#aaaaaa', fontFamily: 'monospace' }).setOrigin(0.5)

        card.setInteractive()
        card.on('pointerover', () => card.setFillStyle(0xf0d04022))
        card.on('pointerout',  () => card.setFillStyle(0x1a1a3e))
        card.on('pointerdown', () => {
          this.scene.start('MapSelectScene', { charId: char.id })
        })
      }
    })

    this.add.text(10, H - 15, '← 返回', { fontSize: '7px', color: '#888888', fontFamily: 'monospace' })
      .setInteractive().on('pointerdown', () => this.scene.start('MenuScene'))
  }
}
