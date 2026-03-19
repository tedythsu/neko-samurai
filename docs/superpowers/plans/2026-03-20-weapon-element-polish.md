# Weapon/Element System Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 2 weapon bugs, add DoT damage numbers, redesign orbit shield visual, lower base crit to 10%, add crit upgrades, implement one-time affix filtering, and build a tier-2 affix evolution system.

**Architecture:** Bugs are isolated fixes to weapon files; DoT numbers use a new static helper on Enemy; tier-2 affixes live in a single `src/affixes/tier2.js` file with a `requires` field, consumed by `_buildUpgradePool()` which also gains one-time filtering for tier-1 affixes and mechanicals; Enemy.js gains `frozen` status and per-death hooks for curse2/poison2.

**Tech Stack:** Phaser 3.60, ES modules, Vite, Vitest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/weapons/Homura.js` | Modify | Fix `s.penetrate = false` → `stats.penetrate` |
| `src/weapons/Ofuda.js` | Modify | Same penetrate fix |
| `src/weapons/Ogi.js` | Modify | Aim at nearest enemy instead of flipX direction |
| `src/entities/Enemy.js` | Modify | Add `showDamageNumber()`, DoT number accumulator, `frozen` status, tier-2 death hooks |
| `src/affixes/chain.js` | Modify | Read `chain2` from `_affixCounts` to extend bounces to 3 |
| `src/affixes/burst.js` | Modify | Read `burst2` from `_affixCounts` to extend radius to 60 |
| `src/affixes/tier2.js` | Create | All 8 tier-2 affix objects with `requires` field |
| `src/affixes/index.js` | Modify | Export `ALL_TIER2_AFFIXES` |
| `src/config.js` | Modify | `CRIT_CHANCE` 0.50 → 0.10; add 3 crit `PLAYER_UPGRADES` with `oneTime: true` |
| `src/scenes/GameScene.js` | Modify | Orbit shield → static ring; `_mechanicalsOwned`/`_playerUpgradesOwned` tracking; `_buildUpgradePool()` one-time filtering + tier-2 injection |

---

### Task 1: Bug fixes — Homura/Ofuda penetrate + Ogi nearest-enemy aim

**Files:**
- Modify: `src/weapons/Homura.js`
- Modify: `src/weapons/Ofuda.js`
- Modify: `src/weapons/Ogi.js`

No unit tests possible for Phaser physics. Verify manually: select piercing upgrade, confirm Homura/Ofuda projectiles pass through enemies. Fire Ogi near a group of enemies, confirm the fan always faces the nearest one.

- [ ] **Step 1: Fix Homura penetrate**

In `src/weapons/Homura.js`, find `fire()`. Change:
```js
s.penetrate = false
```
to:
```js
s.penetrate = stats.penetrate ?? false
```

- [ ] **Step 2: Fix Ofuda penetrate**

In `src/weapons/Ofuda.js`, find `fire()`. Change:
```js
s.penetrate = false
```
to:
```js
s.penetrate = stats.penetrate ?? false
```

- [ ] **Step 3: Fix Ogi aim direction**

In `src/weapons/Ogi.js`, replace the `fire()` function's `facingDeg` calculation. The current code:
```js
const facingDeg = player.sprite.flipX ? 180 : 0
```

Replace with nearest-enemy targeting (fallback to flipX if no enemies):
```js
const activeEnemies = enemies.getChildren().filter(e => e.active && !e.dying)
let facingDeg
if (activeEnemies.length > 0) {
  const nearest = activeEnemies.reduce((best, e) => {
    const d = Phaser.Math.Distance.Between(fromX, fromY, e.x, e.y)
    return d < best.d ? { e, d } : best
  }, { e: null, d: Infinity }).e
  facingDeg = Phaser.Math.RadToDeg(
    Phaser.Math.Angle.Between(fromX, fromY, nearest.x, nearest.y))
} else {
  facingDeg = player.sprite.flipX ? 180 : 0
}
```

- [ ] **Step 4: Commit**

```bash
git add src/weapons/Homura.js src/weapons/Ofuda.js src/weapons/Ogi.js
git commit -m "fix: Homura/Ofuda read stats.penetrate; Ogi aims at nearest enemy"
```

---

### Task 2: DoT damage numbers

**Files:**
- Modify: `src/entities/Enemy.js`

DoT numbers should appear at most once per integer damage point, preventing per-frame spam. Use a `_accum` accumulator per DoT type in `_statusEffects`.

- [ ] **Step 1: Add `showDamageNumber` static helper to Enemy.js**

Add this static method right before `takeDamage`:
```js
static showDamageNumber(sprite, amount, color) {
  if (!amount || amount < 1) return
  const scene = sprite.scene
  const txt = scene.add.text(
    sprite.x + Phaser.Math.Between(-12, 12),
    sprite.y - 20,
    `${Math.round(amount)}`,
    { fontSize: '14px', color, stroke: '#000000', strokeThickness: 2 }
  ).setDepth(15).setOrigin(0.5)
  scene.tweens.add({
    targets: txt, y: txt.y - 28, alpha: 0, duration: 750,
    ease: 'Power1', onComplete: () => txt.destroy(),
  })
}
```

- [ ] **Step 2: Add `_accum` and `frozen` to status effects in `activate()`**

In `activate()`, change `_statusEffects` init to (includes `frozen` needed by Task 5's chill2):
```js
sprite._statusEffects = {
  burn:   { stacks: 0, timer: 0, dps: 5, _accum: 0 },
  poison: { stacks: 0, timer: 0, _accum: 0 },
  chill:  { active: false, timer: 0 },
  curse:  { active: false, timer: 0 },
  frozen: { active: false, timer: 0 },
}
```

- [ ] **Step 3: Also reset `_accum` in `_triggerDeath()` onComplete**

In the `onComplete` callback inside `_triggerDeath()`, add after existing resets:
```js
sprite._statusEffects.burn._accum   = 0
sprite._statusEffects.poison._accum = 0
```

- [ ] **Step 4: Emit DoT damage numbers in `updateStatus()`**

In `updateStatus()`, update the burn DoT block:
```js
if (se.burn.stacks > 0 && se.burn.timer > 0) {
  se.burn.timer -= delta
  const dmg = se.burn.dps * corrMult * (delta / 1000)
  sprite.hp -= dmg
  se.burn._accum += dmg
  if (se.burn._accum >= 1) {
    const shown = Math.floor(se.burn._accum)
    se.burn._accum -= shown
    Enemy.showDamageNumber(sprite, shown, '#ff6600')
  }
  if (se.burn.timer <= 0) se.burn.stacks = 0
  if (sprite.hp <= 0 && !sprite.dying) Enemy._triggerDeath(sprite)
}
```

Update the poison DoT block similarly:
```js
if (se.poison.stacks > 0 && se.poison.timer > 0 && !sprite.dying) {
  se.poison.timer -= delta
  const dmg = 3 * se.poison.stacks * corrMult * (delta / 1000)
  sprite.hp -= dmg
  se.poison._accum += dmg
  if (se.poison._accum >= 1) {
    const shown = Math.floor(se.poison._accum)
    se.poison._accum -= shown
    Enemy.showDamageNumber(sprite, shown, '#44cc44')
  }
  if (se.poison.timer <= 0) se.poison.stacks = 0
  if (sprite.hp <= 0 && !sprite.dying) Enemy._triggerDeath(sprite)
}
```

- [ ] **Step 5: Run tests (Enemy.js has no unit tests; verify nothing broke)**

```bash
npx vitest run
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/entities/Enemy.js
git commit -m "feat: DoT damage numbers — orange for burn, green for poison"
```

---

### Task 3: Config — lower base crit, add crit player upgrades

**Files:**
- Modify: `src/config.js`

- [ ] **Step 1: Lower base crit chance**

In `src/config.js`, change:
```js
CRIT_CHANCE: 0.50,
```
to:
```js
CRIT_CHANCE: 0.10,
```

- [ ] **Step 2: Add crit player upgrades**

Append to `PLAYER_UPGRADES` array in `src/config.js`:
```js
{ id: 'crit_rate', name: '武者の眼', desc: '爆擊率 +10%', oneTime: true,
  apply: (player, scene) => { scene._critBonus = (scene._critBonus || 0) + 0.10 } },
{ id: 'crit_dmg',  name: '必殺の型', desc: '爆擊傷害 +30%', oneTime: true,
  apply: (player, scene) => { scene._critDmgBonus = (scene._critDmgBonus || 0) + 0.30 } },
{ id: 'crit_combo', name: '活殺奥義', desc: '爆擊率+5% 爆擊傷害+20%', oneTime: true,
  apply: (player, scene) => {
    scene._critBonus    = (scene._critBonus    || 0) + 0.05
    scene._critDmgBonus = (scene._critDmgBonus || 0) + 0.20
  } },
