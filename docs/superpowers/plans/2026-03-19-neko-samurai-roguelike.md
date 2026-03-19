# 猫の侍伝 Roguelike MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vampire Survivors-style top-down roguelike: cat samurai moves in 4 directions, shurikens auto-attack enemies, enemies spawn from edges, level-up gives 3-choice upgrades.

**Architecture:** Phaser 3 Arcade Physics; 3 scenes (BootScene → GameScene + UpgradeScene overlay); entities are ES classes that receive the scene reference. All sprite animation is manual frame-advance (reusing the existing `_sliceSheet` pattern) — Phaser's built-in anim system is NOT used because the spritesheet frames are irregular and loaded via `load.image`. Object pooling via `physics.add.group` for enemies and shurikens.

**Tech Stack:** Phaser 3.60, Vite 8, Vitest 4 — no additional dependencies.

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `src/config.js` | **Create** | All numeric constants; also exports pure helpers `xpThreshold(level)` and `UPGRADES[]` |
| `src/main.js` | **Replace** | Phaser game config with arcade physics + scene list |
| `src/scenes/BootScene.js` | **Create** | `load.image` for 3 sprite sheets, progress bar, then start GameScene |
| `src/scenes/GameScene.js` | **Replace** | Orchestrator: creates entities, physics groups, overlap handlers, HUD, XP/level logic, spawn timer, game-over |
| `src/scenes/UpgradeScene.js` | **Create** | Dark overlay, 3 random upgrade cards, emits `'upgrade-chosen'` to GameScene then stops |
| `src/entities/Player.js` | **Create** | Physics sprite, manual animation (idle/run/attack), WASD + touch joystick, HP, stats, `applyUpgrade` |
| `src/entities/Enemy.js` | **Create** | Static factory `Enemy.createTexture(scene)` + instance helpers `activate(x,y)`, `update(player)`, `takeDamage(n)` |
| `src/entities/Shuriken.js` | **Create** | Static factory `Shuriken.createTexture(scene)` + `fire(scene, pool, from, target, damage)` |
| `tests/logic.test.js` | **Create** | Vitest unit tests for pure functions: `xpThreshold`, `UPGRADES` math, edge-spawn helper |

---

## Task 1 — config.js: constants + pure helpers

**Files:**
- Create: `src/config.js`
- Create: `tests/logic.test.js`

- [ ] **Step 1: Write failing unit tests first (TDD)**

```js
// tests/logic.test.js
import { describe, it, expect } from 'vitest'
import { CFG, xpThreshold, randomEdgePoint, UPGRADES } from '../src/config.js'

describe('xpThreshold', () => {
  it('returns > 0 for level 1', () => {
    expect(xpThreshold(1)).toBeGreaterThan(0)
  })
  it('grows with level', () => {
    expect(xpThreshold(5)).toBeGreaterThan(xpThreshold(3))
  })
  it('equals XP_BASE at level 1 exactly', () => {
    expect(xpThreshold(1)).toBe(Math.floor(CFG.XP_BASE * 1 ** CFG.XP_SCALE))
  })
  it('level 0 returns 0 — game must start at level >= 1', () => {
    // If game initializes _level = 0, xpThreshold(0) = 0, causing infinite level-up loop.
    // This test documents the invariant: game always starts at level 1.
    expect(xpThreshold(0)).toBe(0)   // documents the danger — game init must use level 1
  })
})

describe('randomEdgePoint', () => {
  it('always produces a point on one of the four edges (1000 samples)', () => {
    for (let i = 0; i < 1000; i++) {
      const p = randomEdgePoint(1600, 1200, 20)
      // Each edge pins exactly ONE axis — only check the axis that was clamped.
      // top (y=inset): x is free → check y; bottom (y=worldH-inset): check y
      // left (x=inset): y is free → check x; right (x=worldW-inset): check x
      const onEdge = p.y === 20 || p.y === 1180 || p.x === 20 || p.x === 1580
      expect(onEdge).toBe(true)
    }
  })
})

describe('UPGRADES', () => {
  it('has 6 entries', () => expect(UPGRADES).toHaveLength(6))
  it('all have id, name, desc', () => {
    UPGRADES.forEach(u => {
      expect(u.id).toBeTruthy()
      expect(u.name).toBeTruthy()
      expect(u.desc).toBeTruthy()
    })
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL (config.js doesn't exist yet)**

```bash
cd /Users/tedhsumbp2024/Documents/workspace/neko-samurai
npm test -- --run
```

Expected: all tests FAIL with "Cannot find module '../src/config.js'"

- [ ] **Step 3: Create `src/config.js`**

```js
// src/config.js

