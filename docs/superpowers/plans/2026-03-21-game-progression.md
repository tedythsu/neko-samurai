# Game Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full 15-minute run progression system — 5 enemy types, difficulty scaling, 3 Bosses (鬼将/雷鬼/大妖魔), kill counter, and victory screen.

**Architecture:** Enemy type configs live in `EnemyTypes.js`; difficulty breakpoints live in `config.js`. `BossManager` owns all boss logic (triggers, skills, HP bar, phase state). `Enemy.activate()` receives a `typeConfig + diffMult` pair so stats come from the type system, not hardcoded CFG values. `GameScene` stores `this._spawnEvent` to pause/resume spawning during boss fights.

**Tech Stack:** Phaser 3 (Arcade physics, `scene.time.addEvent`, `scene.tweens`), vanilla JS ES modules.

**Spec:** `docs/superpowers/specs/2026-03-21-game-progression-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| **Create** | `src/enemies/EnemyTypes.js` | 5 enemy type config objects + `getDifficultyMult(elapsedMs)` |
| **Create** | `src/enemies/BossManager.js` | Boss triggers, skill events, HP bar state, phase logic, `cleanup()` |
| **Modify** | `src/config.js` | Add `PROGRESSION_BREAKPOINTS` array |
| **Modify** | `src/entities/Enemy.js` | New `activate(sprite, x, y, typeConfig, diffMult)` signature; `_baseTint` pipeline |
| **Modify** | `src/scenes/GameScene.js` | Store `_spawnEvent`; update `_spawnWave()`; wire BossManager; kill counter; boss HP bar in `_drawHud()`; victory screen; update death screen |

---

## Task 1: EnemyTypes + PROGRESSION_BREAKPOINTS

**Files:**
- Create: `src/enemies/EnemyTypes.js`
- Modify: `src/config.js`

- [ ] **Step 1: Create `src/enemies/EnemyTypes.js`**

```javascript
// src/enemies/EnemyTypes.js
// Five enemy type configs. unlockMs = when the type enters the spawn pool.
// baseTint: null = no tint (clearTint). hpMult/speedMult/sizeMult are
// multiplied against CFG.ENEMY_HP / CFG.ENEMY_SPEED / base display size.
export const ENEMY_TYPES = [
  {
    id:        'kisotsu',
    unlockMs:  0,
    baseTint:  null,       // no tint
    hpMult:    1.0,
    speedMult: 1.0,
    sizeMult:  1.0,
    behaviorFlags: {},
  },
  {
    id:        'hayate',
    unlockMs:  3 * 60 * 1000,
    baseTint:  0x44ff88,   // green
    hpMult:    0.5,
    speedMult: 2.0,
    sizeMult:  0.75,
    behaviorFlags: {},
  },
  {
    id:        'yoroi',
    unlockMs:  6 * 60 * 1000,
    baseTint:  0xcc6622,   // orange-brown
    hpMult:    4.0,
    speedMult: 0.5,
    sizeMult:  1.5,
    behaviorFlags: {},
  },
  {
    id:        'bakuha',
    unlockMs:  9 * 60 * 1000,
    baseTint:  0xff2200,   // red
    hpMult:    0.7,
    speedMult: 1.3,
    sizeMult:  1.0,
    behaviorFlags: { explode: true, explodeRadius: 60, explodeRange: 30 },
  },
  {
    id:        'jonin',
    unlockMs:  12 * 60 * 1000,
    baseTint:  0xffcc00,   // gold
    hpMult:    2.5,
    speedMult: 1.4,
    sizeMult:  1.2,
    behaviorFlags: {},
  },
]

/**
 * Return { hpMult, speedMult, spawnInterval, maxEnemies } for the given
 * elapsed time in ms, linearly interpolating between PROGRESSION_BREAKPOINTS.
 * Import CFG.PROGRESSION_BREAKPOINTS from config.js.
 */