```

- [ ] **Step 3: Wire `_critBonus`/`_critDmgBonus` into `takeDamage`**

In `Enemy.takeDamage()`, find:
```js
const luckyCount = affixes.filter(a => a.id === 'lucky').length
const critChance = Math.min(1.0, CFG.CRIT_CHANCE + luckyCount * 0.15)
const critMult   = CFG.CRIT_MULTIPLIER + luckyCount * 0.5
```

Replace with:
```js
const luckyCount  = affixes.filter(a => a.id === 'lucky').length
const lucky2Count = affixes.filter(a => a.id === 'lucky2').length
const scene       = sprite.scene
const critBonus   = (scene._critBonus    || 0)
const critDmgBon  = (scene._critDmgBonus || 0)
const critChance  = Math.min(1.0, CFG.CRIT_CHANCE + luckyCount * 0.15 + critBonus)
const critMult    = (CFG.CRIT_MULTIPLIER + luckyCount * 0.5 + critDmgBon) * (lucky2Count > 0 ? 1.5 : 1)
```

(The `lucky2Count` and `lucky2` check are needed for Task 5's tier-2 lucky2 affix — add them now so there's no patch later.)

- [ ] **Step 4: Initialize `_critBonus`/`_critDmgBonus` in GameScene.create()**

In `src/scenes/GameScene.js`, in `create()`, after `this._resonances = new Set()`, add:
```js
this._critBonus    = 0
this._critDmgBonus = 0
this._mechanicalsOwned    = new Set()
this._playerUpgradesOwned = new Set()
```

- [ ] **Step 5: Track one-time player upgrades in GameScene**

In `_addXp()` upgrade handler, find the `player upgrade` branch:
```js
} else {
  upgrade.apply(this._player, this)   // player upgrade
}
```
Replace with:
```js
} else {
  upgrade.apply(this._player, this)
  if (upgrade.oneTime) this._playerUpgradesOwned.add(upgrade.id)
}
```

- [ ] **Step 6: Update `tests/logic.test.js` — PLAYER_UPGRADES length assertion**

`tests/logic.test.js` has `it('has 3 entries', () => expect(PLAYER_UPGRADES).toHaveLength(3))`. After adding 3 crit upgrades, there are 6. Change the assertion:
```js
it('has 6 entries', () => expect(PLAYER_UPGRADES).toHaveLength(6))
```

- [ ] **Step 7: Run tests**

```bash
npx vitest run
```
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/config.js src/entities/Enemy.js src/scenes/GameScene.js tests/logic.test.js
git commit -m "feat: base crit 10%, crit player upgrades, scene crit bonus tracking"
```

