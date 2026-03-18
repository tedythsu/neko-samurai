import Phaser from 'phaser'

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' })
  }

  create() {
    this.add.text(240, 135, '猫の侍伝', {
      fontSize: '32px',
      color: '#ffffff',
    }).setOrigin(0.5)
  }
}
