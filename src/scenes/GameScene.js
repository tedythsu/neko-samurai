// src/scenes/GameScene.js
import Phaser from 'phaser'
import Player   from '../entities/Player.js'
import Enemy    from '../entities/Enemy.js'
import { CFG, randomEdgePoint, xpThreshold, PLAYER_UPGRADES } from '../config.js'
import { ALL_AFFIXES, ALL_MECHANICAL, checkResonances } from '../affixes/index.js'
import { ALL_WEAPONS } from '../weapons/index.js'

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

    // HUD — fixed to camera
    this._hud = this.add.graphics().setScrollFactor(0).setDepth(200)
    this._hudLevel = this.add.text(16, 52, 'Lv 1', {
      fontSize: '14px', color: '#88bbff',
    }).setScrollFactor(0).setDepth(200)
    this._hudTimer = this.add.text(
      this.cameras.main.width - 16, 16,
      '0s', { fontSize: '16px', color: '#ffffff' }
    ).setScrollFactor(0).setDepth(200).setOrigin(1, 0)

    // Weapon icon row — each entry is { icon, label } so both can be destroyed together
    this._hudWeaponIcons  = []
    this._lastWeaponCount = 0

    // Affix dot row (pre-create up to 8 slots)
    this._hudAffixDots = Array.from({ length: 8 }, (_, i) =>
      this.add.rectangle(16 + i * 20, 72, 14, 14, 0x444466)
        .setScrollFactor(0).setDepth(200).setAlpha(0)
    )
    this._hudAffixLabels = Array.from({ length: 8 }, (_, i) =>
      this.add.text(16 + i * 20, 72, '', { fontSize: '9px', color: '#ffffff' })
        .setScrollFactor(0).setDepth(201).setOrigin(0.5)
        .setAlpha(0)
    )

    // Resonance glyph row
    this._hudResonanceText = this.add.text(16, 92, '', {
      fontSize: '11px', color: '#ffcc44',
    }).setScrollFactor(0).setDepth(200)

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
      const now = this.time.now
      for (const shield of this._orbitShields) {
        shield.angle = (shield.angle + 2 * delta / 16) % 360
        const rad = Phaser.Math.DegToRad(shield.angle)
        const sx  = px + Math.cos(rad) * 60
        const sy  = py + Math.sin(rad) * 60
        shield.gfx.setPosition(sx, sy)
        this._enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
          if (Phaser.Math.Distance.Between(sx, sy, e.x, e.y) < 18) {
            const last = shield.damageCd.get(e) || 0
            if (now - last >= 200) {
              shield.damageCd.set(e, now)
              Enemy.takeDamage(e, 1.2, sx, sy, this._affixes)
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

    // Weapon icon row — rebuild only when weapon count changes
    if (this._weapons.length !== this._lastWeaponCount) {
      this._lastWeaponCount = this._weapons.length
      const weaponColors = [0xff8844, 0x44aaff, 0xaaff44, 0xff44aa]
      this._hudWeaponIcons.forEach(({ icon, label }) => { icon.destroy(); label.destroy() })
      this._hudWeaponIcons = this._weapons.map((entry, i) => {
        const icon = this.add.rectangle(16 + i * 26, 58, 20, 20, weaponColors[i] || 0xffffff)
          .setScrollFactor(0).setDepth(200).setStrokeStyle(1, 0xffffff)
        const label = this.add.text(16 + i * 26, 58, entry.weapon.name[0], {
          fontSize: '8px', color: '#000000',
        }).setScrollFactor(0).setDepth(201).setOrigin(0.5)
        return { icon, label }
      })
    }

    // Affix dot row
    const affixIds   = [...this._affixCounts.keys()]
    const affixColor = { burn: 0xff6600, poison: 0x44cc44, chain: 0xffff00,
                         chill: 0x88ccff, curse: 0xaa44aa, leech: 0xff4488,
                         burst: 0xff4400, lucky: 0xffdd88 }
    this._hudAffixDots.forEach((dot, i) => {
      if (i < affixIds.length) {
        const id = affixIds[i]
        dot.setFillStyle(affixColor[id] || 0x888888).setAlpha(1)
        this._hudAffixLabels[i].setText(`${this._affixCounts.get(id)}`).setAlpha(1).setPosition(16 + i * 20, 72)
      } else {
        dot.setAlpha(0); this._hudAffixLabels[i].setAlpha(0)
      }
    })

    // Resonance glyph row
    const resonanceNames = {
      explode_burn: '爆炎', toxic_chain: '毒鏈', blizzard_arc: '雪電',
      corrosion: '腐蝕', dark_harvest: '暗刈'
    }
    const glyphs = [...this._resonances].map(id => resonanceNames[id] || id).join('  ')
    this._hudResonanceText.setText(glyphs)
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

    // Weapon-specific upgrades for all active weapons
    for (const entry of this._weapons)
      pool.push(...(entry.weapon.upgrades ?? []).map(u => ({
        ...u,
        target:   'weapon',
        weaponId: entry.weapon.id,
      })))

    // Elemental affixes
    pool.push(...ALL_AFFIXES.map(a => ({ id: a.id, name: a.name, desc: a.desc, target: 'affix', affix: a })))

    // Mechanical affixes
    pool.push(...ALL_MECHANICAL.map(m => ({ ...m, target: 'mechanical' })))

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

    // Player upgrades (always present — prevents empty-pool deadlock if affix/weapon pools are empty)
    pool.push(...PLAYER_UPGRADES.map(u => ({ ...u, target: 'player' })))

    return Phaser.Utils.Array.Shuffle(pool).slice(0, 3)
  }

  _applyAffix(affix) {
    this._affixes.push(affix)
    const count = (this._affixCounts.get(affix.id) || 0) + 1
    this._affixCounts.set(affix.id, count)
    this._resonances = checkResonances(this._affixCounts)
  }

  _applyMechanical(mechanical) {
    if (mechanical.id === 'multishot') {
      for (const entry of this._weapons) {
        if (entry.stats.projectileCount !== undefined)
          entry.stats.projectileCount += 1
        else
          entry.stats.range = (entry.stats.range || 100) * 1.15
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
    const offset = this._orbitShields.length * 120
    this._orbitShields.push({
      angle:    offset,
      damageCd: new Map(),
      gfx:      this.add.circle(0, 0, 10, 0x88ccff, 0.9).setDepth(7),
    })
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
