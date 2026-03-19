import Phaser from 'phaser'
import BootScene     from './scenes/BootScene.js'
import GameScene     from './scenes/GameScene.js'
import UpgradeScene  from './scenes/UpgradeScene.js'

new Phaser.Game({
  type: Phaser.AUTO,
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, GameScene, UpgradeScene],
})
