# Weapon + Element System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the game from a single-weapon run to a multi-weapon (up to 4) system with 8 elemental affixes, 3 mechanical affixes, and 5 resonance combinations for deep combinatorial builds.

**Architecture:** GameScene replaces its single `_weapon/_weaponStats/_fireTimer/_projectiles` with a `_weapons` array of `{weapon, stats, timer, projectiles}` entries; each weapon fires independently and each projectile group gets its own overlap registration. Affixes are plain objects with `onHit(enemy, damage, scene)` callbacks stored in `scene._affixes[]`, called from `Enemy.takeDamage()` after every hit. Resonances are recomputed as a `Set<string>` whenever an affix is added.

**Tech Stack:** Phaser 3.60 (Arcade Physics, tweens, graphics, particles), Vite, Vitest (for resonance pure-logic test), ES modules

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/config.js` | Add `WEAPON_SLOT_LEVELS`, `MAX_WEAPONS` |
| Modify | `src/scenes/GameScene.js` | Multi-weapon array, affix/resonance state, orbit shield, new HUD |
| Modify | `src/entities/Enemy.js` | `_statusEffects`, `updateStatus()`, `_triggerDeath()`, affix pipeline in `takeDamage()` |
| Create | `src/affixes/burn.js` | Burn DoT affix |
| Create | `src/affixes/poison.js` | Stacking poison DoT affix |
| Create | `src/affixes/chain.js` | Chain lightning affix |
| Create | `src/affixes/chill.js` | Slow affix |
| Create | `src/affixes/curse.js` | +25% damage taken affix |
| Create | `src/affixes/leech.js` | Lifesteal affix |
| Create | `src/affixes/burst.js` | AoE explosion chance affix |
| Create | `src/affixes/lucky.js` | Passive crit boost affix |
| Create | `src/affixes/resonances.js` | `checkResonances()` pure function |
| Create | `src/affixes/index.js` | Export `ALL_AFFIXES`, `ALL_MECHANICAL`, `checkResonances` |
| Read-only | `src/weapons/_pool.js` | `getOrCreate(pool, x, y, texKey)` helper — already exists, imported by Ofuda/Homura |
| Modify | `src/weapons/Shuriken.js` | Accept & pass `affixes` to `Enemy.takeDamage` |
| Modify | `src/weapons/Kunai.js` | Accept & pass `affixes` |
| Modify | `src/weapons/Tachi.js` | Accept & pass `affixes` |
| Create | `src/weapons/Ogi.js` | Fan melee — 120° arc, 400ms animation |
| Create | `src/weapons/Ofuda.js` | Homing projectile, explodes on hit |
| Create | `src/weapons/Kusarigama.js` | Orbital sickles, no physics body |
| Create | `src/weapons/Homura.js` | Slow explosive projectile, AoE on hit |
| Modify | `src/weapons/index.js` | Export all 7 weapons |
| Create | `tests/affixes/resonances.test.js` | Unit test for `checkResonances()` |

---

## Task 1: Config — add weapon slot constants

**Files:**
- Modify: `src/config.js`

- [ ] **Step 1: Add constants to CFG in `src/config.js`**

  Open `src/config.js`. Inside the `CFG` object, after the `CRIT_MULTIPLIER` line, add:

  ```js
  // Weapon slots
  WEAPON_SLOT_LEVELS: [5, 10, 16],  // player level at which 2nd/3rd/4th slot opens
  MAX_WEAPONS: 4,
  ```

- [ ] **Step 2: Verify**

  Run `npm run dev`, open browser. No JS errors in console. (Config is just data; no runtime behavior yet.)

- [ ] **Step 3: Commit**

  ```bash
  git add src/config.js
  git commit -m "feat: add WEAPON_SLOT_LEVELS and MAX_WEAPONS to config"
  ```

---

## Task 2: GameScene — multi-weapon array

Replace the single `_weapon / _weaponStats / _fireTimer / _projectiles` with a `_weapons` array. The game still runs with one starting weapon; the upgrade system (Task 3) adds more.

**Files:**
- Modify: `src/scenes/GameScene.js`

- [ ] **Step 1: Update imports at top of `GameScene.js`**

  Add to the existing import line:
  ```js
  import { CFG, randomEdgePoint, xpThreshold, PLAYER_UPGRADES } from '../config.js'
  // (no change needed — just confirming PLAYER_UPGRADES is already imported)
  ```

- [ ] **Step 2: Replace `init()` — store start weapon only**

  Change:
  ```js
  init(data) {
    this._weapon      = data.weapon
    this._weaponStats = { ...data.weapon.baseStats }
  }
  ```
  To:
  ```js
  init(data) {
    this._startWeapon = data.weapon
  }
  ```

- [ ] **Step 3: Update `create()` — initialize multi-weapon state and call `_addWeapon()`**

  In `create()`, remove these lines:
  ```js
  this._weapon.createTexture(this)
  this._projectiles = this.physics.add.group({ maxSize: 60 })

  this.physics.add.overlap(
    this._projectiles,
    this._enemies,
    (proj, enemy) => {
      if (proj.hitSet.has(enemy)) return
      proj.hitSet.add(enemy)
      Enemy.takeDamage(enemy, proj.damage, proj.x, proj.y)
      if (!proj.penetrate) proj._spent = true
    }
  )

  this.physics.world.on('worldbounds', (body) => {
    if (body.gameObject && this._projectiles.contains(body.gameObject)) {
      body.gameObject.disableBody(true, true)
    }
  })

  this._fireTimer = 0
  ```

  Replace with:
  ```js
  // Multi-weapon state
  this._weapons       = []
  this._affixes       = []              // active affix objects (may have duplicates for stacks)
  this._affixCounts   = new Map()       // id → pick count
  this._resonances    = new Set()       // active resonance IDs
  this._orbitShields  = []              // orbit_shield mechanical affix entries

  this._addWeapon(this._startWeapon)
  ```

- [ ] **Step 4: Add `_addWeapon()` method to GameScene**

  Add this method after `create()`:

  ```js
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
  ```

- [ ] **Step 5: Update `update()` — multi-weapon fire loop**

  Remove:
  ```js
  this._fireTimer += delta
  if (this._fireTimer >= this._weaponStats.fireRate) {
    this._fireTimer = 0
    this._weapon.fire(this, this._projectiles, this._player.x, this._player.y, this._weaponStats, this._enemies, this._player)
  }
  this._projectiles.getChildren().forEach(s => {
    if (s._spent) { s._spent = false; s.disableBody(true, true); return }
    this._weapon.update(s)
  })
  ```

  Replace with:
  ```js
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
  ```

  > **Note:** The `const px = this._player.x` / `py` lines at the top of this block replace the duplicate `const px = this._player.x` lines that used to be only in the orb-attract section. Remove the duplicate `const px` / `const py` from the orb-attract block below (the orb block already has its own `const px = this._player.x` — remove it since it's now declared above, or rename to avoid redeclaration). The easiest fix: the existing orb block starts with `const px = this._player.x` — remove those two lines from the orb block since they're now declared earlier.

- [ ] **Step 6: Verify game still works**

  Run `npm run dev`. Start a game. Confirm:
  - Shuriken/Kunai/Tachi still fire normally
  - Enemies die, XP orbs spawn
  - No console errors about `_weapon` or `_projectiles` being undefined

- [ ] **Step 7: Commit**

  ```bash
  git add src/scenes/GameScene.js
  git commit -m "feat: multi-weapon array in GameScene — _addWeapon(), per-weapon projectile groups"
  ```

---

## Task 3: GameScene — upgrade pool + routing

Wire up the new `_buildUpgradePool()` and `_applyAffix()` / `_applyMechanical()` helpers. At this stage, affixes/resonances aren't implemented yet, so the pool will only offer weapon and player upgrades — but the routing infrastructure will be in place.

**Files:**
- Modify: `src/scenes/GameScene.js`
- Add import: `ALL_AFFIXES`, `ALL_MECHANICAL`, `checkResonances` from `'../affixes/index.js'` (will exist after Task 6)

> **Important:** The affix/resonance imports will cause an error until Task 6 creates `src/affixes/index.js`. Add stub imports as comments for now and un-comment them in Task 6.

- [ ] **Step 1: Update `_addXp()` to use `_buildUpgradePool()`**

  Replace the entire `_addXp()` method with:

  ```js
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
          upgrade.apply(this._player, this)   // player upgrade
        }
        this._upgrading = false
        this.scene.resume('GameScene')
      })

      const choices = this._buildUpgradePool()
      this.scene.launch('UpgradeScene', { level: this._level, upgrades: choices })
      this.scene.pause('GameScene')
    }
  }
  ```

- [ ] **Step 2: Add `_buildUpgradePool()` method**

  ```js
  _buildUpgradePool() {
    const pool = []

    // Weapon-specific upgrades for all active weapons
    for (const entry of this._weapons)
      pool.push(...entry.weapon.upgrades.map(u => ({
        ...u,
        target:   'weapon',
        weaponId: entry.weapon.id,
      })))

    // Elemental affixes (available once src/affixes/index.js exists — Task 6)
    if (typeof ALL_AFFIXES !== 'undefined')
      pool.push(...ALL_AFFIXES.map(a => ({ id: a.id, name: a.name, desc: a.desc, target: 'affix', affix: a })))

    // Mechanical affixes
    if (typeof ALL_MECHANICAL !== 'undefined')
      pool.push(...ALL_MECHANICAL.map(m => ({ ...m, target: 'mechanical' })))

    // New weapon (if next slot is available)
    const nextSlotLevel = CFG.WEAPON_SLOT_LEVELS[this._weapons.length - 1]
    if (this._weapons.length < CFG.MAX_WEAPONS && nextSlotLevel && this._level >= nextSlotLevel) {
      const owned      = new Set(this._weapons.map(e => e.weapon.id))
      const candidates = (typeof ALL_WEAPONS !== 'undefined' ? ALL_WEAPONS : []).filter(w => !owned.has(w.id))
      if (candidates.length)
        pool.push({
          id: 'new_weapon', name: '新武器', desc: '獲得一把新武器',
          target: 'new_weapon',
          weapon: Phaser.Utils.Array.GetRandom(candidates),
        })
    }

    // Player upgrades
    pool.push(...PLAYER_UPGRADES.map(u => ({ ...u, target: 'player' })))

    return Phaser.Utils.Array.Shuffle(pool).slice(0, 3)
  }
  ```

  > **Note:** The `typeof ALL_AFFIXES !== 'undefined'` guards will be removed in Task 6 when real imports replace them. `ALL_WEAPONS` import will also be added in Task 12.

- [ ] **Step 3: Add `_applyAffix()`, `_applyMechanical()`, `_addOrbitShield()` stubs**

  ```js
  // TODO Task 6: import { ALL_AFFIXES, ALL_MECHANICAL, checkResonances } from '../affixes/index.js'
  // TODO Task 6: import { ALL_WEAPONS } from '../weapons/index.js'

  _applyAffix(affix) {
    this._affixes.push(affix)
    const count = (this._affixCounts.get(affix.id) || 0) + 1
    this._affixCounts.set(affix.id, count)
    // checkResonances will be wired in Task 6
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
  ```

- [ ] **Step 4: Verify**

  Run `npm run dev`. Pick Shuriken, level up, confirm upgrade cards appear and a weapon upgrade still works. No console errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/scenes/GameScene.js
  git commit -m "feat: _buildUpgradePool, upgrade routing, _applyAffix/_applyMechanical stubs"
  ```

---

## Task 4: Enemy — status effects + refactor death into `_triggerDeath()`

Prerequisite for the affix pipeline. Extracts the death logic so both `takeDamage()` and `updateStatus()` can trigger it.

**Files:**
- Modify: `src/entities/Enemy.js`

- [ ] **Step 1: Update `activate()` — initialize `_statusEffects`**

  After `sprite.setAlpha(1).clearTint()` in `activate()`, add:
  ```js
  sprite._statusEffects = {
    burn:   { stacks: 0, timer: 0, dps: 5 },
    poison: { stacks: 0, timer: 0 },
    chill:  { active: false, timer: 0 },
    curse:  { active: false, timer: 0 },
  }
  ```

- [ ] **Step 2: Add `updateStatus()` static method**

  Add after `update()`:

  ```js
  static updateStatus(sprite, delta) {
    const se = sprite._statusEffects
    if (!se) return

    const scene      = sprite.scene
    const corrosion  = scene._resonances && scene._resonances.has('corrosion')
    const corrMult   = corrosion ? 1.5 : 1.0

    // Burn DoT
    if (se.burn.stacks > 0 && se.burn.timer > 0) {
      se.burn.timer -= delta
      sprite.hp     -= (se.burn.dps || 5) * corrMult * (delta / 1000)
      if (se.burn.timer <= 0) se.burn.stacks = 0
      if (sprite.hp <= 0 && !sprite.dying) Enemy._triggerDeath(sprite)
    }

    // Poison DoT
    if (se.poison.stacks > 0 && se.poison.timer > 0) {
      se.poison.timer -= delta
      sprite.hp       -= 3 * se.poison.stacks * corrMult * (delta / 1000)
      if (se.poison.timer <= 0) se.poison.stacks = 0
      if (sprite.hp <= 0 && !sprite.dying) Enemy._triggerDeath(sprite)
    }

    // Chill timer
    if (se.chill.active) {
      se.chill.timer -= delta
      if (se.chill.timer <= 0) se.chill.active = false
    }

    // Curse timer
    if (se.curse.active) {
      se.curse.timer -= delta
      if (se.curse.timer <= 0) se.curse.active = false
    }

    // Update visible tint based on status priority
    Enemy._applyStatusTint(sprite)
  }

  static _applyStatusTint(sprite) {
    if (sprite.dying)                                    { sprite.clearTint(); return }
    const se = sprite._statusEffects
    if (!se)                                             return
    if (se.burn.stacks > 0 && se.burn.timer > 0)        { sprite.setTint(0xff6600); return }
    if (se.poison.stacks > 0 && se.poison.timer > 0)    { sprite.setTint(0x44cc44); return }
    if (se.chill.active)                                 { sprite.setTint(0x88ccff); return }
    if (se.curse.active)                                 { sprite.setTint(0xaa44aa); return }
    sprite.clearTint()
  }

  static _hasStatusTint(sprite) {
    const se = sprite._statusEffects
    if (!se) return false
    return (se.burn.stacks > 0 && se.burn.timer > 0)   ||
           (se.poison.stacks > 0 && se.poison.timer > 0) ||
           se.chill.active || se.curse.active
  }
  ```

- [ ] **Step 3: Extract `_triggerDeath()` static method**

  The current death block inside `takeDamage()` (lines starting with `sprite.dying = true` through `return true`) must be moved to a new static method:

  ```js
  static _triggerDeath(sprite) {
    if (sprite.dying) return
    const { x, y } = sprite
    const scene     = sprite.scene

    scene.events.emit('enemy-died', { x, y })
    sprite.dying = true
    sprite.clearTint()

    // Resonance: explode_burn — burning enemies explode on death
    if (scene._resonances && scene._resonances.has('explode_burn') &&
        sprite._statusEffects && sprite._statusEffects.burn.stacks > 0) {
      scene._enemies.getChildren()
        .filter(e => e.active && !e.dying && e !== sprite &&
          Phaser.Math.Distance.Between(x, y, e.x, e.y) < 60)
        .forEach(e => Enemy.takeDamage(e, CFG.ENEMY_HP * 0.3, x, y, []))
    }

    // Resonance: dark_harvest — cursed enemies explode on death + heal
    if (scene._resonances && scene._resonances.has('dark_harvest') &&
        sprite._statusEffects && sprite._statusEffects.curse.active) {
      scene._enemies.getChildren()
        .filter(e => e.active && !e.dying && e !== sprite &&
          Phaser.Math.Distance.Between(x, y, e.x, e.y) < 50)
        .forEach(e => Enemy.takeDamage(e, 15, x, y, []))
      if (scene._player) scene._player.heal(5)
    }

    // Delay physics disable so knockback plays out
    scene.time.delayedCall(150, () => {
      if (sprite.dying) sprite.body.enable = false
    })

    // Dust particle burst
    const emitter = scene.add.particles(x, y, 'dust-particle', {
      speed:    { min: 60, max: 220 },
      angle:    { min: 0, max: 360 },
      scale:    { start: 1.2, end: 0 },
      alpha:    { start: 1,   end: 0 },
      lifespan: 500,
      quantity: 12,
      tint:     [0x9B8765, 0x7A6245, 0x5C4033, 0xC8A87A],
      emitting: false,
    })
    emitter.setDepth(7)
    emitter.explode(12)
    scene.time.delayedCall(600, () => emitter.destroy())

    // Fade out then return to pool
    scene.tweens.add({
      targets:  sprite,
      alpha:    0,
      duration: 100,
      ease:     'Linear',
      onComplete: () => {
        if (sprite._statusEffects) sprite._statusEffects.poison.stacks = 0
        sprite.dying = false
        sprite.setAlpha(1)
        sprite.disableBody(true, true)
      },
    })
  }
  ```

- [ ] **Step 4: Simplify the death block in `takeDamage()`**

  The existing death block in `takeDamage()` (starting from `if (sprite.hp <= 0)`) is replaced with:
  ```js
  if (sprite.hp <= 0) {
    Enemy._triggerDeath(sprite)
    return true
  }
  return false
  ```

- [ ] **Step 5: Call `updateStatus()` from `update()`**

  In `Enemy.update()`, after the existing `sprite.damageCd -= delta` logic, add:
  ```js
  Enemy.updateStatus(sprite, delta)
  ```
  Also update the speed calculation to respect chill:
  ```js
  const chilled = sprite._statusEffects && sprite._statusEffects.chill.active
  sprite.scene.physics.moveToObject(sprite, player.sprite, chilled ? CFG.ENEMY_SPEED * 0.5 : CFG.ENEMY_SPEED)
  ```
  (Replace the existing `sprite.scene.physics.moveToObject(sprite, player.sprite, CFG.ENEMY_SPEED)` line.)

- [ ] **Step 6: Update hit flash in `takeDamage()` to respect status tints**

  Replace the current hit flash block:
  ```js
  sprite.setTint(0xff4444)
  sprite.scene.time.delayedCall(120, () => {
    if (sprite.active && !sprite.dying) sprite.clearTint()
  })
  ```
  With:
  ```js
  if (!Enemy._hasStatusTint(sprite)) {
    sprite.setTint(0xff4444)
    sprite.scene.time.delayedCall(120, () => {
      if (sprite.active && !sprite.dying) Enemy._applyStatusTint(sprite)
    })
  }
  ```

- [ ] **Step 7: Verify**

  Run `npm run dev`. Kill enemies. Confirm dust particle burst still shows, enemies still die properly. No console errors.

- [ ] **Step 8: Commit**

  ```bash
  git add src/entities/Enemy.js
  git commit -m "feat: Enemy status effects, updateStatus, _triggerDeath extracted"
  ```

---

## Task 5: Enemy — affix pipeline in `takeDamage()`

Wire the `affixes = []` parameter into damage calculation (lucky, curse) and the `onHit` callback loop.

**Files:**
- Modify: `src/entities/Enemy.js`

- [ ] **Step 1: Update `takeDamage()` signature and damage calc**

  Change the existing `static takeDamage(sprite, amount, fromX, fromY)` to:

  ```js
  static takeDamage(sprite, amount, fromX, fromY, affixes = []) {
    if (sprite.dying) return false

    const se = sprite._statusEffects

    // Lucky affix: passive crit boost (handle before damage calc)
    const luckyCount = affixes.filter(a => a.id === 'lucky').length
    const critChance = Math.min(1.0, CFG.CRIT_CHANCE + luckyCount * 0.15)
    const critMult   = CFG.CRIT_MULTIPLIER + luckyCount * 0.5
    const isCrit     = Math.random() < critChance

    // Curse: +25% damage if target is cursed
    const curseMult = (se && se.curse.active) ? 1.25 : 1.0

    const damage = Math.round(amount * curseMult * (isCrit ? critMult : 1))
    sprite.hp -= damage
  ```

  (Keep all the rest of the method body the same — floating text, knockback, hit flash, death — just update the top to match the above.)

- [ ] **Step 2: Add affix `onHit` loop after the hit flash block (before the death check)**

  After the hit spark emitter block and before `if (sprite.hp <= 0)`, add:
  ```js
  // Affix pipeline
  for (const affix of affixes) {
    if (affix.id !== 'lucky') affix.onHit(sprite, damage, sprite.scene)
  }
  ```

- [ ] **Step 3: Verify compile**

  Run `npm run dev`. No errors. Affixes array is empty (no affixes yet), so behavior is identical to before.

- [ ] **Step 4: Commit**

  ```bash
  git add src/entities/Enemy.js
  git commit -m "feat: Enemy.takeDamage accepts affixes, calls onHit callbacks"
  ```

---

## Task 6: Affix system — 8 elemental + 3 mechanical + resonances

Create the entire `src/affixes/` directory.

**Files:**
- Create: `src/affixes/resonances.js`
- Create: `src/affixes/burn.js`
- Create: `src/affixes/poison.js`
- Create: `src/affixes/chain.js`
- Create: `src/affixes/chill.js`
- Create: `src/affixes/curse.js`
- Create: `src/affixes/leech.js`
- Create: `src/affixes/burst.js`
- Create: `src/affixes/lucky.js`
- Create: `src/affixes/index.js`
- Create: `tests/affixes/resonances.test.js`

- [ ] **Step 1: Write the failing resonance test**

  Create `tests/affixes/resonances.test.js`:

  ```js
  import { describe, it, expect } from 'vitest'
  import { checkResonances } from '../../src/affixes/resonances.js'

  describe('checkResonances', () => {
    it('returns empty set when no affixes', () => {
      const result = checkResonances(new Map())
      expect(result.size).toBe(0)
    })

    it('activates explode_burn when burn + burst both present', () => {
      const m = new Map([['burn', 1], ['burst', 1]])
      expect(checkResonances(m).has('explode_burn')).toBe(true)
    })

    it('does NOT activate explode_burn with only burn', () => {
      const m = new Map([['burn', 2]])
      expect(checkResonances(m).has('explode_burn')).toBe(false)
    })

    it('activates toxic_chain with poison + chain', () => {
      const m = new Map([['poison', 1], ['chain', 1]])
      expect(checkResonances(m).has('toxic_chain')).toBe(true)
    })

    it('activates corrosion with burn + poison', () => {
      const m = new Map([['burn', 1], ['poison', 1]])
      expect(checkResonances(m).has('corrosion')).toBe(true)
    })

    it('activates dark_harvest with leech + curse', () => {
      const m = new Map([['leech', 1], ['curse', 1]])
      expect(checkResonances(m).has('dark_harvest')).toBe(true)
    })

    it('activates multiple resonances simultaneously', () => {
      const m = new Map([['burn', 1], ['burst', 1], ['poison', 1], ['chain', 1]])
      const result = checkResonances(m)
      expect(result.has('explode_burn')).toBe(true)
      expect(result.has('toxic_chain')).toBe(true)
      expect(result.has('corrosion')).toBe(true)
    })
  })
  ```

- [ ] **Step 2: Run test to confirm it fails**

  ```bash
  npx vitest run tests/affixes/resonances.test.js
  ```
  Expected: FAIL — "Cannot find module '../../src/affixes/resonances.js'"

- [ ] **Step 3: Create `src/affixes/resonances.js`**

  ```js
  // src/affixes/resonances.js

  const RESONANCE_REQS = {
    explode_burn: ['burn', 'burst'],
    toxic_chain:  ['poison', 'chain'],
    blizzard_arc: ['chain', 'chill'],
    corrosion:    ['burn', 'poison'],
    dark_harvest: ['leech', 'curse'],
  }

  /**
   * Returns a Set of active resonance IDs based on which affixes have been acquired.
   * @param {Map<string, number>} affixCounts  id → pick count
   * @returns {Set<string>}
   */
  export function checkResonances(affixCounts) {
    const active = new Set()
    for (const [id, required] of Object.entries(RESONANCE_REQS)) {
      if (required.every(r => (affixCounts.get(r) || 0) >= 1))
        active.add(id)
    }
    return active
  }
  ```

- [ ] **Step 4: Run test again — confirm it passes**

  ```bash
  npx vitest run tests/affixes/resonances.test.js
  ```
  Expected: PASS (7/7)

- [ ] **Step 5: Create `src/affixes/burn.js`**

  ```js
  // src/affixes/burn.js
  export default {
    id:   'burn',
    name: '炎上',
    desc: '點燃敵人：每秒5傷害，持續2秒（疊加：時間延長、傷害倍率提升）',

    onHit(enemy, damage, scene) {
      const se = enemy._statusEffects
      if (!se) return
      const count    = scene._affixCounts ? (scene._affixCounts.get('burn') || 1) : 1
      const duration = count >= 2 ? 4000 : 2000
      const dps      = count >= 3 ? 7.5 : 5
      se.burn.stacks = 1
      se.burn.dps    = dps
      se.burn.timer  = duration
    },
  }
  ```

- [ ] **Step 6: Create `src/affixes/poison.js`**

  ```js
  // src/affixes/poison.js
  export default {
    id:   'poison',
    name: '毒',
    desc: '疊加毒層（最多5層）：每層每秒3傷害',

    onHit(enemy, damage, scene) {
      const se = enemy._statusEffects
      if (!se) return
      const count     = scene._affixCounts ? (scene._affixCounts.get('poison') || 1) : 1
      const maxStacks = count >= 3 ? 12 : count >= 2 ? 8 : 5
      se.poison.stacks = Math.min(se.poison.stacks + 1, maxStacks)
      se.poison.timer  = 5000   // stacks persist 5s without a hit; also cleared on death
    },
  }
  ```

- [ ] **Step 7: Create `src/affixes/chain.js`**

  ```js
  // src/affixes/chain.js
  import Phaser   from 'phaser'
  import Enemy    from '../entities/Enemy.js'

  export default {
    id:   'chain',
    name: '電撃',
    desc: '25%機率：閃電跳躍至周圍敵人（0.5倍傷害）',

    onHit(enemy, damage, scene) {
      if (Math.random() > 0.25) return
      const count   = scene._affixCounts ? (scene._affixCounts.get('chain') || 1) : 1
      const bounces = count   // 1/2/3 bounces for stacks 1/2/3

      const visited = [enemy]
      for (let b = 0; b < bounces; b++) {
        const src = visited[visited.length - 1]
        const next = scene._enemies.getChildren()
          .filter(e => e.active && !e.dying && !visited.includes(e) &&
            Phaser.Math.Distance.Between(src.x, src.y, e.x, e.y) < 120)
          .sort((ea, eb) =>
            Phaser.Math.Distance.Between(src.x, src.y, ea.x, ea.y) -
            Phaser.Math.Distance.Between(src.x, src.y, eb.x, eb.y))[0]
        if (!next) break
        visited.push(next)

        const poisoned   = next._statusEffects && next._statusEffects.poison.stacks > 0
        const toxicChain = scene._resonances && scene._resonances.has('toxic_chain')
        const dmgMult    = 0.5 * (toxicChain && poisoned ? 2 : 1)
        Enemy.takeDamage(next, damage * dmgMult, src.x, src.y, [])

        // Blizzard arc resonance: chill all bounced targets
        if (scene._resonances && scene._resonances.has('blizzard_arc') && next._statusEffects) {
          next._statusEffects.chill.active = true
          next._statusEffects.chill.timer  = 1500
        }

        // Visual: lightning arc line
        const g = scene.add.graphics().setDepth(10)
        g.lineStyle(2, 0xffff44, 0.9)
        g.lineBetween(src.x, src.y, next.x, next.y)
        scene.time.delayedCall(150, () => g.destroy())
      }
    },
  }
  ```

- [ ] **Step 8: Create `src/affixes/chill.js`**

  ```js
  // src/affixes/chill.js
  export default {
    id:   'chill',
    name: '凍結',
    desc: '30%機率：減速50%，持續1.5秒',

    onHit(enemy, damage, scene) {
      if (Math.random() > 0.30) return
      const se = enemy._statusEffects
      if (!se) return
      se.chill.active = true
      se.chill.timer  = 1500
    },
  }
  ```

- [ ] **Step 9: Create `src/affixes/curse.js`**

  ```js
  // src/affixes/curse.js
  export default {
    id:   'curse',
    name: '詛咒',
    desc: '敵人受到+25%傷害，持續3秒（擊中時刷新）',

    onHit(enemy, damage, scene) {
      const se = enemy._statusEffects
      if (!se) return
      se.curse.active = true
      se.curse.timer  = 3000
    },
  }
  ```

- [ ] **Step 10: Create `src/affixes/leech.js`**

  ```js
  // src/affixes/leech.js
  export default {
    id:   'leech',
    name: '吸血',
    desc: '每次攻擊回復傷害量的10% HP',

    onHit(enemy, damage, scene) {
      if (scene._player) scene._player.heal(damage * 0.10)
    },
  }
  ```

- [ ] **Step 11: Create `src/affixes/burst.js`**

  ```js
  // src/affixes/burst.js
  import Enemy from '../entities/Enemy.js'
  import Phaser from 'phaser'

  export default {
    id:   'burst',
    name: '爆裂',
    desc: '20%機率：40px範圍爆炸，0.4倍傷害',

    onHit(enemy, damage, scene) {
      if (Math.random() > 0.20) return
      scene._enemies.getChildren()
        .filter(e => e.active && !e.dying && e !== enemy &&
          Phaser.Math.Distance.Between(enemy.x, enemy.y, e.x, e.y) < 40)
        .forEach(e => Enemy.takeDamage(e, damage * 0.4, enemy.x, enemy.y, []))

      // Visual: brief AoE ring
      const g = scene.add.graphics().setDepth(10)
      g.lineStyle(2, 0xff4400, 0.8)
      g.strokeCircle(enemy.x, enemy.y, 40)
      scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() })
    },
  }
  ```

- [ ] **Step 12: Create `src/affixes/lucky.js`**

  ```js
  // src/affixes/lucky.js
  // Passive — crit boost handled directly in Enemy.takeDamage() by counting lucky affixes.
  export default {
    id:   'lucky',
    name: '幸運',
    desc: '爆擊率+15%，爆擊倍率+0.5倍（可疊加）',
    onHit(enemy, damage, scene) { /* passive — applied in takeDamage */ },
  }
  ```

- [ ] **Step 13: Create `src/affixes/index.js`**

  ```js
  // src/affixes/index.js
  import burn    from './burn.js'
  import poison  from './poison.js'
  import chain   from './chain.js'
  import chill   from './chill.js'
  import curse   from './curse.js'
  import leech   from './leech.js'
  import burst   from './burst.js'
  import lucky   from './lucky.js'

  export { checkResonances } from './resonances.js'

  export const ALL_AFFIXES = [burn, poison, chain, chill, curse, leech, burst, lucky]

  export const ALL_MECHANICAL = [
    {
      id:   'multishot',
      name: '乱射',
      desc: '所有武器：投射數+1（近戰：射程+15%）',
    },
    {
      id:   'piercing',
      name: '貫通',
      desc: '所有投射型武器：彈丸貫穿敵人',
    },
    {
      id:   'orbit_shield',
      name: '護盾術',
      desc: '產生環繞護盾（60px軌道，接觸造成6傷害/秒）',
    },
  ]
  ```

- [ ] **Step 14: Wire affixes into `GameScene.js` — add real imports and connect resonances**

  At the top of `GameScene.js`, add:
  ```js
  import { ALL_AFFIXES, ALL_MECHANICAL, checkResonances } from '../affixes/index.js'
  import { ALL_WEAPONS } from '../weapons/index.js'
  ```

  In `_buildUpgradePool()`, remove the `typeof ALL_AFFIXES !== 'undefined'` guards — they're now real imports:
  ```js
  pool.push(...ALL_AFFIXES.map(a => ({ id: a.id, name: a.name, desc: a.desc, target: 'affix', affix: a })))
  pool.push(...ALL_MECHANICAL.map(m => ({ ...m, target: 'mechanical' })))
  // (new weapon candidates use ALL_WEAPONS import — already guarded)
  const candidates = ALL_WEAPONS.filter(w => !owned.has(w.id))
  ```
  (Remove the `typeof ALL_WEAPONS !== 'undefined' ? ALL_WEAPONS : []` guard.)

  In `_applyAffix()`, add resonance recomputation:
  ```js
  _applyAffix(affix) {
    this._affixes.push(affix)
    const count = (this._affixCounts.get(affix.id) || 0) + 1
    this._affixCounts.set(affix.id, count)
    this._resonances = checkResonances(this._affixCounts)
  }
  ```

- [ ] **Step 15: Run all tests**

  ```bash
  npx vitest run
  ```
  Expected: 7/7 resonance tests PASS.

- [ ] **Step 16: Verify in browser**

  Run `npm run dev`. Level up several times. Confirm:
  - Affix cards appear in upgrade UI (burn, poison, etc.)
  - Picking a poison affix adds it to `scene._affixes` (add `console.log(this._affixes)` to `_applyAffix` temporarily)
  - Mechanical affix cards show (multishot, piercing, orbit_shield)
  - No console errors

- [ ] **Step 17: Commit**

  ```bash
  git add src/affixes/ tests/affixes/
  git add src/scenes/GameScene.js
  git commit -m "feat: affix system — 8 elemental + 3 mechanical affixes, resonances, wired into GameScene"
  ```

---

## Task 7: Update existing weapons to pass affixes

Shuriken, Kunai, and Tachi must forward the `affixes` argument to `Enemy.takeDamage()`.

**Files:**
- Modify: `src/weapons/Shuriken.js`
- Modify: `src/weapons/Kunai.js`
- Modify: `src/weapons/Tachi.js`

- [ ] **Step 1: Update `Shuriken.js` — `fire()` sets `s._affixes` on each projectile**

  Shuriken's overlap is handled by GameScene (already passes `this._affixes`). The projectile just needs to carry the affix reference so the overlap callback (which already has `this._affixes`) can use it. Actually, the GameScene overlap callback already passes `this._affixes` — so **Shuriken and Kunai need NO changes** (their projectiles' hits are handled by the per-group overlap in `_addWeapon()`).

  The only weapon that bypasses the projectile overlap is **Tachi** (melee — calls `Enemy.takeDamage` directly). Update `Tachi.js`:

  In `fire(scene, _pool, fromX, fromY, stats, enemies, player, affixes)`:
  - Add `affixes = []` to the function signature
  - Change `Enemy.takeDamage(e, stats.damage, player.x, player.y)` to `Enemy.takeDamage(e, stats.damage, player.x, player.y, affixes)`

  Full updated `fire()`:
  ```js
  fire(scene, _pool, fromX, fromY, stats, enemies, player, affixes = []) {
    const scale  = (stats.range * 2) / 166
    const hitSet = new Set()

    const slash = scene.add.sprite(fromX, fromY, 'tachi-slash', 0)
      .setDepth(6)
      .setOrigin(0.5, 0.5)
      .setScale(scale)

    const onUpdate = () => {
      slash.setPosition(player.x, player.y)
      enemies.getChildren()
        .filter(e => e.active && !e.dying && !hitSet.has(e) &&
          Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y) < stats.range)
        .forEach(e => { hitSet.add(e); Enemy.takeDamage(e, stats.damage, player.x, player.y, affixes) })
    }

    scene.events.on('update', onUpdate)
    slash.play('tachi-slash')
    scene.tweens.add({ targets: slash, angle: 360, duration: 500, ease: 'Linear' })
    slash.once('animationcomplete', () => {
      scene.events.off('update', onUpdate)
      slash.destroy()
    })
  },
  ```

