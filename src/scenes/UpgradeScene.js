import Phaser from 'phaser'

const RARITY_COLORS = { common: 0x888888, rare: 0x4080ff, epic: 0xc060ff }
const RARITY_LABELS = { common: '普通', rare: '稀有', epic: '史詩' }

export default class UpgradeScene extends Phaser.Scene {
  constructor() { super({ key: 'UpgradeScene', active: false }) }

  create(data) {
    const { width: W, height: H } = this.scale
    const { cards, onChoice } = data
    this._onChoice = onChoice

    // Dimmed overlay
    this.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0).setDepth(0)

    // Title
    this.add.text(W/2, 18, '✦ 等級提升 ✦', {
      fontSize: '9px', color: '#f0d040', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(10)
    this.add.text(W/2, 30, '選擇一項強化', {
      fontSize: '7px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(10)

    // Scroll cards
    cards.forEach((card, i) => {
      const targetX = W * 0.2 + i * (W * 0.3)
      const startY  = -80
      const targetY = H / 2 + 10
      this._buildScroll(card, targetX, startY, targetY, i * 80)
    })
  }

  _buildScroll(card, x, startY, targetY, delay) {
    const container = this.add.container(x, startY).setDepth(10)

    const rarityColor = RARITY_COLORS[card.rarity] || 0x888888
    const bg = this.add.rectangle(0, 0, 100, 140, 0xe8dbb0, 0.95).setStrokeStyle(2, rarityColor)
    const seal = this.add.circle(0, -62, 8, rarityColor, 0.8)
    const sealTxt = this.add.text(0, -62, RARITY_LABELS[card.rarity][0], {
      fontSize: '6px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5)

    const icon = this.add.text(0, -25, card.icon || (card.type === 'weapon' ? '⚔️' : '📜'), {
      fontSize: '20px',
    }).setOrigin(0.5)
    const name = this.add.text(0, 15, card.name, {
      fontSize: '7px', color: '#1a0a00', fontFamily: 'monospace', wordWrap: { width: 88 }, align: 'center',
    }).setOrigin(0.5)
    const lvlTxt = card.type === 'weapon'
      ? this.add.text(0, 30, `Lv.${card.level}`, { fontSize: '7px', color: '#664400', fontFamily: 'monospace' }).setOrigin(0.5)
      : this.add.text(0, 30, '', { fontSize: '6px' })
    const rarityLabel = this.add.text(0, 55, RARITY_LABELS[card.rarity], {
      fontSize: '6px', fontFamily: 'monospace', color: `#${rarityColor.toString(16).padStart(6, '0')}`,
    }).setOrigin(0.5)

    const rodTop = this.add.rectangle(0, -70, 108, 6, 0x8b6914)
    const rodBot = this.add.rectangle(0,  70, 108, 6, 0x8b6914)

    container.add([bg, seal, sealTxt, rodTop, rodBot, icon, name, lvlTxt, rarityLabel])

    bg.setInteractive(new Phaser.Geom.Rectangle(-50, -70, 100, 140), Phaser.Geom.Rectangle.Contains)
    bg.on('pointerover', () => { this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 100 }) })
    bg.on('pointerout',  () => { this.tweens.add({ targets: container, scaleX: 1.0,  scaleY: 1.0,  duration: 100 }) })
    bg.on('pointerdown', () => this._choose(card, container))

    // Unfurl tween
    this.tweens.add({ targets: container, y: targetY, duration: 300, delay, ease: 'Back.Out' })
  }

  _choose(card, chosen) {
    this.children.list
      .filter(c => c !== chosen && c.type === 'Container')
      .forEach(c => this.tweens.add({ targets: c, y: this.scale.height + 80, duration: 200 }))
    this.tweens.add({
      targets: chosen, y: -100, duration: 350, ease: 'Back.In',
      onComplete: () => this._onChoice(card),
    })
  }
}