export const CFG = {
  // Arena
  WORLD_WIDTH:  1600,
  WORLD_HEIGHT: 1200,

  // Player
  PLAYER_SPEED:            200,
  PLAYER_HP_MAX:           100,
  PLAYER_DAMAGE:            20,
  PLAYER_FIRE_RATE:        800,  // ms between shots
  PLAYER_PROJECTILE_COUNT:   1,

  // Enemy
  ENEMY_SPEED:              80,
  ENEMY_HP:                 40,
  ENEMY_DAMAGE:             10,
  ENEMY_SPAWN_INTERVAL:   2000,  // ms

  // XP
  XP_PER_ENEMY:             10,
  XP_BASE:                  50,
  XP_SCALE:                1.4,

  // Waves
  WAVE_SCALE: 3,  // extra enemy added per N levels
}

/** XP required to reach `level + 1` */
export function xpThreshold(level) {
  return Math.floor(CFG.XP_BASE * Math.pow(level, CFG.XP_SCALE))
}

/** Random edge spawn point — returns { x, y } inside world bounds */
export function randomEdgePoint(worldW, worldH, inset = 20) {
  const edge = Math.floor(Math.random() * 4)
  switch (edge) {
    case 0: return { x: Math.random() * worldW,  y: inset }               // top
    case 1: return { x: Math.random() * worldW,  y: worldH - inset }      // bottom
    case 2: return { x: inset,                   y: Math.random() * worldH } // left
    default: return { x: worldW - inset,         y: Math.random() * worldH } // right
  }
}

export const UPGRADES = [
  { id: 'dmg',       name: '手裏剣強化', desc: '傷害 +20%' },
  { id: 'firerate',  name: '連射',       desc: '射速 +25%' },
  { id: 'multishot', name: '雙発',       desc: '子彈數 +1' },
  { id: 'speed',     name: '疾風',       desc: '移速 +15%' },
  { id: 'maxhp',     name: '武者の意志', desc: '最大HP +20%' },
  { id: 'regen',     name: '忍の回復',   desc: '每5秒回復1 HP' },
]
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /Users/tedhsumbp2024/Documents/workspace/neko-samurai
npm test -- --run
```

Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/config.js tests/logic.test.js
git commit -m "feat: config constants, xpThreshold helper, upgrade pool"
```

---

## Task 2 — main.js + BootScene

**Files:**
- Replace: `src/main.js`
- Create: `src/scenes/BootScene.js`

- [ ] **Step 1: Replace `src/main.js`**

```js
// src/main.js
import Phaser from 'phaser'
import BootScene     from './scenes/BootScene.js'
import GameScene     from './scenes/GameScene.js'
import UpgradeScene  from './scenes/UpgradeScene.js'

new Phaser.Game({
  type: Phaser.AUTO,
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, GameScene, UpgradeScene],
})
```

- [ ] **Step 2: Create `src/scenes/BootScene.js`**

```js
// src/scenes/BootScene.js
import Phaser from 'phaser'

const CHAR = 'assets/sprites/potemaru'

export default class BootScene extends Phaser.Scene {
  constructor() { super('BootScene') }

  preload() {
    const { width: W, height: H } = this.cameras.main

    // Progress bar
    const box  = this.add.graphics()
    const fill = this.add.graphics()
    box.fillStyle(0x333333).fillRect(W/2 - 160, H/2 - 20, 320, 40)

    this.load.on('progress', v => {
      fill.clear().fillStyle(0xffffff).fillRect(W/2 - 150, H/2 - 10, 300 * v, 20)
    })

    this.load.image('idle',   `${CHAR}/idle.png`)
    this.load.image('run',    `${CHAR}/run.png`)
    this.load.image('attack', `${CHAR}/attack.png`)
  }

  create() {
    this.scene.start('GameScene')
  }
}
```

