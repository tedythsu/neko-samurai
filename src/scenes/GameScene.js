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

    // Background
    this.add.image(CFG.WORLD_WIDTH / 2, CFG.WORLD_HEIGHT / 2, 'stage')
      .setDisplaySize(CFG.WORLD_WIDTH, CFG.WORLD_HEIGHT)
      .setDepth(0)

    this._player = new Player(this, CFG.WORLD_WIDTH / 2, CFG.WORLD_HEIGHT / 2)
    this.cameras.main.startFollow(this._player.sprite, true, 0.1, 0.1)

    // Slice musou orb spritesheet (6×6) and register looping animation
    const musouTex = this.textures.get('musou')
    if (!musouTex.has(0)) {
      const src = musouTex.source[0]
      const fw  = Math.floor(src.width  / 6)
      const fh  = Math.floor(src.height / 6)
      let idx = 0
      for (let r = 0; r < 6; r++)
        for (let c = 0; c < 6; c++)
          musouTex.add(idx++, 0, c * fw, r * fh, fw, fh)
    }
    if (!this.anims.exists('musou-spin')) {
      this.anims.create({
        key:       'musou-spin',
        frames:    Array.from({ length: 36 }, (_, i) => ({ key: 'musou', frame: i })),
        frameRate: 20,
        repeat:    -1,
      })
    }

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
        Enemy.takeDamage(enemy, proj.damage, proj.x, proj.y)
        if (!proj.penetrate) proj._spent = true   // defer — let all overlaps fire first
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
      this._weapon.fire(this, this._projectiles, this._player.x, this._player.y, this._weaponStats, this._enemies, this._player)
    }
    this._projectiles.getChildren().forEach(s => {
      if (s._spent) { s._spent = false; s.disableBody(true, true); return }
      this._weapon.update(s)
    })

    this._elapsed += delta
    this._hudTimer.setText(`${Math.floor(this._elapsed / 1000)}s`)
    this._drawHud()

    // Orb attract & collect
    const px = this._player.x
    const py = this._player.y
    for (let i = this._orbs.length - 1; i >= 0; i--) {
      const orb  = this._orbs[i]
      const dist = Phaser.Math.Distance.Between(px, py, orb.x, orb.y)

      if (dist < CFG.ORB_COLLECT_RADIUS) {
        if (orb._emitter) orb._emitter.destroy()
        orb.destroy()
        this._orbs.splice(i, 1)
        this._addXp(CFG.XP_PER_ENEMY)
        continue
      }

      if (dist < CFG.ORB_ATTRACT_RADIUS) {
        // First frame entering attract zone — stop floating tween
        if (!orb._attracted) {
          orb._attracted = true
          this.tweens.killTweensOf(orb)
          orb.setScale(orb.scaleX * 1.3)  // slight grow to signal attraction
        }
        // Fly toward player, faster the closer it gets
        const speed = Phaser.Math.Linear(500, 200, dist / CFG.ORB_ATTRACT_RADIUS)
        const angle = Phaser.Math.Angle.Between(orb.x, orb.y, px, py)
        orb.x += Math.cos(angle) * speed * (delta / 1000)
        orb.y += Math.sin(angle) * speed * (delta / 1000)
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
        enemy = this._enemies.create(x, y, 'kisotsu-run', 0)
        enemy.setDepth(5)
      }
      Enemy.activate(enemy, x, y)
    }
  }

  _spawnOrb(ex, ey) {
    const frame0 = this.textures.get('musou').frames[0]
    const orbH   = 24
    const orbW   = Math.round(orbH * frame0.realWidth / frame0.realHeight)
    const orb = this.add.sprite(ex, ey, 'musou', 0)
      .setDisplaySize(orbW, orbH)
      .setDepth(4)
    orb.play('musou-spin')

    // Floating bob ±8px
    this.tweens.add({
      targets:  orb,
      y:        ey - 10,
      yoyo:     true,
      repeat:   -1,
      duration: 1000,
      ease:     'Sine.easeInOut',
    })

    // Gold shimmer particles drifting upward
    const emitter = this.add.particles(ex, ey, 'dust-particle', {
      speed:     { min: 8, max: 24 },
      angle:     { min: 255, max: 285 },
      scale:     { start: 0.5, end: 0 },
      alpha:     { start: 0.9, end: 0 },
      lifespan:  900,
      frequency: 180,
      quantity:  1,
      tint:      [0xffee44, 0xffcc00, 0xffaa22],
    })
    emitter.setDepth(3)
    emitter.startFollow(orb)
    orb._emitter = emitter

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
