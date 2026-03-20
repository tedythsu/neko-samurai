# Weapon Synergy & Evolution System Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make players feel distinct build identities — different weapon + affix combinations produce meaningfully different playstyles, not just scaled numbers.

**Architecture:** Two-layer synergy system. Layer C adds mechanic-changing upgrades to each weapon (behaviour flags in `stats`). Layer A adds a weapon evolution system — when weapon + specific affix are both held, the upgrade pool injects a one-time 覚醒 card that permanently transforms the weapon.

**Tech Stack:** Phaser 3, existing weapon/affix architecture, `_buildUpgradePool()` injection pattern (same as tier-2), per-weapon `fire()`/`update()`/`updateActive()` flag checks.

---

## Part C: Mechanic-Changing Weapon Upgrades

Each weapon gains 1–2 new upgrades that set behaviour flags on `stats`. The weapon's fire/update methods check these flags. All flags default to `false`/`undefined` in `baseStats` (no change needed — undefined is falsy).

### 手裏剣 (Shuriken)
- **回転刃** (`_boomerang: true`): projectiles reverse velocity when they reach max range instead of expiring. On the return trip, the `hitSet` continues to block re-hitting the same enemy, so penetration is not granted by default.
- **散花** (`_scatter: true`): when a shuriken expires (range reached), spawn 3 smaller shurikens (size×0.5, damage×0.4, range=120px) fanning outward at ±45° and straight ahead. Spawned via `getOrCreate` from the same pool.

### 苦無 (Kunai)
- **連刃** (`_chainHit: true`): after hitting an enemy, immediately jump the projectile to the nearest other active enemy within 120px (not in `hitSet`). The kunai teleports: `proj.x = nextEnemy.x; proj.y = nextEnemy.y`, then continues flying. One bounce only.
- **穿心** (`_alwaysPierce: true`): at `fire()` time, forces `s.penetrate = true` regardless of the 貫通 mechanical. If 穿心 and `stats.penetrate` (from 貫通) are both true, effect is the same — no conflict.

### 太刀 (Tachi)
- **居合** (`_iaijutsu: true`): `fire()` uses `scene.time.delayedCall(300, ...)` before executing the slash. Store the pending flag on `stats` itself: `stats._pendingSlash = true` at the start of the delayed call, cleared to `false` after the slash resolves. At the top of `fire()`, if `stats._pendingSlash` is already `true`, return early without queuing a second slash. `stats` is accessible inside `fire()` as the existing 5th parameter — no signature change needed. Range ×2, damage ×1.5 when `_iaijutsu` is active (applied as local variables, not permanently mutating `stats`).
- **殘影** (`_shadow: true`): after `animationcomplete`, create a Graphics rectangle (width=stats.range, height=stats.range×0.4) at player position. It persists for 1000ms and applies `stats.damage * 0.6` to enemies inside it, using a `Map<enemy, lastHitTime>` with 300ms cooldown per enemy (same `damageCd` pattern as Kusarigama). Destroyed via `scene.time.delayedCall(1000, ...)`.

### 扇 (Ogi)
- **旋風** (`_whirlwind: true`): extends animation duration from 400ms to 800ms. `facingDeg` rotates at 360°/800ms each frame (`facingDeg += delta * (360/800)`), making the fan sweep in a full circle.
- **衝波** (`_shockwave: true`): at animation end, emit a Graphics `strokeCircle` that expands from 0→range px radius over 300ms via Phaser tween, dealing `stats.damage * 0.5` to any enemy touched during expansion (one hit per enemy, tracked via a local `Set`). Tween completes → `g.destroy()`.

### 鎖鎌 (Kusarigama)
- **引力場** (`_gravity: true`): each `updateActive` frame, for every active enemy within 160px of player, apply `body.velocity += (dirToPlayer) * 40 * delta/1000`. Capped at 40px/s net pull so enemies are never teleported. Applied before damage checks so the pull takes effect this frame.
- **雙軌道** (`_doubleOrbit: true`): maintains a second array `entry.outerSickles` (distinct from `entry.sickles`) at orbit radius 140px. Same `sickleCount` as inner ring. Lazy-initialised identically to `entry.sickles`. Uses same `damageCd` map (different cooldown key: `e.toString() + '_outer'`). When `sickleCount` upgrades, both arrays grow together.

### 炎矢 (Homura)
- **焦土** (`_scorch: true`): after explosion, spawn a scorch zone. The flag is copied onto `proj` at `fire()` time as `s._scorch = stats._scorch`. In `GameScene._addWeapon()`'s explosion handler (where `_explodeRadius` is already read from `proj`), if `proj._scorch`, create a Graphics circle at explosion site (radius = `proj._explodeRadius`, alpha=0.35, orange). Tracks `Map<enemy, lastDamageTime>` (300ms cd), applies `proj.damage * 0.15` per tick for 3000ms, then destroyed.
- **連鎖爆炸** (`_chainExplode: true`): also copied onto `proj` at `fire()` time. In the explosion handler, 25% chance to call the explosion helper a second time at same position with `knockback=0`. The second explosion does NOT chain-explode (checked via a `_chainDepth` flag on proj, depth 0 → chain allowed, depth 1 → no further chaining).

