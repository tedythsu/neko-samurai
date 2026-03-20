# Universal Weapon Traits (Layer P / Layer M) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-weapon C-layer upgrades with two universal trait pools (Layer P for projectile weapons, Layer M for melee weapons), fix one-time upgrade dedup, and delete all deprecated per-weapon behaviour flags.

**Architecture:** Two new files export trait arrays + weapon-ID sets. GameScene stores `_projTraitsOwned`/`_meleeTraitsOwned` Sets, injects traits into the upgrade pool, and applies them to all matching weapon entries simultaneously. All 16 C-layer one-time upgrade entries are deleted from weapon files; their behaviours are re-expressed via universal traits applied at character level.

**Tech Stack:** Phaser 3, Vite dev server (`npm run dev`), ES modules, no automated test framework — verification is browser-based play testing.

**Spec:** `docs/superpowers/specs/2026-03-20-universal-weapon-traits-design.md`

---

## File Map

| File | Action |
|------|--------|
| `src/upgrades/projTraits.js` | **Create** — ALL_PROJ_TRAITS (5), doScatter helper, PROJ_WEAPON_IDS |
| `src/upgrades/meleeTraits.js` | **Create** — ALL_MELEE_TRAITS (7), MELEE_WEAPON_IDS, SWING_WEAPON_IDS |
| `src/entities/Enemy.js` | **Modify** — add `sprite._doomTimer = null` in `_triggerDeath` |
| `src/weapons/Shuriken.js` | **Modify** — delete boomerang/scatter upgrades; add trait flag copies in fire(); use doScatter |
| `src/weapons/Kunai.js` | **Modify** — delete chainHit/alwaysPierce upgrades + chain-teleport; simplify penetrate; add _miniExplosion/_ricochet |
| `src/weapons/Homura.js` | **Modify** — add `s._pool = pool`; add _miniExplosion/_ricochet flag copies |
| `src/weapons/Ofuda.js` | **Modify** — delete split/linger upgrades + _doSplit; rename _split→_scatter; add _pool; add _miniExplosion/_ricochet; use doScatter |
| `src/weapons/Tachi.js` | **Modify** — delete iaijutsu/shadow upgrades; replace _iaijutsu→_charge, _shadow→_afterimage; add all Layer M trait reads |
| `src/weapons/Ogi.js` | **Modify** — delete whirlwind/shockwave upgrade *entries* (keep read paths); add charge/afterimage/doom/deathBurst/rapidVortex reads |
| `src/weapons/Kusarigama.js` | **Modify** — delete gravity/doubleOrbit upgrades + pull/outer-orbit code; add doom/deathBurst/rapidVortex/afterimage/shockwave |
| `src/scenes/GameScene.js` | **Modify** — imports; init Sets; one-time weapon dedup; proj/melee_trait handlers; _addWeapon retroactive apply; doom timer in update() |
| `src/scenes/UpgradeScene.js` | **Modify** — add proj_trait / melee_trait to CATEGORY map |

---

## Task 1: Enemy.js — doom timer cleanup in _triggerDeath

**Files:**
- Modify: `src/entities/Enemy.js:166-170`

`_triggerDeath` must clear `_doomTimer` on the dying enemy so the doom loop in GameScene.update() skips it. `Enemy.takeDamage` already returns `true` on kill and `false` otherwise (verified at lines 378-382) — no change needed there.

- [ ] **Step 1: Open `src/entities/Enemy.js` and locate `_triggerDeath`**

Line 166: `static _triggerDeath(sprite) {`
Line 167: `  if (sprite.dying) return`

- [ ] **Step 2: Add doom timer clear after the guard**

```javascript
static _triggerDeath(sprite) {
  if (sprite.dying) return
  sprite._doomTimer = null   // ← add this line
  const { x, y } = sprite
```

- [ ] **Step 3: Verify in browser**

Run `npm run dev`. Open game. No console errors. Enemy death works normally.

- [ ] **Step 4: Commit**

```bash
git add src/entities/Enemy.js
git commit -m "fix: clear _doomTimer on enemy death in _triggerDeath"
```

---

## Task 2: Create `src/upgrades/projTraits.js`

**Files:**
- Create: `src/upgrades/projTraits.js`

