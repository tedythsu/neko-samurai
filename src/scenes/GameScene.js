// src/scenes/GameScene.js
import Phaser from 'phaser'
import Player   from '../entities/Player.js'
import Enemy    from '../entities/Enemy.js'
import { CFG, randomEdgePoint, xpThreshold, PROGRESSION_BREAKPOINTS } from '../config.js'
import { WEAPON_UPGRADES_MAP } from '../upgrades/weaponUpgrades.js'
import { ALL_ELEMENTALS }      from '../upgrades/elementals.js'
import { ALL_PROCS }           from '../upgrades/procs.js'
import { ALL_KEYSTONES }       from '../upgrades/keystones.js'
import { ALL_PASSIVES }        from '../upgrades/passives.js'
import { ENEMY_TYPES, getDifficultyMult } from '../enemies/EnemyTypes.js'
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
    this._affixes              = []          // active elemental ailments
    this._affixCounts          = new Map()   // elemental id → 1 (one-time)
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
    this._critBonus            = 0
    this._critDmgBonus         = 0
    this._warCryTimer          = 0
    this._ironBodyTimer        = 0
    this._ironWillTimer        = 0
    this._tachiComboGuardActive = false
    this._tachiComboGuardMult   = 1.0

    this._addWeapon(this._startWeapon)

    // XP / level system
    this._xp       = 0
    this._level    = 1
    this._xpToNext = xpThreshold(this._level)
    this._upgrading = false
    this._displayHp = 100   // animated display values for bar rendering
    this._displayXp = 0
    this._orbs = []

    this.events.on('enemy-died', ({ x, y }) => {
      this._spawnOrb(x, y)
      this._killCount++
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

    // Pause button (below timer, top-right)
    const W = this.cameras.main.width
    const H = this.cameras.main.height
    this._pauseBtn = this.add.text(W - 12, 36, '⏸', {
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

  _createScorchZone(x, y, radius, damage, affixes) {
    this._createDamageZone(x, y, radius, damage, affixes, { color: 0xff4400, alpha: 0.30, mult: 0.15, duration: 3000 })
  }

  _createLingerZone(x, y, radius, damage, affixes) {
    this._createDamageZone(x, y, radius, damage, affixes, { color: 0x8800cc, alpha: 0.25, mult: 0.20, duration: 2000 })
  }

  _createDamageZone(x, y, radius, damage, affixes, { color, alpha, mult, duration }) {
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
            Enemy.takeDamage(e, damage * mult, x, y, affixes, 0)
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
          Enemy.takeDamage(enemy, proj.damage, proj.x, proj.y, this._affixes, proj.knockback ?? 80)
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
        .forEach(en => Enemy.takeDamage(en, dmg, e.x, e.y, this._affixes, 0))
      const g = this.add.graphics().setDepth(10)
      g.lineStyle(3, 0x9900ff, 0.9)
      g.strokeCircle(e.x, e.y, radius)
      this.tweens.add({ targets: g, alpha: 0, duration: 300, onComplete: () => g.destroy() })
    })

    this._enemies.getChildren().forEach(e => Enemy.update(e, this._player, delta))

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
      if (this._warCryTimer >= 5000) {
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
        if (entry.timer >= entry.stats.fireRate) {
          entry.timer = 0
          entry.weapon.fire(this, entry.projectiles, px, py, entry.stats, this._enemies, this._player, this._affixes)
        }
      }
      entry.projectiles.getChildren().forEach(s => {
        if (s._spent) { s._spent = false; s.disableBody(true, true); return }
        entry.weapon.update(s)
      })
      if (entry.weapon.updateActive) {
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
        this._addXp(CFG.XP_PER_ENEMY)
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
    // Difficulty multipliers for current elapsed time
    const diff = getDifficultyMult(this._elapsed, PROGRESSION_BREAKPOINTS)

    // Update spawn interval in-place (no destroy/recreate)
    this._spawnEvent.delay = Math.round(diff.spawnInterval)

    // Max-on-screen cap
    if (this._enemies.countActive() >= diff.maxEnemies) return

    // Build unlocked type pool (excluding 爆炸型 during boss — _bossActive flag)
    const pool = ENEMY_TYPES.filter(t =>
      t.unlockMs <= this._elapsed &&
      !(this._bossActive && t.id === 'bakuha')
    )
    if (pool.length === 0) return

    const count = Math.floor(this._level / CFG.WAVE_SCALE) + 1
    for (let i = 0; i < count; i++) {
      if (this._enemies.countActive() >= diff.maxEnemies) break
      const { x, y } = randomEdgePoint(CFG.WORLD_WIDTH, CFG.WORLD_HEIGHT)
      let enemy = this._enemies.getFirstDead(false)
      if (!enemy) {
        enemy = this._enemies.create(x, y, 'kisotsu-run', 0)
        enemy.setDepth(5)
      }
      // Pick a random type from the unlocked pool
      const typeConfig = pool[Math.floor(Math.random() * pool.length)]
      Enemy.activate(enemy, x, y, typeConfig, diff)
    }
  }

  _spawnOrb(ex, ey) {
    const orb = this.add.sprite(ex, ey, 'musou', 0)
      .setDisplaySize(this._orbW, this._orbH)
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
    orb._spawnTime = this.time.now
  }

  _addXp(amount) {
    if (this._upgrading) return
    this._xp += amount
    if (this._xp >= this._xpToNext) {
      this._xp      -= this._xpToNext
      this._displayXp = 0   // snap to zero so bar fills from start on new level
      this._level   += 1
      this._xpToNext = xpThreshold(this._level)
      this._upgrading = true

      this.events.once('upgrade-chosen', (upgrade) => {
        if (upgrade.target === 'weapon') {
          const entry = this._weapons.find(e => e.weapon.id === upgrade.weaponId)
          if (entry) {
            upgrade.apply(entry.stats)
            if (!this._weaponUpgradesOwned.has(upgrade.weaponId))
              this._weaponUpgradesOwned.set(upgrade.weaponId, new Set())
            this._weaponUpgradesOwned.get(upgrade.weaponId).add(upgrade.id)
          }
        } else if (upgrade.target === 'elemental') {
          this._affixes.push(upgrade.elemental)
          this._affixCounts.set(upgrade.elemental.id, 1)
        } else if (upgrade.target === 'proc') {
          this._procsOwned.add(upgrade.id)
          if (upgrade.apply) upgrade.apply(this._player, this)
        } else if (upgrade.target === 'keystone') {
          this._keystonesOwned.add(upgrade.id)
          if (upgrade.apply) upgrade.apply(this._player, this)
        } else if (upgrade.target === 'passive') {
          upgrade.apply(this._player, this)
          if (upgrade.oneTime) this._passivesOwned.add(upgrade.id)
        }
        this._upgrading = false
        this.scene.resume('GameScene')
      })

      const choices = this._buildUpgradePool()
      this.scene.launch('UpgradeScene', { level: this._level, upgrades: choices })
      this.scene.pause('GameScene')
    }
  }

  _buildUpgradePool() {
    const pool = []

    // Weapon-specific upgrades (4 per weapon)
    const entry = this._weapons[0]
    if (entry) {
      const wId = entry.weapon.id
      const upgrades = WEAPON_UPGRADES_MAP[wId] || []
      const owned = this._weaponUpgradesOwned.get(wId) || new Set()
      for (const u of upgrades) {
        if (!owned.has(u.id))
          pool.push({ ...u, target: 'weapon', weaponId: wId })
      }
    }

    // Elemental ailments (one-time)
    pool.push(...ALL_ELEMENTALS
      .filter(e => !this._affixCounts.has(e.id))
      .map(e => ({ id: e.id, name: e.name, desc: e.desc, target: 'elemental', elemental: e })))

    // Procs/Auras
    pool.push(...ALL_PROCS
      .filter(p => !this._procsOwned.has(p.id) && this._level >= (p.minLevel ?? 1))
      .map(p => ({ ...p, target: 'proc' })))

    // Keystones
    pool.push(...ALL_KEYSTONES
      .filter(k => !this._keystonesOwned.has(k.id) && this._level >= (k.minLevel ?? 5))
      .map(k => ({ ...k, target: 'keystone' })))

    // Passives (stackable unless oneTime)
    pool.push(...ALL_PASSIVES
      .filter(p => !p.oneTime || !this._passivesOwned.has(p.id))
      .map(p => ({ ...p, target: 'passive' })))

    // Deduplicate
    const seen = new Set()
    const deduped = pool.filter(u => {
      const key = u.id + (u.weaponId ?? '')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    if (deduped.length === 0) {
      return ALL_PASSIVES.slice(0, 3).map(p => ({ ...p, target: 'passive' }))
    }

    return Phaser.Utils.Array.Shuffle(deduped).slice(0, 3)
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
      }
    })
    const g = this.add.graphics().setDepth(8)
    g.lineStyle(3, 0xffcc44, 0.9)
    g.strokeCircle(px, py, radius)
    this.tweens.add({ targets: g, alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 400, onComplete: () => g.destroy() })
  }

  _createGravityField(x, y, radius, affixes) {
    const dur = 1500
    let elapsed = 0
    const g = this.add.graphics().setDepth(4)
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
