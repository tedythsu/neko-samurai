# 武器與元素詞條系統 Design Spec

**Date:** 2026-03-19
**Status:** Approved (v2 — post spec-review fixes)

---

## Goal

Expand the weapon system from single-weapon-per-run to multi-weapon + elemental affix model. Players start with one weapon, can acquire up to 4 total, and layer elemental/mechanical affixes for combinatorial depth.

---

## Architecture Overview

### Weapon Slots & Multi-Weapon Fire Loop

GameScene replaces single `_weapon / _weaponStats / _fireTimer / _projectiles` with an array of weapon entries:

```js
// Each active weapon is an entry:
{ weapon, stats, timer, projectiles }
// `projectiles` = physics.add.group({ maxSize: 60 })
// Overlap registered per-group in _addWeapon()
```

Each frame in `update()`:
```
for each entry in this._weapons:
  entry.timer += delta
  if entry.timer >= entry.stats.fireRate:
    entry.timer = 0
    entry.weapon.fire(scene, entry.projectiles, px, py, entry.stats, enemies, player, this._affixes)
  entry.projectiles.getChildren().forEach(s => {
    if s._spent: disableBody; return
    entry.weapon.update(s)
  })
```

### Weapon Unlock Thresholds (in config.js)
```js
WEAPON_SLOT_LEVELS: [5, 10, 16]   // levels at which new slot opens
MAX_WEAPONS: 4
```

---

## Weapons (7 Total)

### Existing (unchanged baseStats)

| ID | Name | Type |
|----|------|------|
| shuriken | 手裏剣 | Radial projectile |
| kunai | 苦無 | Targeted projectile |
| tachi | 太刀 | Melee sweep |

### New (placeholder color textures)

| ID | Name | Color | Type | Mechanic |
|----|------|-------|------|----------|
| ogi | 扇 | Orange rect | Melee cone | 120° front-arc sweep; hits all enemies in arc each frame during 400ms animation |
| ofuda | 霊符 | Purple rect | Homing projectile | Slow-moving (speed 150), homes toward nearest enemy; angular velocity capped at 4°/frame to prevent oscillation; explodes (60px radius, 1.5× damage) on hit |
| kusarigama | 鎖鎌 | Cyan rect | Orbital | 1–3 sickles orbit player at radius 80px using `scene.time` angle; contact damage per frame with 200ms cooldown per enemy; no Arcade physics body |
| homura | 炎矢 | Red rect | Explosive projectile | Slow (speed 200), large (24×24px); on hit: AoE explosion 80px radius, 1.2× damage to all enemies in radius |

### New Weapon baseStats

```js
ogi:        { damage: 18, fireRate: 1200, range: 90 }
ofuda:      { damage: 30, fireRate: 2000, projectileCount: 1, range: 600, speed: 150 }
kusarigama: { damage: 8,  fireRate: 0,    sickleCount: 1 }   // fireRate unused; always active
homura:     { damage: 25, fireRate: 2500, projectileCount: 1, range: 700, speed: 200 }
```

---

## Affix System

### Affix Object Interface
```js
{
  id:     string,
  name:   string,
  desc:   string,
  // Called after every weapon hit (melee and projectile)
  onHit(enemy, damage, scene) { ... }
}
```

### Passing Affixes Through the Hit Pipeline

`Enemy.takeDamage` gains an optional `affixes` parameter:
```js
static takeDamage(sprite, amount, fromX, fromY, affixes = []) {
  // ... existing damage / crit / knockback ...
  for (const affix of affixes) affix.onHit(sprite, amount, scene)
}
```

All call sites updated:
- Projectile overlap: `Enemy.takeDamage(enemy, proj.damage, proj.x, proj.y, scene._affixes)`
- Tachi onUpdate: `Enemy.takeDamage(e, stats.damage, px, py, scene._affixes)`
- Ogi sweep: `Enemy.takeDamage(e, stats.damage, px, py, scene._affixes)`
- Kusarigama contact: `Enemy.takeDamage(e, stats.damage, px, py, scene._affixes)`

