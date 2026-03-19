import Phaser from 'phaser'

export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene') }
  create() {
    this.add.text(100, 100, 'GameScene stub', { color: '#fff' })
  }
}
