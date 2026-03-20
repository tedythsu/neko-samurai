# Universal Weapon Traits (Layer P / Layer M) Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace per-weapon C-layer behavior upgrades with two universal modifier pools — Layer P (projectile weapons) and Layer M (melee weapons) — applied at character level, fix one-time upgrade deduplication, and delete deprecated per-weapon flags.

**Architecture:** Character-level trait sets (`scene._projTraitsOwned`, `scene._meleeTraitsOwned`) apply their stats flags to all matching weapon entries simultaneously. New weapon entries receive retroactive application on pickup. Traits are offered once per run (like mechanicals).

**Tech Stack:** Phaser 3, existing weapon/affix/mechanical architecture, `_buildUpgradePool()` injection pattern.

---

## Part 1: One-Time Upgrade Fix

### Problem
16 boolean behaviour flags in weapon `upgrades[]` arrays (e.g. `_boomerang`, `_scatter`, `_chainHit`, `_alwaysPierce`, `_iaijutsu`, `_shadow`, `_whirlwind`, `_shockwave`, `_gravity`, `_doubleOrbit`, `_scorch`, `_chainExplode`, `_split`, `_linger`) have no dedup guard — once taken, they still appear in future upgrade pools because `_buildUpgradePool()` does not filter per-weapon one-time upgrades.

### Fix
- Each weapon entry gets an `entry.takenUpgrades = new Set()` initialised in `_addWeapon()`.
- All 16 one-time weapon upgrades (the behaviour flags listed above) gain `oneTime: true`.
- The weapon upgrade injection in `_buildUpgradePool()` filters: `if (u.oneTime && entry.takenUpgrades.has(u.id)) continue`.
- When a weapon upgrade is chosen in the `upgrade-chosen` handler, if `upgrade.oneTime` is truthy, add `upgrade.id` to `entry.takenUpgrades`.

This is the same pattern already used by `_playerUpgradesOwned` and `_mechanicalsOwned`.

---

## Part 2: Delete C-Layer Per-Weapon Behaviour Upgrades

Remove the following upgrade entries entirely from each weapon file. The functionality is replaced by Layer P / Layer M traits.

| Weapon | Upgrades to Delete |
|--------|-------------------|
| Shuriken | `boomerang` (回転刃), `scatter` (散花) |
| Kunai | `chainHit` (連刃), `alwaysPierce` (穿心) |
| Tachi | `iaijutsu` (居合), `shadow` (殘影) |
| Ogi | `whirlwind` (旋風), `shockwave` (衝波) |
| Kusarigama | `gravity` (引力場), `doubleOrbit` (雙軌道) |
| Homura | `scorch` (焦土), `chainExplode` (連鎖爆炸) |
| Ofuda | `split` (分裂), `linger` (滯留) |

After deletion, also remove the `stats` flag reads from each weapon's `fire()`, `update()`, and `updateActive()` methods that checked these flags (e.g. `if (sprite._boomerang)`, `if (entry.stats._gravity)`, etc.). Scorch/linger/chainExplode/kaku handler branches in `GameScene._addWeapon()` explosion callback remain — they are now fed by Layer P traits instead.

The Kunai `_alwaysPierce` check in `fire()` (`s.penetrate = stats.penetrate || stats._alwaysPierce || false`) simplifies to `s.penetrate = stats.penetrate || false`. The Kunai `_chainHit` teleport in `updateActive()` is removed entirely. Frozen-pierce logic for 氷刃苦無 (`koori` evo) is **kept** — it is not a C-layer flag, it is an evolution-only check.

**Tachi `_shadow` → `_afterimage` rename note:** Tachi's existing `fire()` checks `stats._shadow` inside the shadow zone condition: `if (stats._shadow || isMuramasa)`. When deleting the `_shadow` upgrade, this condition **must** be updated to `if (stats._afterimage || isMuramasa)` so the Muramasa evo shadow zone continues to function.

**Tachi `_iaijutsu` → `_charge` rename note:** Tachi's existing `fire()` contains a `_pendingSlash` guard block. When deleting the `_iaijutsu` upgrade, remove the entire `_pendingSlash` guard (`if (stats._iaijutsu && stats._pendingSlash) return; if (stats._iaijutsu) stats._pendingSlash = true`) and replace it with the `_charge`/`_pendingCharge` guard described in Part 4.

