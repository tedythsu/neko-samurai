import Phaser from 'phaser'
export default class PauseScene extends Phaser.Scene {
  constructor() { super({ key: 'PauseScene', active: false }) }
  create(data) {
    const { width: W, height: H } = this.scale
    this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0)
    this.add.text(W/2, H*0.3, '⏸ 暫停', { fontSize: '14px', color: '#f0d040', fontFamily: 'monospace' }).setOrigin(0.5)
    const btns = [
      { label: '▶ 繼續', action: () => { this.scene.stop(); data.gameScene._paused = false } },
      { label: '↺ 重新開始', action: () => { this.scene.stop(); this.scene.stop('GameScene'); this.scene.start('CharSelectScene') } },
      { label: '⌂ 主選單', action: () => { this.scene.stop(); this.scene.stop('GameScene'); this.scene.start('MenuScene') } },
    ]
    btns.forEach(({ label, action }, i) => {
      const y = H * 0.45 + i * 22
      const bg = this.add.rectangle(W/2, y, 120, 14, 0x1a1a2e).setInteractive()
      this.add.text(W/2, y, label, { fontSize: '7px', color: '#f0e8d0', fontFamily: 'monospace' }).setOrigin(0.5)
      bg.on('pointerover', () => bg.setFillStyle(0xf0d04022))
      bg.on('pointerout',  () => bg.setFillStyle(0x1a1a2e))
      bg.on('pointerdown', action)
    })
  }
}