### 霊符 (Ofuda)
- **分裂** (`_split: true`): copied onto `proj` at `fire()` time. In Ofuda's `update()`, when the projectile expires by range (not by direct hit), fire 3 small ofuda from the expiry point (size×0.5, damage×0.5, no homing, range=150px), fanning at -45°/0°/+45° from the original travel direction.
- **滯留** (`_linger: true`): copied onto `proj` at `fire()`. In the explosion handler (GameScene), if `proj._linger`, create a linger zone at explosion site (radius=60px). Uses same `damageCd` pattern as 焦土: `Map<enemy, lastDamageTime>`, 300ms cd, `proj.damage * 0.2` per tick, 2000ms lifetime.

---

## Part A: Weapon Evolution System

### Evolution ID Strings

| 進化名 | `id` string | `weaponId` | `affixId` |
|--------|------------|------------|-----------|
| 龍炎矢 | `'ryuen'` | `'homura'` | `'burn'` |
| 雷轟剣 | `'raikou'` | `'shuriken'` | `'chain'` |
| 氷刃苦無 | `'koori'` | `'kunai'` | `'chill'` |
| 妖刀村正 | `'muramasa'` | `'tachi'` | `'leech'` |
| 毒蛇鎖鎌 | `'dokuja'` | `'kusarigama'` | `'poison'` |
| 核符 | `'kaku'` | `'ofuda'` | `'burst'` |
| 死神扇 | `'shinigami'` | `'ogi'` | `'curse'` |

### Evolution Effects

**龍炎矢 (`ryuen`)** — set on `entry.stats._evo = 'ryuen'` in the homura entry:
- At `fire()` time: `s.damage *= 1.5`; `s.displaySize = (72, 72)` (3× original 24px); `s._explodeRadius *= 2`; `s._scorch = true` (always, no flag needed).
- The `_scorch` zone inherits the doubled `_explodeRadius`.

**雷轟剣 (`raikou`)** — set on shuriken entry `stats._evo`:
- In `updateActive()`: chain bounce is unconditional (100%). Bounce count = `entry.stats.projectileCount`. Routes through a local bounce loop (not through chain.js `onHit`) so it is not subject to chain affix RNG. Distance threshold: 120px.

**氷刃苦無 (`koori`)** — set on kunai entry `stats._evo`:
- In `updateActive()` after hit: call `e._statusEffects.frozen.active = true; e._statusEffects.frozen.timer = 2000`.
- Conditional pierce: if target is frozen (`e._statusEffects.frozen.active`), do NOT set `proj._spent = true` (even if `!proj.penetrate` and `!stats._alwaysPierce`). `穿心` (`_alwaysPierce`) is a strict superset of this — if both are active, `_alwaysPierce` already covers it.

**妖刀村正 (`muramasa`)** — set on tachi entry `stats._evo`:
- In `fire()` inside the per-enemy forEach (after `takeDamage`): `if (stats._evo === 'muramasa') scene._player.heal(stats.damage * 0.30)`.
- Stats override at fire time: `range * 1.5`, `damage * 1.3` — applied as local variables within `fire()`, not mutating `stats` permanently.
- The leech affix 10% heal also fires through the normal affix pipeline — both apply, total ≈40% healing on evolved Tachi.

**毒蛇鎖鎌 (`dokuja`)** — set on kusarigama entry `stats._evo`:
- In `updateActive()` on each contact damage tick: also apply 1 poison stack to the enemy (`e._statusEffects.poison.stacks = Math.min(e._statusEffects.poison.maxStacks ?? 10, e._statusEffects.poison.stacks + 1)`).
- Orbit radius: inner `SICKLE_LEN` becomes `80 + 40 = 120`px (read as `(stats._evo === 'dokuja' ? 120 : 80)`).

**核符 (`kaku`)** — set on ofuda entry `stats._evo`:
- Copied onto `proj` at `fire()` time: `s._evoKaku = (stats._evo === 'kaku')`.
- In explosion handler: if `proj._evoKaku`, multiply `explodeRadius` by 2.5 before the splash loop; run the AoE splash loop unconditionally (100% — skip the `Math.random() > 0.20` check from burst.js); `_linger = true` forced. The linger zone uses `proj.damage` as it exists at that point in the handler (the same value used for the splash loop). Do not call into `burst.js` — replicate the AoE splash inline within the explosion callback to avoid coupling to burst's internal probability check.