- [ ] **Step 2: Verify**

  Run `npm run dev`. Pick Tachi, acquire a leech affix, kill enemies — HP should slowly restore. Check console for errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/weapons/Tachi.js
  git commit -m "feat: Tachi passes affixes to Enemy.takeDamage"
  ```

---

## Task 8: New weapon — Ogi (扇, melee fan)

**Files:**
- Create: `src/weapons/Ogi.js`

- [ ] **Step 1: Create `src/weapons/Ogi.js`**

  ```js
  // src/weapons/Ogi.js
  import Phaser from 'phaser'
  import Enemy  from '../entities/Enemy.js'

  export default {
    id:   'ogi',
    name: '扇',
    desc: '扇型揮擊・廣域近戰',

    baseStats: {
      damage:   18,
      fireRate: 1200,
      range:    90,
    },

    upgrades: [
      { id: 'dmg',   name: '扇強化', desc: '傷害 +25%', apply: s => { s.damage   *= 1.25 } },
      { id: 'range', name: '廣域',   desc: '射程 +20%', apply: s => { s.range    *= 1.20 } },
      { id: 'speed', name: '速揮',   desc: '揮速 +20%', apply: s => { s.fireRate *= 0.80 } },
    ],

    createTexture(_scene) { /* no persistent texture — arc is drawn with Graphics */ },

    fire(scene, _pool, fromX, fromY, stats, enemies, player, affixes = []) {
      const hitSet = new Set()
      let elapsed  = 0
      const facingDeg = player.sprite.flipX ? 180 : 0

      // Fan arc Graphics object
      const g = scene.add.graphics().setDepth(6)

      const updateFn = (_, delta) => {
        elapsed += delta
        const t = Math.min(elapsed / 400, 1)

        g.clear()
        g.setPosition(player.x, player.y)
        g.fillStyle(0xff8800, 0.45 * (1 - t))
        g.beginPath()
        g.moveTo(0, 0)
        const segs = 12
        for (let i = 0; i <= segs; i++) {
          const a = Phaser.Math.DegToRad(facingDeg - 60 + 120 * i / segs)
          g.lineTo(Math.cos(a) * stats.range, Math.sin(a) * stats.range)
        }
        g.closePath()
        g.fillPath()

        // Hit check each frame during the swing
        enemies.getChildren()
          .filter(e => e.active && !e.dying && !hitSet.has(e))
          .forEach(e => {
            const dist = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y)
            if (dist > stats.range) return
            const angleDeg = Phaser.Math.RadToDeg(
              Phaser.Math.Angle.Between(player.x, player.y, e.x, e.y))
            const diff = Phaser.Math.Wrap(angleDeg - facingDeg, -180, 180)
            if (Math.abs(diff) <= 60) {
              hitSet.add(e)
              Enemy.takeDamage(e, stats.damage, player.x, player.y, affixes)
            }
          })

        if (elapsed >= 400) {
          scene.events.off('update', updateFn)
          g.destroy()
        }
      }
      scene.events.on('update', updateFn)
    },

    update() {},
  }
  ```

- [ ] **Step 2: Add Ogi to `src/weapons/index.js`**

  ```js
  import Ogi from './Ogi.js'
  export const ALL_WEAPONS = [Shuriken, Kunai, Tachi, Ogi]
  ```

  Tasks 9–11 will keep extending this array. Task 12 is the final consolidation.

- [ ] **Step 3: Verify manually**

  Run `npm run dev`. Start with Ogi or acquire it at level 5 (if level 5 is reachable). Confirm orange fan arc appears in front of player and enemies inside the arc take damage. Check console for errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/weapons/Ogi.js src/weapons/index.js
  git commit -m "feat: Ogi weapon — 120-degree fan melee sweep"
  ```

