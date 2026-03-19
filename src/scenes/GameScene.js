// src/scenes/GameScene.js  (TEMPORARY — will be fully replaced in Task 4)
import Phaser from 'phaser'
import Player from '../entities/Player.js'
import { CFG } from '../config.js'

export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene') }

  create() {
    this.physics.world.setBounds(0, 0, CFG.WORLD_WIDTH, CFG.WORLD_HEIGHT)
    this.cameras.main.setBounds(0, 0, CFG.WORLD_WIDTH, CFG.WORLD_HEIGHT)

    this._player = new Player(this, CFG.WORLD_WIDTH / 2, CFG.WORLD_HEIGHT / 2)
    this.cameras.main.startFollow(this._player.sprite, true, 0.1, 0.1)
  }

  update(_, delta) {
    this._player.update(delta)
  }
}