export function getDifficultyMult(elapsedMs, breakpoints) {
  const pts = breakpoints
  // Clamp to last breakpoint
  if (elapsedMs >= pts[pts.length - 1].timeMs) {
    const last = pts[pts.length - 1]
    return { hpMult: last.hpMult, speedMult: last.speedMult,
             spawnInterval: last.spawnInterval, maxEnemies: last.maxEnemies }
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    if (elapsedMs >= a.timeMs && elapsedMs < b.timeMs) {
      const t = (elapsedMs - a.timeMs) / (b.timeMs - a.timeMs)
      return {
        hpMult:        a.hpMult        + (b.hpMult        - a.hpMult)        * t,
        speedMult:     a.speedMult     + (b.speedMult     - a.speedMult)     * t,
        spawnInterval: a.spawnInterval + (b.spawnInterval - a.spawnInterval) * t,
        maxEnemies:    Math.round(a.maxEnemies + (b.maxEnemies - a.maxEnemies) * t),
      }
    }
  }
  // Unreachable: above loop covers all cases between breakpoints, clamp covers >= last.
  // Defensive fallback only.
  return { hpMult: 1, speedMult: 1, spawnInterval: 2000, maxEnemies: 20 }
}
```

- [ ] **Step 2: Add `PROGRESSION_BREAKPOINTS` to `src/config.js`**

Add after the closing `}` of the `CFG` object (before `xpThreshold`):

```javascript
export const PROGRESSION_BREAKPOINTS = [
  { timeMs:  0 * 60000, spawnInterval: 2000, hpMult: 1.0, speedMult: 1.0, maxEnemies: 20 },
  { timeMs:  3 * 60000, spawnInterval: 1700, hpMult: 1.2, speedMult: 1.1, maxEnemies: 25 },
  { timeMs:  6 * 60000, spawnInterval: 1400, hpMult: 1.5, speedMult: 1.2, maxEnemies: 30 },
  { timeMs:  9 * 60000, spawnInterval: 1100, hpMult: 2.0, speedMult: 1.3, maxEnemies: 35 },
  { timeMs: 12 * 60000, spawnInterval:  900, hpMult: 2.5, speedMult: 1.4, maxEnemies: 40 },
]
```

- [ ] **Step 3: Verify the file loads (no syntax error)**

Run: `npm run dev` — open browser, confirm game starts normally.

- [ ] **Step 4: Commit**

```bash
git add src/enemies/EnemyTypes.js src/config.js
git commit -m "feat: enemy type configs and difficulty breakpoints"
```

---

## Task 2: Enemy.activate() — type system + _baseTint pipeline

**Files:**
- Modify: `src/entities/Enemy.js`

- [ ] **Step 1: Update `activate()` signature and body**

Replace lines 32–53 (current `static activate(sprite, x, y)` through closing `}`):

```javascript
/**
 * Activate a pooled enemy at position (x, y).
 * typeConfig — one of ENEMY_TYPES entries (defaults to kisotsu if omitted)
 * diffMult   — { hpMult, speedMult } from getDifficultyMult()
 */
static activate(sprite, x, y, typeConfig = null, diffMult = null) {
  const type = typeConfig || { id: 'kisotsu', baseTint: null, hpMult: 1.0, speedMult: 1.0, sizeMult: 1.0, behaviorFlags: {} }
  const dm   = diffMult   || { hpMult: 1.0, speedMult: 1.0 }

  sprite.enableBody(true, x, y, true, true)
  sprite.hp             = CFG.ENEMY_HP * type.hpMult * dm.hpMult
  sprite.damageCd       = 0
  sprite.knockbackTimer = 0
  sprite.dying          = false
  sprite._frame         = 0
  sprite._timer         = 0
  sprite._baseTint      = type.baseTint    // store for tint pipeline restore
  sprite._typeConfig    = type             // store for behavior checks (e.g. bakuha explode)
  sprite._speed         = CFG.ENEMY_SPEED * type.speedMult * dm.speedMult

  sprite.setAlpha(1)
  if (type.baseTint !== null) {
    sprite.setTint(type.baseTint)
  } else {
    sprite.clearTint()
  }

  sprite._statusEffects = {
    burn:   { stacks: 0, timer: 0, dps: 5, _accum: 0 },
    poison: { stacks: 0, timer: 0, _accum: 0 },
    chill:  { active: false, timer: 0 },
    curse:  { active: false, timer: 0 },
    frozen: { active: false, timer: 0 },
  }

  const frame0 = sprite.scene.textures.get('kisotsu-run').frames[0]
  const dH = Math.round(64 * type.sizeMult)
  const dW = Math.round(dH * frame0.realWidth / frame0.realHeight)
  sprite.setTexture('kisotsu-run', 0).setDisplaySize(dW, dH)

  // Scale physics body proportionally (base body is 18×38 for 64px height)
  const bodyW = Math.round(18 * type.sizeMult)
  const bodyH = Math.round(38 * type.sizeMult)
  sprite.body.setSize(bodyW, bodyH)

  // 爆炸型: pulsing alpha tween
  if (type.behaviorFlags.explode) {
    sprite._pulseTween = sprite.scene.tweens.add({
      targets: sprite, alpha: { from: 0.6, to: 1.0 },
      yoyo: true, repeat: -1, duration: 350,
    })
  } else {
    sprite._pulseTween = null
  }
}
```

- [ ] **Step 2: Update `update()` to use `sprite._speed` instead of `CFG.ENEMY_SPEED`**

In `static update(sprite, player, delta)`, find line:
```javascript
const speed = frozen ? 0 : (chilled ? CFG.ENEMY_SPEED * 0.5 : CFG.ENEMY_SPEED)
```
Replace with:
```javascript
const baseSpeed = sprite._speed ?? CFG.ENEMY_SPEED
const speed     = frozen ? 0 : (chilled ? baseSpeed * 0.5 : baseSpeed)
```

- [ ] **Step 3: Add 爆炸型 explode behavior to `update()`**

Inside `static update(sprite, player, delta)`, after the `sprite.setFlipX(...)` line, add:

```javascript
// 爆炸型: explode when within range of player
if (!sprite.dying && sprite._typeConfig?.behaviorFlags?.explode) {
  const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, player.x, player.y)
  if (dist < sprite._typeConfig.behaviorFlags.explodeRange) {
    // AoE damage to player
    player.takeDamage(CFG.ENEMY_DAMAGE * 2)
    // Kill pulse tween then die
    if (sprite._pulseTween) { sprite._pulseTween.stop(); sprite._pulseTween = null }
    Enemy._triggerDeath(sprite)
    return
  }
}
```

- [ ] **Step 4: Fix `_applyStatusTint()` to restore `_baseTint` instead of `clearTint()`**

Replace line 155:
```javascript
    sprite.clearTint()
