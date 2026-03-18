# 猫の侍伝 v1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable browser roguelike — cat samurai vs yokai, Vampire Survivors style — with complete game loop (menu → game → upgrade → result → meta progression).

**Architecture:** Phaser 3 scenes handle all rendering and input; pure-JS systems (WaveManager, UpgradeSystem, MetaProgress) hold logic and are unit-testable with Vitest. All content (characters, weapons, enemies) lives in `src/data/` as plain objects — adding content never touches engine code. Placeholder pixel graphics are drawn with Phaser's Graphics API so the game runs without real sprite assets.

**Tech Stack:** Phaser 3.60, Vite 5, Vitest, vanilla JS (ESM)

---

## File Map

| File | Responsibility |
|------|---------------|
| `index.html` | Entry point |
| `vite.config.js` | Dev server + build |
| `src/main.js` | Phaser game config, scene registry |
| `src/scenes/BootScene.js` | Asset preload, placeholder texture generation |
| `src/scenes/MenuScene.js` | Main menu (night/torii aesthetic) |
| `src/scenes/CharSelectScene.js` | Character picker |
| `src/scenes/MapSelectScene.js` | Map picker |
| `src/scenes/GameScene.js` | Core game loop, HUD, input |
| `src/scenes/UpgradeScene.js` | Scroll-unfurl upgrade overlay |
| `src/scenes/PauseScene.js` | Pause overlay |
| `src/scenes/ResultScene.js` | End-of-run screen |
| `src/scenes/MetaScene.js` |武魂 upgrade tree |
| `src/entities/Player.js` | Movement, HP, invincibility, knockback |
| `src/entities/Enemy.js` | Base enemy — pool-managed, near/far AI |
| `src/entities/weapons/Kunai.js` | Projectile weapon |
| `src/entities/weapons/Tachi.js` | Arc slash weapon |
| `src/entities/weapons/Shikigami.js` | Orbiting satellite weapon |
| `src/systems/WaveManager.js` | Spawn scheduling, wave boss logic |
| `src/systems/UpgradeSystem.js` | Rarity draw, card pool |
| `src/systems/MetaProgress.js` | LocalStorage save/load/migrate |
| `src/systems/VFX.js` | Particle effect helpers |
| `src/data/characters.js` | Character definitions |
| `src/data/weapons.js` | Weapon definitions + level tables |
| `src/data/enemies.js` | Enemy definitions |
| `src/data/upgrades.js` | Passive item definitions |
| `src/data/maps.js` | Map + wave schedule definitions |
| `tests/systems/WaveManager.test.js` | Unit tests |
| `tests/systems/UpgradeSystem.test.js` | Unit tests |
| `tests/systems/MetaProgress.test.js` | Unit tests |

---

## Task 1: Project Scaffold

**Files:**
- Create: `index.html`, `package.json`, `vite.config.js`, `src/main.js`

- [ ] **Step 1: Init project**

```bash
cd /Users/tedhsumbp2024/Documents/workspace/neko-samurai
npm init -y
npm install phaser@3.60.0
npm install -D vite vitest
```

- [ ] **Step 2: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <title>猫の侍伝</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
    canvas { image-rendering: pixelated; }
  </style>
</head>
<body>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create `vite.config.js`**

```js
import { defineConfig } from 'vite'
export default defineConfig({
  base: './',
  build: { outDir: 'dist', assetsDir: 'assets' },
  test: { environment: 'node' },
})
```

- [ ] **Step 4: Create `src/main.js`** (stub — scenes added per task)

```js
import Phaser from 'phaser'
import BootScene from './scenes/BootScene.js'
import MenuScene from './scenes/MenuScene.js'

const config = {
  type: Phaser.AUTO,
  width: 480,
  height: 270,
  pixelArt: true,
  backgroundColor: '#0d0d1a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scene: [BootScene, MenuScene],
}

export default new Phaser.Game(config)
```

- [ ] **Step 5: Verify dev server starts**

```bash
npx vite
```
Expected: browser opens, black screen, no console errors.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: project scaffold — Phaser 3 + Vite"
```

---

## Task 2: Data Definitions

**Files:**
- Create: `src/data/characters.js`, `src/data/weapons.js`, `src/data/enemies.js`, `src/data/upgrades.js`, `src/data/maps.js`

- [ ] **Step 1: Create `src/data/characters.js`**

```js
export const CHARACTERS = {
  mikenomaru: {
    id: 'mikenomaru', name: '三毛丸', breed: '三毛貓',
    passive: { type: 'goldBonus', value: 0.2 },
    startWeapon: 'kunai',
    stats: { hp: 100, speed: 140, armor: 0, luck: 0 },
    spriteKey: 'cat_mikenomaru',
    color: 0xf0a040,
  },
  kuroka: {
    id: 'kuroka', name: '黒影', breed: '黒貓', locked: true,
    passive: { type: 'critBonus', value: 0.15 },
    startWeapon: 'tachi',
    stats: { hp: 90, speed: 155, armor: 0, luck: 0 },
    spriteKey: 'cat_kuroka',
    color: 0x333366,
  },
}
```

- [ ] **Step 2: Create `src/data/weapons.js`**

```js
export const WEAPONS = {
  kunai: {
    id: 'kunai', name: '苦無投擲', type: 'projectile',
    levels: [
      { damage: 12, cooldown: 1200, count: 1, pierce: 1, speed: 300 },
      { damage: 16, cooldown: 1000, count: 2, pierce: 1, speed: 320 },
      { damage: 20, cooldown: 900,  count: 3, pierce: 1, speed: 340 },
      { damage: 26, cooldown: 800,  count: 4, pierce: 2, speed: 360 },
      { damage: 32, cooldown: 700,  count: 5, pierce: 2, speed: 380 },
    ],
    evolveWith: 'kazeFu', evolveTo: 'senbon',
    icon: '🗡️',
  },
  tachi: {
    id: 'tachi', name: '太刀斬擊', type: 'arc',
    levels: [
      { damage: 20, cooldown: 1400, arc: 120, range: 60 },
      { damage: 28, cooldown: 1200, arc: 150, range: 70 },
      { damage: 38, cooldown: 1100, arc: 180, range: 80 },
      { damage: 50, cooldown: 1000, arc: 240, range: 90 },
      { damage: 65, cooldown: 900,  arc: 360, range: 100 },
    ],
    evolveWith: 'steelAmulet', evolveTo: 'metsuYoTachi',
    icon: '⚔️',
  },
  shikigami: {
    id: 'shikigami', name: '召喚式神', type: 'orbit',
    levels: [
      { damage: 10, cooldown: 500, count: 1, orbitRadius: 60, orbitSpeed: 2 },
      { damage: 14, cooldown: 500, count: 2, orbitRadius: 65, orbitSpeed: 2.2 },
      { damage: 18, cooldown: 500, count: 3, orbitRadius: 70, orbitSpeed: 2.5 },
      { damage: 24, cooldown: 500, count: 4, orbitRadius: 75, orbitSpeed: 2.8 },
      { damage: 30, cooldown: 500, count: 5, orbitRadius: 80, orbitSpeed: 3.2 },
    ],
    evolveWith: null, evolveTo: null,
    icon: '✨',
  },
}
```

- [ ] **Step 3: Create `src/data/enemies.js`**

```js
export const ENEMIES = {
  oni_soldier: {
    id: 'oni_soldier', name: '鬼兵',
    hp: 30, speed: 60, damage: 10, xp: 5, souls: 1,
    color: 0xcc3333, size: 12, type: 'normal',
  },
  oni_general: {
    id: 'oni_general', name: '大鬼兵將',
    hp: 300, speed: 45, damage: 20, xp: 50, souls: 15,
    color: 0xaa1111, size: 20, type: 'boss',
    isBoss: true,
  },
  kitsune_vanguard: {
    id: 'kitsune_vanguard', name: '妖狐前鋒',
    hp: 600, speed: 90, damage: 25, xp: 80, souls: 25,
    color: 0xff8800, size: 22, type: 'boss',
    isBoss: true, behavior: 'dash',
  },
  bamboo_fox_final: {
    id: 'bamboo_fox_final', name: '竹林妖狐',
    hp: 2000, speed: 70, damage: 30, xp: 200, souls: 80,
    color: 0xff6600, size: 32, type: 'final_boss',
    isBoss: true,
  },
}
```

- [ ] **Step 4: Create `src/data/upgrades.js`**

```js
export const PASSIVES = {
  hpUp:    { id: 'hpUp',    name: '生命符',  rarity: 'common', effect: { type: 'hp',    value: 20 } },
  spdUp:   { id: 'spdUp',   name: '疾風符',  rarity: 'rare',   effect: { type: 'speed', value: 15 } },
  atkUp:   { id: 'atkUp',   name: '攻擊符',  rarity: 'common', effect: { type: 'atk',   value: 0.1 } },
  cdUp:    { id: 'cdUp',    name: '冷卻符',  rarity: 'rare',   effect: { type: 'cd',    value: 0.1 } },
  luckUp:  { id: 'luckUp',  name: '幸運符',  rarity: 'epic',   effect: { type: 'luck',  value: 20 } },
  kazeFu:  { id: 'kazeFu',  name: '疾風符★', rarity: 'epic',   effect: { type: 'speed', value: 10 }, evolveKey: true },
  steelAmulet: { id: 'steelAmulet', name: '鋼鐵護符', rarity: 'epic', effect: { type: 'armor', value: 10 }, evolveKey: true },
}
```

- [ ] **Step 5: Create `src/data/maps.js`**

```js
export const MAPS = {
  bamboo_village: {
    id: 'bamboo_village', name: '竹林村', locked: false,
    bgColor: 0x1a2a0a, difficulty: 1,
    enemies: ['oni_soldier'],
    waveSchedule: [
      { time: 60,  boss: 'oni_general',      hpMult: 1.0 },
      { time: 180, boss: 'oni_general',      hpMult: 1.2, count: 2 },
      { time: 300, boss: 'oni_general',      hpMult: 1.5, count: 3 },
      { time: 480, boss: 'oni_general',      hpMult: 2.0, behavior: 'chase' },
      { time: 660, boss: 'kitsune_vanguard', hpMult: 2.5 },
      { time: 900, boss: 'bamboo_fox_final', hpMult: 5.0, final: true },
    ],
    spawnRate: 1200, // ms between spawns (base)
  },
}
```

- [ ] **Step 6: Commit**

```bash
git add src/data && git commit -m "feat: data definitions for characters, weapons, enemies, upgrades, maps"
```

---

## Task 3: MetaProgress System

**Files:**
- Create: `src/systems/MetaProgress.js`, `tests/systems/MetaProgress.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/systems/MetaProgress.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import MetaProgress from '../../src/systems/MetaProgress.js'

