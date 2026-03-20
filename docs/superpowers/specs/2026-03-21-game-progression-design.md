# Game Progression Design Spec

## Overview

**Genre:** Top-down survival roguelike (mobile-first)
**Run structure:** Time-based survival — Vampire Survivors style
**Run duration:** 15 minutes per run
**Win condition:** Defeat the Final Boss (大妖魔) at the 15-minute mark
**Lose condition:** Player HP reaches 0

---

## Phase Timeline

The 15-minute run is divided into implicit phases by enemy type unlocks and Boss encounters. No scene changes — everything occurs in the existing open arena.

```
0:00 ──── 3:00 ──── 5:00 ──── 6:00 ──── 9:00 ──── 10:00 ──── 12:00 ──── 15:00
           快速型     鬼将       坦克型     爆炸型     雷鬼         精英型     大妖魔
           登場       Boss       登場       登場       Boss         登場       Final Boss
```

### Boss Encounter Flow

When a Boss timestamp is reached:
1. Regular enemy spawning **pauses** — done by setting `this._spawnEvent.paused = true` (the spawn `TimeEvent` reference must be stored as `this._spawnEvent` in `GameScene.create()`)
2. Full-screen overlay text: `「[Boss名] 降臨」` fades in for 1.5 seconds
3. Boss spawns at a random edge point (same as regular enemies)
4. On Boss death: short pause (0.5s) → large XP orb burst → `this._spawnEvent.paused = false` resumes spawning

---

## Enemy Types

Five enemy types total. Each type uses a color tint on the existing `kisotsu-run` spritesheet, plus distinct stat multipliers. New types are **added to the spawn pool** at their unlock time — they don't replace existing types.

### Tint Persistence

Each enemy sprite stores its base type tint as `sprite._baseTint`. The existing `Enemy._applyStatusTint()` and hit-flash code must be updated to restore `sprite._baseTint` (instead of calling `clearTint()`) when no status effect is active. This prevents status effects from permanently erasing the type tint.

### 基礎兵 (Kisotsu) — 0:00
- **Tint:** none (`_baseTint = null`, uses `clearTint()`)
- **HP:** `CFG.ENEMY_HP` × 1.0
- **Speed:** `CFG.ENEMY_SPEED` × 1.0
- **Size:** 100% of base display size
- **Behavior:** direct pursuit of player

### 快速型 (Hayate) — 3:00
- **Tint:** green (`_baseTint = 0x44ff88`)
- **HP:** base × 0.5
- **Speed:** base × 2.0
- **Size:** 75% of base display size
- **Behavior:** direct pursuit; low HP means it dies quickly if focused

### 坦克型 (Yoroi) — 6:00
- **Tint:** orange-brown (`_baseTint = 0xcc6622`)
- **HP:** base × 4.0
- **Speed:** base × 0.5
- **Size:** 150% of base display size
- **Behavior:** slow direct pursuit; physics body scaled to match display size

