import Phaser from 'phaser'

const CHAR = 'assets/sprites/potemaru'

export default class BootScene extends Phaser.Scene {
  constructor() { super('BootScene') }

  preload() {
    const W = this.cameras.main.width
    const H = this.cameras.main.height

    this.add.rectangle(W / 2, H / 2, W, H, 0x07070f)

    // Title
    this.add.text(W / 2, H / 2 - 72, '猫の侍伝', {
      fontSize: '38px', color: '#c8a84b',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
      stroke: '#2a1800', strokeThickness: 3,
    }).setOrigin(0.5)

    this.add.text(W / 2, H / 2 - 32, 'N E K O   S A M U R A I', {
      fontSize: '11px', color: '#4a4030',
      fontFamily: '"Cinzel", "Palatino Linotype", serif',
    }).setOrigin(0.5)

    // Bar track
    const barW = Math.min(300, W * 0.55)
    const barX = W / 2 - barW / 2
    const barY = H / 2 + 28

    const track = this.add.graphics()
    track.fillStyle(0x111110, 1)
    track.fillRoundedRect(barX, barY, barW, 6, 3)
    track.lineStyle(1, 0x3a3020, 1)
    track.strokeRoundedRect(barX, barY, barW, 6, 3)

    const fill = this.add.graphics()

    this.add.text(W / 2, barY + 20, '読み込み中', {
      fontSize: '10px', color: '#4a4030',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
    }).setOrigin(0.5)

    this.load.on('progress', v => {
      fill.clear()
      fill.fillStyle(0xc8a84b, 0.85)
      fill.fillRoundedRect(barX + 1, barY + 1, (barW - 2) * v, 4, 2)
    })

    this.load.image('idle',        `${CHAR}/idle.png`)
    this.load.image('run',         `${CHAR}/run.png`)
    this.load.image('kisotsu-run', 'assets/sprites/enemy/kisotsu/run.png')
    this.load.image('musou',       'assets/sprites/orbs/musou.png')
    this.load.image('stage',       'assets/sprites/backgrounds/stage.png')
    this.load.spritesheet('tachi-slash', 'assets/sprites/weapons/tachi_slash.png', {
      frameWidth: 166, frameHeight: 166,
    })
  }

  create() {
    this.scene.start('WeaponSelectScene')
  }
}