const mockStorage = {}
const ls = { getItem: k => mockStorage[k] ?? null, setItem: (k,v) => { mockStorage[k]=v } }

describe('MetaProgress', () => {
  let mp
  beforeEach(() => { Object.keys(mockStorage).forEach(k=>delete mockStorage[k]); mp = new MetaProgress(ls) })

  it('returns default save when storage empty', () => {
    const s = mp.load()
    expect(s.version).toBe(1)
    expect(s.souls).toBe(0)
    expect(s.nodes.atk).toBe(0)
  })

  it('saves and reloads correctly', () => {
    mp.addSouls(150)
    mp.save()
    const mp2 = new MetaProgress(ls)
    expect(mp2.load().souls).toBe(150)
  })

  it('upgrades a node and deducts souls', () => {
    mp.addSouls(200)
    const ok = mp.upgradeNode('atk')
    expect(ok).toBe(true)
    expect(mp.data.nodes.atk).toBe(1)
    expect(mp.data.souls).toBe(120) // 200 - 80
  })

  it('rejects upgrade when insufficient souls', () => {
    const ok = mp.upgradeNode('atk')
    expect(ok).toBe(false)
  })

  it('rejects upgrade at max level', () => {
    mp.addSouls(9999)
    for (let i = 0; i < 5; i++) mp.upgradeNode('atk')
    const ok = mp.upgradeNode('atk')
    expect(ok).toBe(false)
  })

  it('migrates v0 save by filling missing fields', () => {
    mockStorage['neko_meta_v1'] = JSON.stringify({ version: 0, souls: 50 })
    const s = mp.load()
    expect(s.nodes.atk).toBe(0)
    expect(s.souls).toBe(50)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run tests/systems/MetaProgress.test.js
```

- [ ] **Step 3: Implement `src/systems/MetaProgress.js`**

```js
const STORAGE_KEY = 'neko_meta_v1'
const CURRENT_VERSION = 1

const NODE_DEFS = {
  atk:        { cost: 80,  max: 5 },
  hp:         { cost: 100, max: 5 },
  spd:        { cost: 80,  max: 3 },
  luck:       { cost: 120, max: 3 },
  pickup:     { cost: 90,  max: 3 },
  cd:         { cost: 150, max: 3 },
  gold:       { cost: 90,  max: 3 },
  exp:        { cost: 110, max: 3 },
  char_kuroka:  { cost: 500, max: 1 },
  map_shrine:   { cost: 600, max: 1 },
}

function defaultSave() {
  return {
    version: CURRENT_VERSION,
    souls: 0,
    nodes: Object.fromEntries(Object.keys(NODE_DEFS).map(k => [k, 0])),
    unlocked: [],
    settings: { musicVol: 0.8, sfxVol: 1.0 },
    stats: { totalRuns: 0, bestTime: 0, totalKills: 0 },
  }
}

function migrate(raw) {
  const def = defaultSave()
  const out = { ...def, ...raw, nodes: { ...def.nodes, ...(raw.nodes || {}) } }
  out.version = CURRENT_VERSION
  return out
}

export default class MetaProgress {
  constructor(storage = localStorage) {
    this._storage = storage
    this.data = this.load()
  }

  load() {
    const raw = this._storage.getItem(STORAGE_KEY)
    if (!raw) { this.data = defaultSave(); return this.data }
    try {
      const parsed = JSON.parse(raw)
      this.data = migrate(parsed)
    } catch {
      this.data = defaultSave()
    }
    return this.data
  }

  save() {
    this._storage.setItem(STORAGE_KEY, JSON.stringify(this.data))
  }

  addSouls(n) { this.data.souls += n }

  upgradeNode(id) {
    const def = NODE_DEFS[id]
    if (!def) return false
    const cur = this.data.nodes[id] ?? 0
    if (cur >= def.max) return false
    if (this.data.souls < def.cost) return false
    this.data.souls -= def.cost
    this.data.nodes[id] = cur + 1
    if (id === 'char_kuroka') this.data.unlocked.push('kuroka')
    if (id === 'map_shrine')  this.data.unlocked.push('shrine')
    return true
  }

  getStatBonuses() {
    const n = this.data.nodes
    return {
      atkMult:    1 + (n.atk  || 0) * 0.05,
      hpMult:     1 + (n.hp   || 0) * 0.10,
      spdMult:    1 + (n.spd  || 0) * 0.05,
      luck:           (n.luck || 0) * 10,
      pickupMult: 1 + (n.pickup || 0) * 0.20,
      cdMult:     1 - (n.cd   || 0) * 0.05,
      goldMult:   1 + (n.gold || 0) * 0.15,
      expMult:    1 + (n.exp  || 0) * 0.10,
    }
  }

  isUnlocked(id) { return this.data.unlocked.includes(id) }
  static get NODE_DEFS() { return NODE_DEFS }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run tests/systems/MetaProgress.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/systems/MetaProgress.js tests/systems/MetaProgress.test.js
git commit -m "feat: MetaProgress system with save/load/migrate/upgrade"
```

---

## Task 4: WaveManager System

**Files:**
- Create: `src/systems/WaveManager.js`, `tests/systems/WaveManager.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/systems/WaveManager.test.js
import { describe, it, expect, vi } from 'vitest'
import WaveManager from '../../src/systems/WaveManager.js'
import { MAPS } from '../../src/data/maps.js'

describe('WaveManager', () => {
  it('returns correct boss at scheduled time', () => {
    const wm = new WaveManager(MAPS.bamboo_village)
    const boss = wm.getBossAt(60)
    expect(boss.boss).toBe('oni_general')
    expect(boss.hpMult).toBe(1.0)
  })

  it('returns null when no boss at time', () => {
    const wm = new WaveManager(MAPS.bamboo_village)
    expect(wm.getBossAt(45)).toBeNull()
  })

  it('detects final boss', () => {
    const wm = new WaveManager(MAPS.bamboo_village)
    const boss = wm.getBossAt(900)
    expect(boss.final).toBe(true)
  })

  it('tracks spawn rate multiplier', () => {
    const wm = new WaveManager(MAPS.bamboo_village)
    expect(wm.spawnRateMultiplier).toBe(1.0)
    wm.onBossKilled()
    expect(wm.spawnRateMultiplier).toBeCloseTo(1.15)
    // caps at 2.5
    for (let i = 0; i < 20; i++) wm.onBossKilled()
    expect(wm.spawnRateMultiplier).toBe(2.5)
  })

  it('current spawn interval respects multiplier', () => {
    const wm = new WaveManager(MAPS.bamboo_village)
    wm.onBossKilled()
    expect(wm.currentSpawnInterval).toBeCloseTo(1200 / 1.15, 0)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run tests/systems/WaveManager.test.js
```

- [ ] **Step 3: Implement `src/systems/WaveManager.js`**

```js
export default class WaveManager {
  constructor(mapDef) {
    this._map = mapDef
    this._schedule = [...mapDef.waveSchedule]
    this._triggeredTimes = new Set()
    this.spawnRateMultiplier = 1.0
    this.activeBoss = null
  }

  getBossAt(elapsedSeconds) {
    const entry = this._schedule.find(e => e.time === elapsedSeconds)
    return entry || null
  }

  checkAndTrigger(elapsedSeconds) {
    if (this._triggeredTimes.has(elapsedSeconds)) return null
    const entry = this.getBossAt(elapsedSeconds)
    if (entry) { this._triggeredTimes.add(elapsedSeconds); return entry }
    return null
  }

  onBossKilled() {
    this.activeBoss = null
    this.spawnRateMultiplier = Math.min(2.5, this.spawnRateMultiplier + 0.15)
  }

  get currentSpawnInterval() {
    return this._map.spawnRate / this.spawnRateMultiplier
  }

  get isFinalBossActive() {
    return this.activeBoss?.final === true
  }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run tests/systems/WaveManager.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/systems/WaveManager.js tests/systems/WaveManager.test.js
git commit -m "feat: WaveManager with boss schedule and spawn rate scaling"
```

---

## Task 5: UpgradeSystem

**Files:**
- Create: `src/systems/UpgradeSystem.js`, `tests/systems/UpgradeSystem.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/systems/UpgradeSystem.test.js
import { describe, it, expect } from 'vitest'
import UpgradeSystem from '../../src/systems/UpgradeSystem.js'

describe('UpgradeSystem', () => {
  it('draws 3 cards', () => {
    const us = new UpgradeSystem({ weapons: ['kunai', 'tachi'], passives: ['hpUp', 'spdUp', 'atkUp'] })
    const cards = us.drawCards({ luck: 0, weapons: [] })
    expect(cards).toHaveLength(3)
  })

  it('does not offer already-maxed weapon', () => {
    const us = new UpgradeSystem({ weapons: ['kunai'], passives: ['hpUp', 'spdUp', 'atkUp', 'cdUp', 'luckUp'] })
    const cards = us.drawCards({ luck: 0, weapons: [{ id: 'kunai', level: 5 }] })
    const kunaiUpgrade = cards.filter(c => c.type === 'weapon' && c.id === 'kunai')
    expect(kunaiUpgrade).toHaveLength(0)
  })

  it('higher luck shifts rarity toward epic', () => {
    const us = new UpgradeSystem({ weapons: [], passives: ['hpUp','spdUp','atkUp','cdUp','luckUp'] })
    let epicCount = 0
    for (let i = 0; i < 300; i++) {
      const cards = us.drawCards({ luck: 100, weapons: [] })
      epicCount += cards.filter(c => c.rarity === 'epic').length
    }
    // With luck=100 (10 stacks of +10), epic chance ~15%, expect >100 in 900 draws
    expect(epicCount).toBeGreaterThan(100)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run tests/systems/UpgradeSystem.test.js
```

- [ ] **Step 3: Implement `src/systems/UpgradeSystem.js`**

```js
import { WEAPONS } from '../data/weapons.js'
import { PASSIVES } from '../data/upgrades.js'

const RARITY_BASE = { common: 0.70, rare: 0.25, epic: 0.05 }

function calcRarityWeights(luck) {
  const stacks = Math.floor(luck / 10)
  let common = Math.max(0.30, RARITY_BASE.common - stacks * 0.05)
  let rare   = Math.min(0.50, RARITY_BASE.rare   + stacks * 0.03)
  let epic   = Math.min(0.20, RARITY_BASE.epic   + stacks * 0.02)
  const total = common + rare + epic
  return { common: common/total, rare: rare/total, epic: epic/total }
}

function pickRarity(luck) {
  const w = calcRarityWeights(luck)
  const r = Math.random()
  if (r < w.epic) return 'epic'
  if (r < w.epic + w.rare) return 'rare'
  return 'common'
}

export default class UpgradeSystem {
  constructor({ weapons = Object.keys(WEAPONS), passives = Object.keys(PASSIVES) } = {}) {
    this._weaponIds = weapons
    this._passiveIds = passives
  }

  drawCards({ luck = 0, weapons = [] } = {}) {
    const weaponLevels = Object.fromEntries(weapons.map(w => [w.id, w.level]))
    const pool = []

    // Weapon upgrades (not at max)
    for (const id of this._weaponIds) {
      const def = WEAPONS[id]; if (!def) continue
      const cur = weaponLevels[id] ?? 0
      if (cur > 0 && cur < def.levels.length) {
        pool.push({ type: 'weapon', id, name: def.name, level: cur + 1, rarity: cur >= 3 ? 'rare' : 'common' })
      }
    }

    // New weapons (not yet held)
    for (const id of this._weaponIds) {
      const def = WEAPONS[id]; if (!def) continue
      if (!weaponLevels[id]) {
        pool.push({ type: 'weapon', id, name: def.name, level: 1, rarity: 'common' })
      }
    }

    // Passives
    for (const id of this._passiveIds) {
      const def = PASSIVES[id]; if (!def) continue
      pool.push({ type: 'passive', id, name: def.name, rarity: def.rarity, effect: def.effect })
    }

    if (pool.length === 0) return []

    // Draw 3 unique cards
    const drawn = []
    const used = new Set()
    let attempts = 0
    while (drawn.length < 3 && attempts < 100) {
      attempts++
      const rarity = pickRarity(luck)
      const candidates = pool.filter(c => c.rarity === rarity && !used.has(c.id))
      if (candidates.length === 0) continue
      const card = candidates[Math.floor(Math.random() * candidates.length)]
      drawn.push(card)
      used.add(card.id)
    }
    // Fallback: fill remaining from any pool
    if (drawn.length < 3) {
      const remaining = pool.filter(c => !used.has(c.id))
      drawn.push(...remaining.slice(0, 3 - drawn.length))
    }
    return drawn
  }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run tests/systems/UpgradeSystem.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/systems/UpgradeSystem.js tests/systems/UpgradeSystem.test.js
git commit -m "feat: UpgradeSystem with rarity draws and luck scaling"
```

---

## Task 6: Placeholder Asset Generation (BootScene)

**Files:**
- Create: `src/scenes/BootScene.js`

All sprites are drawn procedurally with Phaser Graphics — no image files needed for MVP.

- [ ] **Step 1: Create `src/scenes/BootScene.js`**

```js
import Phaser from 'phaser'

export default class BootScene extends Phaser.Scene {
  constructor() { super('BootScene') }

  create() {
    this._makeCat('cat_mikenomaru', 0xf0a040, 0xffd080)
    this._makeCat('cat_kuroka',     0x334466, 0x6688aa)
    this._makeEnemy('enemy_oni',    0xcc3333, 12)
    this._makeEnemy('enemy_boss',   0xaa1111, 22)
    this._makeWeapon('weapon_kunai',    0xc8c8ff, 4)
    this._makeWeapon('weapon_slash',    0xffffc0, 8)
    this._makeWeapon('weapon_shiki',    0xffaa44, 6)
    this._makeParticle('p_sakura',  0xffb7c5)
    this._makeParticle('p_soul',    0xaa88ff)
    this._makeTile('tile_grass',    0x1a2a0a, 0x223311)
    this._makeUiBox('ui_scroll',    0xe8dbb0)
    this.scene.start('MenuScene')
  }

  _makeCat(key, bodyColor, stripeColor) {
    const g = this.make.graphics({ add: false })
    const s = 32
    g.fillStyle(bodyColor)
    g.fillRect(8, 10, 16, 14)  // body
    g.fillRect(10, 4, 12, 10)  // head
    g.fillStyle(0x111111)
    g.fillRect(13, 7, 3, 3)    // left eye
    g.fillRect(20, 7, 3, 3)    // right eye
    g.fillStyle(stripeColor)
    g.fillRect(10, 4, 2, 6)    // ear L
    g.fillRect(20, 4, 2, 6)    // ear R
    g.fillStyle(bodyColor)
    g.fillRect(6, 24, 5, 8)    // leg L
    g.fillRect(21, 24, 5, 8)   // leg R
    g.fillRect(26, 20, 6, 3)   // tail
    g.generateTexture(key, s, s)
    g.destroy()
  }

  _makeEnemy(key, color, size) {
    const g = this.make.graphics({ add: false })
    g.fillStyle(color)
    g.fillRect(0, 0, size * 2, size * 2)
    g.fillStyle(0x000000)
    g.fillRect(size * 0.3, size * 0.4, size * 0.3, size * 0.3)
    g.fillRect(size * 1.1, size * 0.4, size * 0.3, size * 0.3)
    g.fillStyle(0xffffff)
    g.fillRect(size * 0.3, size * 1.0, size * 1.4, size * 0.2)
    g.generateTexture(key, size * 2, size * 2)
    g.destroy()
  }

  _makeWeapon(key, color, size) {
    const g = this.make.graphics({ add: false })
    g.fillStyle(color, 0.9)
    g.fillRect(0, size/2 - 1, size * 3, 3)
    g.generateTexture(key, size * 3, size)
    g.destroy()
  }

  _makeParticle(key, color) {
    const g = this.make.graphics({ add: false })
    g.fillStyle(color)
    g.fillRect(0, 0, 4, 4)
    g.generateTexture(key, 4, 4)
    g.destroy()
  }

  _makeTile(key, c1, c2) {
    const g = this.make.graphics({ add: false })
    g.fillStyle(c1); g.fillRect(0, 0, 16, 16)
    g.fillStyle(c2); g.fillRect(0, 8, 16, 2)
    g.generateTexture(key, 16, 16)
    g.destroy()
  }

  _makeUiBox(key, color) {
    const g = this.make.graphics({ add: false })
    g.fillStyle(color, 0.92); g.fillRect(0, 0, 120, 160)
    g.lineStyle(2, 0x8b6914); g.strokeRect(0, 0, 120, 160)
    g.lineStyle(1, 0x8b6914, 0.5); g.strokeRect(4, 4, 112, 152)
    g.generateTexture(key, 120, 160)
    g.destroy()
  }
}
```

- [ ] **Step 2: Update `src/main.js`** to import BootScene as first scene and chain to MenuScene

- [ ] **Step 3: Check browser** — BootScene loads and transitions (MenuScene stub OK for now)

- [ ] **Step 4: Commit**

```bash
git add src/scenes/BootScene.js && git commit -m "feat: BootScene procedural pixel asset generation"
```

---

## Task 7: MenuScene

**Files:**
- Create: `src/scenes/MenuScene.js`

- [ ] **Step 1: Create `src/scenes/MenuScene.js`**

```js
import Phaser from 'phaser'

export default class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene') }

  create() {
    const { width: W, height: H } = this.scale

    // Night sky gradient
    const sky = this.add.graphics()
    sky.fillGradientStyle(0x0a0a15, 0x0a0a15, 0x1a0a20, 0x1a0a20, 1)
    sky.fillRect(0, 0, W, H)

    // Stars
    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(0, W)
      const y = Phaser.Math.Between(0, H * 0.7)
      const star = this.add.rectangle(x, y, 1, 1, 0xffffff, Phaser.Math.FloatBetween(0.3, 0.9))
      this.tweens.add({ targets: star, alpha: 0.1, duration: Phaser.Math.Between(1000, 3000), yoyo: true, repeat: -1 })
    }

    // Moon
    this.add.circle(W - 50, 40, 18, 0xf0e060).setAlpha(0.9)
    this.add.circle(W - 44, 38, 15, 0x1a0a20)  // crescent shadow

    // Mountain silhouettes
    const mtn = this.add.graphics()
    mtn.fillStyle(0x150818)
    mtn.fillTriangle(0, H, 60, H*0.5, 120, H)
    mtn.fillTriangle(80, H, 160, H*0.35, 240, H)
    mtn.fillTriangle(200, H, 280, H*0.45, 360, H)
    mtn.fillTriangle(300, H, 400, H*0.3, W, H)
    mtn.fillStyle(0x0d0008)
    mtn.fillRect(0, H*0.75, W, H*0.25)

    // Torii gate
    const tx = W * 0.5, ty = H * 0.6
    const torii = this.add.graphics()
    torii.fillStyle(0xcc3300)
    torii.fillRect(tx - 20, ty, 4, 35)    // left pillar
    torii.fillRect(tx + 16, ty, 4, 35)    // right pillar
    torii.fillRect(tx - 26, ty - 8, 52, 6) // top beam
    torii.fillRect(tx - 22, ty,     44, 4) // lower beam

    // Title
    this.add.text(W/2, H * 0.22, '猫の侍伝', {
      fontSize: '22px', color: '#f0d040', fontFamily: 'serif',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5)
    this.add.text(W/2, H * 0.32, 'NEKO NO SAMURAI-DEN', {
      fontSize: '6px', color: '#f0d04088', fontFamily: 'monospace', letterSpacing: 4,
    }).setOrigin(0.5)

    // Cat emoji placeholder
    this.add.text(W/2, H * 0.47, '🐱⚔️', { fontSize: '20px' }).setOrigin(0.5)

    // Menu buttons
    const btns = [
      { label: '▶  開始遊戲', scene: 'CharSelectScene' },
      { label: '⚔  武魂強化', scene: 'MetaScene' },
    ]
    btns.forEach(({ label, scene }, i) => {
      const y = H * 0.64 + i * 22
      const bg = this.add.rectangle(W/2, y, 110, 16, 0x1a0a00).setInteractive()
      const border = this.add.graphics()
      border.lineStyle(1, 0xf0d04066); border.strokeRect(W/2 - 55, y - 8, 110, 16)
      const txt = this.add.text(W/2, y, label, { fontSize: '7px', color: '#f0d040', fontFamily: 'monospace' }).setOrigin(0.5)
      bg.on('pointerover',  () => { bg.setFillStyle(0xf0d04022); txt.setColor('#ffffff') })
      bg.on('pointerout',   () => { bg.setFillStyle(0x1a0a00);   txt.setColor('#f0d040') })
      bg.on('pointerdown',  () => this.scene.start(scene))
    })

    // Cherry blossoms drift
    this._spawnBlossom()
    this.time.addEvent({ delay: 800, callback: this._spawnBlossom, callbackScope: this, loop: true })
  }

  _spawnBlossom() {
    const { width: W, height: H } = this.scale
    const x = Phaser.Math.Between(0, W)
    const b = this.add.text(x, -10, '🌸', { fontSize: '8px' })
    this.tweens.add({
      targets: b, y: H + 20, x: x + Phaser.Math.Between(-30, 30),
      alpha: { from: 0.7, to: 0 }, duration: Phaser.Math.Between(4000, 7000),
      onComplete: () => b.destroy(),
    })
  }
}
```

- [ ] **Step 2: Verify in browser** — night scene with stars, torii, title, two buttons visible.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/MenuScene.js && git commit -m "feat: MenuScene — night sky, torii, animated blossoms"
```

---

## Task 8: CharSelectScene + MapSelectScene

**Files:**
- Create: `src/scenes/CharSelectScene.js`, `src/scenes/MapSelectScene.js`

- [ ] **Step 1: Create `src/scenes/CharSelectScene.js`**

```js
import Phaser from 'phaser'
import { CHARACTERS } from '../data/characters.js'
import MetaProgress from '../systems/MetaProgress.js'

export default class CharSelectScene extends Phaser.Scene {
  constructor() { super('CharSelectScene') }

  create() {
    const { width: W, height: H } = this.scale
    const mp = new MetaProgress()
    mp.load()

    this.add.rectangle(0, 0, W, H, 0x0d0d1a).setOrigin(0)
    this.add.text(W/2, 20, '選擇貓咪武士', { fontSize: '10px', color: '#f0d040', fontFamily: 'monospace' }).setOrigin(0.5)

    const chars = Object.values(CHARACTERS)
    chars.forEach((char, i) => {
      const x = W * 0.25 + i * (W * 0.5)
      const locked = char.locked && !mp.isUnlocked(char.id)

      const card = this.add.rectangle(x, H/2, 90, 120, locked ? 0x1a1a2e : 0x1a1a3e)
      this.add.graphics().lineStyle(1, locked ? 0x444444 : 0xf0d04066).strokeRect(x - 45, H/2 - 60, 90, 120)

      if (locked) {
        this.add.text(x, H/2, '🔒', { fontSize: '24px' }).setOrigin(0.5)
        this.add.text(x, H/2 + 30, '需武魂解鎖', { fontSize: '6px', color: '#666666', fontFamily: 'monospace' }).setOrigin(0.5)
      } else {
        const sprite = this.add.image(x, H/2 - 20, char.spriteKey).setScale(2)
        this.add.text(x, H/2 + 10, char.name, { fontSize: '8px', color: '#f0e8d0', fontFamily: 'monospace' }).setOrigin(0.5)
        this.add.text(x, H/2 + 22, char.breed, { fontSize: '6px', color: '#888888', fontFamily: 'monospace' }).setOrigin(0.5)
        this.add.text(x, H/2 + 38, `HP: ${char.stats.hp}  SPD: ${char.stats.speed}`, { fontSize: '6px', color: '#aaaaaa', fontFamily: 'monospace' }).setOrigin(0.5)

        card.setInteractive()
        card.on('pointerover', () => card.setFillStyle(0xf0d04022))
        card.on('pointerout',  () => card.setFillStyle(0x1a1a3e))
        card.on('pointerdown', () => {
          this.scene.start('MapSelectScene', { charId: char.id })
        })
      }
    })

    this.add.text(10, H - 15, '← 返回', { fontSize: '7px', color: '#888888', fontFamily: 'monospace' })
      .setInteractive().on('pointerdown', () => this.scene.start('MenuScene'))
  }
}
```

- [ ] **Step 2: Create `src/scenes/MapSelectScene.js`**

```js
import Phaser from 'phaser'
import { MAPS } from '../data/maps.js'
import MetaProgress from '../systems/MetaProgress.js'

export default class MapSelectScene extends Phaser.Scene {
  constructor() { super('MapSelectScene') }

  create(data) {
    const { width: W, height: H } = this.scale
    const mp = new MetaProgress(); mp.load()
    this._charId = data.charId

    this.add.rectangle(0, 0, W, H, 0x0d0d1a).setOrigin(0)
    this.add.text(W/2, 20, '選擇戰場', { fontSize: '10px', color: '#f0d040', fontFamily: 'monospace' }).setOrigin(0.5)

    const maps = Object.values(MAPS)
    maps.forEach((map, i) => {
      const x = W * 0.2 + i * (W * 0.35)
      const locked = map.locked && !mp.isUnlocked(map.id)

      const card = this.add.rectangle(x, H/2, 100, 110, 0x1a1a2e)
      this.add.graphics().lineStyle(1, locked ? 0x333333 : 0xf0d04066).strokeRect(x-50, H/2-55, 100, 110)

      const preview = this.add.rectangle(x, H/2 - 20, 80, 55, map.bgColor || 0x1a2a0a)
      this.add.text(x, H/2 - 20, locked ? '🔒' : '🌿', { fontSize: '20px' }).setOrigin(0.5)
      this.add.text(x, H/2 + 20, map.name, { fontSize: '8px', color: locked ? '#555555' : '#f0e8d0', fontFamily: 'monospace' }).setOrigin(0.5)
      this.add.text(x, H/2 + 33, `難度 ${'★'.repeat(map.difficulty)}`, { fontSize: '7px', color: '#f0a030', fontFamily: 'monospace' }).setOrigin(0.5)

      if (!locked) {
        card.setInteractive()
        card.on('pointerover', () => card.setFillStyle(0xf0d04022))
        card.on('pointerout',  () => card.setFillStyle(0x1a1a2e))
        card.on('pointerdown', () => this.scene.start('GameScene', { charId: this._charId, mapId: map.id }))
      }
    })

    this.add.text(10, H-15, '← 返回', { fontSize:'7px', color:'#888888', fontFamily:'monospace' })
      .setInteractive().on('pointerdown', () => this.scene.start('CharSelectScene'))
  }
}
```

- [ ] **Step 3: Register both scenes in `src/main.js`**

Add imports and add to scene array: `[BootScene, MenuScene, CharSelectScene, MapSelectScene]`

- [ ] **Step 4: Verify flow** — Menu → CharSelect → MapSelect, locked chars show lock icon.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/CharSelectScene.js src/scenes/MapSelectScene.js src/main.js
git commit -m "feat: CharSelectScene and MapSelectScene with lock state"
```

---

## Task 9: Player Entity

**Files:**
- Create: `src/entities/Player.js`

- [ ] **Step 1: Create `src/entities/Player.js`**

```js
import Phaser from 'phaser'
import { CHARACTERS } from '../data/characters.js'

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, charId, metaBonuses = {}) {
    const charDef = CHARACTERS[charId]
    super(scene, x, y, charDef.spriteKey)
    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.charDef = charDef
    this._bonuses = metaBonuses

    // Stats
    const hpMult  = metaBonuses.hpMult  || 1
    const spdMult = metaBonuses.spdMult || 1
    this.maxHp    = charDef.stats.hp * hpMult
    this.hp       = this.maxHp
    this.speed    = charDef.stats.speed * spdMult
    this.luck     = charDef.stats.luck + (metaBonuses.luck || 0)
    this.atkMult  = metaBonuses.atkMult || 1
    this.xp       = 0
    this.level    = 1
    this.xpToNext = 20
    this.gold     = 0
    this.kills    = 0

    // Invincibility
    this._invincible  = false
    this._invincTime  = charId === 'yukihime' ? 750 : 500

    this.setScale(2)
    this.body.setCircle(8, 8, 8)
    this.setDepth(10)

    // Cursor keys
    this._keys = scene.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT')
  }

  update() {
    const { W, A, S, D, UP, DOWN, LEFT, RIGHT } = this._keys
    let vx = 0, vy = 0
    if (A.isDown || LEFT.isDown)  vx -= 1
    if (D.isDown || RIGHT.isDown) vx += 1
    if (W.isDown || UP.isDown)    vy -= 1
    if (S.isDown || DOWN.isDown)  vy += 1
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707 }
    this.setVelocity(vx * this.speed, vy * this.speed)
    if (vx !== 0) this.setFlipX(vx < 0)
  }

  takeDamage(amount, enemies, scene) {
    if (this._invincible) return
    this.hp = Math.max(0, this.hp - amount)
    this._invincible = true

    // Red flash overlay
    const flash = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0xff0000, 0.3).setOrigin(0).setDepth(100)
    scene.time.delayedCall(150, () => flash.destroy())

    // Blink tween
    scene.tweens.add({
      targets: this, alpha: 0.3,
      duration: 80, yoyo: true, repeat: Math.floor(this._invincTime / 160),
      onComplete: () => { this.alpha = 1; this._invincible = false },
    })

    // Knockback nearby enemies
    if (enemies) {
      enemies.getChildren().forEach(e => {
        if (!e.active) return
        const dist = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y)
        if (dist < 48) {
          const angle = Phaser.Math.Angle.Between(this.x, this.y, e.x, e.y)
          scene.tweens.add({
            targets: e,
            x: e.x + Math.cos(angle) * 30,
            y: e.y + Math.sin(angle) * 30,
            duration: 200,
          })
        }
      })
    }
  }

  gainXp(amount, metaBonuses) {
    const expMult = (metaBonuses || this._bonuses).expMult || 1
    this.xp += amount * expMult
    if (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext
      this.level++
      this.xpToNext = Math.floor(this.xpToNext * 1.3)
      return true // leveled up
    }
    return false
  }

  get isDead() { return this.hp <= 0 }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/entities/Player.js && git commit -m "feat: Player entity with movement, damage, knockback, XP"
```

---

## Task 10: Enemy Entity

**Files:**
- Create: `src/entities/Enemy.js`

- [ ] **Step 1: Create `src/entities/Enemy.js`**

```js
import Phaser from 'phaser'
import { ENEMIES } from '../data/enemies.js'

const FAR_THRESHOLD = 400 // px — beyond this, skip arcade physics

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'enemy_oni')
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.setActive(false).setVisible(false)
  }

  spawn(x, y, enemyId, hpOverride) {
    const def = ENEMIES[enemyId]
    this.setActive(true).setVisible(true).setPosition(x, y)
    this.enemyId   = enemyId
    this.enemyDef  = def
    this.hp        = hpOverride ?? def.hp
    this.maxHp     = this.hp
    this.speed     = def.speed
    this.damage    = def.damage
    this._isBoss   = def.isBoss || false
    this._behavior = def.behavior || 'chase'
    this._dashCooldown = 0

    const s = def.isBoss ? 2.5 : 1.5
    this.setScale(s)
    this.setTexture(def.isBoss ? 'enemy_boss' : 'enemy_oni')
    this.setTint(def.color)
    this.body.setCircle(def.size * 0.6)
    this.setDepth(5)
    return this
  }

  update(player, delta) {
    if (!this.active || !player?.active) return

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y)

    if (dist > FAR_THRESHOLD) {
      // Lightweight vector movement — skip arcade physics
      const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y)
      this.x += Math.cos(angle) * this.speed * (delta / 1000)
      this.y += Math.sin(angle) * this.speed * (delta / 1000)
      this.body.reset(this.x, this.y)
      return
    }

    if (this._behavior === 'dash' && this._dashCooldown <= 0 && dist < 150) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y)
      this.scene.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), this.speed * 4, this.body.velocity)
      this._dashCooldown = 3000
    } else {
      this.scene.physics.moveToObject(this, player, this.speed)
      this._dashCooldown -= delta
    }
  }

  takeDamage(amount) {
    this.hp -= amount
    this.setTint(0xffffff)
    this.scene.time.delayedCall(80, () => { if (this.active) this.setTint(this.enemyDef.color) })
    if (this.hp <= 0) { this.die(); return true }
    return false
  }

  die() {
    this.setActive(false).setVisible(false)
    this.body.reset(0, 0)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/entities/Enemy.js && git commit -m "feat: Enemy entity with object-pool support, far/near AI, dash behavior"
```

---

## Task 11: Weapon Entities

**Files:**
- Create: `src/entities/weapons/Kunai.js`, `src/entities/weapons/Tachi.js`, `src/entities/weapons/Shikigami.js`

- [ ] **Step 1: Create `src/entities/weapons/Kunai.js`**

```js
import Phaser from 'phaser'
import { WEAPONS } from '../../data/weapons.js'

export default class Kunai {
  constructor(scene, player) {
    this.scene   = scene
    this.player  = player
    this.id      = 'kunai'
    this.level   = 1
    this._timer  = 0
    this._group  = scene.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize: 20, runChildUpdate: false })
  }

  get def() { return WEAPONS.kunai.levels[this.level - 1] }
  get group() { return this._group }

  update(delta, enemies) {
    this._timer += delta
    if (this._timer < this.def.cooldown) return
    this._timer = 0

    const allEnemies = enemies.getChildren().filter(e => e.active)
    if (allEnemies.length === 0) return

    // Sort by distance, shoot at closest N
    allEnemies.sort((a, b) => {
      const da = Phaser.Math.Distance.Between(this.player.x, this.player.y, a.x, a.y)
      const db = Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y)
      return da - db
    })

    const targets = allEnemies.slice(0, this.def.count)
    targets.forEach(target => {
      const proj = this._group.get(this.player.x, this.player.y, 'weapon_kunai')
      if (!proj) return
      proj.setActive(true).setVisible(true).setScale(1.5).setDepth(8)
      proj._pierce = this.def.pierce
      proj._damage = this.def.damage * (this.player.atkMult || 1)
      proj._hit = new Set()
      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x, target.y)
      this.scene.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), this.def.speed, proj.body.velocity)
      proj.setRotation(angle)
      // Auto-destroy after 1.5s
      this.scene.time.delayedCall(1500, () => { if (proj.active) { proj.setActive(false).setVisible(false) } })
    })
  }

  levelUp() { if (this.level < WEAPONS.kunai.levels.length) this.level++ }
}
```

- [ ] **Step 2: Create `src/entities/weapons/Tachi.js`**

```js
import Phaser from 'phaser'
import { WEAPONS } from '../../data/weapons.js'

