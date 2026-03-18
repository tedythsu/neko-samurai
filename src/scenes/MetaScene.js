import Phaser from 'phaser'
import MetaProgress from '../systems/MetaProgress.js'

export default class MetaScene extends Phaser.Scene {
  constructor() { super('MetaScene') }

  create() {
    const { width: W, height: H } = this.scale
    this._mp = new MetaProgress()

    this.add.rectangle(0, 0, W, H, 0x0d0d1a).setOrigin(0)
    this.add.text(W/2, 14, '⚔ 武魂強化', { fontSize: '10px', color: '#f0d040', fontFamily: 'monospace' }).setOrigin(0.5)

    this._soulsTxt = this.add.text(W/2, 28, `🔮 ${this._mp.data.souls}`, {
      fontSize: '8px', color: '#aa88ff', fontFamily: 'monospace',
    }).setOrigin(0.5)

    const nodes = Object.entries(MetaProgress.NODE_DEFS)
    const cols = 5, startX = W * 0.12, startY = 50, gapX = W * 0.175, gapY = 36

    nodes.forEach(([id, def], idx) => {
      const col = idx % cols, row = Math.floor(idx / cols)
      const x = startX + col * gapX, y = startY + row * gapY
      const cur = this._mp.data.nodes[id] || 0
      const maxed = cur >= def.max

      const canAfford = this._mp.data.souls >= def.cost
      const tileColor = maxed ? 0xf0a030 : (cur > 0 ? 0x1a3a1a : 0x1a1a2e)
      const tile = this.add.rectangle(x, y, 42, 30, tileColor).setStrokeStyle(1, maxed ? 0xf0a030 : 0x444444)

      const icons = { atk:'⚔',hp:'❤',spd:'💨',luck:'🍀',pickup:'🧲',cd:'❄',gold:'💰',exp:'✨',char_kuroka:'🐱',map_shrine:'⛩' }
      this.add.text(x, y - 4, icons[id] || '?', { fontSize: '10px' }).setOrigin(0.5)
      this.add.text(x, y + 8, maxed ? 'MAX' : `${cur}/${def.max}`, {
        fontSize: '5px', color: maxed ? '#f0a030' : '#888888', fontFamily: 'monospace',
      }).setOrigin(0.5)

      if (!maxed) {
        this.add.text(x + 18, y + 12, `${def.cost}`, { fontSize: '5px', color: '#aa88ff', fontFamily: 'monospace' }).setOrigin(1)
        tile.setInteractive()
        tile.on('pointerover', () => tile.setStrokeStyle(1, canAfford ? 0xf0d040 : 0xcc4444))
        tile.on('pointerout',  () => tile.setStrokeStyle(1, 0x444444))
        tile.on('pointerdown', () => {
          if (this._mp.upgradeNode(id)) {
            this._mp.save()
            this.scene.restart()
          }
        })
      }
    })

    this.add.text(10, H-14, '← 返回', { fontSize:'7px', color:'#888888', fontFamily:'monospace' })
      .setInteractive().on('pointerdown', () => this.scene.start('MenuScene'))
  }
}
