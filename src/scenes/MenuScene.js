import Phaser from 'phaser'

export default class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene') }

  create() {
    const { width: W, height: H } = this.scale

    // Night sky gradient
    const sky = this.add.graphics()
    sky.fillGradientStyle(0x0a0a15, 0x0a0a15, 0x1a0a20, 0x1a0a20, 1)
    sky.fillRect(0, 0, W, H)

    // Stars
    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(0, W)
      const y = Phaser.Math.Between(0, H * 0.7)
      const star = this.add.rectangle(x, y, 1, 1, 0xffffff, Phaser.Math.FloatBetween(0.3, 0.9))
      this.tweens.add({ targets: star, alpha: 0.1, duration: Phaser.Math.Between(1000, 3000), yoyo: true, repeat: -1 })
    }

    // Moon
    this.add.circle(W - 50, 40, 18, 0xf0e060).setAlpha(0.9)
    this.add.circle(W - 44, 38, 15, 0x1a0a20)  // crescent shadow

    // Mountain silhouettes
    const mtn = this.add.graphics()
    mtn.fillStyle(0x150818)
    mtn.fillTriangle(0, H, 60, H*0.5, 120, H)
    mtn.fillTriangle(80, H, 160, H*0.35, 240, H)
    mtn.fillTriangle(200, H, 280, H*0.45, 360, H)
    mtn.fillTriangle(300, H, 400, H*0.3, W, H)
    mtn.fillStyle(0x0d0008)
    mtn.fillRect(0, H*0.75, W, H*0.25)

    // Torii gate
    const tx = W * 0.5, ty = H * 0.6
    const torii = this.add.graphics()
    torii.fillStyle(0xcc3300)
    torii.fillRect(tx - 20, ty, 4, 35)    // left pillar
    torii.fillRect(tx + 16, ty, 4, 35)    // right pillar
    torii.fillRect(tx - 26, ty - 8, 52, 6) // top beam
    torii.fillRect(tx - 22, ty,     44, 4) // lower beam

    // Title
    this.add.text(W/2, H * 0.22, '猫の侍伝', {
      fontSize: '22px', color: '#f0d040', fontFamily: 'serif',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5)
    this.add.text(W/2, H * 0.32, 'NEKO NO SAMURAI-DEN', {
      fontSize: '6px', color: '#f0d04088', fontFamily: 'monospace', letterSpacing: 4,
    }).setOrigin(0.5)

    // Cat emoji placeholder
    this.add.text(W/2, H * 0.47, '🐱⚔️', { fontSize: '20px' }).setOrigin(0.5)

    // Menu buttons
    const btns = [
      { label: '▶  開始遊戲', scene: 'CharSelectScene' },
      { label: '⚔  武魂強化', scene: 'MetaScene' },
    ]
    btns.forEach(({ label, scene }, i) => {
      const y = H * 0.64 + i * 22
      const bg = this.add.rectangle(W/2, y, 110, 16, 0x1a0a00).setInteractive()
      const border = this.add.graphics()
      border.lineStyle(1, 0xf0d04066); border.strokeRect(W/2 - 55, y - 8, 110, 16)
      const txt = this.add.text(W/2, y, label, { fontSize: '7px', color: '#f0d040', fontFamily: 'monospace' }).setOrigin(0.5)
      bg.on('pointerover',  () => { bg.setFillStyle(0xf0d04022); txt.setColor('#ffffff') })
      bg.on('pointerout',   () => { bg.setFillStyle(0x1a0a00);   txt.setColor('#f0d040') })
      bg.on('pointerdown',  () => this.scene.start(scene))
    })

    // Cherry blossoms drift
    this._spawnBlossom()
    this.time.addEvent({ delay: 800, callback: this._spawnBlossom, callbackScope: this, loop: true })
  }

  _spawnBlossom() {
    const { width: W, height: H } = this.scale
    const x = Phaser.Math.Between(0, W)
    const b = this.add.text(x, -10, '🌸', { fontSize: '8px' })
    this.tweens.add({
      targets: b, y: H + 20, x: x + Phaser.Math.Between(-30, 30),
      alpha: { from: 0.7, to: 0 }, duration: Phaser.Math.Between(4000, 7000),
      onComplete: () => b.destroy(),
    })
  }
}
