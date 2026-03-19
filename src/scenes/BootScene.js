import Phaser from 'phaser'

const CHAR = 'assets/sprites/potemaru'

export default class BootScene extends Phaser.Scene {
  constructor() { super('BootScene') }

  preload() {
    const { width: W, height: H } = this.cameras.main

    // Progress bar
    const box  = this.add.graphics()
    const fill = this.add.graphics()
    box.fillStyle(0x333333).fillRect(W/2 - 160, H/2 - 20, 320, 40)

    this.load.on('progress', v => {
      fill.clear().fillStyle(0xffffff).fillRect(W/2 - 150, H/2 - 10, 300 * v, 20)
    })

    this.load.image('idle',   `${CHAR}/idle.png`)
    this.load.image('run',    `${CHAR}/run.png`)
    this.load.image('stage',  'assets/sprites/backgrounds/stage.png')
    this.load.spritesheet('tachi-slash', 'assets/sprites/weapons/tachi_slash.png', {
      frameWidth: 166, frameHeight: 166,
    })
  }

  create() {
    this.scene.start('WeaponSelectScene')
  }
}