- [ ] **Step 3: Stub GameScene so the boot doesn't crash**

`src/scenes/GameScene.js` currently has code that references `aura` and other things. Replace it with a minimal stub for now:

```js
// src/scenes/GameScene.js  (TEMPORARY STUB — will be replaced in Task 5)
import Phaser from 'phaser'

export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene') }
  create() {
    this.add.text(100, 100, 'GameScene stub', { color: '#fff' })
  }
}
```

Also add an UpgradeScene stub:

```js
// src/scenes/UpgradeScene.js  (TEMPORARY STUB — will be replaced in Task 6)
import Phaser from 'phaser'

export default class UpgradeScene extends Phaser.Scene {
  constructor() { super('UpgradeScene') }
  create() {}
}
```

- [ ] **Step 4: Manual test — `npm run dev`**

Open browser. Should see:
- White loading bar briefly
- Then "GameScene stub" text on dark background

- [ ] **Step 5: Commit**

```bash
git add src/main.js src/scenes/BootScene.js src/scenes/GameScene.js src/scenes/UpgradeScene.js
git commit -m "feat: BootScene asset loading, main.js with arcade physics"
```

---

## Task 3 — Player entity

**Files:**
- Create: `src/entities/Player.js`

The Player class owns its physics sprite, manual frame animation, WASD + touch input, HP, and stats. It does NOT own HUD graphics — those live in GameScene.

- [ ] **Step 1: Create `src/entities/Player.js`**