---

## Task 9: New weapon — Ofuda (霊符, homing projectile)

**Files:**
- Create: `src/weapons/Ofuda.js`

- [ ] **Step 1: Create `src/weapons/Ofuda.js`**

  ```js
  // src/weapons/Ofuda.js
  import Phaser     from 'phaser'
  import { getOrCreate } from './_pool.js'

  export default {
    id:     'ofuda',
    name:   '霊符',
    desc:   '緩速追蹤・命中爆炸',
    texKey: 'ofuda-tex',

    baseStats: {
      damage:         30,
      fireRate:       2000,
      projectileCount: 1,
      range:          600,
      speed:          150,
      penetrate:      false,
    },

    upgrades: [
      { id: 'dmg',     name: '霊符強化', desc: '傷害 +25%',  apply: s => { s.damage         *= 1.25 } },
      { id: 'speed',   name: '追蹤加速', desc: '速度 +30%',  apply: s => { s.speed          *= 1.30 } },
      { id: 'multi',   name: '多重符',   desc: '符數 +1',    apply: s => { s.projectileCount += 1 } },
    ],

    createTexture(scene) {
      if (scene.textures.exists('ofuda-tex')) return
      const rt = scene.add.renderTexture(0, 0, 14, 20)
      rt.fill(0x9933cc)
      rt.saveTexture('ofuda-tex')
      rt.destroy()
    },

    fire(scene, pool, fromX, fromY, stats, enemies) {
      const targets = _nearestEnemies(enemies, fromX, fromY, stats.projectileCount)
      if (targets.length === 0) return
      targets.forEach(target => {
        const s = getOrCreate(pool, fromX, fromY, this.texKey)
        s.damage        = stats.damage
        s.hitSet        = new Set()
        s.spawnX        = fromX
        s.spawnY        = fromY
        s.range         = stats.range
        s.penetrate     = false
        s._target       = target
        s._explodeRadius = 60
        s._explodeMult   = 1.5
        s._speed        = stats.speed

        const angle = Phaser.Math.Angle.Between(fromX, fromY, target.x, target.y)
        scene.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), stats.speed, s.body.velocity)
      })
    },

    update(sprite) {
      if (!sprite.active) return

      // Out of range → expire
      if (Phaser.Math.Distance.Between(sprite.spawnX, sprite.spawnY, sprite.x, sprite.y) >= sprite.range) {
        sprite.disableBody(true, true)
        return
      }

      // Lost target — keep going straight
      if (!sprite._target || !sprite._target.active || sprite._target.dying) return

      // Steer toward target with 4°/frame angular velocity cap
      const targetAngle  = Phaser.Math.Angle.Between(sprite.x, sprite.y, sprite._target.x, sprite._target.y)
      const currentAngle = Math.atan2(sprite.body.velocity.y, sprite.body.velocity.x)

      let diff = targetAngle - currentAngle
      while (diff >  Math.PI) diff -= 2 * Math.PI
      while (diff < -Math.PI) diff += 2 * Math.PI

      const maxTurn  = Phaser.Math.DegToRad(4)
      const turn     = Math.min(Math.abs(diff), maxTurn) * Math.sign(diff)
      const newAngle = currentAngle + turn
      const speed    = sprite._speed || 150

      sprite.body.velocity.x = Math.cos(newAngle) * speed
      sprite.body.velocity.y = Math.sin(newAngle) * speed
      sprite.rotation = newAngle
    },
  }

  function _nearestEnemies(enemies, x, y, count) {
    return enemies.getChildren()
      .filter(e => e.active && !e.dying)
      .map(e => ({ e, d: Phaser.Math.Distance.Between(x, y, e.x, e.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, count)
      .map(({ e }) => e)
  }
  ```

