// src/scenes/GameScene.js
import Phaser from 'phaser'
import Player   from '../entities/Player.js'
import Enemy    from '../entities/Enemy.js'
import { CFG, randomEdgePoint, xpThreshold, PLAYER_UPGRADES } from '../config.js'

export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene') }

  init(data) {
    this._weapon      = data.weapon
    this._weaponStats = { ...data.weapon.baseStats }
  }

  create() {
    this.physics.world.setBounds(0, 0, CFG.WORLD_WIDTH, CFG.WORLD_HEIGHT)
    this.cameras.main.setBounds(0, 0, CFG.WORLD_WIDTH, CFG.WORLD_HEIGHT)

    // Grid background
    const bg = this.add.graphics().setDepth(0)
    bg.fillStyle(0x1a1a2e).fillRect(0, 0, CFG.WORLD_WIDTH, CFG.WORLD_HEIGHT)
    bg.lineStyle(1, 0x222244, 0.5)
    for (let x = 0; x <= CFG.WORLD_WIDTH; x += 100)
      bg.lineBetween(x, 0, x, CFG.WORLD_HEIGHT)
    for (let y = 0; y <= CFG.WORLD_HEIGHT; y += 100)
      bg.lineBetween(0, y, CFG.WORLD_WIDTH, y)
    // Arena border
    bg.lineStyle(3, 0x4444aa, 1)
    bg.strokeRect(0, 0, CFG.WORLD_WIDTH, CFG.WORLD_HEIGHT)

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

    this._weapon.createTexture(this)
    this._projectiles = this.physics.add.group({ maxSize: 60 })

    this.physics.add.overlap(
      this._projectiles,
      this._enemies,
      (proj, enemy) => {
        if (proj.hitSet.has(enemy)) return
        proj.hitSet.add(enemy)
        Enemy.takeDamage(enemy, proj.damage)
        if (!proj.penetrate) proj.disableBody(true, true)
      }
    )

    this.physics.world.on('worldbounds', (body) => {
      if (body.gameObject && this._projectiles.contains(body.gameObject)) {
        body.gameObject.disableBody(true, true)
      }
    })

    this._fireTimer = 0

    // XP / level system
    this._xp       = 0
    this._level    = 1
    this._xpToNext = xpThreshold(this._level)
    this._upgrading = false
    this._orbs = []

    this.events.on('enemy-died', ({ x, y }) => this._spawnOrb(x, y))
    this.events.on('player-dead', this._onPlayerDead, this)

    // HUD — fixed to camera
    this._hud = this.add.graphics().setScrollFactor(0).setDepth(200)
    this._hudLevel = this.add.text(16, 52, 'Lv 1', {
      fontSize: '14px', color: '#88bbff',
    }).setScrollFactor(0).setDepth(200)
    this._hudTimer = this.add.text(
      this.cameras.main.width - 16, 16,
      '0s', { fontSize: '16px', color: '#ffffff' }
    ).setScrollFactor(0).setDepth(200).setOrigin(1, 0)

    this._elapsed = 0
  }

  update(_, delta) {
    this._player.update(delta)
    this._enemies.getChildren().forEach(e => Enemy.update(e, this._player, delta))

    this._fireTimer += delta
    if (this._fireTimer >= this._weaponStats.fireRate) {
      this._fireTimer = 0
      this._weapon.fire(this, this._projectiles, this._player.x, this._player.y, this._weaponStats, this._enemies)
    }
    this._projectiles.getChildren().forEach(s => this._weapon.update(s))

    this._elapsed += delta
    this._hudTimer.setText(`${Math.floor(this._elapsed / 1000)}s`)
    this._drawHud()

    // Collect orbs within pickup radius
    for (let i = this._orbs.length - 1; i >= 0; i--) {
      const orb = this._orbs[i]
      if (Phaser.Math.Distance.Between(
        this._player.x, this._player.y, orb.x, orb.y
      ) < CFG.ORB_COLLECT_RADIUS) {
        orb.destroy()
        this._orbs.splice(i, 1)
        this._addXp(CFG.XP_PER_ENEMY)
      }
    }
  }

  _drawHud() {
    const W    = this.cameras.main.width
    const hpPct = this._player.hp / this._player.maxHp
    const xpPct = this._xp / this._xpToNext

    this._hud.clear()

    // HP bar (200px wide)
    this._hud.fillStyle(0x555555).fillRect(16, 16, 200, 14)
    this._hud.fillStyle(0xee3333).fillRect(16, 16, 200 * hpPct, 14)

    // XP bar
    this._hud.fillStyle(0x333355).fillRect(16, 34, 200, 10)
    this._hud.fillStyle(0x4488ff).fillRect(16, 34, 200 * xpPct, 10)

    this._hudLevel.setText(`Lv ${this._level}`)
    this._hudTimer.setX(W - 16)
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
    this._orbs.push(orb)
  }

  _addXp(amount) {
    if (this._upgrading) return
    this._xp += amount
    if (this._xp >= this._xpToNext) {
      this._xp      -= this._xpToNext
      this._level   += 1
      this._xpToNext = xpThreshold(this._level)
      this._upgrading = true
      this.events.once('upgrade-chosen', (upgrade) => {
        if (upgrade.target === 'weapon') upgrade.apply(this._weaponStats)
        else upgrade.apply(this._player, this)
        this._upgrading = false
        this.scene.resume('GameScene')
      })
      const weaponUps = this._weapon.upgrades.map(u => ({ ...u, target: 'weapon' }))
      const playerUps = PLAYER_UPGRADES.map(u => ({ ...u, target: 'player' }))
      const pool = Phaser.Utils.Array.Shuffle([...weaponUps, ...playerUps])
      const choices = pool.slice(0, 3)
      this.scene.launch('UpgradeScene', { level: this._level, upgrades: choices })
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
