# 猫の侍伝 — Roguelike MVP Design Spec

**Date:** 2026-03-19
**Status:** Approved
**Scope:** Minimal viable roguelike — 1 weapon type, 1 enemy type, bounded arena

---

## Overview

A Vampire Survivors–style top-down roguelike. The player controls a cat samurai (`potemaru`) who moves freely in a bounded arena while their weapon auto-attacks nearby enemies. Killing enemies yields experience; leveling up triggers a 3-choice upgrade screen. The game ends when the player's HP reaches zero.

---

## Game Loop

```
Start → Move (WASD/Arrows/Touch) → Shurikens auto-fire at nearest enemy
→ Enemy dies → drops XP orb → player collects → XP bar fills
→ Level up → UpgradeScene overlay (3-choose-1) → resume
→ Player HP = 0 → Game Over overlay → restart
```

---

## Architecture

### Scenes

| Scene | Purpose |
|-------|---------|
| `BootScene` | Preload all assets, show progress bar, then start GameScene |
| `GameScene` | All gameplay: player, enemies, shurikens, XP, HUD |
| `UpgradeScene` | Overlay launched in parallel on level-up; pauses GameScene |

No menu scene for MVP — boot goes directly to game.

### `main.js` — Required Phaser Config

```js
import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import GameScene from './scenes/GameScene';
import UpgradeScene from './scenes/UpgradeScene';

new Phaser.Game({
  type: Phaser.AUTO,
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, GameScene, UpgradeScene]
});
```

> **Note:** The `physics` block is required. Without it, all Arcade Physics calls (setCollideWorldBounds, moveToObject, overlap) will throw at runtime.

### File Structure

```
src/
├── main.js                  — Phaser config, scene list
├── config.js                — All numeric constants (speeds, HP, damage, etc.)
├── scenes/
│   ├── BootScene.js
│   ├── GameScene.js
│   └── UpgradeScene.js
└── entities/
    ├── Player.js
    ├── Enemy.js
    └── Shuriken.js
```

---

## Entities

### Player (`entities/Player.js`)

**Sprite loading:** The `potemaru` spritesheets have non-uniform, non-square frame dimensions. Use `this.load.image` (not `this.load.spritesheet`) and slice frames manually from the texture. Actual measured dimensions:

| Sheet | Total size | Cols×Rows | Frame size |
|-------|-----------|-----------|------------|
| `idle.png` | 2088×3120 | 6×6 | 348×520 px |
| `run.png` | 2952×3144 | 6×6 | 492×524 px |
| `attack.png` | 3840×3612 | 6×6 | 640×602 px |

All sheets have 36 frames total. Scale the rendered sprite to a fixed display height (e.g. 120px) preserving aspect ratio. `aura.png` is **out of scope for MVP** — ignore it.

- **Movement:** WASD + Arrow keys + virtual joystick (touch); speed from `config.js`; sprite flips on X for left/right
- **Animations:**
  - `idle` — frames 0–8 only (9 of 36 frames used, intentional — remaining frames are unused variants), 12 FPS, loop
  - `run` — frames 0–35, 24 FPS, loop
  - `attack` — frames 0–35, 24 FPS, play-once; triggered on every shuriken fire. Does **not** interrupt movement; the `run`/`idle` animation resumes automatically when `attack` completes via the `animationcomplete` event.
- **HP:** starts at `config.PLAYER_HP_MAX`; HP bar rendered as Graphics at fixed screen position
- **Physics:** Arcade body, `setCollideWorldBounds(true)`
- **Public interface:**
  - `takeDamage(amount)` — reduces HP; emits `'player-dead'` on GameScene events if ≤ 0
  - `heal(amount)` — restores HP up to max
  - `applyUpgrade(upgradeId)` — mutates stats based on upgrade type
  - Stats as plain properties: `speed`, `damage`, `fireRate`, `projectileCount`, `maxHp`, `hp`

### Enemy — 鬼兵 (`entities/Enemy.js`)

- **Appearance:** Red rectangle (40×40) with `鬼` text label — procedural Graphics, no sprite needed
- **Spawn:** From a random edge of the arena every `config.ENEMY_SPAWN_INTERVAL` ms
- **Behavior:** Moves toward player via `scene.physics.moveToObject(this, player, config.ENEMY_SPEED)` called each frame
- **HP:** `config.ENEMY_HP`; on death: deactivate body, hide, emit `'enemy-died'` event on scene with `{ x, y }` for XP orb spawn
- **Damage:** Deals `config.ENEMY_DAMAGE` on overlap with player; 1-second cooldown flag prevents spam damage
- **Pooling:** `scene.physics.add.group()` in GameScene; reactivate instead of destroy

### Shuriken (`entities/Shuriken.js`)

- **Appearance:** Small rotating dark square (12×12); create once as a RenderTexture, reuse as pool texture key
- **Behavior:**
  - GameScene fires `player.projectileCount` shurikens every `player.fireRate` ms
  - Each shuriken targets the nearest living enemy at moment of fire; velocity computed with `Phaser.Math.Angle.Between`
  - `angle += 8` each frame for visual spin
  - Deactivated on hit or on exiting world bounds (`body.onWorldBounds = true`)
- **Damage:** `player.damage` per hit; one hit per enemy per shuriken (flag on contact)
- **Pooling:** `scene.physics.add.group({ maxSize: 40 })`

