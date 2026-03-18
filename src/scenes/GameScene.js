import Phaser from 'phaser'
import Player from '../entities/Player.js'
import Enemy from '../entities/Enemy.js'
import Kunai from '../entities/weapons/Kunai.js'
import Tachi from '../entities/weapons/Tachi.js'
import Shikigami from '../entities/weapons/Shikigami.js'
import WaveManager from '../systems/WaveManager.js'
import UpgradeSystem from '../systems/UpgradeSystem.js'
import VFX from '../systems/VFX.js'
import MetaProgress from '../systems/MetaProgress.js'
import { MAPS } from '../data/maps.js'
import { CHARACTERS } from '../data/characters.js'
import { ENEMIES } from '../data/enemies.js'

const WEAPON_CLASSES = { kunai: Kunai, tachi: Tachi, shikigami: Shikigami }
const MAX_ENEMIES = 300

export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene') }

  create(data) {
    const { width: W, height: H } = this.scale
    this._charId = data.charId || 'mikenomaru'
    this._mapId  = data.mapId  || 'bamboo_village'
    const mapDef = MAPS[this._mapId]

    this._mp = new MetaProgress()
    const bonuses = this._mp.getStatBonuses()

    // Tilemap background (tiled)
    for (let tx = 0; tx < W; tx += 16)
      for (let ty = 0; ty < H; ty += 16)
        this.add.image(tx, ty, 'tile_grass').setOrigin(0).setDepth(0)

    // Player
    this._player = new Player(this, W/2, H/2, this._charId, bonuses)

    // Enemies pool
    this._enemies = this.physics.add.group({
      classType: Enemy, maxSize: MAX_ENEMIES, runChildUpdate: false,
    })
    for (let i = 0; i < MAX_ENEMIES; i++) this._enemies.add(new Enemy(this, 0, 0), true)

    // Weapons
    const charDef = CHARACTERS[this._charId]
    this._weapons = [ new WEAPON_CLASSES[charDef.startWeapon](this, this._player) ]

    // Systems
    this._wave    = new WaveManager(mapDef)
    this._upgrade = new UpgradeSystem()
    this._vfx     = new VFX(this)

    // HUD
    this._buildHUD(W, H)

    // Physics: enemies damage player
    this.physics.add.overlap(this._player, this._enemies, (player, enemy) => {
      if (!enemy.active) return
      player.takeDamage(enemy.damage, this._enemies, this)
      this._updateHpBar()
    })

    // Spawn timer
    this._spawnTimer = 0
    this._elapsed    = 0  // seconds
    this._kills      = 0
    this._souls      = 0
    this._paused     = false
    this._gameOver   = false
    this._upgradePending = 0

    // Pause key
    this.input.keyboard.on('keydown-P', () => this._togglePause())
    this.input.keyboard.on('keydown-ESC', () => this._togglePause())
  }

  _buildHUD(W, H) {
    // HP bar
    this._hpBarBg   = this.add.rectangle(60, 8, 100, 7, 0x333333).setOrigin(0, 0.5).setDepth(50).setScrollFactor(0)
    this._hpBarFill = this.add.rectangle(60, 8, 100, 7, 0xe03030).setOrigin(0, 0.5).setDepth(51).setScrollFactor(0)
    this.add.text(10, 4, '❤', { fontSize: '8px' }).setDepth(52).setScrollFactor(0)

    // XP bar
    this._xpBarBg   = this.add.rectangle(0, H, W, 3, 0x333333).setOrigin(0, 1).setDepth(50).setScrollFactor(0)
    this._xpBarFill = this.add.rectangle(0, H, 0, 3, 0x4080ff).setOrigin(0, 1).setDepth(51).setScrollFactor(0)

    // Timer
    this._timerTxt = this.add.text(W/2, 6, '00:00', {
      fontSize: '8px', color: '#f0d040', fontFamily: 'monospace'
    }).setOrigin(0.5, 0).setDepth(52).setScrollFactor(0)

    // Level
    this._levelTxt = this.add.text(W - 8, 6, 'Lv.1', {
      fontSize: '7px', color: '#f0d040', fontFamily: 'monospace'
    }).setOrigin(1, 0).setDepth(52).setScrollFactor(0)

    // Weapon slots
    this._weaponSlots = []
    for (let i = 0; i < 6; i++) {
      const slot = this.add.rectangle(8 + i * 20, H - 14, 16, 16, 0x1a1a2e)
        .setOrigin(0, 0.5).setDepth(50).setScrollFactor(0)
      this._weaponSlots.push(slot)
    }
  }

  _updateHpBar() {
    const pct = this._player.hp / this._player.maxHp
    this._hpBarFill.width = 100 * pct
  }

  _updateXpBar() {
    const pct = this._player.xp / this._player.xpToNext
    this._xpBarFill.width = this.scale.width * pct
  }

  _spawnEnemy(enemyId, hpOverride) {
    const { width: W, height: H } = this.scale
    const side = Phaser.Math.Between(0, 3)
    let x, y
    if (side === 0)      { x = Phaser.Math.Between(0, W); y = -20 }
    else if (side === 1) { x = W + 20; y = Phaser.Math.Between(0, H) }
    else if (side === 2) { x = Phaser.Math.Between(0, W); y = H + 20 }
    else                 { x = -20; y = Phaser.Math.Between(0, H) }

    const enemy = this._enemies.getFirstDead(false)
    if (enemy) {
      const baseHp = ENEMIES[enemyId]?.hp ?? 300
      const actualHp = hpOverride != null ? baseHp * hpOverride : undefined
      enemy.spawn(x, y, enemyId || 'oni_soldier', actualHp)
    }
  }

  _togglePause() {
    if (this._gameOver) return
    this._paused = !this._paused
    if (this._paused) this.scene.launch('PauseScene', { gameScene: this })
    else this.scene.stop('PauseScene')
  }

  update(time, delta) {
    if (this._paused) return
    if (this._player.isDead && !this._gameOver) { this._onDeath(); return }

    this._player.update()

    const dt = delta
    this._elapsed += delta / 1000

    // Wave boss check (every second)
    const elapsedInt = Math.floor(this._elapsed)
    const bossEntry = this._wave.checkAndTrigger(elapsedInt)
    if (bossEntry && !this._wave.activeBoss) {
      const count = bossEntry.count || 1
      for (let i = 0; i < count; i++) this._spawnEnemy(bossEntry.boss, bossEntry.hpMult)
      this._wave.activeBoss = bossEntry
    }

    // Regular spawn
    if (!this._wave.isFinalBossActive) {
      this._spawnTimer += delta
      const activeCount = this._enemies.countActive()
      if (this._spawnTimer >= this._wave.currentSpawnInterval && activeCount < MAX_ENEMIES) {
        this._spawnTimer = 0
        const mapDef = MAPS[this._mapId]
        const id = mapDef.enemies[Phaser.Math.Between(0, mapDef.enemies.length - 1)]
        this._spawnEnemy(id)
      }
    }

    // Update enemies
    this._enemies.getChildren().forEach(e => { if (e.active) e.update(this._player, dt) })

    // Update weapons
    this._weapons.forEach(w => {
      if (w.update) w.update(dt, this._enemies)
      // Check kunai hits
      if (w.group) {
        this.physics.overlap(w.group, this._enemies, (proj, enemy) => {
          if (!proj.active || !enemy.active) return
          if (proj._hit?.has(enemy)) return
          proj._hit?.add(enemy)
          const killed = enemy.takeDamage(proj._damage || 10)
          this._vfx.weaponHit(enemy.x, enemy.y)
          if (killed) this._onEnemyKilled(enemy)
          proj._pierce = (proj._pierce || 1) - 1
          if (proj._pierce <= 0) { proj.setActive(false).setVisible(false) }
        })
      }
    })

    // Check boss killed
    if (this._wave.activeBoss) {
      const bossAlive = this._enemies.getChildren().some(e => e.active && e._isBoss)
      if (!bossAlive) this._wave.onBossKilled()
    }

    // Timer HUD
    const mins = Math.floor(this._elapsed / 60).toString().padStart(2, '0')
    const secs = Math.floor(this._elapsed % 60).toString().padStart(2, '0')
    this._timerTxt.setText(`${mins}:${secs}`)
    this._levelTxt.setText(`Lv.${this._player.level}`)
    this._updateXpBar()
  }

  _onEnemyKilled(enemy) {
    this._kills++
    this._souls += enemy.enemyDef?.souls || 1
    this._vfx.enemyDeath(enemy.x, enemy.y, enemy._isBoss)

    const leveled = this._player.gainXp(enemy.enemyDef?.xp || 5)
    if (leveled) {
      this._vfx.levelUp(this._player.x, this._player.y)
      this._levelTxt.setText(`Lv.${this._player.level}`)
      this._upgradePending++
      if (this._upgradePending === 1) this._openUpgrade()
    }
    this._updateHpBar()
  }

  _openUpgrade() {
    this._paused = true
    const cards = this._upgrade.drawCards({
      luck: this._player.luck,
      weapons: this._weapons.map(w => ({ id: w.id, level: w.level })),
    })
    this.scene.launch('UpgradeScene', {
      cards,
      onChoice: (card) => {
        this._applyUpgrade(card)
        this._upgradePending--
        if (this._upgradePending > 0) {
          this._openUpgrade()
        } else {
          this._paused = false
          this.scene.stop('UpgradeScene')
        }
      },
    })
  }

  _applyUpgrade(card) {
    if (card.type === 'weapon') {
      const existing = this._weapons.find(w => w.id === card.id)
      if (existing) { existing.levelUp(); return }
      const WeaponClass = WEAPON_CLASSES[card.id]
      if (WeaponClass) this._weapons.push(new WeaponClass(this, this._player))
    }
    if (card.type === 'passive' && card.effect) {
      const e = card.effect
      if (e.type === 'hp')    { this._player.maxHp += e.value; this._player.hp = Math.min(this._player.hp + e.value, this._player.maxHp) }
      if (e.type === 'speed') this._player.speed += e.value
      if (e.type === 'atk')   this._player.atkMult += e.value
      if (e.type === 'luck')  this._player.luck += e.value
      if (e.type === 'cd')    this._weapons.forEach(w => { if (typeof w.cooldown === 'number') w.cooldown *= (1 - e.value) })
    }
    this._updateHpBar()
  }

  _onDeath() {
    this._endRun(false)
  }

  _endRun(survived) {
    this._gameOver = true
    this._mp.addSouls(this._souls)
    this._mp.data.stats.totalRuns++
    this._mp.data.stats.totalKills += this._kills
    if (this._elapsed > this._mp.data.stats.bestTime) this._mp.data.stats.bestTime = Math.floor(this._elapsed)
    this._mp.save()
    this.scene.start('ResultScene', {
      survived, elapsed: Math.floor(this._elapsed), kills: this._kills, souls: this._souls,
    })
  }
}
