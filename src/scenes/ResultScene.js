import Phaser from 'phaser'
export default class ResultScene extends Phaser.Scene {
  constructor() { super('ResultScene') }
  create(data) {
    const { width: W, height: H } = this.scale
    const { survived, elapsed, kills, souls } = data

    this.add.rectangle(0, 0, W, H, 0x0d0d1a).setOrigin(0)
    this.add.text(W/2, 24, survived ? '✦ 勝利 ✦' : '✕ 倒下了 ✕', {
      fontSize: '14px', color: survived ? '#f0d040' : '#cc4444', fontFamily: 'monospace',
    }).setOrigin(0.5)

    const mins = Math.floor(elapsed/60).toString().padStart(2,'0')
    const secs = (elapsed%60).toString().padStart(2,'0')
    const rows = [
      ['生存時間', `${mins}:${secs}`],
      ['擊殺數',   `${kills}`],
      ['獲得武魂', `🔮 ${souls}`],
    ]
    rows.forEach(([label, val], i) => {
      const y = H * 0.42 + i * 20
      this.add.text(W * 0.28, y, label, { fontSize: '8px', color: '#aaaaaa', fontFamily: 'monospace' })
      this.add.text(W * 0.72, y, val,   { fontSize: '8px', color: '#f0e8d0', fontFamily: 'monospace' }).setOrigin(1, 0)
    })
    this.add.line(W*0.2, H*0.42-4, 0, 0, W*0.6, 0, 0x444444)

    const btn = this.add.rectangle(W/2, H*0.8, 120, 16, 0x1a1a2e).setInteractive()
    this.add.text(W/2, H*0.8, '返回主選單', { fontSize: '8px', color: '#f0d040', fontFamily: 'monospace' }).setOrigin(0.5)
    btn.on('pointerdown', () => this.scene.start('MenuScene'))

    let displayed = 0
    const soulTxt = this.add.text(W/2, H*0.65, '🔮 +0', { fontSize: '10px', color: '#aa88ff', fontFamily: 'monospace' }).setOrigin(0.5)
    if (souls > 0) {
      this.time.addEvent({
        delay: 30, repeat: souls - 1,
        callback: () => { displayed++; soulTxt.setText(`🔮 +${displayed}`) },
      })
    }
  }
}