`onHit` receives `scene` so affixes can access `scene._enemies`, `scene._player`, and `scene._affixCounts`.

### Elemental Affixes (8)

| ID | Name | Effect (per stack) |
|----|------|-------------------|
| burn | 炎上 | Apply burn: 5 DPS for 2s (×stack duration) |
| poison | 毒 | Add poison stack (max 5): 3 DPS/stack; stacks cleared on enemy death |
| chain | 電撃 | 25% chance: arc to nearest enemy in 120px, 0.5× damage (bounces = stack count) |
| chill | 凍結 | 30% chance: slow 50% for 1.5s |
| curse | 詛咒 | Enemy takes +25% damage for 3s (refreshes on hit) |
| leech | 吸血 | Heal player 10% of damage dealt |
| burst | 爆裂 | 20% chance: 40px AoE explosion, 0.4× damage |
| lucky | 幸運 | +15% crit chance, +0.5× crit multiplier (additive per stack) |

**Stack scaling** (affix acquired N times):
- `burn ×2` → DoT duration 4s; `burn ×3` → DPS ×1.5
- `chain ×2` → 2 bounces; `chain ×3` → 3 bounces
- `poison ×2` → max 8 stacks; `poison ×3` → max 12
- All others: flat re-pick = +1 copy of the effect triggered per hit (e.g. leech ×2 heals 20%)

Stack counts stored in `scene._affixCounts: Map<id, number>`.

### Mechanical Affixes (3, universal)

These apply to all weapons generically via stats mutation on pick, not via `onHit`:

| ID | Name | Effect |
|----|------|--------|
| multishot | 乱射 | All weapons: `stats.projectileCount += 1` (melee: `stats.range *= 1.15`) |
| piercing | 貫通 | All projectile weapons: `stats.penetrate = true` |
| orbit_shield | 護盾術 | Spawn an orbiting guard orb (60px radius, 6 DPS on contact) — weapon-agnostic |

> **Note:** `multishot` stacks with weapon-specific `projectileCount` upgrades additively.
> `orbit_shield` is a scene-level object, not attached to a weapon.

---

## Resonance System

`checkResonances(affixCounts: Map): Set<string>` returns a Set of active resonance IDs. Called in `_applyUpgrade` whenever an affix is added.

Active resonances stored in `scene._resonances: Set<string>`.

| Resonance ID | Required Affixes | Effect |
|-------------|-----------------|--------|
| explode_burn | burn + burst | Burning enemies explode on death: 60px radius, 0.3× max-HP damage |
| toxic_chain | poison + chain | Chained lightning deals ×2 on poisoned targets |
| blizzard_arc | chain + chill | Chain lightning also applies chill to all bounced targets |
| corrosion | burn + poison | DoT ticks deal ×1.5 (multiplicative) |
| dark_harvest | leech + curse | Cursed enemies explode on death: 50px radius, 15 flat damage; heals 5 HP |

---

## Status Effect Visual Priority

Status tints replace the hit-flash tint system (no more 120ms red clear racing with status tints):

| Priority | Condition | Tint |
|----------|-----------|------|
| 1 (highest) | dying | none (clearTint) |
| 2 | burn | 0xff6600 (orange) |
| 3 | poison | 0x44cc44 (green) |
| 4 | chill | 0x88ccff (light blue) |
| 5 | curse | 0xaa44aa (purple) |
| 6 (lowest) | hit flash | 0xff4444 (red, 120ms) |

`Enemy.updateStatus` sets tint based on highest active status. Hit flash only applies when no status tint is active.

Status state per sprite:
```js
sprite._statusEffects = {
  burn:   { stacks: 0, timer: 0 },
  poison: { stacks: 0, timer: 0 },
  chill:  { active: false, timer: 0 },
  curse:  { active: false, timer: 0 },
}
```
Initialised in `Enemy.activate()`, ticked in `Enemy.updateStatus(sprite, delta)`.

