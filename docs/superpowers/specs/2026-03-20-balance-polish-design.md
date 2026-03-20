# Balance & Polish Design Spec

**Date:** 2026-03-20
**Scope:** Six gameplay balance improvements to neko-samurai roguelike
**Reference games:** Vampire Survivors, 20 Minutes Till Dawn, Halls of Torment, Brotato, Hades

---

## Overview

Six targeted improvements addressing XP orb pacing, upgrade caps, projectile count clarity, sustain redesign, attack speed naming, and the shift from invisible range upgrades to visible weapon-size upgrades. Each change is independently scoped to a single system.

---

## Point 1 — XP Orb (武魂) Lifetime

### Problem
Orbs never expire. In long sessions they accumulate on the ground, causing visual clutter and removing all positioning tension.

### Design
- **Lifetime:** 12 seconds from spawn
- **Warning phase:** last 3 seconds — orb flashes (alpha oscillates 0.2 → 1.0, frequency increases as time runs out)
- **Expiry:** 0.3-second fade-out, then `destroy()`
- **Attracted orbs are exempt:** once `orb._attracted = true` (entered the 130px attract radius), the countdown pauses — the player is not punished for an orb that is already flying toward them

### Implementation notes
- Add `orb._spawnTime = this.time.now` in `_spawnOrb()`
- In the orb update loop (already iterates `this._orbs`), check elapsed time each frame
- Reuse the existing `this.tweens.killTweensOf(orb)` pattern (already used for attraction) for the expiry fade
- No new data structures needed

### Reference
Halls of Torment uses a ~12-second lifetime with a visible warning flash; players rarely lose orbs unless actively kiting across the full arena. This is the sweet spot for a 1600×1200 arena.

---

## Point 2 — Upgrade Caps

### Problem
All weapon stat upgrades apply multiplicative factors with no ceiling. `range *= 1.20` stacked ten times produces nonsensical values that exceed screen bounds or break visual scaling.

### Design

Caps are enforced inside each weapon upgrade's `apply` function using `Math.min` / `Math.max`:

| Stat | Cap | Rationale |
|------|-----|-----------|
| `projectileCount` | 5 | Beyond 5 the screen becomes unreadable; VS uses 5–6 as a soft ceiling |
| `fireRate` (minimum ms) | 200 ms | Below 200ms the visual difference is imperceptible; prevents audio/particle spam |
| `range` (melee only) | `baseStats.range * 2.0` | Beyond 2× the hitbox covers too much of the arena |
| `_explodeRadius` | `baseStats._explodeRadius + 60` | Beyond base+60px explosions overlap the entire screen |
| `sickleCount` | 4 | 4 sickles fill the orbit visually; more causes z-order confusion |

Damage has **no cap** — multiplicative damage scaling naturally slows down (×1.25 per pick gives +25%, +56%, +95%, +144%… diminishing excitement) and is the primary power-fantasy lever.

### Implementation notes
- Caps are applied in each weapon file's `apply` lambda, not globally
- Pattern: `apply: s => { s.projectileCount = Math.min(5, s.projectileCount + 1) }`
- `fireRate` cap uses `Math.max`: `apply: s => { s.fireRate = Math.max(200, s.fireRate * 0.80) }`
- No new infrastructure needed

---

## Point 3 — Projectile Count: Per-Weapon vs Global

### Problem
Per-weapon count upgrades (`苦無 投射數 +1`) and the mechanical `乱射` (all weapons +1) coexist in the same upgrade pool with no visible distinction in scope or value.

### Design

**Keep both.** Inspired by Vampire Survivors' Duplicator vs per-weapon level-up design:

| Type | Name | Scope | Pool | Repeatable |
|------|------|-------|------|-----------|
| Per-weapon upgrade | `[武器名] 投射數 +1` | One weapon only | Weapon upgrades | Yes (up to cap 5) |
| Mechanical | `乱射 — 所有投射型武器 投射數 +1` | All projectile weapons simultaneously | `ALL_MECHANICAL` (one-time) | No |

**Description clarification only** — no mechanic change. The mechanical `乱射` description is updated to explicitly say "所有投射型武器" so players understand its global scope. Per-weapon upgrades are renamed to include the weapon name (see Point 5).

The mechanical remains more valuable because it affects every projectile weapon simultaneously, and as a one-time mechanical it signals "build-defining choice" vs "weapon refinement."

Additionally, `乱射` gains a secondary effect to reinforce its global nature and make it clearly superior to any single per-weapon count upgrade:
- Current: `projectileCount += 1` for all projectile weapons
- New: `projectileCount += 1` **AND** `range *= 1.10` for all projectile weapons (melee still gets range ×1.15 as before)

---

## Point 4 — Sustain Redesign: Replace Regen

### Problem
`忍の回復` heals 1 HP every 5 seconds (0.2 HP/s). `吸血` (leech) heals 10% of damage dealt — with Kunai at 8 dmg × ~2.9 hits/s that is ~2.3 HP/s. Regen is 10–20× weaker than leech and has no meaningful niche.

### Design