---

## Systems (all inside GameScene)

### XP & Level System

- On `'enemy-died'` event: create a yellow circle (8px radius) at enemy position; tween it toward the **player's position at the moment of spawn** (static target, not tracking). Destroy the circle on tween complete and credit XP.
- Player has `xp` (number) and `xpToNextLevel` (computed as `config.XP_BASE * level ** config.XP_SCALE`)
- On level-up: `this.scene.launch('UpgradeScene')` and `this.scene.pause('GameScene')`

### UpgradeScene ↔ GameScene Communication

Use Phaser events, not object references passed through `scene.launch`:

```js
// GameScene — listen before launching UpgradeScene
this.events.once('upgrade-chosen', (upgradeId) => {
  this.player.applyUpgrade(upgradeId);
  this.scene.resume('GameScene');
});
this.scene.launch('UpgradeScene');
this.scene.pause('GameScene');

// UpgradeScene — emit back to GameScene and stop self
this.scene.get('GameScene').events.emit('upgrade-chosen', selectedId);
this.scene.stop();
```

This avoids passing live class instances across scene boundaries.

### Wave / Enemy Spawning

- `this.time.addEvent` repeating every `config.ENEMY_SPAWN_INTERVAL` ms
- Spawn count: `Math.floor(level / config.WAVE_SCALE) + 1`
- Spawn position: random point on one of the four world edges, inset 20px

### HUD (rendered in GameScene)

- **HP bar:** fixed top-left (`setScrollFactor(0)`), red fill on grey background
- **XP bar:** below HP bar, blue fill
- **Level label:** next to XP bar
- **Timer:** elapsed seconds, top-right
- Redrawn each frame via `Graphics.clear()` + `fillRect`

---

## UpgradeScene

- Semi-transparent dark fullscreen overlay
- 3 card buttons rendered as Graphics + Text
- Each card shows upgrade name (Japanese) + description (Chinese/English)
- On card click: emit `'upgrade-chosen'` to GameScene, stop self

**Upgrade pool** (6 total, 3 sampled without replacement per level-up):

| ID | Name | Effect |
|----|------|--------|
| `dmg` | 手裏剣強化 | `player.damage *= 1.2` |
| `firerate` | 連射 | `player.fireRate *= 0.75` |
| `multishot` | 雙発 | `player.projectileCount += 1` |
| `speed` | 疾風 | `player.speed *= 1.15` |
| `maxhp` | 武者の意志 | `player.maxHp *= 1.2`, heal to new max |
| `regen` | 忍の回復 | add repeating timer: heal 1 HP every 5s |

---

## Config (`config.js`)

```js
export const config = {
  // Arena
  WORLD_WIDTH: 1600,
  WORLD_HEIGHT: 1200,

  // Player
  PLAYER_SPEED: 200,
  PLAYER_HP_MAX: 100,
  PLAYER_DAMAGE: 20,
  PLAYER_FIRE_RATE: 800,       // ms between shots
  PLAYER_PROJECTILE_COUNT: 1,

  // Enemy
  ENEMY_SPEED: 80,
  ENEMY_HP: 40,
  ENEMY_DAMAGE: 10,
  ENEMY_SPAWN_INTERVAL: 2000,  // ms

  // XP
  XP_PER_ENEMY: 10,
  XP_BASE: 50,
  XP_SCALE: 1.4,

  // Waves
  WAVE_SCALE: 3,               // new enemy added per N levels
};
```

---

## Physics

- **Engine:** Arcade, `gravity: { y: 0 }` (declared in `main.js` — see above)
- **Collisions:**
  - `player` vs `enemies` group → `physics.add.overlap` → `enemy.dealDamage(player)`
  - `shurikens` group vs `enemies` group → `physics.add.overlap` → shuriken hits enemy
- Player body: `setCollideWorldBounds(true)`
- Shurikens: `body.onWorldBounds = true`; listen `physics.world.on('worldbounds')` to deactivate

---

## Asset Requirements

| Asset | Path | How loaded |
|-------|------|------------|
| Idle animation | `assets/sprites/potemaru/idle.png` | `load.image`, manual frame slice |
| Run animation | `assets/sprites/potemaru/run.png` | `load.image`, manual frame slice |
| Attack animation | `assets/sprites/potemaru/attack.png` | `load.image`, manual frame slice |
| `aura.png` | — | **Out of scope for MVP** |
| Enemy visual | Procedural Graphics | No file needed |
| Shuriken visual | RenderTexture (created once) | No file needed |

---

## Out of Scope (MVP)

- Menu / title screen
- `aura.png` special effect
- Multiple characters or weapon types
- Map tiles / background art
- Sound / music
- Save / persist progress

> **Touch input IS in scope** — virtual joystick (pointer events) already implemented in current GameScene.js; carry it forward.

---

## Success Criteria

1. Player moves in 4 directions (keyboard + touch), animates correctly
2. Attack animation plays on fire without interrupting movement
3. Shurikens auto-fire toward nearest enemy; multiple on multishot upgrade
4. Enemies spawn from arena edges and chase player
5. XP orbs spawn on enemy death and tween to player
6. Level-up opens UpgradeScene overlay; selection correctly mutates player stats
7. HP depletion triggers game-over with restart
8. All numeric constants live in `config.js`
9. No file exceeds ~150 lines