```
With:
```javascript
    if (sprite._baseTint !== null && sprite._baseTint !== undefined) {
      sprite.setTint(sprite._baseTint)
    } else {
      sprite.clearTint()
    }
```

- [ ] **Step 5: Fix `_triggerDeath()` — stop pulse tween and restore cleanly**

In `_triggerDeath()` after `sprite.dying = true`, add:
```javascript
    if (sprite._pulseTween) { sprite._pulseTween.stop(); sprite._pulseTween = null }
```

- [ ] **Step 6: Verify game runs — enemies spawn with correct tint/size from default kisotsu config**

Run: `npm run dev` — confirm no errors, enemies appear normal.

- [ ] **Step 7: Commit**

```bash
git add src/entities/Enemy.js
git commit -m "feat: Enemy.activate() type+difficulty params, _baseTint tint pipeline, 爆炸型 explode"
```

---

## Task 3: GameScene — difficulty scaling + typed spawn pool

**Files:**
- Modify: `src/scenes/GameScene.js`

- [ ] **Step 1: Add imports at top of `GameScene.js`**

After the existing imports (line 10), add:
```javascript
import { ENEMY_TYPES, getDifficultyMult } from '../enemies/EnemyTypes.js'
import { PROGRESSION_BREAKPOINTS }        from '../config.js'
```

- [ ] **Step 2: Store the spawn `TimeEvent` and add `_killCount`**

In `create()`, find the `this.time.addEvent({...})` block (lines 68–73). Replace with:
```javascript
this._spawnEvent = this.time.addEvent({
  delay: CFG.ENEMY_SPAWN_INTERVAL,
  loop: true,
  callback: this._spawnWave,
  callbackScope: this,
})
```

Then, right after the existing `this._elapsed = 0` line (end of `create()`), add:
```javascript
this._killCount = 0
```

- [ ] **Step 3: Update the `enemy-died` handler to increment kill count**

Find line:
```javascript
this.events.on('enemy-died', ({ x, y }) => this._spawnOrb(x, y))
```
Replace with:
```javascript
this.events.on('enemy-died', ({ x, y }) => {
  this._spawnOrb(x, y)
  this._killCount++
})
```

- [ ] **Step 4: Rewrite `_spawnWave()` with type pool + max cap + difficulty scaling**

Replace the current `_spawnWave()` method (lines 457–468):

```javascript
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
```

- [ ] **Step 5: Initialise `_bossActive` in `create()`**

After `this._killCount = 0`, add:
```javascript
this._bossActive = false
```

- [ ] **Step 6: Verify game runs — at 0:00 only 基礎兵 spawn; console.log pool length to confirm**

Run `npm run dev`, open console. Optionally add temporary `console.log('pool', pool.length)` inside `_spawnWave` for quick smoke test (remove before commit).

- [ ] **Step 7: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "feat: typed spawn pool, difficulty scaling, kill counter in GameScene"
```

---

## Task 4: BossManager — core + 鬼将 (Kijō)

**Files:**
- Create: `src/enemies/BossManager.js`

- [ ] **Step 1: Create `src/enemies/BossManager.js` with core class and 鬼将**