---

## Upgrade Routing (Multi-Weapon)

Each weapon-specific upgrade now carries a `weaponId` tag added at pool-construction time:

```js
const weaponUps = entry.weapon.upgrades.map(u => ({
  ...u,
  target: 'weapon',
  weaponId: entry.weapon.id,
}))
```

In `upgrade-chosen` handler:
```js
if (upgrade.target === 'weapon') {
  const entry = this._weapons.find(e => e.weapon.id === upgrade.weaponId)
  upgrade.apply(entry.stats)
} else if (upgrade.target === 'affix') {
  this._applyAffix(upgrade.affix)
} else if (upgrade.target === 'mechanical') {
  this._applyMechanical(upgrade)
} else if (upgrade.target === 'new_weapon') {
  this._addWeapon(upgrade.weapon)
} else {
  upgrade.apply(this._player, this)   // player upgrade
}
```

---

## Upgrade Pool Composition

```js
_buildUpgradePool() {
  const pool = []

  // Weapon-specific upgrades for all active weapons
  for (const entry of this._weapons)
    pool.push(...entry.weapon.upgrades.map(u => ({ ...u, target: 'weapon', weaponId: entry.weapon.id })))

  // Elemental affixes
  pool.push(...ALL_AFFIXES.map(a => ({ id: a.id, name: a.name, desc: a.desc, target: 'affix', affix: a })))

  // Mechanical affixes
  pool.push(...ALL_MECHANICAL.map(m => ({ ...m, target: 'mechanical' })))

  // New weapon (if slot available)
  if (this._weapons.length < CFG.MAX_WEAPONS && this._level >= nextUnlockLevel()) {
    const owned = new Set(this._weapons.map(e => e.weapon.id))
    const candidates = ALL_WEAPONS.filter(w => !owned.has(w.id))
    if (candidates.length)
      pool.push({ id: 'new_weapon', name: '新武器', target: 'new_weapon',
                  weapon: Phaser.Utils.Array.GetRandom(candidates) })
  }

  // Player upgrades
  pool.push(...PLAYER_UPGRADES.map(u => ({ ...u, target: 'player' })))

  return Phaser.Utils.Array.Shuffle(pool).slice(0, 3)
}
```

---

## HUD Changes

- HP + XP bars (unchanged)
- Weapon row: up to 4 colored 20×20px squares (one per active weapon), scrollFactor 0
- Affix row: up to 8 colored 14×14px dots with stack count, scrollFactor 0
- Resonance row: 1–5 glyph text labels for active resonances

---

## File Structure

```
src/
  config.js                   (add WEAPON_SLOT_LEVELS, MAX_WEAPONS)
  weapons/
    _pool.js                  (unchanged)
    index.js                  (export ALL_WEAPONS with 7 entries)
    Shuriken.js / Kunai.js / Tachi.js   (add scene._affixes passthrough)
    Ogi.js / Ofuda.js / Kusarigama.js / Homura.js   (new)
  affixes/
    index.js                  (ALL_AFFIXES, ALL_MECHANICAL, checkResonances)
    burn.js / poison.js / chain.js / chill.js
    curse.js / leech.js / burst.js / lucky.js
    resonances.js
  entities/
    Enemy.js                  (add _statusEffects, updateStatus, affixes param)
  scenes/
    GameScene.js              (multi-weapon array, affix/resonance state, new HUD)
    UpgradeScene.js           (unchanged UI, receives richer upgrade objects)
```

---

## Scope Boundaries

- No weapon evolution (VS-style)
- No persistent save between runs
- No new enemy types
- Kusarigama uses `scene.time` angle math, no Arcade physics body
- Implementation order: 1) multi-weapon refactor → 2) affix pipeline → 3) new weapons → 4) resonances