---

### Task 4: Orbit shield — static pulsing ring

**Files:**
- Modify: `src/scenes/GameScene.js`

Currently orbit shield creates small orbiting `add.circle()` dots. Redesign to a static glowing ring (radius 60px, gold/white, pulsing alpha) centered on the player each frame.

- [ ] **Step 1: Rewrite `_addOrbitShield()`**

Replace the existing `_addOrbitShield()` method:
```js
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
```

- [ ] **Step 2: Rewrite orbit shield update loop in `update()`**

Find the orbit shield loop in `update()`:
```js
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

Replace with:
```js
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
```

Note: The ring is redrawn each frame (Graphics.clear() + redraw) so it always follows the player without needing setPosition. The alpha tween on the `ring` Graphics object still pulses it visually.

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "feat: orbit shield redesigned as static pulsing ring (distinct from Kusarigama)"
```

---

### Task 5: Tier-2 affix files

**Files:**
- Create: `src/affixes/tier2.js`
- Modify: `src/affixes/index.js`
- Modify: `src/affixes/chain.js` (read chain2 to extend bounce count)
- Modify: `src/affixes/burst.js` (read burst2 to extend radius)

Tier-2 affix design rules:
- Each has a `requires` field (parent tier-1 id)
- `onHit` is either empty (effect driven by parent logic reading `_affixCounts`) or adds a stacking effect
- chain2 and burst2 effects are baked into chain.js/burst.js — their tier-2 objects have empty `onHit`
- burn2: sets `se.burn.dps = 10` on each hit (doubles DoT; resets to 5 per enemy activation, so always upgraded when burn2 fires)
- poison2: `onHit` is empty — the spread happens in `_triggerDeath()` (Task 6)
- chill2: sets `se.frozen` state (Enemy needs `frozen` field — Task 6)
- curse2: `onHit` is empty — AOE happens in `_triggerDeath()` (Task 6)
- leech2: adds extra 10% heal on top of leech's 10% (effectively doubles to 20%)
- lucky2: passive — handled in `takeDamage()` (already wired in Task 3)