```javascript
// src/enemies/BossManager.js
import Phaser  from 'phaser'
import Enemy   from '../entities/Enemy.js'
import { CFG } from '../config.js'

// Boss definitions (triggers checked by elapsed time)
const BOSS_DEFS = [
  {
    id:        'kijo',
    name:      '鬼将',
    triggerMs: 5 * 60 * 1000,
    tint:      0x8844cc,
    scale:     2.5,
    hp:        CFG.ENEMY_HP * 15,
    speed:     CFG.ENEMY_SPEED * 0.8,
  },
  {
    id:        'raiki',
    name:      '雷鬼',
    triggerMs: 10 * 60 * 1000,
    tint:      0x2266ff,
    scale:     2.5,
    hp:        CFG.ENEMY_HP * 25,
    speed:     CFG.ENEMY_SPEED * 0.9,
  },
  {
    id:        'daiyoma',
    name:      '大妖魔',
    triggerMs: 15 * 60 * 1000,
    tint:      0xcc1133,
    scale:     3.0,
    hp:        CFG.ENEMY_HP * 40,
    speed:     CFG.ENEMY_SPEED * 0.7,
  },
]

export default class BossManager {
  constructor(scene) {
    this._scene        = scene
    this._triggered    = new Set()   // boss IDs already triggered
    this._activeEvents = []          // TimeEvent handles for current boss skills
    this.activeBoss    = null        // current boss sprite (null when none)
    this._bossMaxHp    = 0
    this._bossHpPct    = 0
    this._bossName     = ''
    this._phase2Done   = false
  }

  /** Call every frame from GameScene.update() */
  update(elapsedMs) {
    for (const def of BOSS_DEFS) {
      if (!this._triggered.has(def.id) && elapsedMs >= def.triggerMs) {
        this._triggered.add(def.id)
        this._spawnBoss(def)
        return   // one boss at a time
      }
    }

    // Update HP % for HUD
    if (this.activeBoss && this.activeBoss.active) {
      this._bossHpPct = Math.max(0, this.activeBoss.hp / this._bossMaxHp)

      // 大妖魔 phase 2 transition
      if (this.activeBoss._bossId === 'daiyoma' && !this._phase2Done &&
          this._bossHpPct <= 0.5) {
        this._enterDaiyomaPhase2()
      }
    }
  }

  /** Remove all active skill TimeEvents. Call before registering new ones or on boss death. */
  cleanup() {
    for (const ev of this._activeEvents) ev.remove()
    this._activeEvents = []
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  _spawnBoss(def) {
    const scene = this._scene

    // Pause regular spawning
    scene._spawnEvent.paused = true
    scene._bossActive = true

    // Announcement overlay
    const W  = scene.cameras.main.width
    const H  = scene.cameras.main.height
    const overlay = scene.add.text(W / 2, H / 2, `「${def.name} 降臨」`, {
      fontSize: '36px', color: '#ffffff',
      fontFamily: '"Noto Serif JP", serif',
      stroke: '#000000', strokeThickness: 4,
    }).setScrollFactor(0).setDepth(500).setOrigin(0.5).setAlpha(0)
    scene.tweens.add({ targets: overlay, alpha: 1, duration: 400 })
    scene.time.delayedCall(1500, () => {
      scene.tweens.add({ targets: overlay, alpha: 0, duration: 400,
        onComplete: () => overlay.destroy() })
    })

    // Spawn boss sprite from enemy pool
    const { x, y } = _randomEdge(scene)
    let sprite = scene._enemies.getFirstDead(false)
    if (!sprite) {
      sprite = scene._enemies.create(x, y, 'kisotsu-run', 0)
      sprite.setDepth(5)
    }

    // Manual activate (bypass type system — boss uses fixed HP/speed)
    sprite.enableBody(true, x, y, true, true)
    sprite.hp             = def.hp
    sprite.damageCd       = 0
    sprite.knockbackTimer = 0
    sprite.dying          = false
    sprite._frame         = 0
    sprite._timer         = 0
    sprite._baseTint      = def.tint
    sprite._typeConfig    = { id: def.id, behaviorFlags: {} }
    sprite._speed         = def.speed
    sprite._bossId        = def.id
    sprite._pulseTween    = null
    sprite.setAlpha(1).setTint(def.tint)
    sprite._statusEffects = {
      burn:   { stacks: 0, timer: 0, dps: 5, _accum: 0 },
      poison: { stacks: 0, timer: 0, _accum: 0 },
      chill:  { active: false, timer: 0 },
      curse:  { active: false, timer: 0 },
      frozen: { active: false, timer: 0 },
    }

    // Size the boss
    const frame0 = scene.textures.get('kisotsu-run').frames[0]
    const dH = Math.round(64 * def.scale)
    const dW = Math.round(dH * frame0.realWidth / frame0.realHeight)
    sprite.setDisplaySize(dW, dH)
    sprite.body.setSize(Math.round(18 * def.scale), Math.round(38 * def.scale))

    this.activeBoss  = sprite
    this._bossMaxHp  = def.hp
    this._bossHpPct  = 1.0
    this._bossName   = def.name
    this._phase2Done = false

    // Register boss-death watcher
    sprite._bossDeathWatcher = scene.events.on('update', () => {
      if (sprite.dying || !sprite.active || sprite.hp <= 0) {
        scene.events.off('update', sprite._bossDeathWatcher)
        this._onBossDead(def)
      }
    })

    // Register skills by boss ID
    if (def.id === 'kijo')    this._registerKijoSkills(sprite)
    if (def.id === 'raiki')   this._registerRaikiSkills(sprite)    // implemented in Task 5
    if (def.id === 'daiyoma') this._registerDaiyomaPhase1(sprite)  // implemented in Task 5
  }

  // Stub methods — expanded in Task 5
  _registerRaikiSkills(_boss)   { /* Task 5 */ }
  _enterDaiyomaPhase2()         { /* Task 5 */ }
  _registerDaiyomaPhase1(_boss) { /* Task 5 */ }

  _onBossDead(def) {
    this.cleanup()
    const scene       = this._scene
    const boss        = this.activeBoss
    this.activeBoss   = null
    this._bossHpPct   = 0

    if (def.id === 'daiyoma') {
      // Victory!
      scene.time.delayedCall(500, () => scene._onVictory())
      return
    }

    // XP burst
    const { x, y } = boss
    for (let i = 0; i < 12; i++) {
      scene.time.delayedCall(i * 60, () => scene._spawnOrb(
        x + Phaser.Math.Between(-80, 80),
        y + Phaser.Math.Between(-80, 80)
      ))
    }

    // Resume spawning after short pause
    scene.time.delayedCall(500, () => {
      scene._spawnEvent.paused = false
      scene._bossActive = false
    })
  }

  // ─── 鬼将 Skills ─────────────────────────────────────────────────────────

  _registerKijoSkills(boss) {
    const scene = this._scene

    // 衝刺突進: every 4 seconds, dash toward player at 600px/s for 0.3s
    const dashEvent = scene.time.addEvent({
      delay: 4000, loop: true,
      callback: () => {
        if (!boss.active || boss.dying) return
        const player = scene._player
        scene.physics.moveToObject(boss, player.sprite, 600)
        boss._dashing = true
        boss.damageCd = 0  // allow damage during dash
        scene.time.delayedCall(300, () => {
          if (boss.active && !boss.dying) {
            boss.body.velocity.set(0, 0)
            boss._dashing = false
          }
        })
      },
    })
    this._activeEvents.push(dashEvent)

    // 震地: every 3 seconds when HP < 50%
    const tremorEvent = scene.time.addEvent({
      delay: 3000, loop: true,
      callback: () => {
        if (!boss.active || boss.dying) return
        if (boss.hp / this._bossMaxHp >= 0.5) return
        const { x, y } = boss
        // AoE damage
        scene._enemies.getChildren()
          .filter(e => e.active && !e.dying && e !== boss &&
            Phaser.Math.Distance.Between(x, y, e.x, e.y) < 80)
          .forEach(e => Enemy.takeDamage(e, CFG.ENEMY_DAMAGE * 1.5, x, y, [], 0))
        // Check player proximity
        const pDist = Phaser.Math.Distance.Between(x, y, scene._player.x, scene._player.y)
        if (pDist < 80) scene._player.takeDamage(CFG.ENEMY_DAMAGE * 1.5)
        // Expanding ring visual
        const ring = scene.add.graphics().setDepth(8)
        ring.lineStyle(3, 0xff8800, 0.9)
        ring.strokeCircle(x, y, 80)
        scene.tweens.add({
          targets: ring, alpha: 0, scaleX: 1.4, scaleY: 1.4,
          duration: 400, onComplete: () => ring.destroy(),
        })
      },
    })
    this._activeEvents.push(tremorEvent)
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _randomEdge(scene) {
  const W = CFG.WORLD_WIDTH, H = CFG.WORLD_HEIGHT, inset = 20
  const edge = Math.floor(Math.random() * 4)
  switch (edge) {
    case 0: return { x: Math.random() * W,  y: inset }
    case 1: return { x: Math.random() * W,  y: H - inset }
    case 2: return { x: inset,              y: Math.random() * H }
    default: return { x: W - inset,         y: Math.random() * H }
  }
}
```