**Ogi read paths already present:** Ogi's `fire()` already reads `stats._whirlwind` (duration switch) and `stats._shockwave` (shockwave tween). Do not re-add these reads — only delete the upgrade *entries* from `upgrades[]`. The read paths stay.

---

## Part 3: Layer P — Universal Projectile Traits

**File:** `src/upgrades/projTraits.js`

Layer P traits are `oneTime: true` (offered once per run). They set boolean/numeric flags on the stats object of every projectile weapon entry currently held. New projectile weapon entries inherit all owned traits retroactively.

**Projectile weapons:** `shuriken`, `kunai`, `homura`, `ofuda`

### Required imports for `projTraits.js`
```javascript
import Phaser from 'phaser'
import { getOrCreate } from '../weapons/_pool.js'
```

### Exports
```javascript
export const PROJ_WEAPON_IDS = new Set(['shuriken', 'kunai', 'homura', 'ofuda'])
```

### Trait Definitions

```javascript
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
```

### `doScatter` Shared Helper

`doScatter(proj, scene, extraProps = {})` — call from each weapon's `update(sprite)` by passing `sprite.scene` as `scene`. The `extraProps` object is merged onto each scatter child after generic fields, allowing weapon-specific overrides (see Ofuda notes below).

```javascript
export function doScatter(proj, scene, extraProps = {}) {
  if (proj._scatterFired) return
  proj._scatterFired = true
  const pool = proj._pool
  if (!pool) return   // safety guard — pool must be set at fire() time
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
    s._pool          = pool
    s._reversed      = false
    s._ricochetDepth = 99   // scatter children cannot ricochet
    Object.assign(s, extraProps)   // weapon-specific overrides
    const angle = baseAngle + Phaser.Math.DegToRad(i * 45)
    scene.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), 400, s.body.velocity)
  }
}
```

### Required `_pool` assignment in `fire()`

Every projectile weapon's `fire()` must set `s._pool = pool` on each created sprite. Verify and add this line if missing in:
- `Homura.js fire()` — add `s._pool = pool`
- `Ofuda.js fire()` — add `s._pool = pool`
- `Shuriken.js fire()` — already present
- `Kunai.js fire()` — already present

### Trait Behaviour Implementation

Each trait flag is copied onto the projectile sprite at `fire()` time, then read in `update()`/`updateActive()`.

**回旋 (`_boomerang`):** Copy at fire: `s._boomerang = stats._boomerang || false`. In `update(sprite)`: if `sprite._boomerang && !sprite._reversed && dist >= sprite.range` → reverse velocity, set `sprite._reversed = true`. On return to ≤30px of spawn, call scatter if applicable then expire.

**分裂 (`_scatter`):** Copy at fire: `s._scatter = stats._scatter || false`, `s._scatterFired = false`. **Important for Ofuda:** Ofuda's current `fire()` assigns `s._split` and `s._splitFired` — when migrating, delete those two assignments and replace with `s._scatter = stats._scatter || false` and `s._scatterFired = false`. Likewise, Ofuda's current `update()` checks `sprite._split`; replace that check with `sprite._scatter`. In `update(sprite)` expiry path (range reached, not boomerang return): call `doScatter(sprite, sprite.scene, extraProps)`. Weapon-specific `extraProps`:
- Shuriken: `{}` (no extras needed)
- Kunai: `{}` (no extras needed)
- Homura: `{ _explodeRadius: (sprite._explodeRadius || 0) * 0.5, _scorch: false, _chainExplode: false, _chainDepth: 99 }` — scatter children should not chain-explode
- Ofuda: `{ _explodeRadius: (sprite._explodeRadius || 30) * 0.5, _speed: 250, _evoKaku: false, _target: null, _linger: false, range: 150 }` — scatter children need these to trigger explosion, correct speed, and preserve current 150px range

**穿透 (`stats.penetrate`):** At `fire()` time: `s.penetrate = stats.penetrate || false`. When penetrate is true, `proj._spent` is never set after a hit. This replaces both the `貫通` mechanical flag and the former Kunai `穿心`.

**爆裂弾 (`_miniExplosion`):** Copy at fire: `s._miniExplosion = stats._miniExplosion || false`. In `updateActive()` on hit:
```javascript
if (proj._miniExplosion) {
  const r = 40
  enemies.getChildren()
    .filter(e => e.active && !e.dying && e !== hitEnemy &&
      Phaser.Math.Distance.Between(hitEnemy.x, hitEnemy.y, e.x, e.y) < r)
    .forEach(e => Enemy.takeDamage(e, proj.damage * 0.4, hitEnemy.x, hitEnemy.y, affixes, 0))
  const g = scene.add.graphics().setDepth(10)
  g.lineStyle(2, 0xff6600, 0.8)
  g.strokeCircle(hitEnemy.x, hitEnemy.y, r)
  scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() })
}
```

