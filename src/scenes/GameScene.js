// src/scenes/GameScene.js
import Phaser from 'phaser'
import Player   from '../entities/Player.js'
import Enemy    from '../entities/Enemy.js'
import { CFG, randomEdgePoint, xpThreshold, PLAYER_UPGRADES } from '../config.js'
import { ALL_AFFIXES, ALL_MECHANICAL, ALL_TIER2_AFFIXES, checkResonances } from '../affixes/index.js'
import { ALL_WEAPONS } from '../weapons/index.js'

export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene') }

  init(data) {
    this._startWeapon = data.weapon
  }

  preload() {
    this.load.image('kunai',      'assets/sprites/weapons/kunai.png')
    this.load.image('shuriken',   'assets/sprites/weapons/shuriken.png')
    this.load.image('kusarigama', 'assets/sprites/weapons/kusarigama.png')
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

    this.time.addEvent({
      delay: CFG.ENEMY_SPAWN_INTERVAL,
      loop: true,
      callback: this._spawnWave,
      callbackScope: this,
    })

    // Multi-weapon state
    this._weapons       = []
    this._affixes       = []              // active affix objects (may have duplicates for stacks)
    this._affixCounts   = new Map()       // id → pick count
    this._resonances    = new Set()       // active resonance IDs
    this._orbitShields  = []              // orbit_shield mechanical affix entries
    this._critBonus    = 0
    this._critDmgBonus = 0
    this._mechanicalsOwned    = new Set()
    this._playerUpgradesOwned = new Set()

    this._addWeapon(this._startWeapon)

    // XP / level system
    this._xp       = 0
    this._level    = 1
    this._xpToNext = xpThreshold(this._level)
    this._upgrading = false
    this._orbs = []

    this.events.on('enemy-died', ({ x, y }) => this._spawnOrb(x, y))
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
    this._hudLevel = this.add.text(32, 58, 'Lv 1', {
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

    // Weapon icon row — each entry is { icon, label } so both can be destroyed together
    this._hudWeaponIcons  = []
    this._lastWeaponCount = 0

    // Affix dot row (circles, pre-create 16 slots)
    this._hudAffixDots = Array.from({ length: 16 }, (_, i) =>
      this.add.arc(14 + i * 16, 112, 5, 0, 360, false, 0x222244, 1)
        .setScrollFactor(0).setDepth(200).setAlpha(0)
    )

    // Resonance glyph row
    this._hudResonanceText = this.add.text(12, 124, '', {
      fontSize: '12px', color: '#e8c85a',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
      stroke: '#06060f', strokeThickness: 2,
    }).setScrollFactor(0).setDepth(201)

    this._elapsed = 0
  }

  _addWeapon(weapon) {
    weapon.createTexture(this)
    const projectiles = this.physics.add.group({ maxSize: 60 })

    this.physics.add.overlap(
      projectiles,
      this._enemies,
      (proj, enemy) => {
        if (proj.hitSet.has(enemy)) return
        proj.hitSet.add(enemy)
        Enemy.takeDamage(enemy, proj.damage, proj.x, proj.y, this._affixes)
        // Explosive projectiles (Ofuda, Homura)
        if (proj._explodeRadius) {
          this._enemies.getChildren()
            .filter(e => e.active && !e.dying && e !== enemy &&
              Phaser.Math.Distance.Between(proj.x, proj.y, e.x, e.y) < proj._explodeRadius)
            .forEach(e => Enemy.takeDamage(e, proj.damage * (proj._explodeMult || 1), proj.x, proj.y, this._affixes))
        }
        if (!proj.penetrate) proj._spent = true
      }
    )

    // NOTE: each _addWeapon() call stacks one more worldbounds listener.
    // With up to 4 weapons this is 4 listeners — each checks its own group, so behavior is correct.
    // On scene.restart() Phaser destroys the scene fully so listeners are cleaned up automatically.
    this.physics.world.on('worldbounds', (body) => {
      if (body.gameObject && projectiles.contains(body.gameObject)) {
        body.gameObject.disableBody(true, true)
      }
    })

    this._weapons.push({ weapon, stats: { ...weapon.baseStats }, timer: 0, projectiles })
  }

  update(_, delta) {
    this._player.update(delta)

    // 武者の気 regen — tick after combat logic
    if (this._regenActive && !this._player._dead) {
      this._regenTimer += delta
      if (this._regenTimer >= 4000) {
        this._player.heal(this._player.maxHp * 0.015 * delta / 1000)
      }
    }

    this._enemies.getChildren().forEach(e => Enemy.update(e, this._player, delta))

    const px = this._player.x
    const py = this._player.y

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

    // Orbit shields (mechanical affix)
    if (this._orbitShields.length > 0) {
      const RING_RADIUS = 60
      const now = this.time.now
      for (const shield of this._orbitShields) {
        // Redraw ring each frame centered on player
        shield.gfx.clear()
        shield.gfx.lineStyle(3, 0xffdd44, 1)
        shield.gfx.strokeCircle(px, py, RING_RADIUS)
        // Inner glow fill
        shield.gfx.fillStyle(0xffdd44, 0.08)
        shield.gfx.fillCircle(px, py, RING_RADIUS)

        // Purge stale cooldown entries for inactive enemies (pooled sprite reuse fix)
        for (const key of shield.damageCd.keys()) {
          if (!key.active) shield.damageCd.delete(key)
        }
        // Damage any enemy within ring radius
        this._enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
          if (Phaser.Math.Distance.Between(px, py, e.x, e.y) < RING_RADIUS + 8) {
            const last = shield.damageCd.get(e) || 0
            if (now - last >= 200) {
              shield.damageCd.set(e, now)
              Enemy.takeDamage(e, 1.2, px, py, this._affixes)
            }
          }
        })
      }
    }

    this._elapsed += delta
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
    const W      = this.cameras.main.width
    const hpPct  = Math.max(0, this._player.hp / this._player.maxHp)
    const xpPct  = Math.max(0, this._xp / this._xpToNext)
    const BX = 32, BW = 188   // bar x, bar width

    this._hud.clear()

    // HP indicator dot
    this._hud.fillStyle(0xcc2233, 1).fillCircle(21, 27, 6)

    // HP bar track → dark fill → bright fill → top highlight
    this._hud.fillStyle(0x180508, 1).fillRoundedRect(BX, 21, BW, 12, 4)
    if (hpPct > 0) {
      const fw = Math.max(8, BW * hpPct)
      this._hud.fillStyle(0x881520, 1).fillRoundedRect(BX, 21, fw, 12, 4)
      this._hud.fillStyle(0xdd2235, 1).fillRoundedRect(BX, 21, fw,  5, 4)
    }
    this._hud.lineStyle(1, 0x661222, 0.8).strokeRoundedRect(BX, 21, BW, 12, 4)

    // XP indicator dot
    this._hud.fillStyle(0x2255cc, 1).fillCircle(21, 44, 5)

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

    // Weapon icon row — rebuild only when weapon count changes
    if (this._weapons.length !== this._lastWeaponCount) {
      this._lastWeaponCount = this._weapons.length
      const weaponColors = [0xd47c3a, 0x3a8fd4, 0x5ab84c, 0xc44ab8]
      this._hudWeaponIcons.forEach(({ icon, label }) => { icon.destroy(); label.destroy() })
      this._hudWeaponIcons = this._weapons.map((entry, i) => {
        const cx = 22 + i * 28
        const icon = this.add.arc(cx, 93, 12, 0, 360, false, weaponColors[i] || 0x888888)
          .setScrollFactor(0).setDepth(200)
          .setStrokeStyle(1.5, 0xffffff, 0.55)
        const label = this.add.text(cx, 93, entry.weapon.name[0], {
          fontSize: '10px', color: '#0a0814',
          fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
        }).setScrollFactor(0).setDepth(201).setOrigin(0.5)
        return { icon, label }
      })
    }

    // Affix dot row (circles, tier-2 get outer ring)
    const affixIds   = [...this._affixCounts.keys()]
    const affixColor = {
      burn:    0xff6600, burn2:    0xff3300,
      poison:  0x44cc44, poison2:  0x00ff44,
      chain:   0xffff00, chain2:   0xffff00,
      chill:   0x88ccff, chill2:   0x44aaff,
      curse:   0xaa44aa, curse2:   0xcc00cc,
      leech:   0xff4488, leech2:   0xff0066,
      burst:   0xff4400, burst2:   0xff6600,
      lucky:   0xffdd88, lucky2:   0xffaa00,
    }
    this._hudAffixDots.forEach((dot, i) => {
      if (i < affixIds.length) {
        const id  = affixIds[i]
        const col = affixColor[id] || 0x888888
        dot.setFillStyle(col, 1).setAlpha(1)
        dot.setStrokeStyle(id.endsWith('2') ? 1.5 : 0, 0xffffff, 0.85)
      } else {
        dot.setAlpha(0)
      }
    })

    // Resonance glyphs
    const resonanceNames = {
      explode_burn: '爆炎', toxic_chain: '毒鏈', blizzard_arc: '雪電',
      corrosion: '腐蝕', dark_harvest: '暗刈',
    }
    this._hudResonanceText.setText(
      [...this._resonances].map(id => resonanceNames[id] || id).join('  ')
    )
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
      this._level   += 1
      this._xpToNext = xpThreshold(this._level)
      this._upgrading = true

      this.events.once('upgrade-chosen', (upgrade) => {
        if (upgrade.target === 'weapon') {
          const entry = this._weapons.find(e => e.weapon.id === upgrade.weaponId)
          if (entry) upgrade.apply(entry.stats)
        } else if (upgrade.target === 'affix') {
          this._applyAffix(upgrade.affix)
        } else if (upgrade.target === 'mechanical') {
          this._applyMechanical(upgrade)
        } else if (upgrade.target === 'new_weapon') {
          this._addWeapon(upgrade.weapon)
        } else {
          upgrade.apply(this._player, this)
          if (upgrade.oneTime) this._playerUpgradesOwned.add(upgrade.id)
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

    // Weapon-specific upgrades (always repeatable)
    for (const entry of this._weapons)
      pool.push(...(entry.weapon.upgrades ?? []).map(u => ({
        ...u, target: 'weapon', weaponId: entry.weapon.id,
      })))

    // Tier-1 elemental affixes — only show if not yet owned
    pool.push(...ALL_AFFIXES
      .filter(a => !this._affixCounts.has(a.id))
      .map(a => ({ id: a.id, name: a.name, desc: a.desc, target: 'affix', affix: a })))

    // Tier-2 elemental affixes — only if parent owned AND tier-2 not yet owned
    pool.push(...ALL_TIER2_AFFIXES
      .filter(a => this._affixCounts.has(a.requires) && !this._affixCounts.has(a.id))
      .map(a => ({ id: a.id, name: a.name, desc: a.desc, target: 'affix', affix: a })))

    // Mechanical affixes — only if not yet owned
    pool.push(...ALL_MECHANICAL
      .filter(m => !this._mechanicalsOwned.has(m.id))
      .map(m => ({ ...m, target: 'mechanical' })))

    // New weapon (if next slot is available)
    const nextSlotLevel = CFG.WEAPON_SLOT_LEVELS[this._weapons.length - 1]
    if (this._weapons.length < CFG.MAX_WEAPONS && nextSlotLevel && this._level >= nextSlotLevel) {
      const owned      = new Set(this._weapons.map(e => e.weapon.id))
      const candidates = ALL_WEAPONS.filter(w => !owned.has(w.id))
      if (candidates.length)
        pool.push({
          id: 'new_weapon', name: '新武器', desc: '獲得一把新武器',
          target: 'new_weapon',
          weapon: Phaser.Utils.Array.GetRandom(candidates),
        })
    }

    // Player upgrades — filter out already-owned one-time upgrades; non-one-time always present
    pool.push(...PLAYER_UPGRADES
      .filter(u => !u.oneTime || !this._playerUpgradesOwned.has(u.id))
      .map(u => ({ ...u, target: 'player' })))

    // NOTE: Tier-1 elemental affixes are now one-time only (filtered above). This intentionally
    // removes stacking for all tier-1 affixes including `lucky`. Tier-2 affixes (e.g. lucky2,
    // burn2) provide the next power step. Dead stacking branches in affix files are harmless.

    // Deduplicate by id+weaponId before shuffling to prevent duplicate choices
    const seen    = new Set()
    const deduped = pool.filter(u => {
      const key = u.id + (u.weaponId ?? '')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Safety: pool should never be empty with current upgrade definitions, but
    // if it somehow is, fall back to repeatable player upgrades
    if (deduped.length === 0) {
      return PLAYER_UPGRADES
        .filter(u => !u.oneTime)
        .map(u => ({ ...u, target: 'player' }))
        .slice(0, 3)
    }

    return Phaser.Utils.Array.Shuffle(deduped).slice(0, 3)
  }

  _applyAffix(affix) {
    this._affixes.push(affix)
    const count = (this._affixCounts.get(affix.id) || 0) + 1
    this._affixCounts.set(affix.id, count)
    this._resonances = checkResonances(this._affixCounts)
  }

  _applyMechanical(mechanical) {
    this._mechanicalsOwned.add(mechanical.id)
    if (mechanical.id === 'multishot') {
      for (const entry of this._weapons) {
        if (entry.stats.projectileCount !== undefined) {
          entry.stats.projectileCount = Math.min(5, entry.stats.projectileCount + 1)
          if (entry.stats.range !== undefined) {
            entry.stats.range = entry.stats.range * 1.10
          }
        } else {
          entry.stats.range = (entry.stats.range || 100) * 1.15
        }
      }
    } else if (mechanical.id === 'piercing') {
      // Only weapons that declare `penetrate` in baseStats support piercing (opt-in by design)
      for (const entry of this._weapons) {
        if (entry.stats.penetrate !== undefined)
          entry.stats.penetrate = true
      }
    } else if (mechanical.id === 'orbit_shield') {
      this._addOrbitShield()
    }
  }

  _addOrbitShield() {
    const ring = this.add.graphics().setDepth(7)
    // Pulse alpha 0.3 ↔ 0.9 continuously
    this.tweens.add({
      targets: ring,
      alpha: { from: 0.3, to: 0.9 },
      yoyo: true,
      repeat: -1,
      duration: 600,
      ease: 'Sine.easeInOut',
    })
    this._orbitShields.push({
      gfx:      ring,
      damageCd: new Map(),
    })
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
      `生存  ${_fmtTime(this._elapsed)}   到達  Lv ${this._level}`, {
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
}

function _fmtTime(ms) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