- [ ] **Step 2: Verify file parses (no syntax error)**

Run: `npm run dev` — check console. Import from BossManager in a test file is not needed yet; we'll wire it in Task 6.

- [ ] **Step 3: Commit**

```bash
git add src/enemies/BossManager.js
git commit -m "feat: BossManager core, boss spawn flow, 鬼将 dash + tremor skills"
```

---

## Task 5: BossManager — 雷鬼 + 大妖魔

**Files:**
- Modify: `src/enemies/BossManager.js`

- [ ] **Step 1: Add `_registerRaikiSkills()` to BossManager**

Inside the `BossManager` class, after `_registerKijoSkills()`:

```javascript
// ─── 雷鬼 Skills ─────────────────────────────────────────────────────────

_registerRaikiSkills(boss) {
  const scene = this._scene

  // 雷擊圈: every 5s, expanding ring 0→200px over 0.8s, damages player if within
  const lightningEvent = scene.time.addEvent({
    delay: 5000, loop: true,
    callback: () => {
      if (!boss.active || boss.dying) return
      const { x, y } = boss
      _doLightningRing(scene, x, y)
    },
  })
  this._activeEvents.push(lightningEvent)

  // 召喚: every 8s, spawn 3 快速型 near boss
  const hayateType = { id: 'hayate', baseTint: 0x44ff88, hpMult: 0.5, speedMult: 2.0, sizeMult: 0.75, behaviorFlags: {} }
  const summonEvent = scene.time.addEvent({
    delay: 8000, loop: true,
    callback: () => {
      if (!boss.active || boss.dying) return
      const diff = { hpMult: 1, speedMult: 1 }
      for (let i = 0; i < 3; i++) {
        const ox = boss.x + Phaser.Math.Between(-120, 120)
        const oy = boss.y + Phaser.Math.Between(-120, 120)
        let minion = scene._enemies.getFirstDead(false)
        if (!minion) {
          minion = scene._enemies.create(ox, oy, 'kisotsu-run', 0)
          minion.setDepth(5)
        }
        Enemy.activate(minion, ox, oy, hayateType, diff)
      }
    },
  })
  this._activeEvents.push(summonEvent)
}

// ─── 大妖魔 Skills ────────────────────────────────────────────────────────

_registerDaiyomaPhase1(boss) {
  const scene = this._scene

  // Phase 1: dash every 5s
  const dashEvent = scene.time.addEvent({
    delay: 5000, loop: true,
    callback: () => {
      if (!boss.active || boss.dying) return
      const player = scene._player
      scene.physics.moveToObject(boss, player.sprite, 600)
      boss._dashing = true
      scene.time.delayedCall(300, () => {
        if (boss.active && !boss.dying) { boss.body.velocity.set(0, 0); boss._dashing = false }
      })
    },
  })
  this._activeEvents.push(dashEvent)

  // Phase 1: lightning ring every 6s
  const lightningEvent = scene.time.addEvent({
    delay: 6000, loop: true,
    callback: () => {
      if (!boss.active || boss.dying) return
      _doLightningRing(scene, boss.x, boss.y)
    },
  })
  this._activeEvents.push(lightningEvent)
}

_enterDaiyomaPhase2() {
  this._phase2Done = true
  const scene = this._scene
  const boss  = this.activeBoss

  // Cleanup phase 1 events
  this.cleanup()

  // Screen flash
  const W = scene.cameras.main.width, H = scene.cameras.main.height
  const flash = scene.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.4)
    .setScrollFactor(0).setDepth(499)
  scene.time.delayedCall(200, () => flash.destroy())

  // Tint change + speed increase
  boss._baseTint = 0xff0000
  boss.setTint(0xff0000)
  boss._speed = CFG.ENEMY_SPEED * 1.2

  // Phase 2 events
  const hayateType = { id: 'hayate', baseTint: 0x44ff88, hpMult: 0.5, speedMult: 2.0, sizeMult: 0.75, behaviorFlags: {} }
  const yoroiType  = { id: 'yoroi',  baseTint: 0xcc6622, hpMult: 4.0, speedMult: 0.5, sizeMult: 1.5,  behaviorFlags: {} }
  const diff = { hpMult: 1, speedMult: 1 }

  const dashEvent = scene.time.addEvent({
    delay: 3000, loop: true,
    callback: () => {
      if (!boss.active || boss.dying) return
      scene.physics.moveToObject(boss, scene._player.sprite, 600)
      boss._dashing = true
      scene.time.delayedCall(300, () => {
        if (boss.active && !boss.dying) { boss.body.velocity.set(0, 0); boss._dashing = false }
      })
    },
  })
  this._activeEvents.push(dashEvent)

  const lightningEvent = scene.time.addEvent({
    delay: 6000, loop: true,
    callback: () => {
      if (!boss.active || boss.dying) return
      _doLightningRing(scene, boss.x, boss.y)
    },
  })
  this._activeEvents.push(lightningEvent)

  // 混合召喚: every 6s, 2 快速型 + 1 坦克型
  const summonEvent = scene.time.addEvent({
    delay: 6000, loop: true,
    callback: () => {
      if (!boss.active || boss.dying) return
      const spawnNear = (type) => {
        const ox = boss.x + Phaser.Math.Between(-120, 120)
        const oy = boss.y + Phaser.Math.Between(-120, 120)
        let m = scene._enemies.getFirstDead(false)
        if (!m) { m = scene._enemies.create(ox, oy, 'kisotsu-run', 0); m.setDepth(5) }
        Enemy.activate(m, ox, oy, type, diff)
      }
      spawnNear(hayateType)
      spawnNear(hayateType)
      spawnNear(yoroiType)
    },
  })
  this._activeEvents.push(summonEvent)
}
```