**彈射 (`_ricochet`):** Copy at fire: `s._ricochet = stats._ricochet || false`, `s._ricochetDepth = 0`. In `updateActive()` on hit, after damage dealt:
```javascript
if (proj._ricochet && proj._ricochetDepth < 2) {
  const next = enemies.getChildren()
    .filter(e => e.active && !e.dying && !proj.hitSet.has(e))
    .sort((a, b) =>
      Phaser.Math.Distance.Between(hitEnemy.x, hitEnemy.y, a.x, a.y) -
      Phaser.Math.Distance.Between(hitEnemy.x, hitEnemy.y, b.x, b.y))[0]
  if (next) {
    const r = getOrCreate(proj._pool, hitEnemy.x, hitEnemy.y, proj.texture.key)
    r.setDisplaySize(proj.displayWidth, proj.displayHeight)
    r.damage         = proj.damage * 0.7
    r.hitSet         = new Set([hitEnemy])
    r.spawnX         = hitEnemy.x
    r.spawnY         = hitEnemy.y
    r.range          = 200
    r.penetrate      = false
    r.knockback      = proj.knockback
    r._hitRadius     = proj._hitRadius
    r._boomerang     = false
    r._scatter       = proj._scatter
    r._scatterFired  = false
    r._miniExplosion = proj._miniExplosion
    r._ricochet      = true
    r._ricochetDepth = proj._ricochetDepth + 1
    r._pool          = proj._pool
    r._reversed      = false
    scene.physics.moveToObject(r, next, 400)
  }
}
```
Note: ricochet children inherit `_scatter` (they can scatter on expiry), but `_ricochetDepth = depth + 1` prevents further ricochets once depth reaches 2.

---

## Part 4: Layer M — Universal Melee Traits

**File:** `src/upgrades/meleeTraits.js`

Layer M traits are `oneTime: true`. They apply to all melee weapon entries held. New melee weapon entries inherit all owned traits retroactively.

**Melee weapons:** `tachi`, `ogi`, `kusarigama`
**Swing weapons (subset):** `tachi`, `ogi`

### Exports
```javascript
export const MELEE_WEAPON_IDS = new Set(['tachi', 'ogi', 'kusarigama'])
export const SWING_WEAPON_IDS = new Set(['tachi', 'ogi'])
```

`蓄力` and `旋風` have `swingOnly: true` — they are only injected if the player holds at least one swing weapon. They still apply to ALL swing weapons held (not locked to a single weapon). Kusarigama never receives these traits.

### Trait Definitions