```js
// src/entities/Player.js
import { CFG } from '../config.js'

const CHAR_H  = 120   // display height px
const ATK_FPS = 24
const RUN_FPS = 24
const IDL_FPS = 12

export default class Player {
  constructor(scene, x, y) {
    this.scene  = scene
    // Stats (mutable by upgrades)
    this.speed            = CFG.PLAYER_SPEED
    this.damage           = CFG.PLAYER_DAMAGE
    this.fireRate         = CFG.PLAYER_FIRE_RATE
    this.projectileCount  = CFG.PLAYER_PROJECTILE_COUNT
    this.maxHp            = CFG.PLAYER_HP_MAX
    this.hp               = this.maxHp

    // Slice frames into each texture
    _sliceSheet(scene, 'idle',   6, 6)
    _sliceSheet(scene, 'run',    6, 6)
    _sliceSheet(scene, 'attack', 6, 6)

    // Precompute display widths (aspect-correct per sheet)
    this._dW = {
      idle:   _frameAspectW(scene, 'idle',   CHAR_H),
      run:    _frameAspectW(scene, 'run',    CHAR_H),
      attack: _frameAspectW(scene, 'attack', CHAR_H),
    }

    // Physics sprite
    this.sprite = scene.physics.add.sprite(x, y, 'idle', 0)
      .setDisplaySize(this._dW.idle, CHAR_H)
      .setCollideWorldBounds(true)
    this.sprite.body.setSize(40, 60)   // hitbox smaller than visual

    // Keyboard
    this._keys = scene.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT')

    // Touch joystick
    this._touch   = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 }
    this._joyBase = scene.add.circle(0, 0, 55, 0x000000, 0.15).setDepth(100).setVisible(false)
    this._joyKnob = scene.add.circle(0, 0, 28, 0x000000, 0.30).setDepth(101).setVisible(false)
    scene.input.on('pointerdown',  p  => this._onDown(p))
    scene.input.on('pointermove',  p  => this._onMove(p))
    scene.input.on('pointerup',    ()  => this._onUp())

    // Animation state
    this._state          = 'idle'
    this._frame          = { idle: 0, run: 0, attack: 0 }
    this._timer          = { idle: 0, run: 0, attack: 0 }
    this._attacking      = false
    this._attackElapsed  = 0   // raw ms since last startAttack() — not modulo'd
    this._dead           = false
  }

  // ── Public ────────────────────────────────────────────────────────────────

  get x() { return this.sprite.x }
  get y() { return this.sprite.y }

  update(delta) {
    if (this._dead) return
    this._move(delta)
    this._animateTick(delta)
  }

  startAttack() {
    if (this._attacking) return
    this._attacking      = true
    this._frame.attack   = 0
    this._timer.attack   = 0
    this._attackElapsed  = 0   // raw ms accumulator (not modulo'd)
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount)
    if (this.hp <= 0 && !this._dead) {
      this._dead = true
      this.scene.events.emit('player-dead')
    }
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount)
  }

  applyUpgrade(id) {
    switch (id) {
      case 'dmg':       this.damage          *= 1.20; break
      case 'firerate':  this.fireRate         *= 0.75; break
      case 'multishot': this.projectileCount += 1;    break
      case 'speed':     this.speed            *= 1.15; break
      case 'maxhp':     this.maxHp *= 1.20; this.heal(this.maxHp); break
      case 'regen':
        this.scene.time.addEvent({
          delay: 5000, loop: true,
          callback: () => this.heal(1),
        })
        break
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _move(delta) {
    const k  = this._keys
    let vx = 0, vy = 0
    if (k.A.isDown || k.LEFT.isDown)  vx -= 1
    if (k.D.isDown || k.RIGHT.isDown) vx += 1
    if (k.W.isDown || k.UP.isDown)    vy -= 1
    if (k.S.isDown || k.DOWN.isDown)  vy += 1
    if (this._touch.active) { vx += this._touch.dx; vy += this._touch.dy }

    const len = Math.hypot(vx, vy)
    if (len > 1) { vx /= len; vy /= len }

    this.sprite.setVelocity(vx * this.speed, vy * this.speed)

    if      (vx >  0.05) this.sprite.setFlipX(false)
    else if (vx < -0.05) this.sprite.setFlipX(true)

    const moving = len > 0.1
    if (!this._attacking) this._state = moving ? 'run' : 'idle'
  }

  _animateTick(delta) {
    let key, fps, count

    if (this._attacking) {
      key = 'attack'; fps = ATK_FPS; count = 36
    } else if (this._state === 'run') {
      key = 'run';    fps = RUN_FPS; count = 36
    } else {
      key = 'idle';   fps = IDL_FPS; count = 9
    }

    this._timer[key] += delta
    const interval = 1000 / fps
    while (this._timer[key] >= interval) {
      this._timer[key] -= interval
      this._frame[key]  = (this._frame[key] + 1) % count
    }

    // Attack completion: use raw accumulator (never modulo'd) so the threshold is reachable.
    // _frame.attack loops via % 36, so elapsed-from-frame would always be < 36 intervals.
    if (this._attacking) {
      this._attackElapsed += delta
      if (this._attackElapsed >= 36 * (1000 / ATK_FPS)) this._attacking = false
    }

    this.sprite
      .setTexture(key, this._frame[key])
      .setDisplaySize(this._dW[key], CHAR_H)
  }

  _onDown(p) {
    this._touch.active = true
    this._touch.startX = p.x; this._touch.startY = p.y
    this._touch.dx = 0; this._touch.dy = 0
    this._joyBase.setPosition(p.x, p.y).setVisible(true)
    this._joyKnob.setPosition(p.x, p.y).setVisible(true)
  }

  _onMove(p) {
    if (!this._touch.active) return
    const dx   = p.x - this._touch.startX
    const dy   = p.y - this._touch.startY
    const dist = Math.hypot(dx, dy)
    const maxR = 55, ratio = dist > maxR ? maxR / dist : 1
    this._touch.dx = (dx / maxR) * ratio
    this._touch.dy = (dy / maxR) * ratio
    this._joyKnob.setPosition(this._touch.startX + dx * ratio, this._touch.startY + dy * ratio)
  }

  _onUp() {
    this._touch.active = false; this._touch.dx = 0; this._touch.dy = 0
    this._joyBase.setVisible(false); this._joyKnob.setVisible(false)
  }
}

// ── Module-level helpers (no Phaser dependency for pure math) ─────────────

function _sliceSheet(scene, key, cols, rows) {
  const tex = scene.textures.get(key)
  if (tex.has(0)) return            // already sliced
  const src = tex.source[0]
  const fw  = Math.floor(src.width  / cols)
  const fh  = Math.floor(src.height / rows)
  let idx = 0
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      tex.add(idx++, 0, c * fw, r * fh, fw, fh)
}

function _frameAspectW(scene, key, h) {
  const f = scene.textures.get(key).frames.__BASE
  // after slicing, frame 0 has the right dimensions
  const frame0 = scene.textures.get(key).frames[0]
  if (!frame0) return h
  return Math.round(h * frame0.realWidth / frame0.realHeight)
}
```