export default class Tachi {
  constructor(scene, player) {
    this.scene  = scene
    this.player = player
    this.id     = 'tachi'
    this.level  = 1
    this._timer = 0
    // Visual slash arc
    this._slashGfx = scene.add.graphics().setDepth(9)
  }

  get def() { return WEAPONS.tachi.levels[this.level - 1] }
  get group() { return null } // arc uses graphics, not sprites

  update(delta, enemies) {
    this._timer += delta
    if (this._timer < this.def.cooldown) return
    this._timer = 0

    const arcRad = Phaser.Math.DegToRad(this.def.arc)
    const startAngle = -arcRad / 2
    const range = this.def.range * 2

    // Draw slash
    this._slashGfx.clear()
    this._slashGfx.fillStyle(0xffffc0, 0.5)
    this._slashGfx.slice(this.player.x, this.player.y, range, startAngle, startAngle + arcRad, false)
    this._slashGfx.fillPath()
    this.scene.time.delayedCall(120, () => this._slashGfx.clear())

    // Damage enemies in arc
    enemies.getChildren().forEach(e => {
      if (!e.active) return
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y)
      if (dist <= range) {
        const dmg = this.def.damage * (this.player.atkMult || 1)
        e.takeDamage(dmg)
      }
    })
  }

  levelUp() { if (this.level < WEAPONS.tachi.levels.length) this.level++ }
}
```

- [ ] **Step 3: Create `src/entities/weapons/Shikigami.js`**

```js
import Phaser from 'phaser'
import { WEAPONS } from '../../data/weapons.js'