```javascript
export const ALL_MELEE_TRAITS = [
  // --- Universal melee ---
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
  // --- Swing-only (tachi + ogi) ---
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

### Trait Behaviour Implementation

**死爆 (`_deathBurst`):** Use the return value of `Enemy.takeDamage()` — it returns `true` when the hit causes death (hp drops to ≤ 0). Check `if (killed && entry.stats._deathBurst)` where `killed` is the return value:

```javascript
const killed = Enemy.takeDamage(e, dmg, sx, sy, affixes, 0)
if (killed && entry.stats._deathBurst) {
  const r = 60
  enemies.getChildren()
    .filter(en => en.active && !en.dying && en !== e &&
      Phaser.Math.Distance.Between(e.x, e.y, en.x, en.y) < r)
    .forEach(en => Enemy.takeDamage(en, entry.stats.damage, e.x, e.y, affixes, 0))
  const g = scene.add.graphics().setDepth(10)
  g.lineStyle(2, 0xff0000, 0.9)
  g.strokeCircle(e.x, e.y, r)
  scene.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() })
}
```

First verify that `Enemy.takeDamage` returns a boolean (read `src/entities/Enemy.js` — confirm the `takeDamage` function ends with `return true` on kill path and `return false` otherwise). If it does not currently return a boolean, add `return true` to the kill path and `return false` to the early-exit paths in `Enemy.takeDamage`.

For Kusarigama (contact damage): apply same pattern per contact tick.
For Kusarigama `_shockwave` on-kill: `const killed = Enemy.takeDamage(...); if (killed && entry.stats._shockwave) { /* emit ring */ }`

**命運印記 (`_doom`):** On hit (not kill), if `entry.stats._doom`:
- Set `e._doomTimer = scene.time.now + 2000`, `e._doomDamage = entry.stats.damage * 1.5`, `e._doomRadius = 60`.
- For Kusarigama contact ticks: refresh the timer (`e._doomTimer = scene.time.now + 2000`) rather than stacking.
- Enemy death must clear the doom timer. In `Enemy._triggerDeath(sprite)` (the existing death handler in `src/entities/Enemy.js`), add `sprite._doomTimer = null` at the start of the function.
- The doom explosion fires in `GameScene.update()` — see Part 5.

**疾旋 (`_rapidVortex`):** Computed once per fire/tick frame, not per individual enemy hit. Count `nearbyCount` = active non-dying enemies within 150px of `player` position. `damageMultiplier = 1 + Math.min(4, nearbyCount) * 0.25`. For Tachi/Ogi: compute once at the start of the slash frame. For Kusarigama: compute `nearbyCount` and `damageMultiplier` **once at the top of `updateActive()`**, before all sickle/enemy loops — the per-enemy 200ms `damageCd` gate is separate and unrelated to this multiplier. Apply `dmg * damageMultiplier` when calling `takeDamage`.

**殘像 (`_afterimage`):** For Tachi/Ogi: after `animationcomplete`, create a Graphics rectangle at player position (width = `stats.range * (stats._whirlwind ? 2 : 1)`, height = `stats.range * 0.4`), fill cyan (0x00ccff), alpha=0.35. Uses `Map<enemy, lastHitTime>` with 300ms cooldown, applies `stats.damage * 0.5` for 1000ms, then destroys. Add shutdown guard: `const cleanup = () => { clearInterval; g.destroy() }; scene.events.once('shutdown', cleanup)`.
- For Kusarigama: every 400ms (compare `scene.time.now >= entry.lastTrailTime + 400`; initialise `entry.lastTrailTime = 0` in `_addWeapon()`), if the weapon is active, create a brief translucent copy of the sickle ring at current position (clone each sickle position as an image at depth 6, alpha=0.4), fade out over 300ms. After emitting the trail, set `entry.lastTrailTime = scene.time.now`.

**衝波 (`_shockwave`):** For Tachi/Ogi: after `animationcomplete`, a Graphics `strokeCircle` expands from 0 → `stats.range` px radius over 300ms via Phaser tween. Deals `stats.damage * 0.5` to any enemy touched during expansion (one hit per enemy, tracked via a local `Set`). Tween `onUpdate`: check all active non-dying enemies against current expanded radius each frame. Tween `onComplete`: `g.destroy()`. **Note:** Ogi's existing `fire()` already implements this shockwave (the `shockFn` pattern via `scene.events.on('update')` and the `onComplete: shockDone` cleanup). The existing Ogi implementation is already compliant with this spec — do not add a second shockwave emitter to Ogi's fire(). Only add this behaviour to Tachi (new) and Kusarigama (on-kill, new).
- For Kusarigama: on enemy kill (`killed === true` from `takeDamage`), emit a shockwave ring from player position: radius expands 0 → 80px over 300ms, same tween pattern.

**蓄力 (`_charge`, swing-only):** Replaces `_iaijutsu`/`_pendingSlash`. In Tachi/Ogi `fire()`: remove the old `_iaijutsu`/`_pendingSlash` guard block entirely. Add new guard: `if (stats._charge && stats._pendingCharge) return`. If `stats._charge`, set `stats._pendingCharge = true`, use `scene.time.delayedCall(300, doSlash)` with `localRange = stats.range * 2`, `localDamage = stats.damage * 1.5`. After slash resolves, `stats._pendingCharge = false`.

**旋風 (`_whirlwind`, swing-only):** Ogi's `fire()` already reads `stats._whirlwind` — no change needed to Ogi's read path. Tachi does not have a whirlwind-style attack shape; `stats._whirlwind` simply doubles the animation duration on Tachi as well (800ms instead of 400ms) and sets facingDeg rotation at 360°/800ms per frame.

---

## Part 5: GameScene Integration

### Required imports to add in `GameScene.js`
```javascript
import { ALL_PROJ_TRAITS, PROJ_WEAPON_IDS }   from '../upgrades/projTraits.js'
import { ALL_MELEE_TRAITS, MELEE_WEAPON_IDS, SWING_WEAPON_IDS } from '../upgrades/meleeTraits.js'
```

### Initialisation (in `create()`)
```javascript
this._projTraitsOwned  = new Set()   // Set of trait ids
this._meleeTraitsOwned = new Set()   // Set of trait ids
```

### `_buildUpgradePool()` — Weapon Upgrade Dedup Fix

Replace the current weapon-upgrade injection block:
```javascript
for (const entry of this._weapons) {
  for (const u of (entry.weapon.upgrades ?? [])) {
    if (u.oneTime && entry.takenUpgrades.has(u.id)) continue
    pool.push({ ...u, target: 'weapon', weaponId: entry.weapon.id })
  }
}
```

### `_buildUpgradePool()` — Layer P/M Injection (after evolution injection, before dedup)
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

### `upgrade-chosen` Handler

Update weapon branch to track one-time upgrades:
```javascript
if (upgrade.target === 'weapon') {
  const entry = this._weapons.find(e => e.weapon.id === upgrade.weaponId)
  if (entry) {
    upgrade.apply(entry.stats)
    if (upgrade.oneTime) entry.takenUpgrades.add(upgrade.id)
  }
}
```

Add new `else if` branches (before the final `else`):
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

### `_addWeapon()` Entry Initialisation

Add to the entry object:
- `entry.takenUpgrades = new Set()`
- `entry.lastTrailTime = 0`  (used by Kusarigama afterimage)

### `_addWeapon()` Retroactive Trait Application

At the end of `_addWeapon()`, after the entry is pushed:
```javascript
// Retroactively apply owned Layer P traits
if (PROJ_WEAPON_IDS.has(weapon.id)) {
  for (const trait of ALL_PROJ_TRAITS) {
    if (this._projTraitsOwned.has(trait.id)) trait.apply(entry.stats)
  }
}
// Retroactively apply owned Layer M traits
if (MELEE_WEAPON_IDS.has(weapon.id)) {
  for (const trait of ALL_MELEE_TRAITS) {
    if (!this._meleeTraitsOwned.has(trait.id)) continue
    if (trait.swingOnly && !SWING_WEAPON_IDS.has(weapon.id)) continue
    trait.apply(entry.stats)
  }
}
```

### `update()` — Doom Timer Check

In `GameScene.update()`, add a doom timer pass over all enemies (can be in the existing enemies loop):
```javascript
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

