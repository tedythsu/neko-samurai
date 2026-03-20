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
1. Regular enemy spawning **pauses**
2. Full-screen overlay text: `「[Boss名] 降臨」` fades in for 1.5 seconds
3. Boss spawns at a random edge point (same as regular enemies)
4. On Boss death: short pause (0.5s) → large XP orb burst → spawning resumes

---

## Enemy Types

Five enemy types total. Each type uses a separate texture/color tint and distinct stat profile. New types are **added to the spawn pool** at their unlock time — they don't replace existing types.

### 基礎兵 (Kisotsu) — 0:00
- **Texture:** existing `kisotsu-run` spritesheet
- **HP:** `CFG.ENEMY_HP` × 1.0 (base)
- **Speed:** `CFG.ENEMY_SPEED` × 1.0
- **Behavior:** direct pursuit of player

### 快速型 (Hayate) — 3:00
- **Texture:** `kisotsu-run` with green tint (`0x44ff88`)
- **HP:** base × 0.5
- **Speed:** base × 2.0
- **Behavior:** same direct pursuit; low HP means high-priority kill target
- **Visual size:** 75% of base display size

### 坦克型 (Yoroi) — 6:00
- **Texture:** `kisotsu-run` with orange-brown tint (`0xcc6622`)
- **HP:** base × 4.0
- **Speed:** base × 0.5
- **Behavior:** slow direct pursuit; body size 150% of base
- **Visual size:** 150% of base display size

### 爆炸型 (Bakuha) — 9:00
- **Texture:** `kisotsu-run` with red tint (`0xff2200`)
- **HP:** base × 0.7
- **Speed:** base × 1.3
- **Behavior:** pursues player; when within 30px of player → triggers explosion (AoE damage equal to `ENEMY_DAMAGE × 2`, radius 60px) then dies
- **Visual:** pulsing alpha (0.6 ↔ 1.0) to signal danger

### 精英型 (Jōnin) — 12:00
- **Texture:** `kisotsu-run` with gold tint (`0xffcc00`)
- **HP:** base × 2.5
- **Speed:** base × 1.4
- **Behavior:** direct pursuit; combination of speed and durability
- **Visual size:** 120% of base display size

---

## Difficulty Scaling

Enemy stats and spawn rate scale continuously over time. Applied as multipliers on top of each enemy type's base profile.

| Time Window | Spawn Interval | HP Multiplier | Speed Multiplier | Max On-Screen |
|-------------|---------------|---------------|-----------------|---------------|
| 0–3 min     | 2000ms        | ×1.0          | ×1.0            | 20            |
| 3–6 min     | 1700ms        | ×1.2          | ×1.1            | 25            |
| 6–9 min     | 1400ms        | ×1.5          | ×1.2            | 30            |
| 9–12 min    | 1100ms        | ×2.0          | ×1.3            | 35            |
| 12–15 min   | 900ms         | ×2.5          | ×1.4            | 40            |
| Boss active | paused        | —             | —               | no new spawns |

Scaling is computed from elapsed time in milliseconds, using linear interpolation between breakpoints. Applied in `GameScene._spawnWave()` and `Enemy.activate()`.

---

## Boss Designs

All bosses reuse the `kisotsu-run` spritesheet with tint + scale. Each has a dedicated HP bar shown in the HUD during the encounter. Boss skills are implemented as timed `scene.time.addEvent` loops attached to the boss sprite.

### Boss 1 — 鬼将 (Kijō) — 5:00

- **Tint:** purple (`0x8844cc`)
- **Scale:** 2.5× display size
- **HP:** base × 15
- **Speed:** base × 0.8

**Skills:**
- **衝刺突進 (Dash):** Every 4 seconds, dashes directly toward the player's current position at speed 600px/s for 0.3 seconds. Deals `ENEMY_DAMAGE × 2` on contact during dash.
- **震地 (Tremor):** Activates when HP drops below 50%. Every 3 seconds, triggers a ground-pound AoE (radius 80px, `ENEMY_DAMAGE × 1.5`). Visual: expanding ring graphic.

### Boss 2 — 雷鬼 (Raiki) — 10:00

- **Tint:** blue (`0x2266ff`)
- **Scale:** 2.5× display size
- **HP:** base × 25
- **Speed:** base × 0.9

**Skills:**
- **雷擊圈 (Lightning Ring):** Every 5 seconds, emits an expanding ring from self (radius grows 0 → 200px over 0.8s). Contact with the ring deals `ENEMY_DAMAGE × 1.5`. Visual: yellow expanding circle graphic with brief flash.
- **召喚 (Summon):** Every 8 seconds, spawns 3 快速型 minions at random positions near the boss (within 120px). Minions use current difficulty HP/speed multipliers.

### Boss 3 — 大妖魔 (Dai Yōma) — 15:00 (Final Boss)

- **Tint:** dark red (`0xcc1133`)
- **Scale:** 3.0× display size
- **HP:** base × 40
- **Speed:** base × 0.7

**Phase 1 (HP > 50%):** Inherits Boss 1 and Boss 2 skill sets:
- Dash every 5 seconds
- Lightning Ring every 6 seconds

**Phase 2 (HP ≤ 50%):** Skill timers reset, add:
- Speed increases to base × 1.2
- **混合召喚 (Mixed Summon):** Every 6 seconds, spawns 2 快速型 + 1 坦克型
- Dash interval reduces to 3 seconds

**Phase 2 visual transition:** Brief screen flash (white, alpha 0.4) + boss tint shifts to `0xff0000`.

---

## HUD Changes

### Boss HP Bar
- Shown only during a Boss encounter
- Position: bottom-center of screen, above the existing HUD panel
- Layout: label (`鬼将`) left + health bar (width 300px) + percentage text right
- Color: `0xcc2244` fill on `0x220008` track, with `0xff4466` highlight top strip
- Disappears on Boss death

### Timer
- Existing timer HUD (`_hudTimer`) continues running throughout
- No changes needed

---

## Victory Screen

Triggered when 大妖魔 dies. Mirrors the existing `_onPlayerDead()` pattern:

1. Physics pause
2. Dark overlay (same as death screen)
3. `勝` kanji displayed (gold color `0xd4a843`) with scale-in animation
4. Stats: `生存 15:00　到達 Lv X　擊殺 Y`
5. `Click to restart` prompt
6. On click: `this.scene.restart()`

---

## Architecture Notes

### New files
- `src/enemies/EnemyTypes.js` — defines the 5 enemy type configs (tint, HP mult, speed mult, size mult, behavior flags)
- `src/enemies/BossManager.js` — handles boss spawn triggers, skill timers, HP bar, phase transitions

### Modified files
- `src/config.js` — add `PROGRESSION_BREAKPOINTS` array (time/spawnInterval/hpMult/speedMult/maxEnemies per phase)
- `src/scenes/GameScene.js` — import BossManager; update `_spawnWave()` to read current difficulty; integrate boss HP bar drawing in `_drawHud()`
- `src/entities/Enemy.js` — `activate()` accepts an enemy type config object; applies tint, size, stat multipliers

### Spawn pool logic
`_spawnWave()` selects enemy type based on elapsed time:
- Build a weighted pool of unlocked types
- All types have equal weight once unlocked (no further weighting needed — difficulty scaling handles intensity)

### No scene changes
All progression happens within `GameScene`. No new Phaser scenes are required.
