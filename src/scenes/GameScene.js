// src/scenes/GameScene.js
import Phaser from 'phaser'
import Player   from '../entities/Player.js'
import Enemy    from '../entities/Enemy.js'
import Shuriken from '../entities/Shuriken.js'
import { CFG, randomEdgePoint, xpThreshold, UPGRADES } from '../config.js'

export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene') }

  create() {
    this.physics.world.setBounds(0, 0, CFG.WORLD_WIDTH, CFG.WORLD_HEIGHT)
    this.cameras.main.setBounds(0, 0, CFG.WORLD_WIDTH, CFG.WORLD_HEIGHT)

    this._player = new Player(this, CFG.WORLD_WIDTH / 2, CFG.WORLD_HEIGHT / 2)
    this.cameras.main.startFollow(this._player.sprite, true, 0.1, 0.1)

    Enemy.createTexture(this)
    this._enemies = this.physics.add.group()

    this.physics.add.overlap(
      this._player.sprite,
      this._enemies,
      (_, enemy) => Enemy.dealDamage(enemy, this._player)
    )

    this.time.addEvent({
      delay: CFG.ENEMY_SPAWN_INTERVAL,
      loop: true,
      callback: this._spawnWave,
      callbackScope: this,
    })

    Shuriken.createTexture(this)
    this._shurikens = this.physics.add.group({ maxSize: 40 })

    this.physics.add.overlap(
      this._shurikens,
      this._enemies,
      (shuriken, enemy) => {
        if (shuriken.hitSet.has(enemy)) return
        shuriken.hitSet.add(enemy)
        Enemy.takeDamage(enemy, shuriken.damage)
        shuriken.disableBody(true, true)
      }
    )

    this.physics.world.on('worldbounds', (body) => {
      if (body.gameObject && this._shurikens.contains(body.gameObject)) {
        body.gameObject.disableBody(true, true)
      }
    })

    this._fireTimer = 0

    // XP / level system
    this._xp       = 0
    this._level    = 1
    this._xpToNext = xpThreshold(this._level)
    this._upgrading = false

    this.events.on('enemy-died', ({ x, y }) => this._spawnOrb(x, y))
    this.events.on('player-dead', this._onPlayerDead, this)
  }

  update(_, delta) {
    this._player.update(delta)
    this._enemies.getChildren().forEach(e => Enemy.update(e, this._player, delta))

    this._fireTimer += delta
    if (this._fireTimer >= this._player.fireRate) {
      this._fireTimer = 0
      if (this._enemies.countActive() > 0) {
        this._player.startAttack()
        Shuriken.fire(
          this,
          this._shurikens,
          this._player.x,
          this._player.y,
          this._enemies,
          this._player.projectileCount,
          this._player.damage
        )
      }
    }
    this._shurikens.getChildren().forEach(s => Shuriken.update(s))
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

  _spawnOrb(ex, ey) {
    const orb = this.add.circle(ex, ey, 8, 0xffee00).setDepth(4)
    this.tweens.add({
      targets: orb,
      x: this._player.x, y: this._player.y,
      duration: 400, ease: 'Sine.In',
      onComplete: () => {
        orb.destroy()
        this._addXp(CFG.XP_PER_ENEMY)
      },
    })
  }

  _addXp(amount) {
    if (this._upgrading) return
    this._xp += amount
    if (this._xp >= this._xpToNext) {
      this._xp      -= this._xpToNext
      this._level   += 1
      this._xpToNext = xpThreshold(this._level)
      this._upgrading = true
      this.events.once('upgrade-chosen', (id) => {
        this._player.applyUpgrade(id)
        this._upgrading = false
        this.scene.resume('GameScene')
      })
      this.scene.launch('UpgradeScene', {
        level: this._level,
        upgrades: Phaser.Utils.Array.Shuffle(UPGRADES.slice()).slice(0, 3),
      })
      this.scene.pause('GameScene')
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