Note: dying enemies with `e._doomTimer` are skipped by the `!e.active` check once the fade-out tween disables the sprite. `Enemy._triggerDeath()` also clears `sprite._doomTimer = null` (see Part 4).

---

## Part 6: UpgradeScene Badge

### Required file: `src/scenes/UpgradeScene.js`

Add to the `CATEGORY` map:
```javascript
proj_trait:  { color: 0x0088ff, label: '投射', text: '#88ccff' },
melee_trait: { color: 0xff6600, label: '近戰', text: '#ffaa44' },
```

---

## Part 7: Enemy.js Changes

### Required file: `src/entities/Enemy.js`

1. In `_triggerDeath(sprite)`: add `sprite._doomTimer = null` immediately **after** the existing `if (sprite.dying) return` guard line (not before it).
2. Verify `takeDamage(sprite, ...)` returns `true` on the kill path and `false` (or nothing) otherwise. If it does not, add explicit return values:
   - Early exit lines (e.g. `if (!sprite.active || sprite.dying) return`) → change to `return false`
   - The line calling `_triggerDeath` → after that call, add `return true`
   - If the enemy is hit but not killed → ensure function ends with `return false` (or implicit undefined, which is falsy — that is sufficient)

---

## File Structure

| File | Change |
|------|--------|
| `src/upgrades/projTraits.js` | New: `ALL_PROJ_TRAITS` (5 entries), `doScatter(proj, scene, extraProps)`, `PROJ_WEAPON_IDS` |
| `src/upgrades/meleeTraits.js` | New: `ALL_MELEE_TRAITS` (7 entries), `MELEE_WEAPON_IDS`, `SWING_WEAPON_IDS` |
| `src/entities/Enemy.js` | Add `sprite._doomTimer = null` in `_triggerDeath()`; verify/add boolean return values in `takeDamage()` |
| `src/weapons/Shuriken.js` | Delete boomerang/scatter upgrades; in `fire()` add `s._boomerang = stats._boomerang \|\| false`, `s._scatter = stats._scatter \|\| false`, `s._scatterFired = false`, `s._miniExplosion = stats._miniExplosion \|\| false`, `s._ricochet = stats._ricochet \|\| false`, `s._ricochetDepth = 0`; replace `_doScatter` call with `doScatter(sprite, sprite.scene)` in `update()` |
| `src/weapons/Kunai.js` | Delete chainHit/alwaysPierce upgrades; delete _chainHit teleport; simplify penetrate; add _miniExplosion/_ricochet handling in `updateActive()`; keep koori evo frozen-pierce |
| `src/weapons/Tachi.js` | Delete iaijutsu/shadow upgrades; remove _pendingSlash guard; update shadow condition to `_afterimage \|\| isMuramasa`; add _charge/_pendingCharge guard; add _afterimage zone; add _shockwave, _doom, _deathBurst (using `takeDamage` return), _rapidVortex |
| `src/weapons/Ogi.js` | Delete whirlwind/shockwave upgrade entries only (read paths already exist); add _charge, _afterimage, _doom, _deathBurst, _rapidVortex |
| `src/weapons/Kusarigama.js` | Delete gravity/doubleOrbit upgrades; delete gravity pull + outer orbit code; add _doom (refresh timer on contact), _deathBurst (on takeDamage return true), _rapidVortex, _afterimage (trail every 400ms), _shockwave (on-kill ring) |
| `src/weapons/Homura.js` | Add `s._pool = pool` in `fire()`; add _miniExplosion/_ricochet copies at fire() time |
| `src/weapons/Ofuda.js` | Delete split/linger upgrade entries; delete per-weapon `_doSplit`; add `s._pool = pool` in `fire()`; call `doScatter(sprite, sprite.scene, ofudaExtraProps)` in `update()`; add _miniExplosion/_ricochet copies |
| `src/scenes/GameScene.js` | Add imports; init `_projTraitsOwned`/`_meleeTraitsOwned`; fix weapon upgrade injection + pick handler; add proj_trait/melee_trait handler branches; add entry.takenUpgrades + entry.lastTrailTime; retroactive trait apply in `_addWeapon()`; doom timer pass in `update()` |
| `src/scenes/UpgradeScene.js` | Add `proj_trait` / `melee_trait` to `CATEGORY` map |