**死神扇 (`shinigami`)** — set on ogi entry `stats._evo`:
- In `fire()` updateFn, after each hit confirm: force-apply curse to the enemy (`e._statusEffects.curse.active = true; e._statusEffects.curse.timer = 4000`) regardless of whether curse affix is equipped.
- If curse2 is also owned (`scene._affixCounts?.has('curse2')`), death explosion radius uses `80 * 2 = 160`px (existing curse2 logic, already doubled by the scene check — no extra code needed).

### GameScene Integration

**Init** (`create()`):
```javascript
this._offeredEvos = new Set()
```

**Injection** (inside `_buildUpgradePool()`, after tier-2 injection):
```javascript
for (const evo of ALL_EVOLUTIONS) {
  if (this._offeredEvos.has(evo.id)) continue          // already offered — skip forever
  const hasWeapon = this._weapons.some(w => w.id === evo.weaponId)
  const hasAffix  = (this._affixCounts.get(evo.affixId) || 0) >= 1
  if (hasWeapon && hasAffix) {
    pool.push({ ...evo, target: 'evolution' })
    this._offeredEvos.add(evo.id)                      // mark offered NOW (not on pick)
  }
}
```

**Application** (inside the `upgrade-chosen` event handler, as a new `else if` branch):
```javascript
} else if (upgrade.target === 'evolution') {
  const entry = this._weapons.find(w => w.id === upgrade.weaponId)
  if (entry) entry.stats._evo = upgrade.id
}
```

### UpgradeScene badge

Add to `CATEGORY` map:
```javascript
evolution: { color: 0xff4444, label: '覚醒', text: '#ff8888' },
```

---

## File Structure

| File | Change |
|------|--------|
| `src/weapons/Shuriken.js` | Add 回転刃/散花 upgrades; update `update()` for boomerang reverse; update `updateActive()` for scatter on expiry and raikou bounce |
| `src/weapons/Kunai.js` | Add 連刃/穿心 upgrades; update `updateActive()` for chain-bounce, pierce-frozen, koori freeze |
| `src/weapons/Tachi.js` | Add 居合/殘影 upgrades; update `fire()` for delayed slash + pending guard; add shadow zone + muramasa heal |
| `src/weapons/Ogi.js` | Add 旋風/衝波 upgrades; update `fire()` for rotating facingDeg + shockwave ring; add shinigami curse apply |
| `src/weapons/Kusarigama.js` | Add 引力場/雙軌道 upgrades; update `updateActive()` for gravity pull, `entry.outerSickles`, dokuja poison stacks |
| `src/weapons/Homura.js` | Add 焦土/連鎖爆炸 upgrades; copy `_scorch`, `_chainExplode` onto `proj` at `fire()` time |
| `src/weapons/Ofuda.js` | Add 分裂/滯留 upgrades; copy `_split`, `_linger`, `_evoKaku` onto `proj` at `fire()` time; update `update()` for split-on-expire |
| `src/affixes/evolutions.js` | New file: `ALL_EVOLUTIONS` array (7 entries, each with `id`, `name`, `desc`, `weaponId`, `affixId`) |
| `src/affixes/index.js` | Export `ALL_EVOLUTIONS` |
| `src/scenes/GameScene.js` | Init `_offeredEvos`; inject evolutions in `_buildUpgradePool()`; add `else if evolution` in upgrade handler; add scorch/linger/chainExplode/kaku handling in explosion callback (reading from `proj` flags) |
| `src/scenes/UpgradeScene.js` | Add `evolution` to `CATEGORY` map |

---

## Behaviour Invariants

- **Evolution offered once per run**: `_offeredEvos.add(evo.id)` is called at pool-injection time, not at pick time. Declined evolutions are never re-offered in the same run.
- **Evolution enhances, not replaces**: all existing weapon upgrades remain active. C-layer flags are independent of evolutions.
- **No HUD change needed**: evolutions are not affixes and do not appear in the affix dot row. The weapon slot visual is sufficient.
- **Explosion flags travel on `proj`**: scorch/linger/chainExplode/kaku are copied from `stats` onto `proj` at `fire()` time (same pattern as `_explodeRadius`, `_explodeMult`). The GameScene explosion callback reads from `proj` only — it never accesses `entry.stats` directly.
- **Scorch/linger use `damageCd` maps**: recurring zone damage uses `Map<enemy, lastHitTime>` with 300ms cooldown, consistent with Kusarigama. Not `hitSet` (which would only hit once).
- **`_chainExplode` depth guard**: `proj._chainDepth = 0` set at fire time. Explosion helper increments depth; if depth ≥ 1, no further chaining. Prevents infinite recursion.
- **Gravity pull cap**: `Math.min(40, pullSpeed) * delta/1000` — enemies can never be pulled faster than 40px/s regardless of delta.
- **Dedup key safety**: evolution `id` values are globally unique strings (e.g. `'ryuen'`) that do not collide with weapon upgrade `id` values (e.g. `'dmg'`, `'firerate'`). The dedup key `u.id + (u.weaponId ?? '')` will produce strings like `'ryuenhomura'` — distinct from any weapon upgrade.