- [ ] **Step 1: Create `src/affixes/tier2.js`**

```js
// src/affixes/tier2.js
// Tier-2 affix upgrades. Each requires the parent tier-1 affix.
// Effects driven by parent files (chain, burst) or Enemy.js hooks read scene._affixCounts.

export default [
  {
    id: 'burn2', name: '業火', requires: 'burn',
    desc: '燃燒傷害 ×2',
    onHit(enemy) {
      const se = enemy._statusEffects
      if (se && se.burn.stacks > 0) se.burn.dps = 10
    },
  },
  {
    id: 'poison2', name: '猛毒擴散', requires: 'poison',
    desc: '中毒敵人死亡時：毒性傳播至周圍3個敵人（50%毒層數）',
    onHit() {},  // handled in Enemy._triggerDeath
  },
  {
    id: 'chain2', name: '落雷', requires: 'chain',
    desc: '連鎖擴展到3個目標',
    onHit() {},  // chain.js reads scene._affixCounts.has('chain2')
  },
  {
    id: 'chill2', name: '凍結', requires: 'chill',
    desc: '完全停止敵人移動2秒（取代減速）',
    onHit(enemy) {
      const se = enemy._statusEffects
      if (!se) return
      se.frozen.active = true
      se.frozen.timer  = 2000
      // Chill becomes irrelevant when frozen, but keep it active for resonance compatibility
    },
  },
  {
    id: 'curse2', name: '恐慌', requires: 'curse',
    desc: '被詛咒敵人死亡時：對周圍80px造成15傷害',
    onHit() {},  // handled in Enemy._triggerDeath
  },
  {
    id: 'leech2', name: '血饗', requires: 'leech',
    desc: '吸血效果 ×2（共回復傷害量20%）',
    onHit(enemy, damage, scene) {
      if (scene._player) scene._player.heal(damage * 0.10)  // extra 10% on top of leech's 10%
    },
  },
  {
    id: 'burst2', name: '大爆炸', requires: 'burst',
    desc: '爆炸範圍 +50%（40px → 60px）',
    onHit() {},  // burst.js reads scene._affixCounts.has('burst2')
  },
  {
    id: 'lucky2', name: '大吉', requires: 'lucky',
    desc: '爆擊傷害倍率 ×1.5',
    onHit() {},  // handled passively in Enemy.takeDamage via lucky2Count check
  },
]
```

- [ ] **Step 2: Export `ALL_TIER2_AFFIXES` from `src/affixes/index.js`**

Add to `src/affixes/index.js`:
```js
import tier2 from './tier2.js'
export const ALL_TIER2_AFFIXES = tier2
```

- [ ] **Step 3: Update `chain.js` to extend to 3 bounces when chain2 owned**

In `src/affixes/chain.js`, find:
```js
const count   = scene._affixCounts ? (scene._affixCounts.get('chain') || 1) : 1
const bounces = count
```

Replace with:
```js
const hasChain2 = scene._affixCounts?.has('chain2')
const bounces   = hasChain2 ? 3 : (scene._affixCounts ? (scene._affixCounts.get('chain') || 1) : 1)
```

- [ ] **Step 4: Update `burst.js` to extend radius to 60 when burst2 owned**

In `src/affixes/burst.js`, find:
```js
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
```

Replace with:
```js
onHit(enemy, damage, scene) {
  if (Math.random() > 0.20) return
  const radius = scene._affixCounts?.has('burst2') ? 60 : 40
  scene._enemies.getChildren()
    .filter(e => e.active && !e.dying && e !== enemy &&
      Phaser.Math.Distance.Between(enemy.x, enemy.y, e.x, e.y) < radius)
    .forEach(e => Enemy.takeDamage(e, damage * 0.4, enemy.x, enemy.y, []))

  const g = scene.add.graphics().setDepth(10)
  g.lineStyle(2, 0xff4400, 0.8)
  g.strokeCircle(enemy.x, enemy.y, radius)
  scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() })
},
```