- [ ] **Step 2: Add `_doLightningRing()` helper at the bottom of the file (outside the class, alongside `_randomEdge`)**

```javascript
function _doLightningRing(scene, x, y) {
  const maxR  = 200
  const dur   = 800
  const ring  = scene.add.graphics().setDepth(8)
  let   curR  = 0

  ring.lineStyle(3, 0x66aaff, 0.9)
  ring.strokeCircle(x, y, 1)

  // Tween radius via a proxy object
  const proxy = { r: 0 }
  scene.tweens.add({
    targets: proxy, r: maxR, duration: dur,
    ease: 'Linear',
    onUpdate: () => {
      curR = proxy.r
      ring.clear()
      ring.lineStyle(3, 0x66aaff, 0.9)
      ring.strokeCircle(x, y, curR)
      // Damage player if within ring radius this frame
      const pDist = Phaser.Math.Distance.Between(x, y, scene._player.x, scene._player.y)
      if (Math.abs(pDist - curR) < 12) scene._player.takeDamage(CFG.ENEMY_DAMAGE * 1.5)
    },
    onComplete: () => ring.destroy(),
  })
}
```

- [ ] **Step 3: Verify file parses (no syntax error)**

Run: `npm run dev` — check console, game starts.

- [ ] **Step 4: Commit**