> **Note:** Attack completion uses `_attackElapsed`, a raw ms accumulator that is **never** modulo'd. This avoids the pitfall where `_frame.attack % 36` resets to 0, making the threshold unreachable from `frame * interval + timer`. Once `_attackElapsed >= 36 * (1000/ATK_FPS)` (≈ 1500 ms), `_attacking` resets and the next tick returns to idle/run.

- [ ] **Step 2: Wire Player into GameScene stub to verify it doesn't crash**

Update `src/scenes/GameScene.js`:

```js
// src/scenes/GameScene.js  (TEMPORARY — will be fully replaced in Task 5)
import Phaser from 'phaser'
import Player from '../entities/Player.js'
import { CFG } from '../config.js'

export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene') }

  create() {
    this.physics.world.setBounds(0, 0, CFG.WORLD_WIDTH, CFG.WORLD_HEIGHT)
    this.cameras.main.setBounds(0, 0, CFG.WORLD_WIDTH, CFG.WORLD_HEIGHT)

    this._player = new Player(this, CFG.WORLD_WIDTH / 2, CFG.WORLD_HEIGHT / 2)
    this.cameras.main.startFollow(this._player.sprite, true, 0.1, 0.1)
  }

  update(_, delta) {
    this._player.update(delta)
  }
}
```

- [ ] **Step 3: Manual test — `npm run dev`**

Should see:
- Cat samurai sprite centered on dark background
- WASD moves it (idle/run animation switches)
- Sprite flips left/right correctly
- Cannot leave world bounds
- Touch joystick appears on mobile / when dragging

- [ ] **Step 4: Commit**

```bash
git add src/entities/Player.js src/scenes/GameScene.js
git commit -m "feat: Player entity — physics sprite, animation, WASD + touch input"
```

---

## Task 4 — Enemy entity + spawning

**Files:**
- Create: `src/entities/Enemy.js`
- Modify: `src/scenes/GameScene.js`

- [ ] **Step 1: Create `src/entities/Enemy.js`**

```js
// src/entities/Enemy.js
import { CFG } from '../config.js'

export default class Enemy {
  /**
   * Call once per scene to register the 'enemy-tex' texture.
   * Must be called in GameScene.create() before creating the group.
   */
  static createTexture(scene) {
    if (scene.textures.exists('enemy-tex')) return
    const rt = scene.add.renderTexture(0, 0, 40, 40)
    rt.fill(0xcc2222)
    const lbl = scene.add.text(0, 0, '鬼', {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
    })
    rt.draw(lbl, 8, 8)
    rt.saveTexture('enemy-tex')
    lbl.destroy()
    rt.destroy()
  }

  /**
   * Activate a pooled enemy at position (x, y).
   * Call from GameScene when getting an enemy from the group.
   */
  static activate(sprite, x, y) {
    sprite.enableBody(true, x, y, true, true)
    sprite.hp         = CFG.ENEMY_HP
    sprite.damageCd   = 0     // cooldown timer ms
  }

  /**
   * Per-frame update. Call in GameScene.update() for each active enemy.
   */
  static update(sprite, player, delta) {
    if (!sprite.active) return
    sprite.scene.physics.moveToObject(sprite, player.sprite, CFG.ENEMY_SPEED)
    if (sprite.damageCd > 0) sprite.damageCd -= delta
  }

  /**
   * Reduce enemy HP. Returns true if enemy died.
   */
  static takeDamage(sprite, amount) {
    sprite.hp -= amount
    if (sprite.hp <= 0) {
      const { x, y } = sprite
      sprite.disableBody(true, true)
      sprite.scene.events.emit('enemy-died', { x, y })
      return true
    }
    return false
  }

  /**
   * Deal contact damage to player (with cooldown).
   */
  static dealDamage(sprite, player) {
    if (sprite.damageCd > 0) return
    player.takeDamage(CFG.ENEMY_DAMAGE)
    sprite.damageCd = 1000   // 1 second cooldown
  }
}
```