- [ ] **Step 2: Add to `src/weapons/index.js`**

  ```js
  import Ofuda from './Ofuda.js'
  export const ALL_WEAPONS = [Shuriken, Kunai, Tachi, Ogi, Ofuda]
  ```

- [ ] **Step 3: Verify manually**

  Run `npm run dev`. Acquire Ofuda via upgrade. Confirm purple rectangles slowly home toward enemies and explode on contact (other nearby enemies should also take damage from the AoE).

- [ ] **Step 4: Commit**

  ```bash
  git add src/weapons/Ofuda.js src/weapons/index.js
  git commit -m "feat: Ofuda weapon — homing projectile with AoE explosion"
  ```

---

## Task 10: New weapon — Kusarigama (鎖鎌, orbital sickles)

No Arcade physics body. Uses `updateActive()` each frame.

**Files:**
- Create: `src/weapons/Kusarigama.js`

- [ ] **Step 1: Create `src/weapons/Kusarigama.js`**

  ```js
  // src/weapons/Kusarigama.js
  import Phaser from 'phaser'
  import Enemy  from '../entities/Enemy.js'

  export default {
    id:   'kusarigama',
    name: '鎖鎌',
    desc: '環繞軌道・持續接觸傷害',

    baseStats: {
      damage:      8,
      fireRate:    0,      // always active — handled by updateActive()
      sickleCount: 1,
    },

    upgrades: [
      { id: 'dmg',    name: '鎌強化', desc: '傷害 +25%', apply: s => { s.damage      *= 1.25 } },
      { id: 'sickle', name: '多鎌',   desc: '鎌刃 +1',   apply: s => { s.sickleCount += 1 } },
    ],

    createTexture(_scene) { /* sickles are drawn as rectangles in updateActive */ },

    fire() { /* no-op — sickles initialized lazily in updateActive */ },

    update() { /* no-op — no physics projectiles */ },

    updateActive(entry, scene, enemies, player, affixes, delta) {
      // Lazy-init sickle sprites
      if (!entry.sickles) {
        entry.sickles  = []
        entry.damageCd = new Map()
      }

      // Grow sickle array if sickleCount increased via upgrade
      while (entry.sickles.length < entry.stats.sickleCount) {
        entry.sickles.push(
          scene.add.rectangle(0, 0, 20, 8, 0x00cccc).setDepth(8)
        )
      }

      const now       = scene.time.now
      const baseAngle = (now / 1000) * 180   // full rotation every 2s

      for (let i = 0; i < entry.sickles.length; i++) {
        const sickle  = entry.sickles[i]
        const angle   = Phaser.Math.DegToRad(baseAngle + (360 / entry.sickles.length) * i)
        const sx      = player.x + Math.cos(angle) * 80
        const sy      = player.y + Math.sin(angle) * 80
        sickle.setPosition(sx, sy).setRotation(angle)

        enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
          if (Phaser.Math.Distance.Between(sx, sy, e.x, e.y) < 20) {
            const last = entry.damageCd.get(e) || 0
            if (now - last >= 200) {
              entry.damageCd.set(e, now)
              Enemy.takeDamage(e, entry.stats.damage, sx, sy, affixes)
            }
          }
        })
      }
    },
  }
  ```