```bash
git add src/enemies/BossManager.js
git commit -m "feat: 雷鬼 lightning ring + summon, 大妖魔 two-phase boss skills"
```

---

## Task 6: GameScene integration — BossManager wiring, boss HP bar, victory screen, death screen update

**Files:**
- Modify: `src/scenes/GameScene.js`

- [ ] **Step 1: Import BossManager**

Add to the imports at the top of `GameScene.js`:
```javascript
import BossManager from '../enemies/BossManager.js'
```

- [ ] **Step 2: Instantiate BossManager in `create()`**

After `this._bossActive = false`, add:
```javascript
this._bossManager = new BossManager(this)
```

- [ ] **Step 3: Add boss HP bar HUD elements in `create()` (after existing HUD setup)**

After the existing HUD block (around line 148, after `this._elapsed = 0`), add:
```javascript
// Boss HP bar (hidden by default)
const BW = 300
const bossBarY = this.cameras.main.height - 40
this._bossHudGroup = this.add.group()
this._bossBarBg = this.add.rectangle(
  this.cameras.main.width / 2, bossBarY, BW + 4, 14, 0x220008
).setScrollFactor(0).setDepth(202).setOrigin(0.5, 0.5).setAlpha(0)
this._bossBarFill = this.add.rectangle(
  this.cameras.main.width / 2 - BW / 2, bossBarY, BW, 10, 0xcc2244
).setScrollFactor(0).setDepth(203).setOrigin(0, 0.5).setAlpha(0)
this._bossBarHighlight = this.add.rectangle(
  this.cameras.main.width / 2 - BW / 2, bossBarY - 4, BW, 2, 0xff4466
).setScrollFactor(0).setDepth(204).setOrigin(0, 0.5).setAlpha(0)
this._bossNameText = this.add.text(
  this.cameras.main.width / 2 - BW / 2 - 4, bossBarY, '', {
    fontSize: '12px', color: '#ffaacc',
    fontFamily: '"Noto Serif JP", serif',
  }
).setScrollFactor(0).setDepth(204).setOrigin(1, 0.5).setAlpha(0)
this._bossPctText = this.add.text(
  this.cameras.main.width / 2 + BW / 2 + 4, bossBarY, '', {
    fontSize: '12px', color: '#ffaacc',
    fontFamily: '"Cinzel", serif',
  }
).setScrollFactor(0).setDepth(204).setOrigin(0, 0.5).setAlpha(0)
```