- [ ] **Step 2: Update `src/scenes/GameScene.js` — add enemy group + spawn**

```js
// src/scenes/GameScene.js  (add enemy system)
import Phaser from 'phaser'
import Player from '../entities/Player.js'
import Enemy  from '../entities/Enemy.js'
import { CFG, randomEdgePoint } from '../config.js'

export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene') }

  create() {
    this.physics.world.setBounds(0, 0, CFG.WORLD_WIDTH, CFG.WORLD_HEIGHT)
    this.cameras.main.setBounds(0, 0, CFG.WORLD_WIDTH, CFG.WORLD_HEIGHT)

    this._player = new Player(this, CFG.WORLD_WIDTH / 2, CFG.WORLD_HEIGHT / 2)
    this.cameras.main.startFollow(this._player.sprite, true, 0.1, 0.1)

    Enemy.createTexture(this)
    this._enemies = this.physics.add.group()

    // Enemy overlaps player → deal damage
    this.physics.add.overlap(
      this._player.sprite,
      this._enemies,
      (_, enemy) => Enemy.dealDamage(enemy, this._player)
    )

    // Spawn timer
    this._level = 1
    this.time.addEvent({
      delay: CFG.ENEMY_SPAWN_INTERVAL,
      loop: true,
      callback: this._spawnWave,
      callbackScope: this,
    })

    this.events.on('player-dead', this._onPlayerDead, this)
  }

  update(_, delta) {
    this._player.update(delta)
    this._enemies.getChildren().forEach(e => Enemy.update(e, this._player, delta))
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
```

- [ ] **Step 3: Manual test — `npm run dev`**

Should see:
- Red 鬼 enemies spawning from arena edges every 2 s
- Enemies chase the player
- Player HP decreases on contact (verify in browser console: add `console.log(this._player.hp)` in update temporarily)
- On HP = 0, "死" appears with restart prompt

- [ ] **Step 4: Commit**

```bash
git add src/entities/Enemy.js src/scenes/GameScene.js
git commit -m "feat: Enemy entity, spawn timer, player-enemy overlap damage, game over"
```

---

## Task 5 — Shuriken weapon system

**Files:**
- Create: `src/entities/Shuriken.js`
- Modify: `src/scenes/GameScene.js`

- [ ] **Step 1: Create `src/entities/Shuriken.js`**

```js
// src/entities/Shuriken.js
const SPEED = 400
const SIZE  = 12

export default class Shuriken {
  static createTexture(scene) {
    if (scene.textures.exists('shuriken-tex')) return
    const rt = scene.add.renderTexture(0, 0, SIZE, SIZE)
    rt.fill(0x222244)
    rt.saveTexture('shuriken-tex')
    rt.destroy()
  }

  /**
   * Fire `count` shurikens from (fromX, fromY) toward the `count` nearest enemies.
   * @param {Phaser.GameObjects.Group} pool  - physics group of shurikens
   * @param {number} fromX
   * @param {number} fromY
   * @param {Phaser.GameObjects.Group} enemies
   * @param {number} count     - player.projectileCount
   * @param {number} damage    - player.damage
   */
  static fire(scene, pool, fromX, fromY, enemies, count, damage) {
    const targets = Shuriken._nearestEnemies(enemies, fromX, fromY, count)
    targets.forEach(target => {
      let s = pool.getFirstDead(false)
      if (!s) {
        s = pool.create(fromX, fromY, 'shuriken-tex')
        s.setDepth(8)
        s.body.onWorldBounds = true
      }
      s.enableBody(true, fromX, fromY, true, true)
      s.damage = damage
      s.hitSet = new Set()  // enemies already hit by this shuriken

      const angle = Phaser.Math.Angle.Between(fromX, fromY, target.x, target.y)
      scene.physics.velocityFromAngle(
        Phaser.Math.RadToDeg(angle), SPEED, s.body.velocity
      )
    })
  }

  static update(sprite) {
    if (!sprite.active) return
    sprite.angle += 8
  }

  static _nearestEnemies(enemies, x, y, count) {
    return enemies
      .getChildren()
      .filter(e => e.active)
      .sort((a, b) =>
        Phaser.Math.Distance.Between(x, y, a.x, a.y) -
        Phaser.Math.Distance.Between(x, y, b.x, b.y)
      )
      .slice(0, count)
  }
}
```