export default class Shikigami {
  constructor(scene, player) {
    this.scene   = scene
    this.player  = player
    this.id      = 'shikigami'
    this.level   = 1
    this._angle  = 0
    this._timer  = 0
    this._orbs   = []
    this._updateOrbs()
  }

  get def() { return WEAPONS.shikigami.levels[this.level - 1] }
  get group() { return null }

  _updateOrbs() {
    this._orbs.forEach(o => o.destroy())
    this._orbs = []
    for (let i = 0; i < this.def.count; i++) {
      const orb = this.scene.add.circle(0, 0, 5, 0xffaa44, 0.85).setDepth(9)
      this._orbs.push(orb)
    }
  }

  update(delta, enemies) {
    this._angle += this.def.orbitSpeed * (delta / 1000)
    this._timer += delta

    const r = this.def.orbitRadius
    this._orbs.forEach((orb, i) => {
      const a = this._angle + (i * Math.PI * 2 / this.def.count)
      orb.setPosition(this.player.x + Math.cos(a) * r, this.player.y + Math.sin(a) * r)
    })

    if (this._timer < this.def.cooldown) return
    this._timer = 0

    // Damage enemies touching any orb
    enemies.getChildren().forEach(e => {
      if (!e.active) return
      for (const orb of this._orbs) {
        const dist = Phaser.Math.Distance.Between(orb.x, orb.y, e.x, e.y)
        if (dist < 14) {
          e.takeDamage(this.def.damage * (this.player.atkMult || 1))
          break
        }
      }
    })
  }