- [ ] **Step 4: Call `_bossManager.update()` in the main `update()` method**

Find the `update(time, delta)` method. After `this._elapsed += delta`, add:
```javascript
this._bossManager.update(this._elapsed)
```

- [ ] **Step 5: Update `_drawHud()` to render boss HP bar when active**

At the end of `_drawHud()`, add:
```javascript
// Boss HP bar
const bossAlpha = this._bossManager.activeBoss ? 1 : 0
this._bossBarBg.setAlpha(bossAlpha)
this._bossBarFill.setAlpha(bossAlpha)
this._bossBarHighlight.setAlpha(bossAlpha)
this._bossNameText.setAlpha(bossAlpha)
this._bossPctText.setAlpha(bossAlpha)

if (this._bossManager.activeBoss) {
  const pct = this._bossManager._bossHpPct
  const BW  = 300
  this._bossBarFill.setDisplaySize(Math.round(BW * pct), 10)
  this._bossPctText.setText(`${Math.round(pct * 100)}%`)
  this._bossNameText.setText(this._bossManager._bossName)
}
```

- [ ] **Step 6: Update `_onPlayerDead()` to include kill count**

Find the `statsText` line in `_onPlayerDead()`:
```javascript
`生存  ${_fmtTime(this._elapsed)}   到達  Lv ${this._level}`
```
Replace with:
```javascript
`生存  ${_fmtTime(this._elapsed)}   到達  Lv ${this._level}   擊殺  ${this._killCount}`
```

- [ ] **Step 7: Add `_onVictory()` method**

After `_onPlayerDead()` (before the closing `}` of the class):

```javascript
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
```

- [ ] **Step 8: Verify end-to-end smoke test**

Run: `npm run dev`. Confirm:
1. Game starts, enemies spawn normally
2. After ~3 min, green (快速型) enemies appear
3. Console shows no errors
4. _onPlayerDead shows kill count

To skip to boss quickly: temporarily set `triggerMs: 10 * 1000` in BOSS_DEFS, verify announcement + boss spawns + HP bar appears. **Revert to `5 * 60 * 1000` before committing.**

- [ ] **Step 9: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "feat: BossManager wired, boss HP bar HUD, victory screen, kill count in death screen"
```

---

## Verification Checklist (post-implementation)

- [ ] 基礎兵 spawn from 0:00, no tint, normal stats
- [ ] 快速型 added to pool at 3:00, green tint, small & fast
- [ ] 坦克型 added at 6:00, orange-brown tint, large & slow
- [ ] 爆炸型 added at 9:00, red tint, pulses alpha, explodes near player
- [ ] 精英型 added at 12:00, gold tint, large & fast
- [ ] 鬼将 spawns at 5:00, regular spawning pauses, announcement shows, HP bar visible, dash + tremor (after 50% HP) work
- [ ] 雷鬼 spawns at 10:00, lightning ring expands, 快速型 minions spawned
- [ ] 大妖魔 spawns at 15:00, phase 2 triggers at 50% HP (flash, tint change, speed up, mixed summon)
- [ ] Defeating 大妖魔 → 勝 victory screen with correct stats
- [ ] Death screen shows kill count
- [ ] Status effects (burn/chill/etc.) still show correctly on colored enemies (tint restores after status clears)
- [ ] 爆炸型 NOT in boss summon pool

---

## Notes for Implementer

- **No tests exist** in this project. Verification is manual in-browser. Use `npm run dev` (Vite) and test in browser at `localhost:5173`.
- Boss skill damage numbers from spec: dash = `ENEMY_DAMAGE × 2`, tremor = `ENEMY_DAMAGE × 1.5`, lightning ring = `ENEMY_DAMAGE × 1.5`. These are in the spec — implement exactly.
- The 大妖魔 lightning ring check uses player proximity to the ring edge (not center) — see `_doLightningRing`, the `Math.abs(pDist - curR) < 12` check.
- Boss sprites are grabbed from `this._enemies` group (same pool as regular enemies). This means they show up in `countActive()` — that's intentional since regular spawning is paused.
- `_onVictory()` is called by BossManager via `scene._onVictory()` — this is a direct method call, not an event.
- Phase transition in 大妖魔 is checked in `BossManager.update()` every frame — `_phase2Done` prevents it running twice.
