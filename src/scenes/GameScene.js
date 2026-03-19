// src/scenes/GameScene.js
import Phaser from 'phaser'
import Player from '../entities/Player.js'
import Enemy  from '../entities/Enemy.js'
import { CFG, randomEdgePoint } from '../config.js'

export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene') }

  create() {
    this.physics.world.setBounds(0, 0, CFG.WORLD_WIDTH, CFG.WORLD_HEIGHT)
    this.cameras.main.setBounds(0, 0, CFG.WORLD_WIDTH, CFG.WORLD_HEIGHT)

    this._player = new Player(this, CFG.WORLD_WIDTH / 2, CFG.WORLD_HEIGHT / 2)
    this.cameras.main.startFollow(this._player.sprite, true, 0.1, 0.1)

    Enemy.createTexture(this)
    this._enemies = this.physics.add.group()

    // Enemy overlaps player → deal damage
    this.physics.add.overlap(
      this._player.sprite,
      this._enemies,
      (_, enemy) => Enemy.dealDamage(enemy, this._player)
    )

    // Spawn timer
    this._level = 1
    this.time.addEvent({
      delay: CFG.ENEMY_SPAWN_INTERVAL,
      loop: true,
      callback: this._spawnWave,
      callbackScope: this,
    })

    this.events.on('player-dead', this._onPlayerDead, this)
  }

  update(_, delta) {
    this._player.update(delta)
    this._enemies.getChildren().forEach(e => Enemy.update(e, this._player, delta))
  }

  _spawnWave() {
    const count = Math.floor(this._level / CFG.WAVE_SCALE) + 1
    for (let i = 0; i < count; i++) {
      const { x, y } = randomEdgePoint(CFG.WORLD_WIDTH, CFG.WORLD_HEIGHT)
      let enemy = this._enemies.getFirstDead(false)
      if (!enemy) {
        enemy = this._enemies.create(x, y, 'enemy-tex')
        enemy.setDepth(5)
      }
      Enemy.activate(enemy, x, y)
    }
  }

  _onPlayerDead() {
    this.physics.pause()
    this.add.text(
      this.cameras.main.midPoint.x,
      this.cameras.main.midPoint.y,
      '死\n\nClick to restart',
      { color: '#ff4444', fontSize: '48px', align: 'center' }
    ).setOrigin(0.5)
    this.input.once('pointerdown', () => this.scene.restart())
  }
}