  levelUp() {
    if (this.level < WEAPONS.shikigami.levels.length) {
      this.level++
      this._updateOrbs()
    }
  }

  destroy() { this._orbs.forEach(o => o.destroy()) }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/entities/weapons/ && git commit -m "feat: Kunai, Tachi, Shikigami weapon entities"
```

---

## Task 12: VFX System

**Files:**
- Create: `src/systems/VFX.js`

- [ ] **Step 1: Create `src/systems/VFX.js`**

```js
export default class VFX {
  constructor(scene) {
    this.scene = scene
    this._emitters = {}
    this._init()
  }

  _init() {
    const s = this.scene
    this._emitters.sakura = s.add.particles(0, 0, 'p_sakura', {
      speed: { min: 40, max: 100 }, angle: { min: 0, max: 360 },
      lifespan: 400, alpha: { start: 0.9, end: 0 }, scale: { min: 0.5, max: 1.2 },
      quantity: 5, emitting: false,
    }).setDepth(20)
    this._emitters.soul = s.add.particles(0, 0, 'p_soul', {
      speed: { min: 30, max: 80 }, angle: { min: 240, max: 300 },
      lifespan: 600, alpha: { start: 0.8, end: 0 }, scale: { min: 0.5, max: 1.5 },
      quantity: 7, emitting: false,
    }).setDepth(20)
    this._emitters.spark = s.add.particles(0, 0, 'p_sakura', {
      tint: [0xffff88, 0xff8800], speed: { min: 60, max: 120 },
      lifespan: 150, alpha: { start: 1, end: 0 }, scale: { min: 0.4, max: 0.8 },
      quantity: 2, emitting: false,
    }).setDepth(20)
  }