- [ ] **Step 2: Add to `src/weapons/index.js`**

  ```js
  import Kusarigama from './Kusarigama.js'
  export const ALL_WEAPONS = [Shuriken, Kunai, Tachi, Ogi, Ofuda, Kusarigama]
  ```

- [ ] **Step 3: Verify manually**

  Run `npm run dev`. Acquire Kusarigama at level 5. Confirm cyan sickles orbit the player and deal contact damage to touching enemies.

- [ ] **Step 4: Commit**

  ```bash
  git add src/weapons/Kusarigama.js src/weapons/index.js
  git commit -m "feat: Kusarigama weapon — orbital sickles with contact damage"
  ```

---

## Task 11: New weapon — Homura (炎矢, explosive projectile)

**Files:**
- Create: `src/weapons/Homura.js`

- [ ] **Step 1: Create `src/weapons/Homura.js`**

  ```js
  // src/weapons/Homura.js
  import Phaser     from 'phaser'
  import { getOrCreate } from './_pool.js'

  export default {
    id:     'homura',
    name:   '炎矢',
    desc:   '大型炎彈・爆炸傷害',
    texKey: 'homura-tex',

    baseStats: {
      damage:          25,
      fireRate:        2500,
      projectileCount: 1,
      range:           700,
      speed:           200,
      penetrate:       false,
      _explodeRadius:  80,   // AoE explosion radius; readable by fire() and upgradeable
    },

    upgrades: [
      { id: 'dmg',    name: '炎矢強化', desc: '傷害 +25%', apply: s => { s.damage         *= 1.25 } },
      { id: 'radius', name: '大爆炸',   desc: '爆炸半徑+20px',
        apply: s => { s._explodeRadius = (s._explodeRadius || 80) + 20 } },
      { id: 'multi',  name: '多重炎矢', desc: '彈數 +1',   apply: s => { s.projectileCount += 1 } },
    ],

    createTexture(scene) {
      if (scene.textures.exists('homura-tex')) return
      const rt = scene.add.renderTexture(0, 0, 24, 24)
      rt.fill(0xdd2200)
      rt.saveTexture('homura-tex')
      rt.destroy()
    },

    fire(scene, pool, fromX, fromY, stats, enemies) {
      const targets = _nearestEnemies(enemies, fromX, fromY, stats.projectileCount)
      if (targets.length === 0) return
      targets.forEach(target => {
        const s = getOrCreate(pool, fromX, fromY, this.texKey)
        s.setDisplaySize(24, 24)
        s.damage         = stats.damage
        s.hitSet         = new Set()
        s.spawnX         = fromX
        s.spawnY         = fromY
        s.range          = stats.range
        s.penetrate      = false
        s._explodeRadius = stats._explodeRadius   // from baseStats or upgraded value
        s._explodeMult   = 1.2

        const angle = Phaser.Math.Angle.Between(fromX, fromY, target.x, target.y)
        scene.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), stats.speed, s.body.velocity)
      })
    },

    update(sprite) {
      if (!sprite.active) return
      sprite.rotation += 0.1
      if (Phaser.Math.Distance.Between(sprite.spawnX, sprite.spawnY, sprite.x, sprite.y) >= sprite.range) {
        sprite.disableBody(true, true)
      }
    },
  }

  function _nearestEnemies(enemies, x, y, count) {
    return enemies.getChildren()
      .filter(e => e.active && !e.dying)
      .map(e => ({ e, d: Phaser.Math.Distance.Between(x, y, e.x, e.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, count)
      .map(({ e }) => e)
  }
  ```