---

## Behaviour Invariants

- **Traits are character-level, offered once per run**: `_projTraitsOwned`/`_meleeTraitsOwned` Sets never reset mid-run.
- **Retroactive application**: picking a new weapon after acquiring traits automatically gets all owned applicable traits.
- **Swing-only traits skip Kusarigama**: `swingOnly: true` traits are never injected when no swing weapon is held, and never applied to Kusarigama entries.
- **One-time weapon upgrades dedup**: `entry.takenUpgrades` per weapon entry; `oneTime: true` upgrades never reappear once taken.
- **`_deathBurst` uses `takeDamage` return value**: Never check `e.hp <= 0` — use the boolean returned by `Enemy.takeDamage()` which fires before the death animation makes `e.dying = true`.
- **`_pool` required on all projectile sprites**: `doScatter` has an early return guard (`if (!pool) return`), but all weapon `fire()` functions must set `s._pool = pool`.
- **Ofuda scatter children carry weapon-specific props**: `doScatter` is called with `extraProps` containing `_explodeRadius`, `_speed`, `_evoKaku`, `_target`, `_linger` so the GameScene explosion handler fires correctly.
- **彈射 depth guard**: `_ricochetDepth` starts at 0; spawned ricochet gets `depth + 1`; depth ≥ 2 blocks further ricochets. Scatter children get `_ricochetDepth = 99`.
- **命運印記 contact refresh**: Kusarigama contact ticks refresh `e._doomTimer` rather than stacking. Enemy death clears `_doomTimer` in `_triggerDeath()`.
- **Dead C-layer flags**: All 16 weapon flag reads removed from weapon files. Evolution flags (`_evo` checks) are unaffected.
- **Ogi/Tachi read paths for `_whirlwind`/`_shockwave` already exist**: No new read code needed in Ogi's `fire()`.
- **Scorch/linger/chainExplode/kaku**: Remain in GameScene explosion handler, fed by `stats._scorch`/`stats._linger` copied at Homura/Ofuda `fire()` time. Not changed by this spec.
