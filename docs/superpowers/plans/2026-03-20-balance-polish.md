# Balance & Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six targeted balance improvements — orb lifetime, upgrade caps, 乱射 enhancement, sustain redesign, upgrade naming, and projectile size upgrades.

**Architecture:** All changes are isolated to their respective files with no new shared infrastructure. Orb expiry uses the existing `_orbs` update loop. Regen uses a scene-level flag+timer pattern already established by crit bonuses. Weapon size uses a `_scale` stat following the `_explodeRadius` pattern in Homura.

**Tech Stack:** Phaser 3.60, ES modules, Vite, Vitest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/scenes/GameScene.js` | Modify | Orb lifetime logic; regen update + listener; 乱射 range effect in `_applyMechanical` |
| `src/entities/Player.js` | Modify | Emit `player-hit` event in `takeDamage()` |
| `src/config.js` | Modify | Replace `regen` entry with `武者の気` |
| `src/affixes/index.js` | Modify | Update `乱射` desc |
| `src/weapons/Tachi.js` | Modify | Caps + rename upgrades |
| `src/weapons/Ogi.js` | Modify | Caps + rename upgrades |
| `src/weapons/Kunai.js` | Modify | Caps + rename + `_scale` stat + size upgrade |
| `src/weapons/Shuriken.js` | Modify | Caps + rename + `_scale` stat + size upgrade |
| `src/weapons/Homura.js` | Modify | Caps + rename upgrades |
| `src/weapons/Ofuda.js` | Modify | Cap + rename upgrades |
| `src/weapons/Kusarigama.js` | Modify | Cap + rename upgrades |
| `tests/logic.test.js` | Modify | Update PLAYER_UPGRADES test; add cap + regen shape tests |

---

### Task 1: XP Orb (武魂) Lifetime — 12s expiry + warning flash

**Files:**
- Modify: `src/scenes/GameScene.js`

- [ ] **Step 1: Add spawn timestamp in `_spawnOrb()`**

In `src/scenes/GameScene.js`, find `_spawnOrb(ex, ey)`. After `this._orbs.push(orb)`, add:

```js
orb._spawnTime = this.time.now
```

- [ ] **Step 2: Add expiry + warning logic to orb update loop**

In `GameScene.update()`, find the orb update loop that starts with:
```js
for (let i = this._orbs.length - 1; i >= 0; i--) {
  const orb  = this._orbs[i]
  const dist = Phaser.Math.Distance.Between(px, py, orb.x, orb.y)
```

Add the following block immediately after `const dist = ...` and before the collect radius check:

```js
      // Orb lifetime — exempt attracted orbs (already flying toward player)
      if (!orb._attracted) {
        const elapsed = this.time.now - orb._spawnTime
        if (elapsed >= 12000) {
          // Expire: destroy emitter + fade out + remove
          if (orb._emitter) orb._emitter.destroy()
          this.tweens.add({
            targets: orb, alpha: 0, duration: 300, ease: 'Linear',
            onComplete: () => orb.destroy(),
          })
          this.tweens.killTweensOf(orb)
          this._orbs.splice(i, 1)
          continue
        }
        // Warning flash: last 3 seconds — alpha oscillates faster as time runs out
        if (elapsed >= 9000) {
          const remaining = 12000 - elapsed         // 3000 → 0
          const freq = Phaser.Math.Linear(200, 80, 1 - remaining / 3000)
          if (!orb._warnTween || orb._warnTween.totalElapsed % freq < 16) {
            this.tweens.killTweensOf(orb)
            orb._warnTween = this.tweens.add({
              targets: orb, alpha: { from: 0.2, to: 1.0 },
              yoyo: true, repeat: -1, duration: freq, ease: 'Linear',
            })
          }
        }
      }
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```

Expected: all tests pass (no changes to logic.test.js).

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "feat: XP orbs expire after 12s with warning flash"
```

---

### Task 2: Weapon Upgrade Caps + Rename All Upgrades

**Files:**
- Modify: `src/weapons/Tachi.js`
- Modify: `src/weapons/Ogi.js`
- Modify: `src/weapons/Homura.js`
- Modify: `src/weapons/Ofuda.js`
- Modify: `src/weapons/Kusarigama.js`
- Modify: `tests/logic.test.js`

This task covers caps and renames for all weapons **except** Kunai and Shuriken (handled in Task 5 alongside their `_scale` upgrade).

- [ ] **Step 1: Write cap tests**

In `tests/logic.test.js`, add after the existing `PLAYER_UPGRADES` describe block:

```js
import Tachi       from '../src/weapons/Tachi.js'
import Ogi         from '../src/weapons/Ogi.js'
import Homura      from '../src/weapons/Homura.js'
import Ofuda       from '../src/weapons/Ofuda.js'
import Kusarigama  from '../src/weapons/Kusarigama.js'

describe('weapon upgrade caps', () => {
  it('Tachi fireRate never drops below 200ms', () => {
    const s = { ...Tachi.baseStats }
    for (let i = 0; i < 20; i++) Tachi.upgrades.find(u => u.id === 'firerate').apply(s)
    expect(s.fireRate).toBeGreaterThanOrEqual(200)
  })
  it('Tachi range capped at 2× base', () => {
    const s = { ...Tachi.baseStats }
    for (let i = 0; i < 20; i++) Tachi.upgrades.find(u => u.id === 'range').apply(s)
    expect(s.range).toBeLessThanOrEqual(Tachi.baseStats.range * 2)
  })
  it('Ogi fireRate never drops below 200ms', () => {
    const s = { ...Ogi.baseStats }
    for (let i = 0; i < 20; i++) Ogi.upgrades.find(u => u.id === 'speed').apply(s)
    expect(s.fireRate).toBeGreaterThanOrEqual(200)
  })
  it('Ogi range capped at 2× base', () => {
    const s = { ...Ogi.baseStats }
    for (let i = 0; i < 20; i++) Ogi.upgrades.find(u => u.id === 'range').apply(s)
    expect(s.range).toBeLessThanOrEqual(Ogi.baseStats.range * 2)
  })
  it('Homura projectileCount capped at 5', () => {
    const s = { ...Homura.baseStats }
    for (let i = 0; i < 20; i++) Homura.upgrades.find(u => u.id === 'multi').apply(s)
    expect(s.projectileCount).toBeLessThanOrEqual(5)
  })
  it('Homura _explodeRadius capped at base + 60', () => {
    const s = { ...Homura.baseStats }
    for (let i = 0; i < 20; i++) Homura.upgrades.find(u => u.id === 'radius').apply(s)
    expect(s._explodeRadius).toBeLessThanOrEqual(Homura.baseStats._explodeRadius + 60)
  })
  it('Ofuda projectileCount capped at 5', () => {
    const s = { ...Ofuda.baseStats }
    for (let i = 0; i < 20; i++) Ofuda.upgrades.find(u => u.id === 'multi').apply(s)
    expect(s.projectileCount).toBeLessThanOrEqual(5)
  })
  it('Kusarigama sickleCount capped at 4', () => {
    const s = { ...Kusarigama.baseStats }
    for (let i = 0; i < 20; i++) Kusarigama.upgrades.find(u => u.id === 'sickle').apply(s)
    expect(s.sickleCount).toBeLessThanOrEqual(4)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run
```

Expected: cap tests fail because no caps exist yet.

- [ ] **Step 3: Update `Tachi.js` — caps + rename**

Replace the entire `upgrades` array in `src/weapons/Tachi.js`:

```js
upgrades: [
  { id: 'dmg',      name: '太刀 傷害 +25%',    desc: '', apply: s => { s.damage   *= 1.25 } },
  { id: 'firerate', name: '太刀 攻擊速度 +20%', desc: '', apply: s => { s.fireRate  = Math.max(200, s.fireRate * 0.80) } },
  { id: 'range',    name: '太刀 攻擊範圍 +30%', desc: '', apply: s => { s.range     = Math.min(Tachi.baseStats.range * 2, s.range * 1.30) } },
],
```

Since `Tachi.baseStats.range` is a self-reference, use the literal value `100` for the cap (Tachi base range is 50, ×2 = 100):

```js
  { id: 'range',    name: '太刀 攻擊範圍 +30%', desc: '', apply: s => { s.range = Math.min(100, s.range * 1.30) } },
```

- [ ] **Step 4: Update `Ogi.js` — caps + rename**

Replace `upgrades` in `src/weapons/Ogi.js` (Ogi base range is 90, ×2 = 180):

```js
upgrades: [
  { id: 'dmg',   name: '扇 傷害 +25%',    desc: '', apply: s => { s.damage   *= 1.25 } },
  { id: 'range', name: '扇 攻擊範圍 +20%', desc: '', apply: s => { s.range    = Math.min(180, s.range * 1.20) } },
  { id: 'speed', name: '扇 攻擊速度 +20%', desc: '', apply: s => { s.fireRate = Math.max(200, s.fireRate * 0.80) } },
],
```

- [ ] **Step 5: Update `Homura.js` — caps + rename**

Replace `upgrades` in `src/weapons/Homura.js` (base `_explodeRadius` is 80, cap = 80+60 = 140):

```js
upgrades: [
  { id: 'dmg',    name: '炎矢 傷害 +25%',    desc: '', apply: s => { s.damage          *= 1.25 } },
  { id: 'radius', name: '炎矢 爆炸範圍 +20px', desc: '', apply: s => { s._explodeRadius = Math.min(140, s._explodeRadius + 20) } },
  { id: 'multi',  name: '炎矢 投射數 +1',     desc: '', apply: s => { s.projectileCount = Math.min(5, s.projectileCount + 1) } },
],
```

- [ ] **Step 6: Update `Ofuda.js` — cap + rename**

Replace `upgrades` in `src/weapons/Ofuda.js`:

```js
upgrades: [
  { id: 'dmg',   name: '霊符 傷害 +25%',  desc: '', apply: s => { s.damage          *= 1.25 } },
  { id: 'speed', name: '霊符 追蹤速度 +30%', desc: '', apply: s => { s.speed          *= 1.30 } },
  { id: 'multi', name: '霊符 投射數 +1',   desc: '', apply: s => { s.projectileCount = Math.min(5, s.projectileCount + 1) } },
],
```

- [ ] **Step 7: Update `Kusarigama.js` — cap + rename**

Replace `upgrades` in `src/weapons/Kusarigama.js`:

```js
upgrades: [
  { id: 'dmg',    name: '鎖鎌 傷害 +25%', desc: '', apply: s => { s.damage      *= 1.25 } },
  { id: 'sickle', name: '鎖鎌 鎌刃 +1',   desc: '', apply: s => { s.sickleCount = Math.min(4, s.sickleCount + 1) } },
],
```

- [ ] **Step 8: Run tests — verify they pass**

```bash
npx vitest run
```

Expected: all tests pass including new cap tests.

- [ ] **Step 9: Commit**

```bash
git add src/weapons/Tachi.js src/weapons/Ogi.js src/weapons/Homura.js src/weapons/Ofuda.js src/weapons/Kusarigama.js tests/logic.test.js
git commit -m "feat: weapon upgrade caps + rename to explicit stat format"
```

---

### Task 3: 乱射 Enhancement — range +10% for projectile weapons

**Files:**
- Modify: `src/scenes/GameScene.js`
- Modify: `src/affixes/index.js`

- [ ] **Step 1: Update `_applyMechanical()` multishot branch**

In `src/scenes/GameScene.js`, find the `multishot` branch in `_applyMechanical()`:

```js
    if (mechanical.id === 'multishot') {
      for (const entry of this._weapons) {
        if (entry.stats.projectileCount !== undefined)
          entry.stats.projectileCount += 1
        else
          entry.stats.range = (entry.stats.range || 100) * 1.15
      }
```

Replace with:

```js
    if (mechanical.id === 'multishot') {
      for (const entry of this._weapons) {
        if (entry.stats.projectileCount !== undefined) {
          entry.stats.projectileCount = Math.min(5, entry.stats.projectileCount + 1)
          entry.stats.range = (entry.stats.range || 100) * 1.10
        } else {
          entry.stats.range = (entry.stats.range || 100) * 1.15
        }
      }
```

- [ ] **Step 2: Update 乱射 description in `src/affixes/index.js`**

Find:
```js
    desc: '所有武器：投射數+1（近戰：射程+15%）',
```

Replace with:
```js
    desc: '所有投射型武器：投射數+1、射程+10%（近戰：射程+15%）',
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.js src/affixes/index.js
git commit -m "feat: 乱射 grants projectile weapons +1 count and range +10%"
```

---

### Task 4: Sustain Redesign — 武者の気 (replace regen)

**Files:**
- Modify: `src/entities/Player.js`
- Modify: `src/config.js`
- Modify: `src/scenes/GameScene.js`
- Modify: `tests/logic.test.js`

- [ ] **Step 1: Write failing test for new regen shape**

In `tests/logic.test.js`, update the `PLAYER_UPGRADES` describe block:

```js
describe('PLAYER_UPGRADES', () => {
  it('has 6 entries', () => expect(PLAYER_UPGRADES).toHaveLength(6))
  it('all have id, name, desc', () => {
    PLAYER_UPGRADES.forEach(u => {
      expect(u.id).toBeTruthy()
      expect(u.name).toBeTruthy()
    })
  })
  it('regen upgrade is oneTime', () => {
    const regen = PLAYER_UPGRADES.find(u => u.id === 'regen')
    expect(regen).toBeDefined()
    expect(regen.oneTime).toBe(true)
  })
})
```

- [ ] **Step 2: Run test — verify regen oneTime fails**

```bash
npx vitest run
```

Expected: `regen upgrade is oneTime` fails because current regen has no `oneTime` field.

- [ ] **Step 3: Replace `regen` entry in `src/config.js`**

Find the existing regen entry:
```js
  { id: 'regen',  name: '忍の回復',  desc: '每5秒回復1 HP',
    apply: (player, scene) => {
      scene.time.addEvent({ delay: 5000, loop: true, callback: () => player.heal(1) })
    } },
```

Replace with:
```js
  { id: 'regen', name: '武者の気', desc: '未受傷4秒後每秒回復最大HP 1.5%', oneTime: true,
    apply: (player, scene) => {
      scene._regenActive = true
      scene._regenTimer  = 0
    } },
```

- [ ] **Step 4: Add `player-hit` emit to `Player.takeDamage()`**

In `src/entities/Player.js`, find `takeDamage(amount)` (around line 61). Add emit as the very first line of the method body:

```js
  takeDamage(amount) {
    this.scene.events.emit('player-hit')   // ← add this line
    this.hp = Math.max(0, this.hp - amount)
    // ... rest unchanged
```

- [ ] **Step 5: Wire regen in `GameScene`**

In `src/scenes/GameScene.js`, inside `create()`, find where other scene events are registered (around line 87 where `enemy-died` and `player-dead` listeners are):

```js
    this.events.on('player-hit', () => { this._regenTimer = 0 })
```

In `GameScene.update()`, add regen tick after the existing player movement/input block (find a line like `this._player.update(delta)` and add after it):

```js
    // 武者の気 regen — tick after combat logic
    if (this._regenActive && !this._player._dead) {
      this._regenTimer += delta
      if (this._regenTimer >= 4000) {
        this._player.heal(this._player.maxHp * 0.015 * delta / 1000)
      }
    }
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run
```

Expected: all tests pass including `regen upgrade is oneTime`.

- [ ] **Step 7: Commit**

```bash
git add src/entities/Player.js src/config.js src/scenes/GameScene.js tests/logic.test.js
git commit -m "feat: replace regen with 武者の気 — out-of-combat 1.5% maxHP/s regen"
```

---

### Task 5: Projectile Size Upgrades — Kunai + Shuriken caps, rename, _scale

**Files:**
- Modify: `src/weapons/Kunai.js`
- Modify: `src/weapons/Shuriken.js`
- Modify: `tests/logic.test.js`

- [ ] **Step 1: Write cap + scale tests**

In `tests/logic.test.js`, add to the `weapon upgrade caps` describe block:

```js
  import Kunai    from '../src/weapons/Kunai.js'
  import Shuriken from '../src/weapons/Shuriken.js'
  // (add inside the describe block)
  it('Kunai fireRate never drops below 200ms', () => {
    const s = { ...Kunai.baseStats }
    for (let i = 0; i < 20; i++) Kunai.upgrades.find(u => u.id === 'firerate').apply(s)
    expect(s.fireRate).toBeGreaterThanOrEqual(200)
  })
  it('Kunai projectileCount capped at 5', () => {
    const s = { ...Kunai.baseStats }
    for (let i = 0; i < 20; i++) Kunai.upgrades.find(u => u.id === 'multishot').apply(s)
    expect(s.projectileCount).toBeLessThanOrEqual(5)
  })
  it('Kunai _scale capped at 2.0', () => {
    const s = { ...Kunai.baseStats }
    for (let i = 0; i < 20; i++) Kunai.upgrades.find(u => u.id === 'scale').apply(s)
    expect(s._scale).toBeLessThanOrEqual(2.0)
  })
  it('Shuriken fireRate never drops below 200ms', () => {
    const s = { ...Shuriken.baseStats }
    for (let i = 0; i < 20; i++) Shuriken.upgrades.find(u => u.id === 'firerate').apply(s)
    expect(s.fireRate).toBeGreaterThanOrEqual(200)
  })
  it('Shuriken projectileCount capped at 5', () => {
    const s = { ...Shuriken.baseStats }
    for (let i = 0; i < 20; i++) Shuriken.upgrades.find(u => u.id === 'multishot').apply(s)
    expect(s.projectileCount).toBeLessThanOrEqual(5)
  })
  it('Shuriken _scale capped at 2.0', () => {
    const s = { ...Shuriken.baseStats }
    for (let i = 0; i < 20; i++) Shuriken.upgrades.find(u => u.id === 'scale').apply(s)
    expect(s._scale).toBeLessThanOrEqual(2.0)
  })
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run
```

Expected: new scale/cap tests fail.

- [ ] **Step 3: Rewrite `Kunai.js`**

Replace `baseStats` (add `_scale: 1.0`, keep existing fields, **remove** `range`):

```js
  baseStats: {
    damage: 8,
    fireRate: 350,
    projectileCount: 1,
    speed: 600,
    penetrate: false,
    _scale: 1.0,
  },
```

Replace `upgrades`:

```js
  upgrades: [
    { id: 'dmg',       name: '苦無 傷害 +25%',    desc: '', apply: s => { s.damage         *= 1.25 } },
    { id: 'firerate',  name: '苦無 攻擊速度 +20%', desc: '', apply: s => { s.fireRate        = Math.max(200, s.fireRate * 0.80) } },
    { id: 'multishot', name: '苦無 投射數 +1',     desc: '', apply: s => { s.projectileCount = Math.min(5, s.projectileCount + 1) } },
    { id: 'penetrate', name: '苦無 貫穿',          desc: '', apply: s => { s.penetrate = true } },
    { id: 'scale',     name: '苦無 體積 +30%',     desc: '', apply: s => { s._scale = Math.min(2.0, s._scale * 1.30) } },
  ],
```

In `fire()`, update the projectile setup. Find the block that sets `s.damage`, `s.hitSet`, etc. and add display size + physics resize. The base Kunai size is 4×14px:

```js
    targets.forEach(target => {
      const s = getOrCreate(pool, fromX, fromY, this.texKey)
      const baseW = 4, baseH = 14
      s.setDisplaySize(baseW * stats._scale, baseH * stats._scale)
      s.body.setSize(baseW * stats._scale, baseH * stats._scale)
      s.damage    = stats.damage
      s.hitSet    = new Set()
      s.spawnX    = fromX
      s.spawnY    = fromY
      s.range     = 500            // fixed travel range (no longer upgradeable)
      s.penetrate = stats.penetrate

      const angle = Phaser.Math.Angle.Between(fromX, fromY, target.x, target.y)
      scene.physics.velocityFromAngle(
        Phaser.Math.RadToDeg(angle), stats.speed, s.body.velocity
      )
    })
```

- [ ] **Step 4: Rewrite `Shuriken.js`**

Replace `baseStats` (add `_scale: 1.0`, remove `range`):

```js
  baseStats: {
    damage: 10,
    fireRate: 800,
    projectileCount: 3,
    speed: 400,
    penetrate: false,
    _scale: 1.0,
  },
```

Replace `upgrades`:

```js
  upgrades: [
    { id: 'dmg',       name: '手裏剣 傷害 +20%',    desc: '', apply: s => { s.damage         *= 1.20 } },
    { id: 'firerate',  name: '手裏剣 攻擊速度 +25%', desc: '', apply: s => { s.fireRate        = Math.max(200, s.fireRate * 0.75) } },
    { id: 'multishot', name: '手裏剣 投射數 +1',     desc: '', apply: s => { s.projectileCount = Math.min(5, s.projectileCount + 1) } },
    { id: 'scale',     name: '手裏剣 體積 +30%',     desc: '', apply: s => { s._scale = Math.min(2.0, s._scale * 1.30) } },
  ],
```

In `fire()`, update projectile setup. The base Shuriken size is 12×12px:

```js
  fire(scene, pool, fromX, fromY, stats /*, enemies unused */) {
    for (let i = 0; i < stats.projectileCount; i++) {
      const s = getOrCreate(pool, fromX, fromY, this.texKey)
      const baseW = 12, baseH = 12
      s.setDisplaySize(baseW * stats._scale, baseH * stats._scale)
      s.body.setSize(baseW * stats._scale, baseH * stats._scale)
      s.damage    = stats.damage
      s.hitSet    = new Set()
      s.spawnX    = fromX
      s.spawnY    = fromY
      s.range     = 300            // fixed travel range
      s.penetrate = stats.penetrate

      const deg = (360 / stats.projectileCount) * i
      scene.physics.velocityFromAngle(deg, stats.speed, s.body.velocity)
    }
  },
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run
```

Expected: all tests pass including new Kunai/Shuriken cap and scale tests.

- [ ] **Step 6: Commit**

```bash
git add src/weapons/Kunai.js src/weapons/Shuriken.js tests/logic.test.js
git commit -m "feat: Kunai/Shuriken body-size upgrade replaces range; caps + rename"
```