- [ ] **Step 2: Finalize `src/weapons/index.js`** (Task 12)

  Add Homura and finalize (handled in next task).

- [ ] **Step 3: Verify manually**

  Run `npm run dev`. Acquire Homura. Confirm large red rectangles fly toward enemies and cause AoE explosions on hit.

- [ ] **Step 4: Commit (after Task 12)**

  Defer to Task 12.

---

## Task 12: Finalize `src/weapons/index.js`

- [ ] **Step 1: Write final `src/weapons/index.js`**

  ```js
  // src/weapons/index.js
  import Shuriken   from './Shuriken.js'
  import Kunai      from './Kunai.js'
  import Tachi      from './Tachi.js'
  import Ogi        from './Ogi.js'
  import Ofuda      from './Ofuda.js'
  import Kusarigama from './Kusarigama.js'
  import Homura     from './Homura.js'

  export const ALL_WEAPONS = [Shuriken, Kunai, Tachi, Ogi, Ofuda, Kusarigama, Homura]
  ```

- [ ] **Step 2: Run tests**

  ```bash
  npx vitest run
  ```
  Expected: all pass.

- [ ] **Step 3: Verify all 7 weapons appear in WeaponSelectScene**

  Run `npm run dev`. The weapon select screen should show 3 random weapons from the 7. Try reloading several times to see different weapons appear.