**Delete `忍の回復`.** Replace with `武者の気` (warrior's spirit):

```
武者の気 — 未受傷超過4秒後，每秒回復最大HP的1.5%
```

| Property | Value |
|----------|-------|
| Trigger | 4 seconds without taking damage |
| Rate | 1.5% of max HP per second (~1.5 HP/s at 100 HP) |
| Cancellation | Any damage received resets the 4-second timer |
| Stackable | No (`oneTime: true`) |
| ID | `regen` (same ID, just redesigned) |

**Design rationale:**
- Leech = offensive sustain (attack more → heal more, suited for aggressive melee builds)
- 武者の気 = defensive sustain (survive hits, stay out of damage, suited for ranged kiting builds with Kunai/Shuriken/Homura)
- The two are differentiated by playstyle rather than raw numbers; neither is strictly dominant
- Reference: Hades' "Stubborn Roots" (regen after not taking damage for a period) is one of the most valued defensive boons

### Implementation notes
- `apply` sets `scene._regenActive = true` and `scene._regenTimer = 0`
- In `GameScene.update()`, increment `_regenTimer` by `delta`; if `>= 4000` and player alive, call `player.heal(player.maxHp * 0.015 * delta / 1000)`
- Player's `takeDamage()` triggers `scene.events.emit('player-hit')` (already does this); listener resets `scene._regenTimer = 0`
- One-time upgrade (`oneTime: true`), tracked in `_playerUpgradesOwned`

---

## Point 5 — Attack Speed Upgrade Naming

### Problem
Flavor names (居合, 速揮, 連投, 連射) don't communicate which weapon the upgrade belongs to or what stat changes.

### Design

All per-weapon attack speed upgrades are renamed to the format `[武器名] 攻擊速度 +X%`:

| Old name | New name | Weapon |
|----------|----------|--------|
| 居合 | `太刀 攻擊速度 +20%` | 太刀 (Tachi) |
| 速揮 | `扇 攻擊速度 +20%` | 扇 (Ogi) |
| 連投 | `苦無 攻擊速度 +20%` | 苦無 (Kunai) |
| 連射 | `手裏剣 攻擊速度 +25%` | 手裏剣 (Shuriken) |

The `name` field becomes the display name directly. The `desc` field is cleared or set to empty string since the name is now self-describing.

Same pattern is applied to all other stat upgrades for consistency (e.g., `太刀強化` → `太刀 傷害 +25%`, `廣域` → `扇 攻擊範圍 +20%`, etc.).

---

## Point 6 — Projectile Range → Weapon Body Size

### Problem
Range upgrades for projectile weapons (Kunai `長射程`, Shuriken `遠投`) extend travel distance before disappearing — an invisible stat change. Players cannot see the effect.

### Design

**Melee weapons (Tachi, Ogi):** Range = visual hitbox size. Already visually obvious (Tachi sprite scales with range, Ogi fan arc scales with range). Rename only:
- `斬擊延伸（射程 +30%）` → `太刀 攻擊範圍 +30%`
- `廣域（射程 +20%）` → `扇 攻擊範圍 +20%`

**Projectile weapons (Kunai, Shuriken):** Replace invisible range extension with **visual body size upgrade**:

| Weapon | Old upgrade | New upgrade |
|--------|-------------|-------------|
| 苦無 | `長射程 — 射程 +20%` | `苦無 體積 +30%` |
| 手裏剣 | `遠投 — 射程 +25%` | `手裏剣 體積 +30%` |

**Mechanics of the size upgrade:**
- `stats._scale` is introduced as a new stat (default `1.0`)
- `apply: s => { s._scale = Math.min(2.0, (s._scale ?? 1.0) * 1.30) }` (cap at 2× original)
- In `fire()`, `s.setDisplaySize(baseW * stats._scale, baseH * stats._scale)` sizes the projectile
- Phaser Arcade physics hitbox is resized proportionally: `s.body.setSize(baseW * stats._scale, baseH * stats._scale)`
- Visually, the player sees a noticeably larger kunai/shuriken after the upgrade
- A larger projectile naturally intersects more enemies per flight path, which is a meaningful gameplay improvement (not just cosmetic)

Reference: Vampire Survivors' Area stat grows the visual size of all projectiles/weapons, and it is consistently rated one of the most satisfying stats in the game.

---

## File Change Summary

| File | Changes |
|------|---------|
| `src/scenes/GameScene.js` | Orb lifetime + warning flash; `_regenTimer` logic in `update()`; `乱射` secondary range effect |
| `src/config.js` | Replace `regen` entry with `武者の気` redesign |
| `src/weapons/Tachi.js` | Upgrade name changes; cap on `range` and `fireRate` |
| `src/weapons/Ogi.js` | Upgrade name changes; cap on `range` and `fireRate` |
| `src/weapons/Kunai.js` | Replace `range` upgrade with `_scale`; cap on `fireRate` and `projectileCount`; `fire()` uses `stats._scale` |
| `src/weapons/Shuriken.js` | Replace `range` upgrade with `_scale`; cap on `fireRate` and `projectileCount`; `fire()` uses `stats._scale` |
| `src/weapons/Homura.js` | Cap on `_explodeRadius` and `projectileCount`; upgrade name changes |
| `src/weapons/Ofuda.js` | Cap on `projectileCount`; upgrade name changes |
| `src/weapons/Kusarigama.js` | Cap on `sickleCount`; upgrade name changes |