  enemyDeath(x, y, isBoss) {
    const count = isBoss ? 30 : 5
    this._emitters.sakura.setPosition(x, y).explode(Math.ceil(count * 0.6))
    this._emitters.soul.setPosition(x, y).explode(Math.ceil(count * 0.4))
    if (isBoss) {
      this.scene.cameras.main.shake(300, 0.015)
      const flash = this.scene.add.rectangle(0, 0, this.scene.scale.width, this.scene.scale.height, 0xffffff, 0.4).setOrigin(0).setDepth(99)
      this.scene.time.delayedCall(120, () => flash.destroy())
    }
  }

  weaponHit(x, y) {
    this._emitters.spark.setPosition(x, y).explode(2)
  }

  levelUp(x, y) {
    const ring = this.scene.add.circle(x, y, 10, 0xf0d040, 0.6).setDepth(20)
    this.scene.tweens.add({
      targets: ring, scaleX: 5, scaleY: 5, alpha: 0,
      duration: 400, onComplete: () => ring.destroy(),
    })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/systems/VFX.js && git commit -m "feat: VFX system — sakura/soul particles, boss flash, camera shake"
```

---

## Task 13: GameScene (Core Loop)

**Files:**
- Create: `src/scenes/GameScene.js`
- Modify: `src/main.js` — add all scenes

- [ ] **Step 1: Create `src/scenes/GameScene.js`**

```js
import Phaser from 'phaser'
import Player from '../entities/Player.js'
import Enemy from '../entities/Enemy.js'
import Kunai from '../entities/weapons/Kunai.js'
import Tachi from '../entities/weapons/Tachi.js'
import Shikigami from '../entities/weapons/Shikigami.js'
import WaveManager from '../systems/WaveManager.js'
import UpgradeSystem from '../systems/UpgradeSystem.js'
import VFX from '../systems/VFX.js'
import MetaProgress from '../systems/MetaProgress.js'
import { MAPS } from '../data/maps.js'
import { CHARACTERS } from '../data/characters.js'

const WEAPON_CLASSES = { kunai: Kunai, tachi: Tachi, shikigami: Shikigami }
const MAX_ENEMIES = 300

export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene') }

  create(data) {
    const { width: W, height: H } = this.scale
    this._charId = data.charId || 'mikenomaru'
    this._mapId  = data.mapId  || 'bamboo_village'
    const mapDef = MAPS[this._mapId]

    this._mp = new MetaProgress(); this._mp.load()
    const bonuses = this._mp.getStatBonuses()

    // Tilemap background (tiled)
    for (let tx = 0; tx < W; tx += 16)
      for (let ty = 0; ty < H; ty += 16)
        this.add.image(tx, ty, 'tile_grass').setOrigin(0).setDepth(0)

    // Player
    this._player = new Player(this, W/2, H/2, this._charId, bonuses)

    // Enemies pool
    this._enemies = this.physics.add.group({
      classType: Enemy, maxSize: MAX_ENEMIES, runChildUpdate: false,
    })
    for (let i = 0; i < MAX_ENEMIES; i++) this._enemies.add(new Enemy(this, 0, 0), true)

    // Weapons
    const charDef = CHARACTERS[this._charId]
    this._weapons = [ new WEAPON_CLASSES[charDef.startWeapon](this, this._player) ]

    // Systems
    this._wave    = new WaveManager(mapDef)
    this._upgrade = new UpgradeSystem()
    this._vfx     = new VFX(this)

    // HUD
    this._buildHUD(W, H)

    // Physics: enemies damage player
    this.physics.add.overlap(this._player, this._enemies, (player, enemy) => {
      if (!enemy.active) return
      player.takeDamage(enemy.damage, this._enemies, this)
      this._updateHpBar()
    })

    // Spawn timer
    this._spawnTimer = 0
    this._elapsed    = 0  // seconds
    this._kills      = 0
    this._souls      = 0
    this._paused     = false

    // Pause key
    this.input.keyboard.on('keydown-P', () => this._togglePause())
    this.input.keyboard.on('keydown-ESC', () => this._togglePause())
  }

  _buildHUD(W, H) {
    // HP bar
    this._hpBarBg   = this.add.rectangle(60, 8, 100, 7, 0x333333).setOrigin(0, 0.5).setDepth(50).setScrollFactor(0)
    this._hpBarFill = this.add.rectangle(60, 8, 100, 7, 0xe03030).setOrigin(0, 0.5).setDepth(51).setScrollFactor(0)
    this.add.text(10, 4, '❤', { fontSize: '8px' }).setDepth(52).setScrollFactor(0)

    // XP bar
    this._xpBarBg   = this.add.rectangle(0, H, W, 3, 0x333333).setOrigin(0, 1).setDepth(50).setScrollFactor(0)
    this._xpBarFill = this.add.rectangle(0, H, 0, 3, 0x4080ff).setOrigin(0, 1).setDepth(51).setScrollFactor(0)

    // Timer
    this._timerTxt = this.add.text(W/2, 6, '00:00', {
      fontSize: '8px', color: '#f0d040', fontFamily: 'monospace'
    }).setOrigin(0.5, 0).setDepth(52).setScrollFactor(0)

    // Level
    this._levelTxt = this.add.text(W - 8, 6, 'Lv.1', {
      fontSize: '7px', color: '#f0d040', fontFamily: 'monospace'
    }).setOrigin(1, 0).setDepth(52).setScrollFactor(0)

    // Weapon slots
    this._weaponSlots = []
    for (let i = 0; i < 6; i++) {
      const slot = this.add.rectangle(8 + i * 20, H - 14, 16, 16, 0x1a1a2e)
        .setOrigin(0, 0.5).setDepth(50).setScrollFactor(0)
      this._weaponSlots.push(slot)
    }
  }

  _updateHpBar() {
    const pct = this._player.hp / this._player.maxHp
    this._hpBarFill.width = 100 * pct
  }

  _updateXpBar() {
    const pct = this._player.xp / this._player.xpToNext
    this._xpBarFill.width = this.scale.width * pct
  }

  _spawnEnemy(enemyId, hpOverride) {
    const { width: W, height: H } = this.scale
    const side = Phaser.Math.Between(0, 3)
    let x, y
    if (side === 0)      { x = Phaser.Math.Between(0, W); y = -20 }
    else if (side === 1) { x = W + 20; y = Phaser.Math.Between(0, H) }
    else if (side === 2) { x = Phaser.Math.Between(0, W); y = H + 20 }
    else                 { x = -20; y = Phaser.Math.Between(0, H) }

    const enemy = this._enemies.getFirstDead(false)
    if (enemy) enemy.spawn(x, y, enemyId || 'oni_soldier', hpOverride)
  }

  _togglePause() {
    this._paused = !this._paused
    if (this._paused) this.scene.launch('PauseScene', { gameScene: this })
    else this.scene.stop('PauseScene')
  }

  update(time, delta) {
    if (this._paused) return
    if (this._player.isDead) { this._onDeath(); return }

    this._player.update()

    const dt = delta
    this._elapsed += delta / 1000

    // Wave boss check (every second)
    const elapsedInt = Math.floor(this._elapsed)
    const bossEntry = this._wave.checkAndTrigger(elapsedInt)
    if (bossEntry && !this._wave.activeBoss) {
      const count = bossEntry.count || 1
      for (let i = 0; i < count; i++) this._spawnEnemy(bossEntry.boss, bossEntry.hpMult)
      this._wave.activeBoss = bossEntry
    }

    // Regular spawn
    if (!this._wave.isFinalBossActive) {
      this._spawnTimer += delta
      const activeCount = this._enemies.countActive()
      if (this._spawnTimer >= this._wave.currentSpawnInterval && activeCount < MAX_ENEMIES) {
        this._spawnTimer = 0
        const mapDef = MAPS[this._mapId]
        const id = mapDef.enemies[Phaser.Math.Between(0, mapDef.enemies.length - 1)]
        this._spawnEnemy(id)
      }
    }

    // Update enemies
    this._enemies.getChildren().forEach(e => { if (e.active) e.update(this._player, dt) })

    // Update weapons
    this._weapons.forEach(w => {
      if (w.update) w.update(dt, this._enemies)
      // Check kunai hits
      if (w.group) {
        this.physics.overlap(w.group, this._enemies, (proj, enemy) => {
          if (!proj.active || !enemy.active) return
          if (proj._hit?.has(enemy)) return
          proj._hit?.add(enemy)
          const killed = enemy.takeDamage(proj._damage || 10)
          this._vfx.weaponHit(enemy.x, enemy.y)
          if (killed) this._onEnemyKilled(enemy)
          proj._pierce = (proj._pierce || 1) - 1
          if (proj._pierce <= 0) { proj.setActive(false).setVisible(false) }
        })
      }
      // Tachi/Shikigami hits handled internally
    })

    // Check boss killed
    if (this._wave.activeBoss) {
      const bossAlive = this._enemies.getChildren().some(e => e.active && e._isBoss)
      if (!bossAlive) this._wave.onBossKilled()
    }

    // Timer HUD
    const mins = Math.floor(this._elapsed / 60).toString().padStart(2, '0')
    const secs = Math.floor(this._elapsed % 60).toString().padStart(2, '0')
    this._timerTxt.setText(`${mins}:${secs}`)
    this._levelTxt.setText(`Lv.${this._player.level}`)
    this._updateXpBar()
  }

  _onEnemyKilled(enemy) {
    this._kills++
    this._souls += enemy.enemyDef?.souls || 1
    this._vfx.enemyDeath(enemy.x, enemy.y, enemy._isBoss)

    // Drop XP gem (placeholder: just add XP directly)
    const leveled = this._player.gainXp(enemy.enemyDef?.xp || 5)
    if (leveled) {
      this._vfx.levelUp(this._player.x, this._player.y)
      this._levelTxt.setText(`Lv.${this._player.level}`)
      this._openUpgrade()
    }
    this._updateHpBar()
  }

  _openUpgrade() {
    this._paused = true
    const cards = this._upgrade.drawCards({
      luck: this._player.luck,
      weapons: this._weapons.map(w => ({ id: w.id, level: w.level })),
    })
    this.scene.launch('UpgradeScene', {
      cards,
      onChoice: (card) => {
        this._applyUpgrade(card)
        this._paused = false
        this.scene.stop('UpgradeScene')
      },
    })
  }

  _applyUpgrade(card) {
    if (card.type === 'weapon') {
      const existing = this._weapons.find(w => w.id === card.id)
      if (existing) { existing.levelUp(); return }
      const WeaponClass = WEAPON_CLASSES[card.id]
      if (WeaponClass) this._weapons.push(new WeaponClass(this, this._player))
    }
    if (card.type === 'passive' && card.effect) {
      const e = card.effect
      if (e.type === 'hp')    { this._player.maxHp += e.value; this._player.hp = Math.min(this._player.hp + e.value, this._player.maxHp) }
      if (e.type === 'speed') this._player.speed += e.value
      if (e.type === 'atk')   this._player.atkMult += e.value
      if (e.type === 'luck')  this._player.luck += e.value
      if (e.type === 'cd')    this._weapons.forEach(w => { if (w.def) {/* cd handled in weapon*/ } })
    }
    this._updateHpBar()
  }

  _onDeath() {
    this._endRun(false)
  }

  _endRun(survived) {
    this._mp.addSouls(this._souls)
    this._mp.data.stats.totalRuns++
    this._mp.data.stats.totalKills += this._kills
    if (this._elapsed > this._mp.data.stats.bestTime) this._mp.data.stats.bestTime = Math.floor(this._elapsed)
    this._mp.save()
    this.scene.start('ResultScene', {
      survived, elapsed: Math.floor(this._elapsed), kills: this._kills, souls: this._souls,
    })
  }
}
```

- [ ] **Step 2: Update `src/main.js`** — add all scenes

```js
import Phaser from 'phaser'
import BootScene from './scenes/BootScene.js'
import MenuScene from './scenes/MenuScene.js'
import CharSelectScene from './scenes/CharSelectScene.js'
import MapSelectScene from './scenes/MapSelectScene.js'
import GameScene from './scenes/GameScene.js'
import UpgradeScene from './scenes/UpgradeScene.js'
import PauseScene from './scenes/PauseScene.js'
import ResultScene from './scenes/ResultScene.js'
import MetaScene from './scenes/MetaScene.js'

const config = {
  type: Phaser.AUTO,
  width: 480, height: 270,
  pixelArt: true,
  backgroundColor: '#0d0d1a',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scene: [BootScene, MenuScene, CharSelectScene, MapSelectScene, GameScene, UpgradeScene, PauseScene, ResultScene, MetaScene],
}
export default new Phaser.Game(config)
```

- [ ] **Step 3: Verify in browser** — play a game, enemies spawn, player moves, enemies die with particles.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.js src/main.js && git commit -m "feat: GameScene — core game loop, HUD, enemy spawning, weapon firing"
```

---

## Task 14: UpgradeScene (Scroll UI)

**Files:**
- Create: `src/scenes/UpgradeScene.js`

- [ ] **Step 1: Create `src/scenes/UpgradeScene.js`**

```js
import Phaser from 'phaser'

const RARITY_COLORS = { common: 0x888888, rare: 0x4080ff, epic: 0xc060ff }
const RARITY_LABELS = { common: '普通', rare: '稀有', epic: '史詩' }

export default class UpgradeScene extends Phaser.Scene {
  constructor() { super({ key: 'UpgradeScene', active: false }) }

  create(data) {
    const { width: W, height: H } = this.scale
    const { cards, onChoice } = data
    this._onChoice = onChoice

    // Dimmed overlay
    this.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0).setDepth(0)

    // Title
    this.add.text(W/2, 18, '✦ 等級提升 ✦', {
      fontSize: '9px', color: '#f0d040', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(10)
    this.add.text(W/2, 30, '選擇一項強化', {
      fontSize: '7px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(10)

    // Scroll cards
    cards.forEach((card, i) => {
      const targetX = W * 0.2 + i * (W * 0.3)
      const startY  = -80
      const targetY = H / 2 + 10
      this._buildScroll(card, targetX, startY, targetY, i * 80)
    })
  }

  _buildScroll(card, x, startY, targetY, delay) {
    const container = this.add.container(x, startY).setDepth(10)

    // Scroll parchment background
    const rarityColor = RARITY_COLORS[card.rarity] || 0x888888
    const bg = this.add.rectangle(0, 0, 100, 140, 0xe8dbb0, 0.95).setStrokeStyle(2, rarityColor)
    const seal = this.add.circle(0, -62, 8, rarityColor, 0.8)
    const sealTxt = this.add.text(0, -62, RARITY_LABELS[card.rarity][0], {
      fontSize: '6px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5)

    // Card content
    const icon = this.add.text(0, -25, card.icon || (card.type === 'weapon' ? '⚔️' : '📜'), {
      fontSize: '20px',
    }).setOrigin(0.5)
    const name = this.add.text(0, 15, card.name, {
      fontSize: '7px', color: '#1a0a00', fontFamily: 'monospace', wordWrap: { width: 88 }, align: 'center',
    }).setOrigin(0.5)
    const lvlTxt = card.type === 'weapon'
      ? this.add.text(0, 30, `Lv.${card.level}`, { fontSize: '7px', color: '#664400', fontFamily: 'monospace' }).setOrigin(0.5)
      : this.add.text(0, 30, '', { fontSize: '6px' })
    const rarityLabel = this.add.text(0, 55, RARITY_LABELS[card.rarity], {
      fontSize: '6px', fontFamily: 'monospace', color: `#${rarityColor.toString(16).padStart(6, '0')}`,
    }).setOrigin(0.5)

    // Scroll rod tops/bottoms
    const rodTop = this.add.rectangle(0, -70, 108, 6, 0x8b6914)
    const rodBot = this.add.rectangle(0,  70, 108, 6, 0x8b6914)

    container.add([bg, seal, sealTxt, rodTop, rodBot, icon, name, lvlTxt, rarityLabel])

    // Interactivity
    bg.setInteractive(new Phaser.Geom.Rectangle(-50, -70, 100, 140), Phaser.Geom.Rectangle.Contains)
    bg.on('pointerover', () => { this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 100 }) })
    bg.on('pointerout',  () => { this.tweens.add({ targets: container, scaleX: 1.0,  scaleY: 1.0,  duration: 100 }) })
    bg.on('pointerdown', () => this._choose(card, container))

    // Unfurl tween
    this.tweens.add({ targets: container, y: targetY, duration: 300, delay, ease: 'Back.Out' })
  }

  _choose(card, chosen) {
    // Fly chosen up, retract others
    this.children.list
      .filter(c => c !== chosen && c.type === 'Container')
      .forEach(c => this.tweens.add({ targets: c, y: this.scale.height + 80, duration: 200 }))
    this.tweens.add({
      targets: chosen, y: -100, duration: 350, ease: 'Back.In',
      onComplete: () => this._onChoice(card),
    })
  }
}
```

- [ ] **Step 2: Verify in browser** — reach level 2, scroll cards unfurl, click selects.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/UpgradeScene.js && git commit -m "feat: UpgradeScene — washi scroll unfurl UI with tween animations"
```

