import Phaser from 'phaser'
import BootScene from './scenes/BootScene.js'
import MenuScene from './scenes/MenuScene.js'
import CharSelectScene from './scenes/CharSelectScene.js'
import MapSelectScene from './scenes/MapSelectScene.js'
import GameScene from './scenes/GameScene.js'
import UpgradeScene from './scenes/UpgradeScene.js'
import PauseScene from './scenes/PauseScene.js'
import ResultScene from './scenes/ResultScene.js'
import MetaScene from './scenes/MetaScene.js'

const config = {
  type: Phaser.AUTO,
  width: 480,
  height: 270,
  pixelArt: true,
  backgroundColor: '#0d0d1a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scene: [BootScene, MenuScene, CharSelectScene, MapSelectScene, GameScene, UpgradeScene, PauseScene, ResultScene, MetaScene],
}

export default new Phaser.Game(config)