This file exports the 5 Layer P trait objects, the `doScatter` shared helper, and the `PROJ_WEAPON_IDS` Set. The `doScatter` helper accepts an `extraProps` object so weapon-specific fields (like Ofuda's `_explodeRadius`) can be merged onto scatter children.

- [ ] **Step 1: Create the file**

```javascript
// src/upgrades/projTraits.js
import Phaser from 'phaser'
import { getOrCreate } from '../weapons/_pool.js'

export const PROJ_WEAPON_IDS = new Set(['shuriken', 'kunai', 'homura', 'ofuda'])

export const ALL_PROJ_TRAITS = [
  {
    id: 'pt_boomerang',
    name: '回旋',
    desc: '投射物抵達射程後反彈飛回',
    oneTime: true,
    apply(stats) { stats._boomerang = true },
  },
  {
    id: 'pt_scatter',
    name: '分裂',
    desc: '投射物消失時分裂成3個小投射物（0.4倍傷害，120px射程）',
    oneTime: true,
    apply(stats) { stats._scatter = true },
  },
  {
    id: 'pt_pierce',
    name: '穿透',
    desc: '投射物穿透所有命中目標',
    oneTime: true,
    apply(stats) { stats.penetrate = true },
  },
  {
    id: 'pt_explosion',
    name: '爆裂弾',
    desc: '投射物命中時在40px範圍造成0.4倍傷害爆炸',
    oneTime: true,
    apply(stats) { stats._miniExplosion = true },
  },
  {
    id: 'pt_ricochet',
    name: '彈射',
    desc: '命中後向最近敵人生成一枚投射物（最多彈射2次）',
    oneTime: true,
    apply(stats) { stats._ricochet = true },
  },
]

/**
 * Spawn 3 small scatter children from a dying/expiring projectile.
 * @param {Phaser.GameObjects.Sprite} proj  — the expiring projectile
 * @param {Phaser.Scene}              scene — pass sprite.scene from update()
 * @param {Object}                    extraProps — weapon-specific overrides merged onto children
 */
export function doScatter(proj, scene, extraProps = {}) {
  if (proj._scatterFired) return
  proj._scatterFired = true
  const pool = proj._pool
  if (!pool) return
  const baseAngle = Math.atan2(proj.body.velocity.y, proj.body.velocity.x)
  for (let i = -1; i <= 1; i++) {
    const s = getOrCreate(pool, proj.x, proj.y, proj.texture.key)
    s.setDisplaySize(proj.displayWidth * 0.5, proj.displayHeight * 0.5)
    s.damage         = proj.damage * 0.4
    s.hitSet         = new Set()
    s.spawnX         = proj.x
    s.spawnY         = proj.y
    s.range          = 120
    s.penetrate      = false
    s.knockback      = 0
    s._hitRadius     = (proj._hitRadius || 14) * 0.5
    s._boomerang     = false
    s._scatter       = false
    s._scatterFired  = true
    s._pool          = pool
    s._reversed      = false
    s._miniExplosion = false
    s._ricochet      = false
    s._ricochetDepth = 99   // scatter children cannot ricochet
    Object.assign(s, extraProps)
    const angle = baseAngle + Phaser.Math.DegToRad(i * 45)
    scene.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), 400, s.body.velocity)
  }
}
```

- [ ] **Step 2: Verify the file parses**

Run `npm run dev`. No import errors in console. (Nothing uses the file yet.)

- [ ] **Step 3: Commit**

```bash
git add src/upgrades/projTraits.js
git commit -m "feat: Layer P universal projectile traits + doScatter helper"
```

---

## Task 3: Create `src/upgrades/meleeTraits.js`

**Files:**
- Create: `src/upgrades/meleeTraits.js`

- [ ] **Step 1: Create the file**

```javascript
// src/upgrades/meleeTraits.js

export const MELEE_WEAPON_IDS = new Set(['tachi', 'ogi', 'kusarigama'])
export const SWING_WEAPON_IDS = new Set(['tachi', 'ogi'])

export const ALL_MELEE_TRAITS = [
  // ── Universal melee ────────────────────────────────────────────────────────
  {
    id: 'mt_deathburst',
    name: '死爆',
    desc: '擊殺時在60px範圍內爆炸，造成100%傷害',
    oneTime: true,
    apply(stats) { stats._deathBurst = true },
  },
  {
    id: 'mt_doom',
    name: '命運印記',
    desc: '命中後2秒，觸發60px死亡爆炸（1.5倍傷害）',
    oneTime: true,
    apply(stats) { stats._doom = true },
  },
  {
    id: 'mt_rapidvortex',
    name: '疾旋',
    desc: '周圍每有1個敵人，本次攻擊傷害+25%（最多+100%）',
    oneTime: true,
    apply(stats) { stats._rapidVortex = true },
  },
  {
    id: 'mt_afterimage',
    name: '殘像',
    desc: '攻擊結束後留下殘像傷害區（1s，0.5倍傷害）',
    oneTime: true,
    apply(stats) { stats._afterimage = true },
  },
  {
    id: 'mt_shockwave',
    name: '衝波',
    desc: '攻擊結束後放出擴張環，對經過的敵人造成0.5倍傷害',
    oneTime: true,
    apply(stats) { stats._shockwave = true },
  },
  // ── Swing-only (tachi + ogi) ───────────────────────────────────────────────
  {
    id: 'mt_charge',
    name: '蓄力',
    desc: '延遲300ms後揮砍，射程×2、傷害×1.5',
    oneTime: true,
    swingOnly: true,
    apply(stats) { stats._charge = true },
  },
  {
    id: 'mt_whirlwind',
    name: '旋風',
    desc: '揮砍期間旋轉360°，覆蓋全方位',
    oneTime: true,
    swingOnly: true,
    apply(stats) { stats._whirlwind = true },
  },
]
```

- [ ] **Step 2: Verify the file parses**

Run `npm run dev`. No import errors in console.

- [ ] **Step 3: Commit**

```bash
git add src/upgrades/meleeTraits.js
git commit -m "feat: Layer M universal melee traits"
```

---

## Task 4: Shuriken.js — delete C-layer, add proj trait reads

**Files:**
- Modify: `src/weapons/Shuriken.js`

Delete the `boomerang` and `scatter` upgrade entries. In `fire()`, add trait flag copies to each sprite. Replace the local `_doScatter` helper with the shared `doScatter` from projTraits.js.

- [ ] **Step 1: Update the imports**

Add at the top (after existing imports):
```javascript
import { doScatter } from '../upgrades/projTraits.js'
```

- [ ] **Step 2: Delete the two C-layer upgrade entries from `upgrades[]`**

Remove these two entries:
```javascript
{ id: 'boomerang', name: '回転刃', desc: '抵達射程後反彈飛回', apply: s => { s._boomerang = true } },
{ id: 'scatter',   name: '散花',   desc: '消失時分裂成3個小手裏剣（0.4倍傷害）', apply: s => { s._scatter = true } },
```

- [ ] **Step 3: In `fire()`, add trait flag copies to each sprite `s`**

After `s._pool = pool` (which is already set at line ~50), add:
```javascript
s._boomerang     = stats._boomerang     || false
s._scatter       = stats._scatter       || false
s._scatterFired  = false
s._miniExplosion = stats._miniExplosion || false
s._ricochet      = stats._ricochet      || false
s._ricochetDepth = 0
```

- [ ] **Step 4: Delete the local `_doScatter` function at the bottom of the file**

Remove the entire `function _doScatter(proj) { ... }` block (lines 119-142).

- [ ] **Step 5: In `update(sprite)`, update the scatter call**

The boomerang expiry check at lines 62-78 already calls `if (sprite._scatter) _doScatter(sprite)`. Replace `_doScatter(sprite)` with `doScatter(sprite, sprite.scene)` in both call sites (boomerang return expiry and normal range expiry).

The updated `update(sprite)` method:
```javascript
update(sprite) {
  if (!sprite.active) return
  sprite.angle += 8

  const dist = Phaser.Math.Distance.Between(sprite.spawnX, sprite.spawnY, sprite.x, sprite.y)

  if (sprite._boomerang) {
    if (!sprite._reversed && dist >= sprite.range) {
      sprite.body.velocity.x *= -1
      sprite.body.velocity.y *= -1
      sprite._reversed = true
    } else if (sprite._reversed && dist <= 30) {
      if (sprite._scatter) doScatter(sprite, sprite.scene)
      sprite.disableBody(true, true)
    }
  } else {
    if (dist >= sprite.range) {
      if (sprite._scatter) doScatter(sprite, sprite.scene)
      sprite.disableBody(true, true)
    }
  }
},
```

- [ ] **Step 6: In `updateActive()`, add `_miniExplosion` and `_ricochet` handling**

Import `getOrCreate` is already present. After `Enemy.takeDamage(e, ...)` and before the `if (!proj.penetrate) proj._spent = true` line, add:

```javascript
// 爆裂弾 — mini explosion on hit
if (proj._miniExplosion) {
  const r = 40
  enemies.getChildren()
    .filter(en => en.active && !en.dying && en !== e &&
      Phaser.Math.Distance.Between(e.x, e.y, en.x, en.y) < r)
    .forEach(en => Enemy.takeDamage(en, proj.damage * 0.4, e.x, e.y, affixes, 0))
  const g = scene.add.graphics().setDepth(10)
  g.lineStyle(2, 0xff6600, 0.8)
  g.strokeCircle(e.x, e.y, r)
  scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() })
}

// 彈射 — ricochet projectile to nearest unhit enemy
if (proj._ricochet && proj._ricochetDepth < 2) {
  const next = enemies.getChildren()
    .filter(en => en.active && !en.dying && !proj.hitSet.has(en))
    .sort((a, b) =>
      Phaser.Math.Distance.Between(e.x, e.y, a.x, a.y) -
      Phaser.Math.Distance.Between(e.x, e.y, b.x, b.y))[0]
  if (next) {
    const r2 = getOrCreate(proj._pool, e.x, e.y, proj.texture.key)
    r2.setDisplaySize(proj.displayWidth, proj.displayHeight)
    r2.damage         = proj.damage * 0.7
    r2.hitSet         = new Set([e])
    r2.spawnX         = e.x
    r2.spawnY         = e.y
    r2.range          = 200
    r2.penetrate      = false
    r2.knockback      = proj.knockback
    r2._hitRadius     = proj._hitRadius
    r2._boomerang     = false
    r2._scatter       = proj._scatter
    r2._scatterFired  = false
    r2._miniExplosion = proj._miniExplosion
    r2._ricochet      = true
    r2._ricochetDepth = proj._ricochetDepth + 1
    r2._pool          = proj._pool
    r2._reversed      = false
    scene.physics.moveToObject(r2, next, 400)
  }
}
```

Also keep the existing `raikou` evo chain bounce block (leave it unchanged).

- [ ] **Step 7: Verify in browser**

Run `npm run dev`. Play until level-up. Shuriken still fires and rotates. No console errors. (Layer P traits are not offered yet — GameScene not updated until Task 11.)

- [ ] **Step 8: Commit**

```bash
git add src/weapons/Shuriken.js
git commit -m "feat: Shuriken — delete C-layer upgrades, add proj trait reads (pt_boomerang/scatter/pierce/explosion/ricochet)"
```

---

## Task 5: Kunai.js — delete C-layer, add proj trait reads

**Files:**
- Modify: `src/weapons/Kunai.js`

Delete `chainHit`/`alwaysPierce` upgrades. Remove the chain-bounce teleport code from `updateActive()`. Simplify `penetrate`. Add `_miniExplosion`/`_ricochet` handling. Keep `koori` frozen-pierce evo logic.

- [ ] **Step 1: Add import**

```javascript
import { doScatter } from '../upgrades/projTraits.js'
```

- [ ] **Step 2: Delete two upgrade entries from `upgrades[]`**

Remove:
```javascript
{ id: 'chainHit',    name: '連刃', desc: '命中後跳躍至最近120px敵人（同等傷害）', apply: s => { s._chainHit = true } },
{ id: 'alwaysPierce',name: '穿心', desc: '永遠貫穿敵人',                          apply: s => { s._alwaysPierce = true } },
```

- [ ] **Step 3: Update `fire()` — simplify penetrate, add trait flag copies**

Change `s.penetrate = stats.penetrate || stats._alwaysPierce || false` to:
```javascript
s.penetrate = stats.penetrate || false
```

Remove `s._chained = false` (the chain-bounce flag is no longer needed).

Add trait flag copies after `s.knockback = ...`:
```javascript
s._miniExplosion = stats._miniExplosion || false
s._ricochet      = stats._ricochet      || false
s._ricochetDepth = 0
s._scatter       = stats._scatter       || false
s._scatterFired  = false
s._pool          = pool
```

- [ ] **Step 4: Update `update(sprite)` — add scatter on expiry**

```javascript
update(sprite) {
  if (!sprite.active) return
  sprite.rotation = Math.atan2(sprite.body.velocity.y, sprite.body.velocity.x) + Math.PI / 2
  if (Phaser.Math.Distance.Between(sprite.spawnX, sprite.spawnY, sprite.x, sprite.y) >= sprite.range) {
    if (sprite._scatter) doScatter(sprite, sprite.scene)
    sprite.disableBody(true, true)
  }
},
```

- [ ] **Step 5: Update `updateActive()` — remove chain-bounce, add miniExplosion/ricochet**

Remove the entire `// 連刃 — one chain-bounce` block (lines 91-111).

After `Enemy.takeDamage(e, proj.damage, ...)` and before the `koori` freeze block, add the same `_miniExplosion` and `_ricochet` code as in Task 4 Step 6 (same pattern, `e` is the hit enemy variable):

```javascript
// 爆裂弾
if (proj._miniExplosion) {
  const r = 40
  enemies.getChildren()
    .filter(en => en.active && !en.dying && en !== e &&
      Phaser.Math.Distance.Between(e.x, e.y, en.x, en.y) < r)
    .forEach(en => Enemy.takeDamage(en, proj.damage * 0.4, e.x, e.y, affixes, 0))
  const g = scene.add.graphics().setDepth(10)
  g.lineStyle(2, 0xff6600, 0.8)
  g.strokeCircle(e.x, e.y, r)
  scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() })
}

// 彈射
if (proj._ricochet && proj._ricochetDepth < 2) {
  const next = enemies.getChildren()
    .filter(en => en.active && !en.dying && !proj.hitSet.has(en))
    .sort((a, b) =>
      Phaser.Math.Distance.Between(e.x, e.y, a.x, a.y) -
      Phaser.Math.Distance.Between(e.x, e.y, b.x, b.y))[0]
  if (next) {
    const r2 = getOrCreate(proj._pool, e.x, e.y, proj.texture.key)
    r2.setDisplaySize(proj.displayWidth, proj.displayHeight)
    r2.damage         = proj.damage * 0.7
    r2.hitSet         = new Set([e])
    r2.spawnX         = e.x
    r2.spawnY         = e.y
    r2.range          = 200
    r2.penetrate      = false
    r2.knockback      = proj.knockback
    r2._hitRadius     = proj._hitRadius
    r2._boomerang     = false
    r2._scatter       = proj._scatter
    r2._scatterFired  = false
    r2._miniExplosion = proj._miniExplosion
    r2._ricochet      = true
    r2._ricochetDepth = proj._ricochetDepth + 1
    r2._pool          = proj._pool
    r2._reversed      = false
    scene.physics.moveToObject(r2, next, 400)
  }
}
```

Keep the `koori` freeze block. Update the pierce logic: remove the `shouldPierce` variable and replace with:
```javascript
const shouldPierce = proj.penetrate || (entry.stats._evo === 'koori' && e._statusEffects?.frozen?.active)
if (!shouldPierce) proj._spent = true
```

- [ ] **Step 6: Verify in browser**

Kunai fires normally. No console errors.

- [ ] **Step 7: Commit**

```bash
git add src/weapons/Kunai.js
git commit -m "feat: Kunai — delete C-layer upgrades, add proj trait reads"
```

---

## Task 6: Homura.js — add _pool, proj trait flag copies

**Files:**
- Modify: `src/weapons/Homura.js`

Homura projectiles now need `_pool` for ricochet children, plus `_miniExplosion`/`_ricochet` flag copies. The C-layer upgrades (`scorch`, `chainExplode`) remain since they are evo/GameScene-handled — do NOT delete them.

- [ ] **Step 1: In `fire()`, add `s._pool = pool` and trait copies**

After `s._chainDepth = 0`, add:
```javascript
s._pool          = pool
s._miniExplosion = stats._miniExplosion || false
s._ricochet      = stats._ricochet      || false
s._ricochetDepth = 0
s._scatter       = stats._scatter       || false
s._scatterFired  = false
```

Note: Homura has no `updateActive()`, so _miniExplosion and _ricochet are handled by the GameScene overlap callback (see Task 11). The flags just need to be present on the sprite.

- [ ] **Step 2: Verify in browser**

Homura fires and explodes normally.

- [ ] **Step 3: Commit**

```bash
git add src/weapons/Homura.js
git commit -m "feat: Homura — add _pool + proj trait flag copies"
```

---

## Task 7: Ofuda.js — delete split/linger, rename _split→_scatter, add _pool, proj trait reads

**Files:**
- Modify: `src/weapons/Ofuda.js`

Delete `split`/`linger` upgrade entries. Delete the `_doSplit` helper at the bottom. Rename `_split`/`_splitFired` → `_scatter`/`_scatterFired` everywhere. Add `s._pool = pool`. Add trait flag copies. Use `doScatter` from projTraits.

- [ ] **Step 1: Add import**

```javascript
import { doScatter } from '../upgrades/projTraits.js'
```

- [ ] **Step 2: Delete two upgrade entries from `upgrades[]`**

Remove:
```javascript
{ id: 'split',  name: '分裂', ... apply: s => { s._split = true } },
{ id: 'linger', name: '滯留', ... apply: s => { s._linger = true } },
```

- [ ] **Step 3: Update `fire()` — rename flags, add _pool, add trait copies**

Replace `s._split = stats._split` and `s._splitFired = false` with:
```javascript
s._scatter      = stats._scatter || false
s._scatterFired = false
```

Add after those lines:
```javascript
s._pool          = pool
s._miniExplosion = stats._miniExplosion || false
s._ricochet      = stats._ricochet      || false
s._ricochetDepth = 0
```

Keep `s._linger`, `s._evoKaku`, and the kaku override block unchanged.

- [ ] **Step 4: Update `update(sprite)` — rename _split→_scatter**

The relevant block in Ofuda's `update()` currently reads:
```javascript
if (dist >= range) {
  if (sprite._split && !sprite._splitFired) {
    sprite._splitFired = true
    _doSplit(sprite)
  }
  sprite.disableBody(true, true)
  return
}
```

Replace the entire block with:
```javascript
if (Phaser.Math.Distance.Between(sprite.spawnX, sprite.spawnY, sprite.x, sprite.y) >= sprite.range) {
  if (sprite._scatter && !sprite._scatterFired) {
    doScatter(sprite, sprite.scene, {
      _explodeRadius: (sprite._explodeRadius || 30) * 0.5,
      _speed:         250,
      _evoKaku:       false,
      _target:        null,
      _linger:        false,
      range:          150,
    })
  }
  sprite.disableBody(true, true)   // ← must keep this so the projectile expires
  return
}
```

- [ ] **Step 5: Delete the `_doSplit` function**

Remove the entire `function _doSplit(proj) { ... }` block at the bottom of the file.

- [ ] **Step 6: Verify in browser**

Ofuda fires and explodes normally. No console errors.

- [ ] **Step 7: Commit**

```bash
git add src/weapons/Ofuda.js
git commit -m "feat: Ofuda — delete split/linger upgrades, rename _split→_scatter, use doScatter"
```

---

## Task 8: Tachi.js — delete C-layer, replace iaijutsu→charge, shadow→afterimage, add all Layer M traits

**Files:**
- Modify: `src/weapons/Tachi.js`

This is the biggest weapon change. The `_iaijutsu`/`_pendingSlash` guard becomes `_charge`/`_pendingCharge`. The shadow zone condition `_shadow || isMuramasa` becomes `_afterimage || isMuramasa`. New traits `_doom`, `_deathBurst`, `_rapidVortex` are added to the slash hit loop. New `_shockwave` ring emitter is added after `animationcomplete`. Whirlwind uses existing duration logic via `_whirlwind` flag.

- [ ] **Step 1: Delete `iaijutsu` and `shadow` from `upgrades[]`**

Remove:
```javascript
{ id: 'iaijutsu', name: '居合', desc: '...', apply: s => { s._iaijutsu = true } },
{ id: 'shadow',   name: '殘影', desc: '...', apply: s => { s._shadow = true } },
```

- [ ] **Step 2: Rewrite `fire()`**

Full replacement of the fire method. Key changes from current code:
- Replace `_iaijutsu`/`_pendingSlash` with `_charge`/`_pendingCharge`
- Replace `stats._shadow || isMuramasa` with `stats._afterimage || isMuramasa`
- Change afterimage damage multiplier from `0.6` to `0.5`
- Add `_rapidVortex` damage multiplier computation
- Add `_doom` mark on each hit
- Add `_deathBurst` on kill (uses `Enemy.takeDamage` return value)
- Add `_shockwave` ring emitter in `animationcomplete`
- Add `_whirlwind`-aware duration (800ms if whirlwind, else 400ms — reuse same pattern as Ogi)

```javascript
fire(scene, _pool, fromX, fromY, stats, enemies, player, affixes = []) {
  // 蓄力: block re-entry during pending slash
  if (stats._charge && stats._pendingCharge) return
  if (stats._charge) stats._pendingCharge = true

  const doSlash = () => {
    const isMuramasa = stats._evo === 'muramasa'
    const range  = stats.range  * (stats._charge ? 2 : 1) * (isMuramasa ? 1.5 : 1)
    const damage = stats.damage * (stats._charge ? 1.5 : 1) * (isMuramasa ? 1.3 : 1)

    // 疾旋: count nearby enemies once
    let dmgMult = 1
    if (stats._rapidVortex) {
      const nearbyCount = enemies.getChildren()
        .filter(e => e.active && !e.dying &&
          Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y) < 150).length
      dmgMult = 1 + Math.min(4, nearbyCount) * 0.25
    }

    // 旋風: whirlwind doubles slash duration and rotates facingDeg each frame
    const slashDuration = stats._whirlwind ? 800 : 500
    let facingDeg = 0   // rotation angle for whirlwind sweep
    let elapsedWhirl = 0

    const scale  = (range * 2) / 166
    const hitSet = new Set()

    const slash = scene.add.sprite(player.x, player.y, 'tachi-slash', 0)
      .setDepth(6).setOrigin(0.5, 0.5).setScale(scale)

    const onUpdate = (_, delta) => {
      if (stats._whirlwind) {
        elapsedWhirl += delta
        facingDeg = (facingDeg + delta * (360 / slashDuration)) % 360
      }
      slash.setPosition(player.x, player.y)
      enemies.getChildren()
        .filter(e => e.active && !e.dying && !hitSet.has(e) &&
          Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y) < range)
        .forEach(e => {
          hitSet.add(e)
          const killed = Enemy.takeDamage(e, damage * dmgMult, player.x, player.y, affixes, stats.knockback ?? 120)
          // 妖刀村正 evo — heal on each hit
          if (isMuramasa && scene._player) scene._player.heal(damage * 0.30)
          // 命運印記 — mark enemy for deferred explosion
          if (stats._doom) {
            e._doomTimer  = scene.time.now + 2000
            e._doomDamage = damage * dmgMult * 1.5
            e._doomRadius = 60
          }
          // 死爆 — burst on kill
          if (killed && stats._deathBurst) {
            const br = 60
            enemies.getChildren()
              .filter(en => en.active && !en.dying && en !== e &&
                Phaser.Math.Distance.Between(e.x, e.y, en.x, en.y) < br)
              .forEach(en => Enemy.takeDamage(en, damage * dmgMult, e.x, e.y, affixes, 0))
            const bg = scene.add.graphics().setDepth(10)
            bg.lineStyle(2, 0xff0000, 0.9)
            bg.strokeCircle(e.x, e.y, br)
            scene.tweens.add({ targets: bg, alpha: 0, duration: 250, onComplete: () => bg.destroy() })
          }
        })
    }

    scene.events.on('update', onUpdate)
    slash.play('tachi-slash')
    scene.tweens.add({ targets: slash, angle: 360, duration: slashDuration, ease: 'Linear' })

    slash.once('animationcomplete', () => {
      scene.events.off('update', onUpdate)
      stats._pendingCharge = false

      // 殘像 (afterimage) or 妖刀村正 — leave damage zone
      if (stats._afterimage || isMuramasa) {
        const sx = player.x, sy = player.y
        const zoneW = range, zoneH = range * 0.4
        const shadowColor = isMuramasa ? 0x880000 : 0x00ccff
        const g = scene.add.graphics().setDepth(5)
        g.fillStyle(shadowColor, 0.35)
        g.fillRect(sx - zoneW / 2, sy - zoneH / 2, zoneW, zoneH)
        const damageCd = new Map()
        const shadowHit = () => {
          const now = scene.time.now
          enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
            if (Math.abs(e.x - sx) < zoneW / 2 && Math.abs(e.y - sy) < zoneH / 2) {
              const last = damageCd.get(e) || 0
              if (now - last >= 300) {
                damageCd.set(e, now)
                Enemy.takeDamage(e, damage * 0.5, sx, sy, affixes, 0)
              }
            }
          })
        }
        scene.events.on('update', shadowHit)
        const cleanupShadow = () => {
          scene.events.off('update', shadowHit)
          g.destroy()
        }
        scene.time.delayedCall(1000, cleanupShadow)
        scene.events.once('shutdown', cleanupShadow)
      }

      // 衝波 — expanding ring
      if (stats._shockwave) {
        const shockHit = new Set()
        const sg = scene.add.graphics().setDepth(6)
        let r = 0
        const shockFn = (_, dt) => {
          r = Math.min(range, r + range * dt / 300)
          sg.clear().setPosition(player.x, player.y)
          sg.lineStyle(3, 0x88ccff, 0.8)
          sg.strokeCircle(0, 0, r)
          enemies.getChildren().filter(e => e.active && !e.dying && !shockHit.has(e)).forEach(e => {
            const d = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y)
            if (Math.abs(d - r) < 18) {
              shockHit.add(e)
              Enemy.takeDamage(e, damage * 0.5, player.x, player.y, affixes, 0)
            }
          })
          if (r >= range) {
            scene.events.off('update', shockFn)
            sg.destroy()
          }
        }
        scene.events.on('update', shockFn)
      }

      slash.destroy()
    })
  }

  if (stats._charge) {
    scene.time.delayedCall(300, doSlash)
  } else {
    doSlash()
  }
},
```

- [ ] **Step 3: Verify in browser**

Tachi slashes normally. Muramasa evo still heals. No console errors.

- [ ] **Step 4: Commit**

```bash
git add src/weapons/Tachi.js
git commit -m "feat: Tachi — replace C-layer with Layer M traits (_charge/_afterimage/_shockwave/_doom/_deathBurst/_rapidVortex)"
```

---

## Task 9: Ogi.js — delete upgrade entries, add Layer M trait reads

**Files:**
- Modify: `src/weapons/Ogi.js`

Ogi already reads `stats._whirlwind` and `stats._shockwave` in its `fire()` — no new read code needed for those. Only delete the upgrade *entries* from `upgrades[]`. Then add `_charge`, `_afterimage`, `_doom`, `_deathBurst`, `_rapidVortex` reads to the hit loop.

- [ ] **Step 1: Delete `whirlwind` and `shockwave` entries from `upgrades[]`**

Remove:
```javascript
{ id: 'whirlwind', name: '旋風', desc: '扇形持續旋轉一整圈（800ms）',        apply: s => { s._whirlwind = true } },
{ id: 'shockwave', name: '衝波', desc: '結束後發出擴張衝擊波（0.5倍傷害）', apply: s => { s._shockwave = true } },
```

- [ ] **Step 2: Rewrite `fire()` with `_charge` guard and `localRange`/`localDamage`**

**Important:** Inside `_doFire`, replace ALL occurrences of `stats.range` with `localRange` and ALL occurrences of `stats.damage` with `localDamage`. This includes the arc drawing loop, the enemy distance check, and `takeDamage` calls. Do a search-replace within the `_doFire` body before committing.

Add `_charge` / `_pendingCharge` guard at the start of `fire()`

```javascript
fire(scene, _pool, fromX, fromY, stats, enemies, player, affixes = []) {
  if (stats._charge && stats._pendingCharge) return
  if (stats._charge) stats._pendingCharge = true

  const _doFire = () => {
    // move all existing fire body into here
    // ... (entire existing fire body)
    // at end of animationcomplete callback: stats._pendingCharge = false
  }

  if (stats._charge) {
    scene.time.delayedCall(300, _doFire)
  } else {
    _doFire()
  }
},
```

For the charge, use `localRange = stats.range * 2` and `localDamage = stats.damage * 1.5` as local variables inside `_doFire` when `stats._charge` is true:
```javascript
const _doFire = () => {
  const isShinigami = stats._evo === 'shinigami'
  const localRange  = stats.range  * (stats._charge ? 2 : 1)
  const localDamage = stats.damage * (stats._charge ? 1.5 : 1)

  // 疾旋 multiplier
  let dmgMult = 1
  if (stats._rapidVortex) {
    const nearbyCount = enemies.getChildren()
      .filter(e => e.active && !e.dying &&
        Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y) < 150).length
    dmgMult = 1 + Math.min(4, nearbyCount) * 0.25
  }

  const hitSet = new Set()
  let elapsed  = 0
  const duration = stats._whirlwind ? 800 : 400
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

  const g = scene.add.graphics().setDepth(6)

  const updateFn = (_, delta) => {
    elapsed += delta
    const t = Math.min(elapsed / duration, 1)

    if (stats._whirlwind) facingDeg = (facingDeg + delta * (360 / duration)) % 360

    g.clear()
    g.setPosition(player.x, player.y)
    g.fillStyle(0xff8800, 0.45 * (1 - t))
    g.beginPath()
    g.moveTo(0, 0)
    const segs = 12
    for (let i = 0; i <= segs; i++) {
      const a = Phaser.Math.DegToRad(facingDeg - 60 + 120 * i / segs)
      g.lineTo(Math.cos(a) * localRange, Math.sin(a) * localRange)
    }
    g.closePath()
    g.fillPath()

    enemies.getChildren()
      .filter(e => e.active && !e.dying && !hitSet.has(e))
      .forEach(e => {
        const dist = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y)
        if (dist > localRange) return
        const angleDeg = Phaser.Math.RadToDeg(
          Phaser.Math.Angle.Between(player.x, player.y, e.x, e.y))
        const diff = Phaser.Math.Wrap(angleDeg - facingDeg, -180, 180)
        if (Math.abs(diff) <= 60) {
          hitSet.add(e)
          const killed = Enemy.takeDamage(e, localDamage * dmgMult, player.x, player.y, affixes, stats.knockback ?? 200)
          // 死神扇 evo — force curse on hit
          if (isShinigami && e._statusEffects && e._statusEffects.curse) {
            e._statusEffects.curse.active = true
            e._statusEffects.curse.timer  = 4000
          }
          // 命運印記
          if (stats._doom) {
            e._doomTimer  = scene.time.now + 2000
            e._doomDamage = localDamage * dmgMult * 1.5
            e._doomRadius = 60
          }
          // 死爆
          if (killed && stats._deathBurst) {
            const br = 60
            enemies.getChildren()
              .filter(en => en.active && !en.dying && en !== e &&
                Phaser.Math.Distance.Between(e.x, e.y, en.x, en.y) < br)
              .forEach(en => Enemy.takeDamage(en, localDamage * dmgMult, e.x, e.y, affixes, 0))
            const bg = scene.add.graphics().setDepth(10)
            bg.lineStyle(2, 0xff0000, 0.9)
            bg.strokeCircle(e.x, e.y, br)
            scene.tweens.add({ targets: bg, alpha: 0, duration: 250, onComplete: () => bg.destroy() })
          }
        }
      })

    if (elapsed >= duration) {
      scene.events.off('update', updateFn)
      g.destroy()
      stats._pendingCharge = false

      // 殘像 afterimage zone
      if (stats._afterimage) {
        const sx = player.x, sy = player.y
        const zoneW = localRange, zoneH = localRange * 0.4
        const ag = scene.add.graphics().setDepth(5)
        ag.fillStyle(0x00ccff, 0.35)
        ag.fillRect(sx - zoneW / 2, sy - zoneH / 2, zoneW, zoneH)
        const damageCd = new Map()
        const afterHit = () => {
          const now = scene.time.now
          enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
            if (Math.abs(e.x - sx) < zoneW / 2 && Math.abs(e.y - sy) < zoneH / 2) {
              const last = damageCd.get(e) || 0
              if (now - last >= 300) {
                damageCd.set(e, now)
                Enemy.takeDamage(e, localDamage * 0.5, sx, sy, affixes, 0)
              }
            }
          })
        }
        scene.events.on('update', afterHit)
        const cleanupAfter = () => {
          scene.events.off('update', afterHit)
          ag.destroy()
        }
        scene.time.delayedCall(1000, cleanupAfter)
        scene.events.once('shutdown', cleanupAfter)
      }

      // 衝波 — existing shockwave code (already present in Ogi, keep as-is)
      if (stats._shockwave) {
        const shockHit = new Set()
        const sg = scene.add.graphics().setDepth(6)
        let r = 0
        const shockFn = (_, dt) => {
          r = Math.min(localRange, r + localRange * dt / 300)
          sg.clear().setPosition(player.x, player.y)
          sg.lineStyle(3, 0xff8800, 0.8)
          sg.strokeCircle(0, 0, r)
          enemies.getChildren().filter(e => e.active && !e.dying && !shockHit.has(e)).forEach(e => {
            const d = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y)
            if (Math.abs(d - r) < 18) {
              shockHit.add(e)
              Enemy.takeDamage(e, localDamage * 0.5, player.x, player.y, affixes, 0)
            }
          })
          if (r >= localRange) {
            scene.events.off('update', shockFn)
            sg.destroy()
          }
        }
        scene.events.on('update', shockFn)
      }
    }
  }
  scene.events.on('update', updateFn)
}
```

- [ ] **Step 3: Verify in browser**

Ogi sweeps normally. No console errors.

- [ ] **Step 4: Commit**

```bash
git add src/weapons/Ogi.js
git commit -m "feat: Ogi — delete C-layer upgrade entries, add Layer M trait reads"
```

---

## Task 10: Kusarigama.js — delete C-layer, add Layer M traits

**Files:**
- Modify: `src/weapons/Kusarigama.js`

Delete `gravity`/`doubleOrbit` upgrade entries. Remove gravity pull code and outer sickle orbit code from `updateActive()`. Add `_rapidVortex`, `_doom`, `_deathBurst`, `_shockwave`, `_afterimage` reads.

- [ ] **Step 1: Delete `gravity` and `doubleOrbit` from `upgrades[]`**

Remove:
```javascript
{ id: 'gravity',     name: '引力場', desc: '...', apply: s => { s._gravity = true } },
{ id: 'doubleOrbit', name: '雙軌道', desc: '...', apply: s => { s._doubleOrbit = true } },
```

- [ ] **Step 2: Remove gravity pull block from `updateActive()`**

Delete lines 53-70 (the entire `// Gravity pull` block).

- [ ] **Step 3: Remove outer orbit block from `updateActive()`**

Delete lines 97-123 (the `// Outer orbit (雙軌道)` block).

- [ ] **Step 4: Add Layer M trait reads to `updateActive()`**

At the top of `updateActive()`, after the lazy init block (`if (!entry.sickles) {...}`), add the `_rapidVortex` multiplier computation:

```javascript
// 疾旋: compute once per frame before all contact checks
let rvMult = 1
if (entry.stats._rapidVortex) {
  const nearbyCount = enemies.getChildren()
    .filter(e => e.active && !e.dying &&
      Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y) < 150).length
  rvMult = 1 + Math.min(4, nearbyCount) * 0.25
}

// 殘像 trail every 400ms
if (entry.stats._afterimage) {
  if (!entry.lastTrailTime) entry.lastTrailTime = 0
  if (now >= entry.lastTrailTime + 400 && entry.sickles.length > 0) {
    entry.lastTrailTime = now
    entry.sickles.forEach(sickle => {
      const trail = scene.add.image(sickle.x, sickle.y, 'kusarigama')
        .setDisplaySize(sickle.displayWidth, sickle.displayHeight)
        .setRotation(sickle.rotation).setAlpha(0.4).setDepth(6)
      scene.tweens.add({ targets: trail, alpha: 0, duration: 300, onComplete: () => trail.destroy() })
    })
  }
}
```

Note: `now` is already defined as `const now = scene.time.now` at the top of `updateActive()`. If it isn't, add it before the above block.

In the contact damage block (inside the inner orbit loop), change:
```javascript
Enemy.takeDamage(e, entry.stats.damage, sx, sy, affixes, 0)
```
to:
```javascript
const killed = Enemy.takeDamage(e, entry.stats.damage * rvMult, sx, sy, affixes, 0)
// 命運印記 — refresh timer on contact
if (entry.stats._doom) {
  e._doomTimer  = now + 2000
  e._doomDamage = entry.stats.damage * rvMult * 1.5
  e._doomRadius = 60
}
// 死爆 — burst on kill
if (killed && entry.stats._deathBurst) {
  const br = 60
  enemies.getChildren()
    .filter(en => en.active && !en.dying && en !== e &&
      Phaser.Math.Distance.Between(e.x, e.y, en.x, en.y) < br)
    .forEach(en => Enemy.takeDamage(en, entry.stats.damage * rvMult, e.x, e.y, affixes, 0))
  const bg = scene.add.graphics().setDepth(10)
  bg.lineStyle(2, 0xff0000, 0.9)
  bg.strokeCircle(e.x, e.y, br)
  scene.tweens.add({ targets: bg, alpha: 0, duration: 250, onComplete: () => bg.destroy() })
}
// 衝波 — ring on kill
if (killed && entry.stats._shockwave) {
  const shockHit = new Set()
  const sg = scene.add.graphics().setDepth(6)
  let rv = 0
  const shockFn = (_, dt) => {
    rv = Math.min(80, rv + 80 * dt / 300)
    sg.clear().setPosition(player.x, player.y)
    sg.lineStyle(3, 0xff8800, 0.8)
    sg.strokeCircle(0, 0, rv)
    enemies.getChildren().filter(en => en.active && !en.dying && !shockHit.has(en)).forEach(en => {
      const d = Phaser.Math.Distance.Between(player.x, player.y, en.x, en.y)
      if (Math.abs(d - rv) < 18) {
        shockHit.add(en)
        Enemy.takeDamage(en, entry.stats.damage * rvMult * 0.5, player.x, player.y, affixes, 0)
      }
    })
    if (rv >= 80) {
      scene.events.off('update', shockFn)
      sg.destroy()
    }
  }
  scene.events.on('update', shockFn)
}
```

Keep the `isDokuja` poison apply block unchanged.

- [ ] **Step 5: Verify in browser**

Kusarigama orbit still works. Gravity pull is gone. No console errors.

- [ ] **Step 6: Commit**

```bash
git add src/weapons/Kusarigama.js
git commit -m "feat: Kusarigama — delete gravity/doubleOrbit, add Layer M trait reads"
```

---

## Task 11: GameScene.js — infrastructure, pool injection, handlers, doom timer

**Files:**
- Modify: `src/scenes/GameScene.js`

This task wires everything together: imports, init, one-time weapon dedup, Layer P/M injection, handlers, retroactive apply in `_addWeapon()`, and doom timer in `update()`.

- [ ] **Step 1: Add imports at the top of GameScene.js**

After the existing imports, add:
```javascript
import { ALL_PROJ_TRAITS, PROJ_WEAPON_IDS }              from '../upgrades/projTraits.js'
import { ALL_MELEE_TRAITS, MELEE_WEAPON_IDS, SWING_WEAPON_IDS } from '../upgrades/meleeTraits.js'
import { getOrCreate }                                    from '../weapons/_pool.js'
```

Note: `doScatter` is NOT imported into GameScene — scatter for Ofuda/Homura is handled in their own `update()` methods. `getOrCreate` IS needed for the ricochet handler (Step 8).

- [ ] **Step 2: In `create()`, add two new Sets after `_offeredEvos`**

```javascript
this._projTraitsOwned  = new Set()
this._meleeTraitsOwned = new Set()
```

- [ ] **Step 3: In `_addWeapon()`, update the entry object at line 258**

Change `this._weapons.push({ weapon, stats: { ...weapon.baseStats }, timer: 0, projectiles })` to:
```javascript
const entry = { weapon, stats: { ...weapon.baseStats }, timer: 0, projectiles, takenUpgrades: new Set(), lastTrailTime: 0 }
```

Then after that line add retroactive trait application:
```javascript
// Retroactively apply owned Layer P traits to new weapon
if (PROJ_WEAPON_IDS.has(weapon.id)) {
  for (const trait of ALL_PROJ_TRAITS) {
    if (this._projTraitsOwned.has(trait.id)) trait.apply(entry.stats)
  }
}
// Retroactively apply owned Layer M traits to new weapon
if (MELEE_WEAPON_IDS.has(weapon.id)) {
  for (const trait of ALL_MELEE_TRAITS) {
    if (!this._meleeTraitsOwned.has(trait.id)) continue
    if (trait.swingOnly && !SWING_WEAPON_IDS.has(weapon.id)) continue
    trait.apply(entry.stats)
  }
}
this._weapons.push(entry)
```

(Remove the old `this._weapons.push(...)` line since it's replaced above.)

- [ ] **Step 4: In `_buildUpgradePool()`, fix weapon upgrade injection for one-time dedup**

Replace the current weapon upgrade injection:
```javascript
for (const entry of this._weapons)
  pool.push(...(entry.weapon.upgrades ?? []).map(u => ({
    ...u, target: 'weapon', weaponId: entry.weapon.id,
  })))
```
with:
```javascript
for (const entry of this._weapons) {
  for (const u of (entry.weapon.upgrades ?? [])) {
    if (u.oneTime && entry.takenUpgrades.has(u.id)) continue
    pool.push({ ...u, target: 'weapon', weaponId: entry.weapon.id })
  }
}
```

- [ ] **Step 5: In `_buildUpgradePool()`, add Layer P/M injection after the evolution injection block**

After the `for (const evo of ALL_EVOLUTIONS) { ... }` block, add:
```javascript
// Layer P — projectile universal traits
const hasProjWeapon = this._weapons.some(w => PROJ_WEAPON_IDS.has(w.weapon.id))
if (hasProjWeapon) {
  for (const trait of ALL_PROJ_TRAITS) {
    if (!this._projTraitsOwned.has(trait.id))
      pool.push({ ...trait, target: 'proj_trait' })
  }
}

// Layer M — melee universal traits
const hasMeleeWeapon = this._weapons.some(w => MELEE_WEAPON_IDS.has(w.weapon.id))
const hasSwingWeapon = this._weapons.some(w => SWING_WEAPON_IDS.has(w.weapon.id))
if (hasMeleeWeapon) {
  for (const trait of ALL_MELEE_TRAITS) {
    if (this._meleeTraitsOwned.has(trait.id)) continue
    if (trait.swingOnly && !hasSwingWeapon) continue
    pool.push({ ...trait, target: 'melee_trait' })
  }
}
```

- [ ] **Step 6: In `upgrade-chosen` handler, update weapon branch and add new trait branches**

Update the weapon handler to track one-time upgrades:
```javascript
if (upgrade.target === 'weapon') {
  const entry = this._weapons.find(e => e.weapon.id === upgrade.weaponId)
  if (entry) {
    upgrade.apply(entry.stats)
    if (upgrade.oneTime) entry.takenUpgrades.add(upgrade.id)
  }
}
```

Add before the final `else` branch:
```javascript
} else if (upgrade.target === 'proj_trait') {
  this._projTraitsOwned.add(upgrade.id)
  for (const entry of this._weapons) {
    if (PROJ_WEAPON_IDS.has(entry.weapon.id)) upgrade.apply(entry.stats)
  }
} else if (upgrade.target === 'melee_trait') {
  this._meleeTraitsOwned.add(upgrade.id)
  for (const entry of this._weapons) {
    if (MELEE_WEAPON_IDS.has(entry.weapon.id)) {
      if (!upgrade.swingOnly || SWING_WEAPON_IDS.has(entry.weapon.id))
        upgrade.apply(entry.stats)
    }
  }
}
```

- [ ] **Step 7: In `update()`, add doom timer pass**

In `GameScene.update()`, add after the regen block and before `this._enemies.getChildren().forEach(e => Enemy.update(...))`:
```javascript
// 命運印記 — deferred explosion check
this._enemies.getChildren().forEach(e => {
  if (!e.active || !e._doomTimer) return
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
```

- [ ] **Step 8: In `_addWeapon()` explosion callback, add `_miniExplosion` handling**

Currently the overlap callback handles `_explodeRadius`, `_scorch`, `_chainExplode`, `_linger`, `_evoKaku`. Add `_miniExplosion` handling at the end of the overlap body (before `if (!proj.penetrate) proj._spent = true`):

```javascript
// 爆裂弾 — also fires in GameScene for Homura/Ofuda (which have no updateActive)
if (proj._miniExplosion) {
  const r = 40
  this._enemies.getChildren()
    .filter(e => e.active && !e.dying && e !== enemy &&
      Phaser.Math.Distance.Between(enemy.x, enemy.y, e.x, e.y) < r)
    .forEach(e => Enemy.takeDamage(e, proj.damage * 0.4, enemy.x, enemy.y, this._affixes, 0))
  const mg = this.add.graphics().setDepth(10)
  mg.lineStyle(2, 0xff6600, 0.8)
  mg.strokeCircle(enemy.x, enemy.y, r)
  this.tweens.add({ targets: mg, alpha: 0, duration: 200, onComplete: () => mg.destroy() })
}
```

Also add a `_ricochet` handler for Homura/Ofuda (which have no `updateActive()`). After the `_miniExplosion` block, add:

```javascript
// 彈射 — ricochet for Homura/Ofuda (no updateActive)
if (proj._ricochet && (proj._ricochetDepth ?? 0) < 2) {
  const next = this._enemies.getChildren()
    .filter(e => e.active && !e.dying && !proj.hitSet.has(e))
    .sort((a, b) =>
      Phaser.Math.Distance.Between(enemy.x, enemy.y, a.x, a.y) -
      Phaser.Math.Distance.Between(enemy.x, enemy.y, b.x, b.y))[0]
  if (next) {
    const r2 = getOrCreate(projectiles, enemy.x, enemy.y, proj.texture.key)
    r2.setDisplaySize(proj.displayWidth, proj.displayHeight)
    r2.damage         = proj.damage * 0.7
    r2.hitSet         = new Set([enemy])
    r2.spawnX         = enemy.x
    r2.spawnY         = enemy.y
    r2.range          = 200
    r2.penetrate      = false
    r2.knockback      = proj.knockback
    r2._hitRadius     = proj._hitRadius || 14
    r2._boomerang     = false
    r2._scatter       = proj._scatter
    r2._scatterFired  = false
    r2._miniExplosion = proj._miniExplosion
    r2._ricochet      = true
    r2._ricochetDepth = (proj._ricochetDepth || 0) + 1
    r2._pool          = projectiles
    r2._reversed      = false
    r2._explodeRadius = proj._explodeRadius
    r2._explodeMult   = proj._explodeMult
    r2._scorch        = false
    r2._chainExplode  = false
    r2._chainDepth    = 99
    r2._linger        = false
    r2._evoKaku       = false
    r2._target        = next    // for Ofuda homing
    r2._speed         = proj._speed
    this.physics.moveToObject(r2, next, proj._speed || 200)
  }
}
```

Note: the `entry` variable is available in the overlap callback scope (see `_addWeapon`). Shuriken and Kunai have their own `updateActive()` that handles `_miniExplosion`/`_ricochet` directly — this GameScene handler covers Homura and Ofuda.

- [ ] **Step 9: Verify in browser**

Run `npm run dev`. Level up — upgrade cards now appear for 回旋/分裂/穿透/爆裂弾/彈射 (投射 badge) and 死爆/命運印記/疾旋/殘像/衝波/蓄力/旋風 (近戰 badge). Picking a Layer P trait and then firing the weapon shows the trait effect. No console errors.

- [ ] **Step 10: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "feat: GameScene — Layer P/M trait pool injection, one-time dedup, doom timer, retroactive apply"
```

---

## Task 12: UpgradeScene.js — add badge entries

**Files:**
- Modify: `src/scenes/UpgradeScene.js:5-12`

- [ ] **Step 1: Add two entries to the `CATEGORY` map**

```javascript
proj_trait:  { color: 0x0088ff, label: '投射', text: '#88ccff' },
melee_trait: { color: 0xff6600, label: '近戰', text: '#ffaa44' },
```

The `CATEGORY` object should now have 8 entries total.

- [ ] **Step 2: Verify in browser**

Level up with a projectile weapon. The Layer P trait cards show a blue '投射' badge. Level up with Tachi/Ogi. The Layer M trait cards show an orange '近戰' badge.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/UpgradeScene.js
git commit -m "feat: UpgradeScene — add proj_trait and melee_trait badge entries"
```

---

## Final Verification Checklist

After all tasks are complete, perform these in-game checks:

- [ ] Start with Shuriken. Level to get 分裂 (pt_scatter). Shuriken projectiles split into 3 small shuriken on expiry.
- [ ] Start with Shuriken. Level to get 回旋 (pt_boomerang). Shurikens reverse at max range.
- [ ] Start with Shuriken + 雷轟剣 evo. Level to get 彈射 (pt_ricochet). Shuriken chain-bounces AND lightning chain (both fire).
- [ ] Start with Kunai. Level to get 穿透 (pt_pierce). Kunai pierces all enemies.
- [ ] Pick 命運印記 (mt_doom) with Tachi. Hit an enemy. After ~2 seconds, purple ring explodes at the enemy's last position.
- [ ] Pick 死爆 (mt_deathburst) with Ogi. Kill an enemy in a group. Nearby enemies take damage.
- [ ] Pick 疾旋 (mt_rapidvortex) with Kusarigama surrounded by enemies. DPS visibly higher vs isolated enemy.
- [ ] Pick 蓄力 (mt_charge) with Tachi. A 300ms delay before the slash fires. Slash arc is visibly larger.
- [ ] Pick 旋風 (mt_whirlwind) with Ogi. The fan sweep rotates a full 360° instead of stopping.
- [ ] One-time upgrade dedup: once you pick a Layer P/M trait, it never appears in the pool again.
- [ ] New weapon picked after traits: the new weapon immediately has all owned traits applied.
- [ ] No console errors during normal play.