- [ ] **Step 2: Update `src/scenes/GameScene.js` — add shuriken firing + overlap**

Add to imports:
```js
import Shuriken from '../entities/Shuriken.js'
```

In `create()`, after enemy group creation:
```js
    Shuriken.createTexture(this)
    this._shurikens = this.physics.add.group({ maxSize: 40 })

    // Shuriken hits enemy
    this.physics.add.overlap(
      this._shurikens,
      this._enemies,
      (shuriken, enemy) => {
        if (shuriken.hitSet.has(enemy)) return
        shuriken.hitSet.add(enemy)
        const died = Enemy.takeDamage(enemy, shuriken.damage)
        shuriken.disableBody(true, true)
      }
    )

    // Deactivate shurikens that leave world bounds
    this.physics.world.on('worldbounds', (body) => {
      if (body.gameObject && this._shurikens.contains(body.gameObject)) {
        body.gameObject.disableBody(true, true)
      }
    })

    // Fire timer
    this._fireTimer = 0
```

In `update(_, delta)`:
```js
    // Shuriken auto-fire
    this._fireTimer += delta
    if (this._fireTimer >= this._player.fireRate) {
      this._fireTimer = 0
      const enemies = this._enemies
      if (enemies.countActive() > 0) {
        this._player.startAttack()
        Shuriken.fire(
          this,
          this._shurikens,
          this._player.x,
          this._player.y,
          enemies,
          this._player.projectileCount,
          this._player.damage
        )
      }
    }
    this._shurikens.getChildren().forEach(s => Shuriken.update(s))
```

- [ ] **Step 3: Manual test — `npm run dev`**

Should see:
- Dark squares firing from player toward nearest enemy
- Shurikens rotate while flying
- Enemies disappear when hit
- Attack animation plays on player when firing

- [ ] **Step 4: Commit**

```bash
git add src/entities/Shuriken.js src/scenes/GameScene.js
git commit -m "feat: Shuriken weapon — pooled projectiles, auto-target nearest enemy"
```

---

## Task 6 — XP, levels, and UpgradeScene

**Files:**
- Modify: `src/scenes/GameScene.js` — XP tracking, orb tween, level-up trigger
- Replace: `src/scenes/UpgradeScene.js` — upgrade overlay

- [ ] **Step 1: Add XP system to `src/scenes/GameScene.js`**

Add to `create()` — **replace** the `this._level = 1` line already present from Task 4:
```js
    this._xp       = 0
    this._level    = 1          // replaces the _level = 1 added in Task 4
    this._xpToNext = xpThreshold(this._level)

    this.events.on('enemy-died', ({ x, y }) => this._spawnOrb(x, y))
    // NOTE: do NOT add events.once('upgrade-chosen') here.
    // The listener is registered inside _addXp() each time a level-up occurs.
    this._upgrading = false
```

Add methods to `GameScene`:
```js
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
```

Add to imports (top of file):
```js
import Phaser from 'phaser'
import { CFG, randomEdgePoint, xpThreshold, UPGRADES } from '../config.js'
```

- [ ] **Step 2: Create `src/scenes/UpgradeScene.js`**

```js
// src/scenes/UpgradeScene.js
import Phaser from 'phaser'

export default class UpgradeScene extends Phaser.Scene {
  constructor() { super('UpgradeScene') }

  init(data) {
    this._level    = data.level
    this._upgrades = data.upgrades   // array of 3 upgrade objects
  }

  create() {
    const { width: W, height: H } = this.cameras.main

    // Semi-transparent overlay
    this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.7)

    this.add.text(W/2, H * 0.15, `Level ${this._level}!`, {
      fontSize: '36px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0.5)

    this.add.text(W/2, H * 0.25, '選擇強化', {
      fontSize: '20px', color: '#cccccc',
    }).setOrigin(0.5)

    const cardW = Math.min(200, W * 0.28)
    const cardH = 140
    const spacing = cardW + 20
    const startX  = W/2 - spacing

    this._upgrades.forEach((upg, i) => {
      const cx = startX + i * spacing
      const cy = H / 2

      const bg = this.add.rectangle(cx, cy, cardW, cardH, 0x1a1a3e)
        .setStrokeStyle(2, 0x6666cc)
        .setInteractive()

      this.add.text(cx, cy - 30, upg.name, {
        fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5)

      this.add.text(cx, cy + 10, upg.desc, {
        fontSize: '13px', color: '#aaaaaa', wordWrap: { width: cardW - 20 },
      }).setOrigin(0.5)

      bg.on('pointerover',  () => bg.setFillColor(0x2a2a5e))
      bg.on('pointerout',   () => bg.setFillColor(0x1a1a3e))
      bg.on('pointerdown',  () => this._choose(upg.id))
    })
  }

  _choose(id) {
    this.scene.get('GameScene').events.emit('upgrade-chosen', id)
    this.scene.stop()
  }
}
```