- [ ] **Step 4: Commit**

  ```bash
  git add src/weapons/Homura.js src/weapons/index.js
  git commit -m "feat: Homura weapon + finalize weapons/index.js with all 7 weapons"
  ```

---

## Task 13: HUD — weapon icons, affix dots, resonance glyphs

Add the three new HUD rows below the existing HP/XP bars.

**Files:**
- Modify: `src/scenes/GameScene.js`

- [ ] **Step 1: Add HUD display objects in `create()`**

  After the `this._hudTimer` line in `create()`, add:
  ```js
  // Weapon icon row — each entry is { icon, label } so both can be destroyed together
  this._hudWeaponIcons = []   // filled dynamically by _drawHud()

  // Affix dot row (pre-create up to 8 slots)
  this._hudAffixDots  = Array.from({ length: 8 }, (_, i) =>
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
  ```

  > **Layout:** HP bar at y=16, XP bar at y=34, level text at y=52, weapon icons at y=58, affix dots at y=72, resonances at y=92.

- [ ] **Step 2: Update `_drawHud()` to draw new rows**

  Add to the end of `_drawHud()`:

  ```js
  // Weapon icon row — one 20×20 colored square per active weapon
  const weaponColors = [0xff8844, 0x44aaff, 0xaaff44, 0xff44aa]
  // Remove old icons AND their labels (both stored together to avoid leaks)
  this._hudWeaponIcons.forEach(({ icon, label }) => { icon.destroy(); label.destroy() })
  this._hudWeaponIcons = this._weapons.map((entry, i) => {
    const icon = this.add.rectangle(16 + i * 26, 58, 20, 20, weaponColors[i] || 0xffffff)
      .setScrollFactor(0).setDepth(200).setStrokeStyle(1, 0xffffff)
    const label = this.add.text(16 + i * 26, 58, entry.weapon.name[0], {
      fontSize: '8px', color: '#000000',
    }).setScrollFactor(0).setDepth(201).setOrigin(0.5)
    return { icon, label }
  })

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
  ```

  > **Note:** Creating weapon icons inside `_drawHud()` on every frame is wasteful. Since `_drawHud()` is called each frame, cache and only rebuild when `this._weapons.length` changes. Add `this._lastWeaponCount = 0` in `create()` and guard in `_drawHud()`:
  > ```js
  > if (this._weapons.length !== this._lastWeaponCount) {
  >   this._lastWeaponCount = this._weapons.length
  >   // rebuild weapon icons
  > }
  > ```
  > But for correctness first, the simple version above is fine. Optimize if frame drops are noticed.

