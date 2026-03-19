import Phaser from 'phaser'
import GameScene from './scenes/GameScene.js'

const config = {
  type: Phaser.AUTO,
  backgroundColor: '#ffffff',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
}

export default new Phaser.Game(config)
