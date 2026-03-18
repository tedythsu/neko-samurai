import Phaser from 'phaser'
import { MAPS } from '../data/maps.js'
import MetaProgress from '../systems/MetaProgress.js'

export default class MapSelectScene extends Phaser.Scene {
  constructor() { super('MapSelectScene') }

  create(data) {
    const { width: W, height: H } = this.scale
    const mp = new MetaProgress(); mp.load()
    this._charId = data.charId

    this.add.rectangle(0, 0, W, H, 0x0d0d1a).setOrigin(0)
    this.add.text(W/2, 20, '選擇戰場', { fontSize: '10px', color: '#f0d040', fontFamily: 'monospace' }).setOrigin(0.5)

    const maps = Object.values(MAPS)
    maps.forEach((map, i) => {
      const x = W * 0.2 + i * (W * 0.35)
      const locked = map.locked && !mp.isUnlocked(map.id)

      const card = this.add.rectangle(x, H/2, 100, 110, 0x1a1a2e)
      this.add.graphics().lineStyle(1, locked ? 0x333333 : 0xf0d04066).strokeRect(x-50, H/2-55, 100, 110)

      this.add.rectangle(x, H/2 - 20, 80, 55, map.bgColor || 0x1a2a0a)
      this.add.text(x, H/2 - 20, locked ? '🔒' : '🌿', { fontSize: '20px' }).setOrigin(0.5)
      this.add.text(x, H/2 + 20, map.name, { fontSize: '8px', color: locked ? '#555555' : '#f0e8d0', fontFamily: 'monospace' }).setOrigin(0.5)
      this.add.text(x, H/2 + 33, `難度 ${'★'.repeat(map.difficulty)}`, { fontSize: '7px', color: '#f0a030', fontFamily: 'monospace' }).setOrigin(0.5)

      if (!locked) {
        card.setInteractive()
        card.on('pointerover', () => card.setFillStyle(0xf0d04022))
        card.on('pointerout',  () => card.setFillStyle(0x1a1a2e))
        card.on('pointerdown', () => this.scene.start('GameScene', { charId: this._charId, mapId: map.id }))
      }
    })

    this.add.text(10, H-15, '← 返回', { fontSize:'7px', color:'#888888', fontFamily:'monospace' })
      .setInteractive().on('pointerdown', () => this.scene.start('CharSelectScene'))
  }
}