- [ ] **Step 3: Verify HUD**

  Run `npm run dev`. Confirm:
  - One weapon icon appears at start (orange square with first character of weapon name)
  - After leveling up and picking burn affix: an orange dot with "1" appears in the affix row
  - After picking a second affix: two dots shown
  - After acquiring both burn + burst: "爆炎" resonance glyph appears

- [ ] **Step 4: Commit**

  ```bash
  git add src/scenes/GameScene.js
  git commit -m "feat: HUD weapon icons, affix dots, resonance glyphs"
  ```

---

## Final Verification Checklist

Run `npm run dev` and verify end-to-end:

- [ ] Pick any starting weapon → game starts normally
- [ ] Level 5: "新武器" card can appear in upgrade choices; picking it adds second weapon icon to HUD
- [ ] All 8 elemental affixes appear as upgrade cards; picking them shows colored dots
- [ ] Burn: enemies glow orange and take DoT damage
- [ ] Poison: stacks accumulate (up to 5 green ticks worth of slow damage)
- [ ] Chain: lightning arcs to nearby enemies on hit (25% chance)
- [ ] Chill: enemies visibly slow (blue tint) after being hit
- [ ] Curse: cursed enemies (purple tint) take extra damage
- [ ] Leech: HP bar refills slightly after kills
- [ ] Burst: random AoE ring appears on some hits
- [ ] Lucky: crits feel more frequent
- [ ] Multishot mechanical: shuriken count increases
- [ ] Orbit_shield: cyan orb orbits player and damages nearby enemies
- [ ] Ogi: orange fan arc sweeps in facing direction
- [ ] Ofuda: purple rectangle homes slowly, explodes on hit
- [ ] Kusarigama: cyan sickles orbit player continuously
- [ ] Homura: large red rectangle flies straight, causes AoE explosion
- [ ] Resonance burn+burst → "爆炎" glyph in HUD; burning enemies explode on death
- [ ] All tests pass: `npx vitest run`

---

## Final Commit

```bash
npx vitest run
git add src/ tests/
git commit -m "feat: weapon+element system complete — 7 weapons, 8 affixes, 3 mechanical, 5 resonances"
```