### 爆炸型 (Bakuha) — 9:00
- **Tint:** red (`_baseTint = 0xff2200`)
- **HP:** base × 0.7
- **Speed:** base × 1.3
- **Size:** 100% of base display size
- **Behavior:** pursues player; when within 30px of player → triggers explosion (AoE `ENEMY_DAMAGE × 2`, radius 60px, no knockback) then calls `Enemy._triggerDeath()`. Explosion damage is **not** scaled with difficulty — intentionally fixed to keep the mechanic readable at all stages.
- **Visual:** pulsing alpha (0.6 ↔ 1.0) via `scene.tweens.add` during `activate()`, killed on death
- **Boss fight rule:** 爆炸型 is **excluded from the spawn pool during Boss encounters** (spawning is paused anyway, and Boss 大妖魔's 混合召喚 explicitly spawns 快速型 + 坦克型 only)

### 精英型 (Jōnin) — 12:00
- **Tint:** gold (`_baseTint = 0xffcc00`)
- **HP:** base × 2.5
- **Speed:** base × 1.4
- **Size:** 120% of base display size
- **Behavior:** direct pursuit; combination of speed and durability

---

## Difficulty Scaling

Enemy HP and speed scale with elapsed time. Spawn interval compresses. `ENEMY_DAMAGE` is **not scaled** — damage from all sources stays fixed to keep player readability consistent.

Each row in the table represents values **at the start** of that time window. Values are linearly interpolated toward the next row's values as time progresses within the window (i.e., a smooth ramp, not a step function). Implementation: given `t` ms elapsed, find the two surrounding breakpoints and lerp between them.

| Time Window | Spawn Interval | HP Multiplier | Speed Multiplier | Max On-Screen |
|-------------|---------------|---------------|-----------------|---------------|
| 0 min       | 2000ms        | ×1.0          | ×1.0            | 20            |
| 3 min       | 1700ms        | ×1.2          | ×1.1            | 25            |
| 6 min       | 1400ms        | ×1.5          | ×1.2            | 30            |
| 9 min       | 1100ms        | ×2.0          | ×1.3            | 35            |
| 12 min      | 900ms         | ×2.5          | ×1.4            | 40            |
| Boss active | paused        | —             | —               | no new spawns |

**Max On-Screen enforcement:** Checked at the start of `_spawnWave()`. If `this._enemies.countActive() >= currentMax`, the entire wave is skipped (no spawns that tick). Spawn timer still fires normally so the next tick rechecks.

**Spawn interval changes:** When the lerped interval changes between ticks, `this._spawnEvent.delay` is updated in-place each frame (or each wave) rather than destroying and recreating the event.

Applied in `GameScene._spawnWave()` (pool selection + max cap) and passed into `Enemy.activate()` (HP + speed + size).

---

## Boss Designs

All bosses reuse the `kisotsu-run` spritesheet with tint + scale. Each has a dedicated HP bar shown in the HUD during the encounter.

Boss skills are implemented as `scene.time.addEvent` loops stored in `BossManager._activeEvents` (an array). On Boss death — or when the scene shuts down — `BossManager.cleanup()` calls `.remove()` on every entry and empties the array. This prevents ghost skill ticks after the boss is gone.

Phase transitions in 大妖魔 explicitly call `BossManager.cleanup()` before registering Phase 2 events, so no Phase 1 timer runs alongside Phase 2.

### Boss 1 — 鬼将 (Kijō) — 5:00

- **Tint:** purple (`0x8844cc`)
- **Scale:** 2.5× display size
- **HP:** `CFG.ENEMY_HP` × 15 (not subject to difficulty HP multiplier — bosses use fixed HP)
- **Speed:** `CFG.ENEMY_SPEED` × 0.8

**Skills:**
- **衝刺突進 (Dash):** Every 4 seconds, sets boss velocity toward the player's current position at 600px/s for 0.3 seconds, then stops. Deals `ENEMY_DAMAGE × 2` on contact during the dash window (flagged via `boss._dashing = true`).
- **震地 (Tremor):** Activates when HP drops below 50%. Every 3 seconds, triggers an AoE (radius 80px centred on boss, `ENEMY_DAMAGE × 1.5`). Visual: expanding ring graphics object, fades out over 0.4s.

### Boss 2 — 雷鬼 (Raiki) — 10:00

- **Tint:** blue (`0x2266ff`)
- **Scale:** 2.5× display size
- **HP:** `CFG.ENEMY_HP` × 25
- **Speed:** `CFG.ENEMY_SPEED` × 0.9

**Skills:**
- **雷擊圈 (Lightning Ring):** Every 5 seconds, emits a ring expanding from 0 → 200px radius over 0.8s using a `scene.tweens.add` on a graphics object. Enemies within the ring radius at any frame during the tween take `ENEMY_DAMAGE × 1.5`. Overlap checked via distance each update tick while the ring is active.
- **召喚 (Summon):** Every 8 seconds, spawns 3 快速型 minions at random positions within 120px of the boss. Minions use the current difficulty HP/speed multipliers (they are regular enemies, not boss-tier).

### Boss 3 — 大妖魔 (Dai Yōma) — 15:00 (Final Boss)

- **Tint:** dark red (`0xcc1133`)
- **Scale:** 3.0× display size
- **HP:** `CFG.ENEMY_HP` × 40
- **Speed:** `CFG.ENEMY_SPEED` × 0.7

**Phase 1 (HP > 50%):**
- Dash every 5 seconds (same mechanic as 鬼将)
- Lightning Ring every 6 seconds (same mechanic as 雷鬼)

**Phase 2 transition (HP drops to ≤ 50%):**
1. `BossManager.cleanup()` removes all Phase 1 events
2. Brief screen flash (white overlay, alpha 0.4, duration 200ms)
3. Boss tint changes to `0xff0000`
4. Speed increases to `CFG.ENEMY_SPEED × 1.2`
5. Phase 2 events registered:
   - Dash every 3 seconds
   - Lightning Ring every 6 seconds (unchanged)
   - **混合召喚:** Every 6 seconds, spawns 2 快速型 + 1 坦克型 near the boss

---

## Kill Counter

A `this._killCount` integer is added to `GameScene` (initialised to 0 in `create()`). Incremented in the `'enemy-died'` event handler. Displayed on both the **victory screen** and the existing **death screen** (`_onPlayerDead`): `生存 X:XX　到達 Lv Y　擊殺 Z`.

---

## HUD Changes

### Boss HP Bar
- Shown only during a Boss encounter (toggled by BossManager)
- Position: bottom-centre of screen, `y = cameraHeight - 40`
- Layout: boss name label (left) + health bar 300px wide (centre) + `XX%` text (right)
- Bar colors: `0xcc2244` fill on `0x220008` track, `0xff4466` highlight top strip (same style as player HP bar)
- Drawn in `_drawHud()` when `this._bossManager.activeBoss` is non-null
- Disappears immediately on Boss death (BossManager sets `activeBoss = null`)

### Timer
- Existing `_hudTimer` continues running. No changes needed.

---

## Victory Screen

Triggered by BossManager when 大妖魔 HP reaches 0. Mirrors the existing `_onPlayerDead()` structure:

1. `this.physics.pause()`
2. Dark overlay rectangle (`0x000000`, alpha 0.72), scroll-fixed, depth 300
3. `勝` kanji, gold (`0xd4a843`), 88px, scale-in animation (same as `死` in death screen)
4. Stats line: `生存 15:00　到達 Lv X　擊殺 Y`
5. `Click to restart` prompt
6. `this.input.once('pointerdown', () => this.scene.restart())`

---

## Architecture Notes

### New files
- `src/enemies/EnemyTypes.js` — exports `ENEMY_TYPES` array of 5 config objects: `{ id, unlockMs, baseTint, hpMult, speedMult, sizeMult, behaviorFlags }`
- `src/enemies/BossManager.js` — class instantiated in `GameScene.create()`. Owns: boss spawn triggers (checked in `update()`), skill `TimeEvent` handles in `_activeEvents[]`, HP bar visibility, phase state, `cleanup()` method

### Modified files
- `src/config.js` — add `PROGRESSION_BREAKPOINTS` array of `{ timeMs, spawnInterval, hpMult, speedMult, maxEnemies }` objects (5 entries matching the table above)
- `src/scenes/GameScene.js`:
  - Store spawn event reference: `this._spawnEvent = this.time.addEvent(...)`
  - Import and instantiate `BossManager`
  - Add `this._killCount = 0` and increment in `'enemy-died'` handler
  - Update `_spawnWave()` to compute current difficulty from `_elapsed`, check `maxEnemies` cap, build unlocked-type pool, pass type config + difficulty mults to `Enemy.activate()`
  - Update `_drawHud()` to render boss HP bar when active
  - Update `_onPlayerDead()` to include kill count in stats line
- `src/entities/Enemy.js`:
  - New `activate()` signature: `static activate(sprite, x, y, typeConfig, difficultyMult)`
  - Store `sprite._baseTint = typeConfig.baseTint`
  - Apply tint, size, `hp = CFG.ENEMY_HP * typeConfig.hpMult * difficultyMult.hp`, speed likewise
  - Update `_applyStatusTint()` to restore `sprite._baseTint` instead of calling `clearTint()` when no status is active
  - Update hit-flash path to restore `sprite._baseTint` after the flash

### No scene changes
All progression happens within `GameScene`. No new Phaser scenes are required.

### Out of scope
Meta-progression (soul currency, permanent upgrades, unlock system) is explicitly deferred and not part of this implementation.