- [ ] **Step 5: Update `lucky.js` desc to remove stacking claim**

Since lucky is now one-time, update `src/affixes/lucky.js` desc line from `'爆擊率+15%，爆擊倍率+0.5倍（可疊加）'` (or similar) to:
```js
desc: '爆擊率+15%，爆擊倍率+0.5倍',
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run
```
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/affixes/tier2.js src/affixes/index.js src/affixes/chain.js src/affixes/burst.js src/affixes/lucky.js
git commit -m "feat: tier-2 affix files — 業火/猛毒擴散/落雷/凍結/恐慌/血饗/大爆炸/大吉"
```

---

### Task 6: Enemy.js — frozen status + tier-2 death hooks

**Files:**
- Modify: `src/entities/Enemy.js`

Add `frozen` status (chill2), and on-death hooks for poison2 (spread) and curse2 (AOE).

- [ ] **Step 1: `activate()` already has `frozen` — confirm no change needed**

Task 2 already added `frozen: { active: false, timer: 0 }` to `activate()`. Skip; no edit needed here.

- [ ] **Step 2: Show merged `onComplete` in `_triggerDeath()` — replace the full reset block**

Task 2 Step 3 already added `burn._accum` and `poison._accum` resets. Now also add `frozen` reset. Rather than two partial edits, replace the entire onComplete callback body with the complete merged version. Find the `onComplete: () => {` block inside `_triggerDeath()` and ensure it reads:

```js
onComplete: () => {
  // Full reset — activate() will re-initialize on next spawn, but clear here
  // to prevent stale state if any code path bypasses activate()
  if (sprite._statusEffects) {
    sprite._statusEffects.burn.stacks   = 0
    sprite._statusEffects.burn.timer    = 0
    sprite._statusEffects.burn._accum   = 0
    sprite._statusEffects.poison.stacks = 0
    sprite._statusEffects.poison.timer  = 0
    sprite._statusEffects.poison._accum = 0
    sprite._statusEffects.chill.active  = false
    sprite._statusEffects.chill.timer   = 0
    sprite._statusEffects.curse.active  = false
    sprite._statusEffects.curse.timer   = 0
    sprite._statusEffects.frozen.active = false
    sprite._statusEffects.frozen.timer  = 0
  }
  sprite.dying = false
  sprite.setAlpha(1)
  sprite.disableBody(true, true)
},
```

(This is the single authoritative merged state of the onComplete block after Tasks 2 + 6.)

- [ ] **Step 3: Apply frozen to movement in `update()`**

Find:
```js
const chilled = sprite._statusEffects && sprite._statusEffects.chill.active
sprite.scene.physics.moveToObject(sprite, player.sprite, chilled ? CFG.ENEMY_SPEED * 0.5 : CFG.ENEMY_SPEED)
```

Replace with:
```js
const frozen  = sprite._statusEffects && sprite._statusEffects.frozen.active
const chilled = sprite._statusEffects && sprite._statusEffects.chill.active
const speed   = frozen ? 0 : (chilled ? CFG.ENEMY_SPEED * 0.5 : CFG.ENEMY_SPEED)
sprite.scene.physics.moveToObject(sprite, player.sprite, speed)
```

- [ ] **Step 4: Frozen timer countdown in `updateStatus()`**

In `updateStatus()`, after the curse timer block, add:
```js
// Frozen timer (chill2)
if (se.frozen.active) {
  se.frozen.timer -= delta
  if (se.frozen.timer <= 0) se.frozen.active = false
}
```

- [ ] **Step 5: Frozen tint in `_applyStatusTint()` and `_hasStatusTint()`**

In `_applyStatusTint()`, add frozen case between chill and curse:
```js
if (se.chill.active || se.frozen.active) { sprite.setTint(0x88ccff); return }
```
(Frozen uses same ice-blue tint as chill, but more intense visually — acceptable.)

Replace the existing `if (se.chill.active)` line with the above combined check.

In `_hasStatusTint()`, update:
```js
return (se.burn.stacks > 0 && se.burn.timer > 0)    ||
       (se.poison.stacks > 0 && se.poison.timer > 0) ||
       se.chill.active || se.frozen.active || se.curse.active
```

- [ ] **Step 6: Add tier-2 death hooks in `_triggerDeath()`**

In `_triggerDeath()`, after the existing `dark_harvest` block (around line 163), add:

```js
// Tier-2: poison2 — spread poison to nearby 3 enemies on death
if (scene._affixCounts?.has('poison2') &&
    sprite._statusEffects && sprite._statusEffects.poison.stacks > 0) {
  const spreadStacks = Math.max(1, Math.floor(sprite._statusEffects.poison.stacks * 0.5))
  scene._enemies.getChildren()
    .filter(e => e.active && !e.dying && e !== sprite &&
      Phaser.Math.Distance.Between(x, y, e.x, e.y) < 100)
    .sort((ea, eb) =>
      Phaser.Math.Distance.Between(x, y, ea.x, ea.y) -
      Phaser.Math.Distance.Between(x, y, eb.x, eb.y))
    .slice(0, 3)
    .forEach(e => {
      if (e._statusEffects) {
        e._statusEffects.poison.stacks = Math.min(5,
          e._statusEffects.poison.stacks + spreadStacks)
        e._statusEffects.poison.timer  = Math.max(
          e._statusEffects.poison.timer, 3000)
      }
    })
}

// Tier-2: curse2 — cursed enemy death causes AoE damage
if (scene._affixCounts?.has('curse2') &&
    sprite._statusEffects && sprite._statusEffects.curse.active) {
  scene._enemies.getChildren()
    .filter(e => e.active && !e.dying && e !== sprite &&
      Phaser.Math.Distance.Between(x, y, e.x, e.y) < 80)
    .forEach(e => Enemy.takeDamage(e, 15, x, y, scene._affixes || []))
  // Visual: fear pulse ring
  const g = scene.add.graphics().setDepth(10)
  g.lineStyle(2, 0xaa44aa, 0.9)
  g.strokeCircle(x, y, 80)
  scene.tweens.add({ targets: g, alpha: 0, scaleX: 1.3, scaleY: 1.3,
    duration: 300, onComplete: () => g.destroy() })
}
```

- [ ] **Step 7: Run tests**

```bash
npx vitest run
```
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/entities/Enemy.js
git commit -m "feat: frozen status (chill2), poison2 spread + curse2 AoE death hooks"
```

---

### Task 7: GameScene — one-time filtering + tier-2 in upgrade pool

**Files:**
- Modify: `src/scenes/GameScene.js`

Wire everything together: track owned mechanicals, filter tier-1/mechanical/one-time player upgrades from pool, inject tier-2 affixes when parent is owned.

- [ ] **Step 1: Import `ALL_TIER2_AFFIXES` in GameScene**

In `src/scenes/GameScene.js`, update the import line:
```js
import { ALL_AFFIXES, ALL_MECHANICAL, ALL_TIER2_AFFIXES, checkResonances } from '../affixes/index.js'
```

- [ ] **Step 2: Track mechanical ownership in `_applyMechanical()`**

In `_applyMechanical()`, add tracking at the start:
```js
_applyMechanical(mechanical) {
  this._mechanicalsOwned.add(mechanical.id)
  // ... rest of existing code unchanged
```

- [ ] **Step 3: Rewrite `_buildUpgradePool()` with filtering**

Replace the entire `_buildUpgradePool()` method:

```js
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
  // removes stacking for all tier-1 affixes including `lucky`. The `lucky` affix can only be
  // picked once (luckyCount === 1), giving crit +15% / crit mult +0.5. Further power comes
  // from tier-2 `lucky2` (大吉 crit ×1.5). Update lucky.js desc to remove "(可疊加)".
  // Also update lucky.js desc: '爆擊率+15%，爆擊倍率+0.5倍' (remove 可疊加)

  // Safety: if somehow pool is still empty, force add repeatable weapon upgrades
  // (prevents infinite _upgrading state)
  if (pool.length === 0) {
    pool.push(...PLAYER_UPGRADES
      .filter(u => !u.oneTime)
      .map(u => ({ ...u, target: 'player' })))
  }

  return Phaser.Utils.Array.Shuffle(pool).slice(0, 3)
}
```

- [ ] **Step 4: Update HUD affix dots to include tier-2 affixes**

In `_drawHud()`, update the affix color map to include tier-2 IDs:
```js
const affixColor = {
  burn: 0xff6600, poison: 0x44cc44, chain: 0xffff00,
  chill: 0x88ccff, curse: 0xaa44aa, leech: 0xff4488,
  burst: 0xff4400, lucky: 0xffdd88,
  // Tier-2 — brighter/more saturated versions of parent
  burn2: 0xff3300, poison2: 0x00ff44, chain2: 0xffff00,
  chill2: 0x44aaff, curse2: 0xcc00cc, leech2: 0xff0066,
  burst2: 0xff6600, lucky2: 0xffaa00,
}
```

The existing dot row supports up to 8 slots. With 8 tier-1 + up to 8 tier-2, we could exceed 8 slots. Expand the pre-created dot arrays from 8 to 16 in `create()`:

Find in `create()`:
```js
this._hudAffixDots = Array.from({ length: 8 }, (_, i) =>
  this.add.rectangle(16 + i * 20, 72, 14, 14, 0x444466)
    .setScrollFactor(0).setDepth(200).setAlpha(0)
)
this._hudAffixLabels = Array.from({ length: 8 }, (_, i) =>
  this.add.text(16 + i * 20, 72, '', { fontSize: '9px', color: '#ffffff' })
    .setScrollFactor(0).setDepth(201).setOrigin(0.5)
    .setAlpha(0)
)
```

Replace with 16 slots:
```js
this._hudAffixDots = Array.from({ length: 16 }, (_, i) =>
  this.add.rectangle(16 + i * 18, 72, 12, 12, 0x444466)
    .setScrollFactor(0).setDepth(200).setAlpha(0)
)
this._hudAffixLabels = Array.from({ length: 16 }, (_, i) =>
  this.add.text(16 + i * 18, 72, '', { fontSize: '8px', color: '#ffffff' })
    .setScrollFactor(0).setDepth(201).setOrigin(0.5)
    .setAlpha(0)
)
```

Also update the `_drawHud()` affix dot loop that checks `i < affixIds.length` and `i * 20` spacing — it already iterates `this._hudAffixDots.forEach` so the 16-slot array is automatically handled. Only the position `16 + i * 20` needs to match the creation — since we changed creation to `i * 18`, make sure `_drawHud()` doesn't hardcode position. Check: the dot positions are set in `create()` and the labels use `.setPosition(16 + i * 20, 72)` in `_drawHud()`. Update that to match `i * 18`:

Find in `_drawHud()`:
```js
this._hudAffixLabels[i].setText(`${this._affixCounts.get(id)}`).setAlpha(1).setPosition(16 + i * 20, 72)
```
Replace with:
```js
this._hudAffixLabels[i].setText(`${this._affixCounts.get(id)}`).setAlpha(1).setPosition(16 + i * 18, 72)
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "feat: one-time affix/mechanical filtering, tier-2 injection in upgrade pool, 16-slot HUD"
```

---

### Final verification

- [ ] **Run full test suite**

```bash
npx vitest run
```
Expected: all existing tests pass (15+).

- [ ] **Manual play-test checklist**
  - [ ] Select piercing upgrade → Homura/Ofuda projectiles pierce enemies
  - [ ] Ogi fires: fan always faces nearest enemy regardless of player direction
  - [ ] Burn/poison enemies show orange/green floating numbers (smaller than white hit numbers)
  - [ ] 護盾術 upgrade creates a golden pulsing ring around player (not orbiting dots)
  - [ ] Kusarigama sickles are visually distinct from orbit shield ring
  - [ ] After picking 燃燒, it no longer appears in upgrade pool; 業火 appears instead
  - [ ] After picking 業火, burn DoT numbers are doubled (10 DPS vs 5)
  - [ ] After picking 貫通 mechanical, it no longer appears again
  - [ ] Crit rate/damage upgrades appear; once picked they disappear from pool
  - [ ] With 凍結 (chill2): enemies stop completely for 2 seconds (not just slow)
  - [ ] With 猛毒擴散: kill a poisoned enemy, nearby enemies get poisoned
  - [ ] With 恐慌: kill a cursed enemy, nearby enemies take 15 damage with purple ring VFX
