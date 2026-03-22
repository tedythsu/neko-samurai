// src/scenes/GameScene.js
import Phaser from 'phaser'
import Player   from '../entities/Player.js'
import Enemy    from '../entities/Enemy.js'
import { CFG, randomEdgePoint, xpThreshold, getWaveConfig, getWaveIndex, WAVE_NAMES, RARITY_WEIGHTS } from '../config.js'
import { WEAPON_UPGRADES_MAP } from '../upgrades/weaponUpgrades.js'
import { ALL_PASSIVES }        from '../upgrades/passives.js'
import { ENEMY_TYPES } from '../enemies/EnemyTypes.js'
import BossManager from '../enemies/BossManager.js'

export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene') }

  init(data) {
    this._startWeapon = data.weapon
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
    const orbFrame = this.textures.get('musou').frames[0]
    this._orbH = 24
    this._orbW = Math.round(this._orbH * orbFrame.realWidth / orbFrame.realHeight)

    Enemy.createTexture(this)
    this._enemies = this.physics.add.group()

    this.physics.add.overlap(
      this._player.sprite,
      this._enemies,
      (_, enemy) => Enemy.dealDamage(enemy, this._player)
    )

    this._spawnEvent = this.time.addEvent({
      delay: CFG.ENEMY_SPAWN_INTERVAL,
      loop: true,
      callback: this._spawnWave,
      callbackScope: this,
    })

    // Multi-weapon state
    this._weapons              = []
    this._weaponUpgradesOwned  = new Map()   // weaponId → Set(upgradeId)
    this._procsOwned           = new Set()
    this._keystonesOwned       = new Set()
    this._passivesOwned        = new Set()
    this._glassCannon          = false
    this._defenseBonus         = 0
    this._soulDrain            = false
    this._daimyoStacks         = 0
    this._ironWillMult         = 1.0
    this._ironBodyShield       = false
    this._orbAttractRadius     = CFG.ORB_ATTRACT_RADIUS
    this._bossChestBonus       = 1.0
    this._hasDefensive         = false
    this._currentWaveXp        = 10    // updated each spawn tick
    this._currentWaveIdx       = -1    // -1 = not yet announced
    this._critBonus            = 0
    this._critDmgBonus         = 0
    this._warCryTimer          = 0
    this._ironBodyTimer        = 0
    this._ironWillTimer        = 0
    this._tachiComboGuardActive = false
    this._tachiComboGuardMult   = 1.0

    // ── New passive/proc state ────────────────────────────────────────────────
    this._weaponChoiceDone  = false       // set true after Lv.3 weapon branch chosen
    this._weaponFinalChoiceDone = false   // set true after Lv.12 weapon branch chosen
    this._passiveStacks     = new Map()   // passiveId → stack count
    this._globalDmgMult     = 1.0
    this._armorPen          = 0
    this._ailmentDurMult    = 1.0
    this._projSpeedMult     = 1.0
    this._attackSpeedMult   = 1.0
    this._critKillXpMult    = 1
    this._critSoul          = false
    this._xpMult            = 1.0
    this._enemySpeedBuff    = 1.0
    this._cdMult            = 1.0
    this._furyMode          = false
    this._shadowDodge       = false
    this._shadowCloneTimer  = 0
    this._shadowStrideUntil = 0
    this._firstStrikeCrit   = false
    this._steadyStance      = false
    this._ailmentExpose     = false
    this._bloodRush         = false
    this._bloodRushUntil    = 0
    this._rationBuffUntil   = 0
    this._caltrops          = false
    this._caltropTimer      = 0
    this._substitutionReady = false
    this._substitutionCd    = 0
    this._substitutionGrace = 0
    this._daimyoTax         = false
    this._daimyoTaxXp       = 0
    this._soulBurstKills    = 0
    this._rationTimer       = 0
    this._tsukuyomiTimer    = 0
    this._susanoCd          = 0
    this._amaterasuUntil    = 0
    this._hitSoundThrottle  = new Map()   // weaponId → last play timestamp
    this._hitSoundKey       = null

    this._addWeapon(this._startWeapon)

    // XP / level system
    this._xp       = 0
    this._level    = 1
    this._xpToNext = xpThreshold(this._level)
    this._upgrading = false
    this._displayHp = 100   // animated display values for bar rendering
    this._displayXp = 0
    this._orbs = []

    this.events.on('enemy-died', () => {
      this._killCount++
      // Soul burst — every 50 kills triggers a screen shockwave
      if (this._procsOwned.has('soul_burst')) {
        this._soulBurstKills++
        if (this._soulBurstKills >= 50) {
          this._soulBurstKills = 0
          this._doSoulBurst()
        }
      }
      // Yamatanoorochi — +0.5% attack speed per kill (capped at +50%)
      if (this._yamatano) {
        this._attackSpeedMult = Math.min(1.30, (this._attackSpeedMult || 1) + 0.002)
      }
    })
    this.events.on('enemy-died-detailed', ({ x, y, enemy }) => {
      const critSoulMult = this._critSoul && enemy?._lastHitWasCrit ? 1.8 : 1
      this._spawnOrb(x, y, this._currentWaveXp * critSoulMult)
      if (enemy?._darkAura) this._reduceSupportCooldowns(1000)
      if (this._keystonesOwned.has('ice_thunder') && (enemy?._warCryConductiveUntil || 0) > this.time.now) {
        this._triggerWarCryChain(enemy.x, enemy.y, enemy)
      }
      if (!this._bloodRush || !enemy) return
      const se = enemy._statusEffects
      if (se?.poison?.active || se?.bleed?.active) {
        this._bloodRushUntil = this.time.now + 3000
      }
    })
    this.events.on('player-dead', this._onPlayerDead, this)
    this.events.on('player-hit', () => { this._regenTimer = 0 })

    // ── HUD ──────────────────────────────────────────────────────────────────
    // Stat panel backdrop (static, drawn once)
    this._hudPanel = this.add.graphics().setScrollFactor(0).setDepth(199)
    this._hudPanel.fillStyle(0x07070f, 0.86)
    this._hudPanel.fillRoundedRect(10, 10, 216, 74, 6)
    this._hudPanel.lineStyle(1, 0xb8943f, 0.7)
    this._hudPanel.strokeRoundedRect(10, 10, 216, 74, 6)
    this._hudPanel.lineStyle(2, 0xd4a843, 1)
    this._hudPanel.lineBetween(16, 10, 220, 10)

    // Dynamic HUD graphics (redrawn each frame)
    this._hud = this.add.graphics().setScrollFactor(0).setDepth(200)

    // Level text
    this._hudLevel = this.add.text(52, 58, 'Lv 1', {
      fontSize: '13px', color: '#c8a84b',
      fontFamily: '"Cinzel", "Palatino Linotype", serif',
    }).setScrollFactor(0).setDepth(201)

    // Timer (top-right)
    this._hudTimer = this.add.text(
      this.cameras.main.width - 12, 14,
      '0:00', {
        fontSize: '17px', color: '#d4c09a',
        fontFamily: '"Cinzel", "Palatino Linotype", serif',
        stroke: '#06060f', strokeThickness: 3,
      }
    ).setScrollFactor(0).setDepth(201).setOrigin(1, 0)

    // Wave name (below timer, top-right)
    const W = this.cameras.main.width
    const H = this.cameras.main.height
    this._hudWave = this.add.text(W - 12, 35, '第壱波', {
      fontSize: '11px', color: '#6a5e40',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
      stroke: '#06060f', strokeThickness: 2,
    }).setScrollFactor(0).setDepth(201).setOrigin(1, 0)

    // Wave announcement overlay (center screen, animated)
    this._waveAnnounce = this.add.text(W / 2, H * 0.28, '', {
      fontSize: '36px', color: '#c8a84b',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
      stroke: '#06060f', strokeThickness: 5,
    }).setScrollFactor(0).setDepth(502).setOrigin(0.5).setAlpha(0)

    // Pause button (below wave name, top-right)
    this._pauseBtn = this.add.text(W - 12, 50, '⏸', {
      fontSize: '13px', color: '#8a7a5a',
      stroke: '#06060f', strokeThickness: 2,
    }).setScrollFactor(0).setDepth(201).setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => { if (!this._paused) this._pauseBtn.setColor('#d4c09a') })
      .on('pointerout',  () => { if (!this._paused) this._pauseBtn.setColor('#8a7a5a') })
      .on('pointerdown', () => this._togglePause())

    // Pause overlay
    this._pauseOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72)
      .setScrollFactor(0).setDepth(500).setVisible(false)
      .setInteractive().on('pointerdown', () => this._togglePause())
    this._pauseTitleText = this.add.text(W / 2, H / 2 - 24, '一時停止', {
      fontSize: '42px', color: '#c8a84b',
      fontFamily: '"Cinzel", "Palatino Linotype", serif',
      stroke: '#06060f', strokeThickness: 5,
    }).setScrollFactor(0).setDepth(501).setOrigin(0.5).setVisible(false)
    this._pauseHintText = this.add.text(W / 2, H / 2 + 28, 'クリックまたは ESC で再開', {
      fontSize: '13px', color: '#6a5e40',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
    }).setScrollFactor(0).setDepth(501).setOrigin(0.5).setVisible(false)

    // ESC key toggle
    this._escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    this._escKey.on('down', () => this._togglePause())
    this._paused = false

    // Weapon icon row — each entry is { icon, label } so both can be destroyed together
    this._hudWeaponIcons  = []
    this._lastWeaponCount = 0

    this._elapsed = 0
    this._killCount = 0
    this._bossActive = false
    this._bossManager = new BossManager(this)

    // Boss HP bar (hidden by default, shown during boss encounters)
    const bossBarBW = 300
    const bossBarY  = this.cameras.main.height - 40
    this._bossBarBg = this.add.rectangle(
      this.cameras.main.width / 2, bossBarY, bossBarBW + 4, 14, 0x220008
    ).setScrollFactor(0).setDepth(202).setOrigin(0.5, 0.5).setAlpha(0)
    this._bossBarFill = this.add.rectangle(
      this.cameras.main.width / 2 - bossBarBW / 2, bossBarY, bossBarBW, 10, 0xcc2244
    ).setScrollFactor(0).setDepth(203).setOrigin(0, 0.5).setAlpha(0)
    this._bossBarHighlight = this.add.rectangle(
      this.cameras.main.width / 2 - bossBarBW / 2, bossBarY - 4, bossBarBW, 2, 0xff4466
    ).setScrollFactor(0).setDepth(204).setOrigin(0, 0.5).setAlpha(0)
    this._bossNameText = this.add.text(
      this.cameras.main.width / 2 - bossBarBW / 2 - 4, bossBarY, '', {
        fontSize: '12px', color: '#ffaacc',
        fontFamily: '"Noto Serif JP", serif',
      }
    ).setScrollFactor(0).setDepth(204).setOrigin(1, 0.5).setAlpha(0)
    this._bossPctText = this.add.text(
      this.cameras.main.width / 2 + bossBarBW / 2 + 4, bossBarY, '', {
        fontSize: '12px', color: '#ffaacc',
        fontFamily: '"Cinzel", serif',
      }
    ).setScrollFactor(0).setDepth(204).setOrigin(0, 0.5).setAlpha(0)
  }

  _createScorchZone(x, y, radius, damage, affixes, weaponId = 'homura') {
    this._createDamageZone(x, y, radius, damage, affixes, {
      color: 0xff4400, alpha: 0.30, mult: 0.12, duration: 2500, source: 'ability', weaponId,
    })
  }

  _createLingerZone(x, y, radius, damage, affixes, weaponId = 'shuriken', bladeSize = null) {
    const duration = 1500
    const hitCd = new Map()
    const blade = this.add.image(x, y, 'shuriken').setDepth(8)
    if (bladeSize?.width && bladeSize?.height) {
      blade.setDisplaySize(bladeSize.width, bladeSize.height)
    } else {
      const scale = radius / 28
      blade.setScale(scale)
    }

    const aura = this.add.graphics().setDepth(7)
    const tick = () => {
      aura.clear()
      aura.lineStyle(2, 0xb48cff, 0.35)
      aura.strokeCircle(x, y, radius)
      blade.angle += 18

      const now = this.time.now
      this._enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
        if (Phaser.Math.Distance.Between(x, y, e.x, e.y) >= radius) return
        const key = e.body?.id ?? e.x
        const last = hitCd.get(key) || 0
        if (now - last < 220) return
        hitCd.set(key, now)
        Enemy.takeDamage(e, damage * 0.16, x, y, affixes, 0, { source: 'ability', weaponId })
      })
    }

    this.events.on('update', tick)
    const cleanup = () => {
      this.events.off('update', tick)
      blade.destroy()
      aura.destroy()
    }
    this.time.delayedCall(duration, cleanup)
    this.events.once('shutdown', cleanup)
  }

  _createDamageZone(x, y, radius, damage, affixes, { color, alpha, mult, duration, source = 'ability', weaponId = null }) {
    const gz = this.add.graphics().setDepth(4)
    gz.fillStyle(color, alpha)
    gz.fillCircle(x, y, radius)
    const damageCd = new Map()
    const tick = () => {
      const now = this.time.now
      this._enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
        if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < radius) {
          const last = damageCd.get(e) || 0
          if (now - last >= 300) {
            damageCd.set(e, now)
            Enemy.takeDamage(e, damage * mult, x, y, affixes, 0, { source, weaponId })
          }
        }
      })
    }
    this.events.on('update', tick)
    const cleanup = () => { this.events.off('update', tick); gz.destroy() }
    this.time.delayedCall(duration, cleanup)
    this.events.once('shutdown', cleanup)
  }

  _addWeapon(weapon) {
    weapon.createTexture(this)
    const projectiles = this.physics.add.group()

    // Fallback overlap only for weapons WITHOUT updateActive().
    // Weapons with updateActive() handle all hit logic there — registering an overlap would
    // fire during preUpdate (before scene.update), stealing the hit before updateActive runs
    // and preventing AoE/ricochet/burn effects from firing.
    if (!weapon.updateActive) {
      this.physics.add.overlap(
        projectiles,
        this._enemies,
        (proj, enemy) => {
          if (proj.hitSet.has(enemy)) return
          proj.hitSet.add(enemy)
          Enemy.takeDamage(enemy, proj.damage, proj.x, proj.y, this._affixes, proj.knockback ?? 80, {
            source: 'weapon',
            weaponId: proj._weaponId || weapon.id,
          })
          if (!proj.penetrate) proj._spent = true
        }
      )
    }

    // NOTE: each _addWeapon() call stacks one more worldbounds listener.
    // With up to 4 weapons this is 4 listeners — each checks its own group, so behavior is correct.
    // On scene.restart() Phaser destroys the scene fully so listeners are cleaned up automatically.
    this.physics.world.on('worldbounds', (body) => {
      if (body.gameObject && projectiles.contains(body.gameObject)) {
        body.gameObject.disableBody(true, true)
      }
    })

    const entry = { weapon, stats: { ...weapon.baseStats }, timer: 0, projectiles, takenUpgrades: new Set(), lastTrailTime: 0 }

    // Retroactively apply owned weapon upgrades
    const owned = this._weaponUpgradesOwned?.get(weapon.id)
    if (owned) {
      for (const u of (WEAPON_UPGRADES_MAP[weapon.id] || [])) {
        if (owned.has(u.id)) u.apply(entry.stats)
      }
    }

    this._weapons.push(entry)
  }

  update(_, delta) {
    if (this._paused) return
    this._player.update(delta)

    // Animate HP bar: instant on damage, smooth on heal
    const realHp = this._player?.hp ?? 0
    if (realHp < this._displayHp) {
      this._displayHp = realHp
    } else {
      this._displayHp += (realHp - this._displayHp) * Math.min(1, 10 * delta / 1000)
    }
    // Animate XP bar: always smooth
    this._displayXp += (this._xp - this._displayXp) * Math.min(1, 8 * delta / 1000)

    // 武者の気 regen — tick after combat logic
    if (this._regenActive && !this._player._dead) {
      this._regenTimer += delta
      if (this._regenTimer >= 4000) {
        this._player.heal(this._player.maxHp * 0.015 * delta / 1000)
      }
    }

    // 命運印記 — deferred explosion check
    this._enemies.getChildren().forEach(e => {
      if (!e.active || e.dying || !e._doomTimer) return
      if (this.time.now < e._doomTimer) return
      const radius = e._doomRadius || 60
      const dmg    = e._doomDamage || 0
      e._doomTimer = null
      this._enemies.getChildren()
        .filter(en => en.active && !en.dying &&
          Phaser.Math.Distance.Between(e.x, e.y, en.x, en.y) < radius)
        .forEach(en => Enemy.takeDamage(en, dmg, e.x, e.y, this._affixes, 0, { source: 'ability' }))
      const g = this.add.graphics().setDepth(10)
      g.lineStyle(3, 0x9900ff, 0.9)
      g.strokeCircle(e.x, e.y, radius)
      this.tweens.add({ targets: g, alpha: 0, duration: 300, onComplete: () => g.destroy() })
    })

    this._enemies.getChildren().forEach(e => Enemy.update(e, this._player, delta))

    // Soft separation — nudge overlapping enemies apart without hard colliders
    const _activeEnemies = this._enemies.getChildren().filter(e => e.active && !e.dying)
    Enemy.applySeparation(_activeEnemies)

    const px = this._player.x
    const py = this._player.y

    // Iron Will keystone — boost damage when standing still
    if (this._keystonesOwned.has('iron_will')) {
      const dx = Math.abs(px - (this._iwPX || px))
      const dy = Math.abs(py - (this._iwPY || py))
      this._iwPX = px; this._iwPY = py
      if (dx > 2 || dy > 2) {
        this._ironWillTimer = 0
        this._ironWillMult  = 1.0
      } else {
        this._ironWillTimer = (this._ironWillTimer || 0) + delta
        this._ironWillMult  = Math.min(2.0, 1.0 + (this._ironWillTimer / 1000) * 0.20)
      }
    }

    // War Cry proc — auto shockwave every 5s
    if (this._procsOwned.has('war_cry')) {
      this._warCryTimer = (this._warCryTimer || 0) + delta
      if (this._warCryTimer >= this._cooldownAdjusted(5000)) {
        this._warCryTimer = 0
        this._doWarCry()
      }
    }

    // Sanctuary Aura — mark nearby enemies for speed reduction
    if (this._procsOwned.has('sanctuary_aura')) {
      const auraRadius = 100 + this._level * 3
      this._enemies.getChildren().forEach(e => {
        e._inSanctuaryAura = e.active && !e.dying &&
          Phaser.Math.Distance.Between(px, py, e.x, e.y) < auraRadius
      })
    }

    // Dark Aura — mark nearby enemies for damage amplification
    if (this._procsOwned.has('dark_aura')) {
      const darkRadius = 120 + this._level * 2
      this._enemies.getChildren().forEach(e => {
        e._darkAura = e.active && !e.dying &&
          Phaser.Math.Distance.Between(px, py, e.x, e.y) < darkRadius
      })
    }

    // Substitution cooldown countdown
    if (this._substitutionCd > 0) {
      this._substitutionCd = Math.max(0, this._substitutionCd - delta)
    }
    if (this._shadowDodge) {
      const vel = this._player?.sprite?.body?.velocity
      const isMoving = vel ? (Math.abs(vel.x) + Math.abs(vel.y)) > 35 : false
      if (isMoving) {
        this._shadowCloneTimer = (this._shadowCloneTimer || 0) + delta
        if (this._shadowCloneTimer >= 1800) {
          this._shadowCloneTimer = 0
          this._triggerShadowCloneBurst(px, py, 80, 18, 70)
        }
      } else {
        this._shadowCloneTimer = 0
      }
    }
    if (this._bloodRushUntil > 0 && this.time.now >= this._bloodRushUntil) {
      this._bloodRushUntil = 0
    }
    if (this._rationBuffUntil > 0 && this.time.now >= this._rationBuffUntil) {
      this._rationBuffUntil = 0
    }
    if (this._substitutionGrace > 0) {
      this._substitutionGrace = Math.max(0, this._substitutionGrace - delta)
    }

    // Caltrops — drop every 3s at player position
    if (this._caltrops) {
      this._caltropTimer = (this._caltropTimer || 0) + delta
      if (this._caltropTimer >= this._cooldownAdjusted(3000)) {
        this._caltropTimer = 0
        this._dropCaltrops(px, py)
      }
    }

    // Ration — restore 5% HP every 30s
    if (this._procsOwned.has('ration')) {
      this._rationTimer = (this._rationTimer || 0) + delta
      if (this._rationTimer >= this._cooldownAdjusted(20000)) {
        this._rationTimer = 0
        this._player.heal(this._player.maxHp * 0.06)
        this._rationBuffUntil = this.time.now + 5000
      }
    }

    // Tsukuyomi — confuse enemies every 15s
    if (this._tsukuyomi) {
      this._tsukuyomiTimer = (this._tsukuyomiTimer || 0) + delta
      if (this._tsukuyomiTimer >= this._cooldownAdjusted(15000)) {
        this._tsukuyomiTimer = 0
        this._doTsukuyomi()
      }
    }

    // Susano cooldown countdown
    if (this._susanoCd > 0) {
      this._susanoCd = Math.max(0, this._susanoCd - delta)
    }

    // Iron Body proc — stand still shield
    if (this._procsOwned.has('iron_body')) {
      const dx = Math.abs(px - (this._ibPX || px))
      const dy = Math.abs(py - (this._ibPY || py))
      this._ibPX = px; this._ibPY = py
      if (dx > 2 || dy > 2) {
        this._ironBodyTimer = 0
      } else {
        this._ironBodyTimer = (this._ironBodyTimer || 0) + delta
        if (this._ironBodyTimer >= 1500 && !this._ironBodyShield) {
          this._ironBodyShield = true
        }
      }
    }

    for (const entry of this._weapons) {
      if (entry.stats.fireRate > 0) {
        entry.timer += delta
        const tempAtkSpd = this._bloodRushUntil > this.time.now ? 1.12 : 1
        const rationAtkSpd = this._rationBuffUntil > this.time.now ? 1.18 : 1
        const effectiveRate = Math.max(120, entry.stats.fireRate / ((this._attackSpeedMult || 1) * tempAtkSpd * rationAtkSpd))
        if (entry.timer >= effectiveRate) {
          entry.timer = 0
          entry.weapon.fire(this, entry.projectiles, px, py, entry.stats, this._enemies, this._player, this._affixes)
        }
      }
      entry.projectiles.getChildren().forEach(s => {
        if (s._spent) { s._spent = false; s.disableBody(true, true); return }
        entry.weapon.update(s)
      })
      if (entry.weapon.updateActive) {
        this._hitSoundKey = entry.weapon.id
        entry.weapon.updateActive(entry, this, this._enemies, this._player, this._affixes, delta)
      }
    }

    this._elapsed += delta
    this._bossManager.update(this._elapsed)
    this._hudTimer.setText(`${Math.floor(this._elapsed / 1000)}s`)
    this._drawHud()

    // Orb attract & collect
    for (let i = this._orbs.length - 1; i >= 0; i--) {
      const orb  = this._orbs[i]
      const dist = Phaser.Math.Distance.Between(px, py, orb.x, orb.y)

      // Orb lifetime — exempt attracted orbs (already flying toward player)
      if (!orb._attracted) {
        if (!orb._spawnTime) orb._spawnTime = this.time.now
        const elapsed = this.time.now - orb._spawnTime
        if (elapsed >= 12000) {
          // Expire: kill existing tweens first, then fade out and destroy
          if (orb._emitter) orb._emitter.destroy()
          this.tweens.killTweensOf(orb)    // kill warning tween BEFORE adding fade tween
          this._orbs.splice(i, 1)
          this.tweens.add({
            targets: orb, alpha: 0, duration: 300, ease: 'Linear',
            onComplete: () => orb.destroy(),
          })
          continue
        }
        // Warning flash: last 3 seconds — alpha oscillates and accelerates
        // Recreate tween whenever frequency changes by >10ms so flash visibly speeds up
        if (elapsed >= 9000) {
          const remaining = 12000 - elapsed         // 3000 → 0
          const freq = Math.round(Phaser.Math.Linear(200, 80, 1 - remaining / 3000))
          if (!orb._warnFreq || Math.abs(orb._warnFreq - freq) > 10) {
            orb._warnFreq = freq
            this.tweens.killTweensOf(orb)
            this.tweens.add({
              targets: orb, alpha: { from: 0.2, to: 1.0 },
              yoyo: true, repeat: -1, duration: freq, ease: 'Linear',
            })
          }
        }
      }

      if (dist < CFG.ORB_COLLECT_RADIUS) {
        if (orb._emitter) orb._emitter.destroy()
        orb.destroy()
        this._orbs.splice(i, 1)
        this._addXp((orb._xpValue ?? this._currentWaveXp) * (this._critKillXpMult || 1))
        continue
      }

      const attractRadius = this._orbAttractRadius || CFG.ORB_ATTRACT_RADIUS
      if (dist < attractRadius) {
        // First frame entering attract zone — stop floating tween
        if (!orb._attracted) {
          orb._attracted = true
          this.tweens.killTweensOf(orb)
          orb.setScale(orb.scaleX * 1.3)  // slight grow to signal attraction
        }
        // Fly toward player, faster the closer it gets
        const speed = Phaser.Math.Linear(500, 200, dist / attractRadius)
        const angle = Phaser.Math.Angle.Between(orb.x, orb.y, px, py)
        orb.x += Math.cos(angle) * speed * (delta / 1000)
        orb.y += Math.sin(angle) * speed * (delta / 1000)
      }
    }
  }

  _togglePause() {
    if (this._player?._dead || this._upgrading) return
    this._paused = !this._paused
    if (this._paused) {
      this.physics.pause()
      this.time.paused = true
      this._pauseOverlay.setVisible(true)
      this._pauseTitleText.setVisible(true)
      this._pauseHintText.setVisible(true)
      this._pauseBtn.setColor('#c8a84b')
    } else {
      this.physics.resume()
      this.time.paused = false
      this._pauseOverlay.setVisible(false)
      this._pauseTitleText.setVisible(false)
      this._pauseHintText.setVisible(false)
      this._pauseBtn.setColor('#8a7a5a')
    }
  }

  _drawHud() {
    const W      = this.cameras.main.width
    const hpPct  = Math.max(0, this._displayHp / this._player.maxHp)
    const xpPct  = Math.max(0, this._displayXp / this._xpToNext)
    const BX = 52, BW = 168   // bar x, bar width (icon area occupies x=10..52)

    this._hud.clear()

    // HP bar track → dark fill → bright fill → top highlight
    this._hud.fillStyle(0x180508, 1).fillRoundedRect(BX, 21, BW, 12, 4)
    if (hpPct > 0) {
      const fw = Math.max(8, BW * hpPct)
      this._hud.fillStyle(0x881520, 1).fillRoundedRect(BX, 21, fw, 12, 4)
      this._hud.fillStyle(0xdd2235, 1).fillRoundedRect(BX, 21, fw,  5, 4)
    }
    this._hud.lineStyle(1, 0x661222, 0.8).strokeRoundedRect(BX, 21, BW, 12, 4)

    // XP bar
    this._hud.fillStyle(0x040812, 1).fillRoundedRect(BX, 39, BW, 8, 3)
    if (xpPct > 0) {
      const fw = Math.max(6, BW * xpPct)
      this._hud.fillStyle(0x2255cc, 1).fillRoundedRect(BX, 39, fw, 8, 3)
      this._hud.fillStyle(0x55aaff, 1).fillRoundedRect(BX, 39, fw, 3, 3)
    }
    this._hud.lineStyle(1, 0x223366, 0.8).strokeRoundedRect(BX, 39, BW, 8, 3)

    this._hudLevel.setText(`Lv ${this._level}`)
    this._hudTimer.setX(W - 12).setText(_fmtTime(this._elapsed))
    this._hudWave.setX(W - 12).setText(WAVE_NAMES[getWaveIndex(this._elapsed)] || '')

    // Weapon icon — left of bars, top=HP bar top (y=21), bottom=XP bar bottom (y=47)
    if (this._weapons.length !== this._lastWeaponCount) {
      this._lastWeaponCount = this._weapons.length
      this._hudWeaponIcons.forEach(({ label }) => label.destroy())
      const entry = this._weapons[0]
      if (entry) {
        const w  = entry.weapon
        const cx = 31, cy = 47   // centre of available area (x=10..52, y=21..74)
        const maxW = 40, maxH = 53  // icon area width × HP top to level text bottom

        let label
        if (w.iconKey) {
          label = this.add.image(cx, cy, w.iconKey, w.iconFrame ?? undefined)
          const scale = Math.min(maxW / label.width, maxH / label.height)
          label.setScale(scale).setScrollFactor(0).setDepth(201)
        } else {
          label = this.add.text(cx, cy, w.iconChar ?? w.name[0], {
            fontSize: '20px', color: '#f0e8d0',
            fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
          }).setScrollFactor(0).setDepth(201).setOrigin(0.5)
        }
        this._hudWeaponIcons = [{ label }]
      }
    }

    // Boss HP bar
    const bossAlpha = this._bossManager.activeBoss ? 1 : 0
    this._bossBarBg.setAlpha(bossAlpha)
    this._bossBarFill.setAlpha(bossAlpha)
    this._bossBarHighlight.setAlpha(bossAlpha)
    this._bossNameText.setAlpha(bossAlpha)
    this._bossPctText.setAlpha(bossAlpha)

    if (this._bossManager.activeBoss) {
      const pct   = this._bossManager._bossHpPct
      const bossW = 300
      this._bossBarFill.setDisplaySize(Math.round(bossW * pct), 10)
      this._bossPctText.setText(`${Math.round(pct * 100)}%`)
      this._bossNameText.setText(this._bossManager._bossName)
    }
  }

  _spawnWave() {
    const wave    = getWaveConfig(this._elapsed)
    const waveIdx = getWaveIndex(this._elapsed)

    // Detect wave transition → announce + surge
    if (waveIdx !== this._currentWaveIdx) {
      this._currentWaveIdx = waveIdx
      this._currentWaveXp  = wave.xpDrop
      this._showWaveAnnouncement(WAVE_NAMES[waveIdx])
      this._triggerWaveSurge(wave)
    }

    // Update trickle interval
    this._spawnEvent.delay = wave.spawnInterval
    this._currentWaveXp    = wave.xpDrop

    // Trickle: refill up to max
    if (this._enemies.countActive() < wave.maxEnemies) {
      this._spawnOneEnemy(wave)
    }
  }

  // Surge: 3 batches of (surgeSize/3) enemies, each batch 1.5s apart.
  // Fills the opening "flood" feeling at each wave transition.
  _triggerWaveSurge(wave) {
    const batchSize = Math.ceil(wave.surgeSize / 3)
    for (let b = 0; b < 3; b++) {
      this.time.delayedCall(b * 1500, () => {
        if (this._paused || this._bossActive) return
        const n = Math.min(batchSize, wave.maxEnemies - this._enemies.countActive())
        for (let i = 0; i < n; i++) {
          this._spawnOneEnemy(wave)
        }
      })
    }
  }

  // Spawn a single kisotsu enemy using current wave stats.
  _spawnOneEnemy(wave) {
    const { x, y } = randomEdgePoint(CFG.WORLD_WIDTH, CFG.WORLD_HEIGHT)
    let enemy = this._enemies.getFirstDead(false)
    if (!enemy) {
      enemy = this._enemies.create(x, y, 'kisotsu-run', 0)
      enemy.setDepth(5)
    }
    const typeConfig = {
      id:            'kisotsu',
      baseTint:      null,
      hpMult:        wave.hp    / CFG.ENEMY_HP,
      speedMult:     (wave.speed / CFG.ENEMY_SPEED) * (this._enemySpeedBuff || 1),
      sizeMult:      wave.scale,
      behaviorFlags: {},
    }
    Enemy.activate(enemy, x, y, typeConfig, null, wave.damage)
  }

  _spawnOrb(ex, ey, xpValue = null) {
    const orb = this.add.sprite(ex, ey, 'musou', 0)
      .setDisplaySize(this._orbW, this._orbH)
      .setDepth(4)
    orb.play('musou-spin')
    orb._xpValue = xpValue ?? this._currentWaveXp

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
    orb._spawnTime = this.time.now
  }

  _addXp(amount) {
    if (this._upgrading) return
    // At max level, XP is frozen
    if (this._level >= CFG.MAX_LEVEL) {
      this._xp = this._xpToNext
      return
    }
    const gained = amount * (this._xpMult || 1)
    // Daimyo tax — every 100 XP permanently +1% global damage
    if (this._daimyoTax) {
      this._daimyoTaxXp = (this._daimyoTaxXp || 0) + gained
      while (this._daimyoTaxXp >= 100) {
        this._daimyoTaxXp -= 100
        this._globalDmgMult = (this._globalDmgMult || 1) * 1.01
      }
    }
    this._xp += gained
    if (this._xp >= this._xpToNext) {
      this._xp      -= this._xpToNext
      this._displayXp = 0   // snap to zero so bar fills from start on new level
      this._level   += 1
      this._xpToNext = xpThreshold(this._level)

      // At max level — no upgrade prompt, just stop
      if (this._level >= CFG.MAX_LEVEL) {
        this._xp = this._xpToNext
        return
      }

      this._upgrading = true

      // Lv.3 = first weapon branch. Lv.12 = second weapon branch if upgrades remain.
      const isWeaponBranch = (this._level === 3) && !this._weaponChoiceDone
      const hasRemainingWeaponUpgrades = this._getRemainingWeaponUpgradeCount() > 0
      const isFinalWeaponBranch = (this._level === 12) &&
        this._weaponChoiceDone && !this._weaponFinalChoiceDone && hasRemainingWeaponUpgrades
      const upgradeMode    = isWeaponBranch || isFinalWeaponBranch ? 'weapon_branch'
                           : (this._level === 12) ? 'legendary_milestone'
                           : 'normal'

      this.events.once('upgrade-chosen', (upgrade) => {
        if (upgrade.target === 'weapon') {
          const entry = this._weapons.find(e => e.weapon.id === upgrade.weaponId)
          if (entry) {
            upgrade.apply(entry.stats)
            if (!this._weaponUpgradesOwned.has(upgrade.weaponId))
              this._weaponUpgradesOwned.set(upgrade.weaponId, new Set())
            this._weaponUpgradesOwned.get(upgrade.weaponId).add(upgrade.id)
          }
          if (!this._weaponChoiceDone) {
            this._weaponChoiceDone = true
          } else if (!this._weaponFinalChoiceDone) {
            this._weaponFinalChoiceDone = true
          }
        } else if (upgrade.target === 'passive') {
          if (upgrade.subtype === 'proc') this._procsOwned.add(upgrade.id)
          if (upgrade.subtype === 'keystone') this._keystonesOwned.add(upgrade.id)
          upgrade.apply(this._player, this)
          if (upgrade.oneTime) {
            this._passivesOwned.add(upgrade.id)
          } else if (upgrade.maxStacks) {
            const cur = (this._passiveStacks.get(upgrade.id) || 0) + 1
            this._passiveStacks.set(upgrade.id, cur)
            if (cur >= upgrade.maxStacks) this._passivesOwned.add(upgrade.id)
          }
        }
        // Track defensive pickup for guarantee logic
        const DEFENSIVE_IDS = new Set(['defense','soul_drain','life_leech','thorns','sanctuary_aura','war_cry','iron_body','vitality','steady_stance','substitution'])
        if (DEFENSIVE_IDS.has(upgrade.id)) this._hasDefensive = true
        this._upgrading = false
        this.scene.resume('GameScene')
      })

      const choices    = this._buildUpgradePool(upgradeMode)
      const weaponName = this._weapons[0]?.weapon.name ?? ''
      this.scene.launch('UpgradeScene', { level: this._level, upgrades: choices, mode: upgradeMode, weaponName })
      this.scene.pause('GameScene')
    }
  }

  _buildUpgradePool(mode = 'normal') {
    // ── Weapon Branch: pick 2 from the currently available weapon upgrades ──
    if (mode === 'weapon_branch') {
      const entry = this._weapons[0]
      if (!entry) return []
      const wId  = entry.weapon.id
      const owned = this._weaponUpgradesOwned.get(wId) || new Set()
      const pool = (WEAPON_UPGRADES_MAP[wId] || [])
        .filter(u => !owned.has(u.id))
        .map(u => ({ ...u, target: 'weapon', weaponId: wId }))
      return this._weightedSelect(pool, pool.map(() => 1), 2)
    }

    // ── Normal / Legendary-Milestone pool ─────────────────────────────────────
    const level = this._level || 1
    const ownedIds = new Set()

    this._procsOwned.forEach(id => ownedIds.add(id))
    this._keystonesOwned.forEach(id => ownedIds.add(id))
    this._passivesOwned.forEach(id => ownedIds.add(id))
    this._weaponUpgradesOwned.forEach(set => set.forEach(id => ownedIds.add(id)))

    // Current weapon IDs — used for weapon-gated passive filtering
    const activeWeaponIds = new Set(this._weapons.map(e => e.weapon.id))

    const candidates = []

    // Unified passive pool — common/rare/epic/legendary all share one source
    for (const p of ALL_PASSIVES) {
      if (this._passivesOwned.has(p.id)) continue
      if (level < (p.minLevel || 1)) continue
      if (p.requires && !ownedIds.has(p.requires)) continue
      // Skip weapon-gated passives that don't apply to the current weapon
      if (p.requiresWeapons && !p.requiresWeapons.some(id => activeWeaponIds.has(id))) continue
      if (p.maxStacks) {
        const cur = this._passiveStacks.get(p.id) || 0
        candidates.push({ ...p, target: 'passive', stackCur: cur, stackMax: p.maxStacks })
      } else {
        candidates.push({ ...p, target: 'passive' })
      }
    }

    if (candidates.length === 0) {
      return ALL_PASSIVES.slice(0, 3).map(p => ({ ...p, target: 'passive' }))
    }

    // ── Weight modifiers ──────────────────────────────────────────────────────
    const DEFENSIVE_IDS        = new Set(['defense','soul_drain','life_leech','thorns','sanctuary_aura','war_cry','iron_body','vitality','steady_stance','substitution'])
    const earlyGame            = level <= 4
    const needDefense          = level >= 8 && !this._hasDefensive
    const isLegendaryMilestone = mode === 'legendary_milestone'

    const weights = candidates.map(u => {
      const base = RARITY_WEIGHTS[u.rarity] ?? RARITY_WEIGHTS.common
      if (earlyGame && u.target !== 'weapon' && u.target !== 'passive') return base * 0.1
      if (needDefense && DEFENSIVE_IDS.has(u.id)) return base * 5
      if (isLegendaryMilestone && u.rarity === 'legendary') return base * 6
      if (isLegendaryMilestone && u.rarity === 'epic')      return base * 3
      if (u.target === 'weapon') return base * 0.65
      return base
    })

    // weapon_branch = 2-card pick from full pool; everything else = 3
    const pickCount = mode === 'weapon_branch' ? 2 : 3
    return this._weightedSelect(candidates, weights, pickCount)
  }

  // Weighted random sampling without replacement
  _weightedSelect(items, weights, count) {
    const result = []
    const w = [...weights]
    const pool = [...items]
    const n = Math.min(count, pool.length)
    for (let i = 0; i < n; i++) {
      const total = w.reduce((s, x) => s + x, 0)
      if (total <= 0) break
      let r = Math.random() * total
      let idx = 0
      for (; idx < w.length - 1; idx++) {
        r -= w[idx]
        if (r <= 0) break
      }
      result.push(pool[idx])
      pool.splice(idx, 1)
      w.splice(idx, 1)
    }
    return result
  }

  _getRemainingWeaponUpgradeCount() {
    const wId = this._weapons[0]?.weapon?.id
    if (!wId) return 0
    const owned = this._weaponUpgradesOwned.get(wId) || new Set()
    return (WEAPON_UPGRADES_MAP[wId] || []).filter(u => !owned.has(u.id)).length
  }

  _doWarCry() {
    const px = this._player.x, py = this._player.y
    const radius = 150
    this._enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
      if (Phaser.Math.Distance.Between(px, py, e.x, e.y) < radius) {
        const dx = e.x - px, dy = e.y - py
        const len = Math.hypot(dx, dy) || 1
        e.body.velocity.x = (dx / len) * 400
        e.body.velocity.y = (dy / len) * 400
        e.knockbackTimer = 350
        e._warCryExposeUntil = this.time.now + 4000
        if (this._keystonesOwned.has('ice_thunder')) {
          e._warCryConductiveUntil = this.time.now + 4000
          Enemy.takeDamage(e, 70, px, py, this._affixes || [], 120, { source: 'proc' })
        }
      }
    })
    const g = this.add.graphics().setDepth(8)
    g.lineStyle(3, 0xffcc44, 0.9)
    g.strokeCircle(px, py, radius)
    this.tweens.add({ targets: g, alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 400, onComplete: () => g.destroy() })
  }

  _doSoulBurst() {
    const px = this._player.x, py = this._player.y
    const radius = Math.max(CFG.WORLD_WIDTH, CFG.WORLD_HEIGHT)
    this._enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
      const dx = e.x - px, dy = e.y - py
      const len = Math.hypot(dx, dy) || 1
      e.body.velocity.x = (dx / len) * 600
      e.body.velocity.y = (dy / len) * 600
      e.knockbackTimer = 400
      Enemy.takeDamage(e, 90, px, py, this._affixes, 0, { source: 'proc' })
    })
    const g = this.add.graphics().setDepth(8)
    g.lineStyle(4, 0xddaaff, 1.0)
    g.strokeCircle(px, py, 10)
    this.tweens.add({
      targets: g, scaleX: radius / 10, scaleY: radius / 10, alpha: 0,
      duration: 500, ease: 'Power2', onComplete: () => g.destroy(),
    })
  }

  _dropCaltrops(x, y) {
    const radius = 40
    const dur    = 4000
    const g = this.add.graphics().setDepth(3)
    g.fillStyle(0x886622, 0.5)
    g.fillCircle(x, y, radius)
    const damageCd = new Map()
    const tick = this.time.addEvent({
      delay: 300,
      repeat: Math.ceil(dur / 300),
      callback: () => {
        const now = this.time.now
        this._enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
          if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < radius) {
            const last = damageCd.get(e) || 0
            if (now - last >= 500) {
              damageCd.set(e, now)
              Enemy.takeDamage(e, 15, x, y, this._affixes, 0, { source: 'proc' })
              // Slow enemy
              const se = e._statusEffects
              if (se) {
                se.chill.active = true
                se.chill.timer  = Math.max(se.chill.timer, 2000 * (this._ailmentDurMult || 1))
              }
            }
          }
        })
      },
    })
    this.time.delayedCall(dur, () => { g.destroy(); tick.remove() })
  }

  _doTsukuyomi() {
    // Reverse all enemy velocities for 2 seconds, causing chaos
    const affected = this._enemies.getChildren().filter(e => e.active && !e.dying)
    affected.forEach(e => {
      e._stunTimer = Math.max(e._stunTimer || 0, 2000)
    })
    // Visual flash
    const W = this.cameras.main.width, H = this.cameras.main.height
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0x220066, 0.35)
      .setScrollFactor(0).setDepth(299)
    this.tweens.add({ targets: flash, alpha: 0, duration: 800, onComplete: () => flash.destroy() })
  }

  _triggerShadowCloneBurst(x, y, radius = 90, damage = 30, knockback = 90) {
    this._enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
      if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < radius) {
        Enemy.takeDamage(e, damage, x, y, this._affixes || [], knockback, { source: 'proc' })
      }
    })
    const g = this.add.graphics().setDepth(8)
    g.lineStyle(2, 0x99bbff, 0.85)
    g.strokeCircle(x, y, radius)
    this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() })
  }

  _triggerIronBodyPulse(x, y) {
    const radius = 120
    this._enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
      if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < radius) {
        const dx = e.x - x, dy = e.y - y
        const len = Math.hypot(dx, dy) || 1
        e.body.velocity.x = (dx / len) * 460
        e.body.velocity.y = (dy / len) * 460
        e.knockbackTimer = 260
        Enemy.takeDamage(e, 55, x, y, this._affixes || [], 0, { source: 'proc' })
        e._warCryExposeUntil = this.time.now + 2500
      }
    })
    const g = this.add.graphics().setDepth(8)
    g.lineStyle(3, 0xaad8ff, 0.9)
    g.strokeCircle(x, y, radius)
    this.tweens.add({ targets: g, alpha: 0, duration: 240, onComplete: () => g.destroy() })
  }

  _cooldownAdjusted(baseMs) {
    return baseMs * (this._cdMult || 1)
  }

  _reduceSupportCooldowns(ms) {
    this._warCryTimer = Math.min(this._cooldownAdjusted(5000), (this._warCryTimer || 0) + ms)
    this._rationTimer = Math.min(this._cooldownAdjusted(20000), (this._rationTimer || 0) + ms)
    this._tsukuyomiTimer = Math.min(this._cooldownAdjusted(15000), (this._tsukuyomiTimer || 0) + ms)
    if (this._substitutionCd > 0) this._substitutionCd = Math.max(0, this._substitutionCd - ms)
  }

  _triggerWarCryChain(x, y, sourceEnemy) {
    const targets = this._enemies.getChildren()
      .filter(e => e.active && !e.dying && e !== sourceEnemy)
      .filter(e => Phaser.Math.Distance.Between(x, y, e.x, e.y) < 170)
      .sort((a, b) => Phaser.Math.Distance.Between(x, y, a.x, a.y) - Phaser.Math.Distance.Between(x, y, b.x, b.y))
      .slice(0, 3)

    targets.forEach(e => {
      const g = this.add.graphics().setDepth(8)
      g.lineStyle(2, 0x99ddff, 0.9)
      g.lineBetween(x, y, e.x, e.y)
      this.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() })
      Enemy.takeDamage(e, 45, x, y, this._affixes || [], 40, { source: 'proc' })
    })
  }

  playHitSound(weaponId) {
    if (!weaponId) return
    const now  = this.time.now
    const last = this._hitSoundThrottle.get(weaponId) || 0
    if (now - last < 80) return
    this._hitSoundThrottle.set(weaponId, now)
    const key = `sfx_${weaponId}`
    if (this.sound.get(key) || this.cache.audio.exists(key)) {
      this.sound.play(key, { volume: 0.5 })
    }
  }

  _showWaveAnnouncement(name) {
    const txt = this._waveAnnounce
    if (!txt) return
    // Kill any existing tween on this text
    this.tweens.killTweensOf(txt)
    txt.setText(name).setAlpha(0).setScale(1.2)
    this.tweens.add({
      targets: txt, alpha: 1, scaleX: 1, scaleY: 1,
      duration: 350, ease: 'Back.easeOut',
    })
    this.tweens.add({
      targets: txt, alpha: 0,
      duration: 500, delay: 1800, ease: 'Cubic.easeIn',
    })
  }

  _createGravityField(x, y, radius, affixes, weaponId = 'homura') {
    const dur = 1500
    let elapsed = 0
    const g = this.add.graphics().setDepth(4)
    const burstSet = new WeakSet()
    const tick = (_, delta) => {
      elapsed += delta
      const alpha = 0.4 * (1 - elapsed / dur)
      g.clear()
      g.fillStyle(0x220044, alpha)
      g.fillCircle(x, y, radius)
      this._enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
        const dist = Phaser.Math.Distance.Between(x, y, e.x, e.y)
        if (dist < radius && dist > 2) {
          const dx = x - e.x, dy = y - e.y
          const len = Math.hypot(dx, dy)
          const pull = 120 * (1 - dist / radius)
          e.body.velocity.x += (dx / len) * pull * delta / 1000
          e.body.velocity.y += (dy / len) * pull * delta / 1000
          if (this._keystonesOwned.has('gravity_burst') && dist < Math.max(24, radius * 0.20) && !burstSet.has(e)) {
            burstSet.add(e)
            Enemy.takeDamage(e, Math.max(12, e.maxHp * 0.08), x, y, affixes, 0, {
              source: 'ability',
              weaponId,
            })
          }
        }
      })
      if (elapsed >= dur) {
        this.events.off('update', tick)
        g.destroy()
      }
    }
    this.events.on('update', tick)
    this.events.once('shutdown', () => { this.events.off('update', tick); g.destroy() })
  }

  _onPlayerDead() {
    this.physics.pause()
    const W  = this.cameras.main.width
    const H  = this.cameras.main.height
    const cx = W / 2, cy = H / 2

    // Dim overlay
    this.add.rectangle(cx, cy, W, H, 0x000000, 0.72)
      .setScrollFactor(0).setDepth(300)

    // 死 kanji
    const deathKanji = this.add.text(cx, cy - 70, '死', {
      fontSize: '88px', color: '#cc1122',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
      stroke: '#3a0008', strokeThickness: 5,
    }).setScrollFactor(0).setDepth(301).setOrigin(0.5).setAlpha(0)

    // Survival stats
    const statsText = this.add.text(cx, cy + 12,
      `生存  ${_fmtTime(this._elapsed)}   到達  Lv ${this._level}   擊殺  ${this._killCount}`, {
        fontSize: '17px', color: '#c8a84b',
        fontFamily: '"Cinzel", "Palatino Linotype", serif',
        stroke: '#06060f', strokeThickness: 3,
      }
    ).setScrollFactor(0).setDepth(301).setOrigin(0.5).setAlpha(0)

    const restartText = this.add.text(cx, cy + 58, 'Click to restart', {
      fontSize: '12px', color: '#6a6854',
      fontFamily: '"Cinzel", serif',
      stroke: '#06060f', strokeThickness: 2,
    }).setScrollFactor(0).setDepth(301).setOrigin(0.5).setAlpha(0)

    this.tweens.add({
      targets: [deathKanji, statsText, restartText],
      alpha: 1, duration: 900, ease: 'Power2',
    })
    this.tweens.add({
      targets: deathKanji,
      scaleX: { from: 1.5, to: 1 }, scaleY: { from: 1.5, to: 1 },
      duration: 700, ease: 'Back.easeOut',
    })

    this.input.once('pointerdown', () => this.scene.restart())
  }

  _onVictory() {
    this.physics.pause()
    const W  = this.cameras.main.width
    const H  = this.cameras.main.height
    const cx = W / 2, cy = H / 2

    // Dim overlay
    this.add.rectangle(cx, cy, W, H, 0x000000, 0.72)
      .setScrollFactor(0).setDepth(300)

    // 勝 kanji
    const victoryKanji = this.add.text(cx, cy - 70, '勝', {
      fontSize: '88px', color: '#d4a843',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
      stroke: '#3a2000', strokeThickness: 5,
    }).setScrollFactor(0).setDepth(301).setOrigin(0.5).setAlpha(0)

    // Stats
    const statsText = this.add.text(cx, cy + 12,
      `生存  ${_fmtTime(this._elapsed)}   到達  Lv ${this._level}   擊殺  ${this._killCount}`, {
        fontSize: '17px', color: '#c8a84b',
        fontFamily: '"Cinzel", "Palatino Linotype", serif',
        stroke: '#06060f', strokeThickness: 3,
      }
    ).setScrollFactor(0).setDepth(301).setOrigin(0.5).setAlpha(0)

    const restartText = this.add.text(cx, cy + 58, 'Click to restart', {
      fontSize: '12px', color: '#6a6854',
      fontFamily: '"Cinzel", serif',
      stroke: '#06060f', strokeThickness: 2,
    }).setScrollFactor(0).setDepth(301).setOrigin(0.5).setAlpha(0)

    this.tweens.add({
      targets: [victoryKanji, statsText, restartText],
      alpha: 1, duration: 900, ease: 'Power2',
    })
    this.tweens.add({
      targets: victoryKanji,
      scaleX: { from: 1.5, to: 1 }, scaleY: { from: 1.5, to: 1 },
      duration: 700, ease: 'Back.easeOut',
    })

    this.input.once('pointerdown', () => this.scene.restart())
  }
}

function _fmtTime(ms) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