- [ ] **Step 3: Manual test — `npm run dev`**

Should see:
- Yellow orbs flying toward player on enemy death
- After enough kills, upgrade overlay appears
- Clicking a card resumes the game
- Stats change (verify fire rate by watching shuriken frequency)

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.js src/scenes/UpgradeScene.js
git commit -m "feat: XP orbs, level-up, UpgradeScene overlay with 3-choice cards"
```

---

## Task 7 — HUD + polish

**Files:**
- Modify: `src/scenes/GameScene.js` — add HUD graphics, timer, cleanup

- [ ] **Step 1: Add HUD to `GameScene.create()`**

```js
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
```

- [ ] **Step 2: Add `_drawHud()` and call it each frame**

```js
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
```

In `update(_, delta)`:
```js
    this._elapsed += delta
    this._hudTimer.setText(`${Math.floor(this._elapsed / 1000)}s`)
    this._drawHud()
```

- [ ] **Step 3: Adjust camera to follow with world bounds background**

In `create()`, after world bounds setup:
```js
    // Tiled-looking background (simple grid)
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
```

- [ ] **Step 4: Manual test — `npm run dev` full playthrough**

Verify all success criteria:
- [ ] 1. Player moves in 4 directions (keyboard + touch), animates
- [ ] 2. Attack animation plays on fire without stopping movement
- [ ] 3. Shurikens auto-fire toward nearest enemy; multishot upgrade adds more
- [ ] 4. Enemies spawn from edges and chase player
- [ ] 5. XP orbs spawn on death and tween to player
- [ ] 6. Level-up opens UpgradeScene; selection correctly mutates stats
- [ ] 7. HP depletion triggers game-over with restart
- [ ] 8. HP bar, XP bar, level, timer visible in HUD
- [ ] 9. All numeric constants in `config.js`

- [ ] **Step 5: Run unit tests — confirm still passing**

```bash
npm test -- --run
```

Expected: 8 tests pass.

- [ ] **Step 6: Final commit**

```bash
git add src/scenes/GameScene.js
git commit -m "feat: HUD (HP/XP bars, level, timer) + grid background"
```

---

## Completion Checklist

- [ ] All 8 unit tests pass (`npm test -- --run`)
- [ ] Game runs without console errors (`npm run dev`)
- [ ] All 9 success criteria verified (Task 7 Step 4)
- [ ] No file exceeds 150 lines
- [ ] All numeric constants live in `src/config.js`

---

## Notes for Implementer

1. **`_sliceSheet` guard:** The function checks `if (tex.has(0)) return` to prevent double-slicing if Player is created twice (e.g. after scene restart). Keep this guard.

2. **`physics.add.overlap` vs collider:** Use `overlap` (not `collider`) for shuriken-enemy and player-enemy interactions — we want them to pass through, not bounce.

3. **UpgradeScene `events.once` re-registration:** `_addXp` uses `events.once` each time to register the handler. This is intentional — `once` automatically removes itself, so there's no double-registration risk.

4. **`Phaser.Utils.Array.Shuffle`:** Mutates the array. Always pass a `.slice()` copy of `UPGRADES` to avoid shuffling the source array.

5. **Touch input during UpgradeScene:** When GameScene is paused, `pointerdown` events on the joystick still fire because they're registered on `scene.input` (not the game). The UpgradeScene cards intercept touch correctly because they're in a separate scene running on top. No special handling needed.