---

## Task 15: PauseScene + ResultScene + MetaScene

**Files:**
- Create: `src/scenes/PauseScene.js`, `src/scenes/ResultScene.js`, `src/scenes/MetaScene.js`

- [ ] **Step 1: Create `src/scenes/PauseScene.js`**

```js
import Phaser from 'phaser'
export default class PauseScene extends Phaser.Scene {
  constructor() { super({ key: 'PauseScene', active: false }) }
  create(data) {
    const { width: W, height: H } = this.scale
    this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0)
    this.add.text(W/2, H*0.3, '⏸ 暫停', { fontSize: '14px', color: '#f0d040', fontFamily: 'monospace' }).setOrigin(0.5)
    const btns = [
      { label: '▶ 繼續', action: () => { this.scene.stop(); data.gameScene._paused = false } },
      { label: '↺ 重新開始', action: () => { this.scene.stop(); this.scene.stop('GameScene'); this.scene.start('CharSelectScene') } },
      { label: '⌂ 主選單', action: () => { this.scene.stop(); this.scene.stop('GameScene'); this.scene.start('MenuScene') } },
    ]
    btns.forEach(({ label, action }, i) => {
      const y = H * 0.45 + i * 22
      const bg = this.add.rectangle(W/2, y, 120, 14, 0x1a1a2e).setInteractive()
      this.add.text(W/2, y, label, { fontSize: '7px', color: '#f0e8d0', fontFamily: 'monospace' }).setOrigin(0.5)
      bg.on('pointerover', () => bg.setFillStyle(0xf0d04022))
      bg.on('pointerout',  () => bg.setFillStyle(0x1a1a2e))
      bg.on('pointerdown', action)
    })
  }
}
```

- [ ] **Step 2: Create `src/scenes/ResultScene.js`**

```js
import Phaser from 'phaser'
export default class ResultScene extends Phaser.Scene {
  constructor() { super('ResultScene') }
  create(data) {
    const { width: W, height: H } = this.scale
    const { survived, elapsed, kills, souls } = data

    this.add.rectangle(0, 0, W, H, 0x0d0d1a).setOrigin(0)
    this.add.text(W/2, 24, survived ? '✦ 勝利 ✦' : '✕ 倒下了 ✕', {
      fontSize: '14px', color: survived ? '#f0d040' : '#cc4444', fontFamily: 'monospace',
    }).setOrigin(0.5)

    const mins = Math.floor(elapsed/60).toString().padStart(2,'0')
    const secs = (elapsed%60).toString().padStart(2,'0')
    const rows = [
      ['生存時間', `${mins}:${secs}`],
      ['擊殺數',   `${kills}`],
      ['獲得武魂', `🔮 ${souls}`],
    ]
    rows.forEach(([label, val], i) => {
      const y = H * 0.42 + i * 20
      this.add.text(W * 0.28, y, label, { fontSize: '8px', color: '#aaaaaa', fontFamily: 'monospace' })
      this.add.text(W * 0.72, y, val,   { fontSize: '8px', color: '#f0e8d0', fontFamily: 'monospace' }).setOrigin(1, 0)
    })
    this.add.line(W*0.2, H*0.42-4, 0, 0, W*0.6, 0, 0x444444)

    const btn = this.add.rectangle(W/2, H*0.8, 120, 16, 0x1a1a2e).setInteractive()
    this.add.text(W/2, H*0.8, '返回主選單', { fontSize: '8px', color: '#f0d040', fontFamily: 'monospace' }).setOrigin(0.5)
    btn.on('pointerdown', () => this.scene.start('MenuScene'))

    // Soul earn animation
    let displayed = 0
    const soulTxt = this.add.text(W/2, H*0.65, '🔮 +0', { fontSize: '10px', color: '#aa88ff', fontFamily: 'monospace' }).setOrigin(0.5)
    this.time.addEvent({
      delay: 30, repeat: souls,
      callback: () => { displayed++; soulTxt.setText(`🔮 +${displayed}`) },
    })
  }
}
```

- [ ] **Step 3: Create `src/scenes/MetaScene.js`**

```js
import Phaser from 'phaser'
import MetaProgress from '../systems/MetaProgress.js'

export default class MetaScene extends Phaser.Scene {
  constructor() { super('MetaScene') }

  create() {
    const { width: W, height: H } = this.scale
    this._mp = new MetaProgress(); this._mp.load()

    this.add.rectangle(0, 0, W, H, 0x0d0d1a).setOrigin(0)
    this.add.text(W/2, 14, '⚔ 武魂強化', { fontSize: '10px', color: '#f0d040', fontFamily: 'monospace' }).setOrigin(0.5)

    this._soulsTxt = this.add.text(W/2, 28, `🔮 ${this._mp.data.souls}`, {
      fontSize: '8px', color: '#aa88ff', fontFamily: 'monospace',
    }).setOrigin(0.5)

    const nodes = Object.entries(MetaProgress.NODE_DEFS)
    const cols = 5, startX = W * 0.12, startY = 50, gapX = W * 0.175, gapY = 36

    nodes.forEach(([id, def], idx) => {
      const col = idx % cols, row = Math.floor(idx / cols)
      const x = startX + col * gapX, y = startY + row * gapY
      const cur = this._mp.data.nodes[id] || 0
      const maxed = cur >= def.max
      const canAfford = this._mp.data.souls >= def.cost

      const tileColor = maxed ? 0xf0a030 : (cur > 0 ? 0x1a3a1a : 0x1a1a2e)
      const tile = this.add.rectangle(x, y, 42, 30, tileColor).setStrokeStyle(1, maxed ? 0xf0a030 : 0x444444)

      const icons = { atk:'⚔',hp:'❤',spd:'💨',luck:'🍀',pickup:'🧲',cd:'❄',gold:'💰',exp:'✨',char_kuroka:'🐱',map_shrine:'⛩' }
      this.add.text(x, y - 4, icons[id] || '?', { fontSize: '10px' }).setOrigin(0.5)
      this.add.text(x, y + 8, maxed ? 'MAX' : `${cur}/${def.max}`, {
        fontSize: '5px', color: maxed ? '#f0a030' : '#888888', fontFamily: 'monospace',
      }).setOrigin(0.5)

      if (!maxed) {
        this.add.text(x + 18, y + 12, `${def.cost}`, { fontSize: '5px', color: '#aa88ff', fontFamily: 'monospace' }).setOrigin(1)
        tile.setInteractive()
        tile.on('pointerover', () => tile.setStrokeStyle(1, canAfford ? 0xf0d040 : 0xcc4444))
        tile.on('pointerout',  () => tile.setStrokeStyle(1, 0x444444))
        tile.on('pointerdown', () => {
          if (this._mp.upgradeNode(id)) {
            this._mp.save()
            this.scene.restart()
          }
        })
      }
    })

    this.add.text(10, H-14, '← 返回', { fontSize:'7px', color:'#888888', fontFamily:'monospace' })
      .setInteractive().on('pointerdown', () => this.scene.start('MenuScene'))
  }
}
```

- [ ] **Step 4: Verify full flow** — play a run → result screen → return to menu → meta scene shows souls.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/PauseScene.js src/scenes/ResultScene.js src/scenes/MetaScene.js
git commit -m "feat: PauseScene, ResultScene, MetaScene — complete game loop"
```

---

## Task 16: Final Integration & Polish

- [ ] **Step 1: Run all unit tests**

```bash
npx vitest run
```
Expected: all pass.

- [ ] **Step 2: Full gameplay test checklist** (manual, in browser)

- [ ] Menu → CharSelect → MapSelect → Game loads
- [ ] Player moves with WASD
- [ ] Enemies spawn from edges, chase player
- [ ] Weapons fire automatically (kunai toward closest enemy)
- [ ] Enemy death shows sakura particles
- [ ] Player takes damage → red flash + knockback
- [ ] Level up → scroll cards appear → select one → upgrades apply
- [ ] Wave boss spawns at 01:00
- [ ] Pause with P key → resume → continue
- [ ] Player death → ResultScene shows stats + souls
- [ ] ResultScene → MenuScene → MetaScene → upgrade a node → souls deducted
- [ ] Upgraded node bonuses apply next run

- [ ] **Step 3: Add `.gitignore`**

```
node_modules/
dist/
.superpowers/
```

- [ ] **Step 4: Final commit**

```bash
git add .gitignore && git commit -m "chore: add .gitignore"
git add -A && git commit -m "feat: v1.0 complete — full game loop playable in browser"
```

- [ ] **Step 5: Verify production build**

```bash
npx vite build
npx vite preview
```
Expected: game runs from `dist/`, no errors.

- [ ] **Step 6: Final commit**

```bash
git add dist/ && git commit -m "build: v1.0 production build"
```

---

## Quick Start (for implementer)

```bash
cd /Users/tedhsumbp2024/Documents/workspace/neko-samurai
npm install
npx vite          # dev server at http://localhost:5173
npx vitest run    # unit tests
npx vite build    # production build
```
