# Weapon Synergy & Evolution System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mechanic-changing weapon upgrades (C-layer) and a weapon evolution system (A-layer) so different weapon+affix combinations feel genuinely distinct.

**Architecture:** C-layer adds `_flag` properties to `stats` checked inside each weapon's `fire()`/`update()`/`updateActive()`. A-layer adds `ALL_EVOLUTIONS` data, `GameScene._offeredEvos` tracking, evolution card injection in `_buildUpgradePool()`, and an `else if (evolution)` branch in the upgrade handler. Evolution effects travel on `proj` properties (same as `_explodeRadius`).

**Tech Stack:** Phaser 3, Vite dev server (`npm run dev`), existing weapon/affix/GameScene architecture.

**Spec:** `docs/superpowers/specs/2026-03-20-weapon-synergy-evolution-design.md`

---

## File Map

| File | Role |
|------|------|
| `src/affixes/evolutions.js` | NEW — `ALL_EVOLUTIONS` array (7 entries) |
| `src/affixes/index.js` | Export `ALL_EVOLUTIONS` |
| `src/scenes/GameScene.js` | Init `_offeredEvos`; inject evolutions in `_buildUpgradePool()`; `else if evolution` in handler; expand explosion callback for scorch/linger/chainExplode/kaku |
| `src/scenes/UpgradeScene.js` | Add `evolution` to `CATEGORY` map |
| `src/weapons/Shuriken.js` | Add 回転刃/散花 upgrades; boomerang + scatter behavior; raikou evo in `updateActive()` |
| `src/weapons/Kunai.js` | Add 連刃/穿心 upgrades; chain-bounce + alwaysPierce + koori evo in `updateActive()` |
| `src/weapons/Tachi.js` | Add 居合/殘影 upgrades; iaijutsu delay + shadow zone + muramasa evo in `fire()` |
| `src/weapons/Ogi.js` | Add 旋風/衝波 upgrades; whirlwind rotation + shockwave ring + shinigami evo in `fire()` |
| `src/weapons/Kusarigama.js` | Add 引力場/雙軌道 upgrades; gravity pull + outer orbit + dokuja evo in `updateActive()` |
| `src/weapons/Homura.js` | Add 焦土/連鎖爆炸 upgrades; copy flags to `proj` in `fire()`; ryuen evo flag |
| `src/weapons/Ofuda.js` | Add 分裂/滯留 upgrades; copy flags + split behavior + kaku evo flag |

---

## Task 1: Evolution Infrastructure

**Files:**
- Create: `src/affixes/evolutions.js`
- Modify: `src/affixes/index.js`
- Modify: `src/scenes/GameScene.js` (lines 1-10 for import, ~30 for init, 514-519 for injection, 456-463 for apply handler)
- Modify: `src/scenes/UpgradeScene.js` (lines 5-11)

- [ ] **Step 1: Create `src/affixes/evolutions.js`**

```javascript
// src/affixes/evolutions.js
// Weapon evolution cards — injected into upgrade pool when weapon + affix conditions are met.

export const ALL_EVOLUTIONS = [
  {
    id: 'ryuen', name: '龍炎矢', weaponId: 'homura', affixId: 'burn',
    desc: '炎矢覚醒：火球體積×3、爆炸範圍×2、直擊傷害×1.5、爆炸留下3秒火場',
  },
  {
    id: 'raikou', name: '雷轟剣', weaponId: 'shuriken', affixId: 'chain',
    desc: '手裏剣覚醒：命中100%觸發閃電連鎖（跳躍數=投射數），無機率限制',
  },
  {
    id: 'koori', name: '氷刃苦無', weaponId: 'kunai', affixId: 'chill',
    desc: '苦無覚醒：每次命中直接冰凍敵人2秒，冰凍敵人可被貫穿',
  },
  {
    id: 'muramasa', name: '妖刀村正', weaponId: 'tachi', affixId: 'leech',
    desc: '太刀覚醒：斬擊範圍×1.5、傷害×1.3、回復傷害量30%、留下血色殘影',
  },
  {
    id: 'dokuja', name: '毒蛇鎖鎌', weaponId: 'kusarigama', affixId: 'poison',
    desc: '鎖鎌覚醒：每次接觸施加毒疊層，軌道半徑+40px',
  },
  {
    id: 'kaku', name: '核符', weaponId: 'ofuda', affixId: 'burst',
    desc: '霊符覚醒：爆炸範圍×2.5、100%觸發AoE爆炸、留下2秒輻射區',
  },
  {
    id: 'shinigami', name: '死神扇', weaponId: 'ogi', affixId: 'curse',
    desc: '扇覚醒：每次命中施加詛咒，詛咒死亡爆炸範圍×2',
  },
]
```

- [ ] **Step 2: Export from `src/affixes/index.js`**

Add to `src/affixes/index.js`:
```javascript
import { ALL_EVOLUTIONS } from './evolutions.js'
// (add to existing exports)
export { ALL_EVOLUTIONS }
```

The file currently exports `checkResonances`, `ALL_AFFIXES`, `ALL_TIER2_AFFIXES`, `ALL_MECHANICAL`. Add `ALL_EVOLUTIONS` to the export list.

- [ ] **Step 3: Import `ALL_EVOLUTIONS` in `GameScene.js`**

At the top of `GameScene.js`, the existing import line reads:
```javascript
import { ALL_AFFIXES, ALL_TIER2_AFFIXES, ALL_MECHANICAL, checkResonances } from '../affixes/index.js'
```
Change it to:
```javascript
import { ALL_AFFIXES, ALL_TIER2_AFFIXES, ALL_MECHANICAL, ALL_EVOLUTIONS, checkResonances } from '../affixes/index.js'
```

- [ ] **Step 4: Initialise `_offeredEvos` in `GameScene.create()`**

Find where other Set initialisations happen (near `_mechanicalsOwned`, `_playerUpgradesOwned`, `_affixCounts`). Add:
```javascript
this._offeredEvos = new Set()
```

- [ ] **Step 5: Inject evolutions in `_buildUpgradePool()`**

In `_buildUpgradePool()`, between the player upgrades block and the dedup pass (after line 514, before line 520), add:
```javascript
    // Weapon evolutions — offered once per run when weapon + affix both held
    for (const evo of ALL_EVOLUTIONS) {
      if (this._offeredEvos.has(evo.id)) continue
      const hasWeapon = this._weapons.some(w => w.weapon.id === evo.weaponId)
      const hasAffix  = (this._affixCounts.get(evo.affixId) || 0) >= 1
      if (hasWeapon && hasAffix) {
        pool.push({ ...evo, target: 'evolution' })
        this._offeredEvos.add(evo.id)   // mark offered NOW so re-roll never re-offers it
      }
    }
```

- [ ] **Step 6: Handle evolution in the upgrade-chosen handler**

In the `events.once('upgrade-chosen', ...)` callback, the chain currently ends with:
```javascript
        } else {
          upgrade.apply(this._player, this)
```
Add a new `else if` branch **before** that final `else`, between the `new_weapon` and player branches:
```javascript
        } else if (upgrade.target === 'evolution') {
          const entry = this._weapons.find(e => e.weapon.id === upgrade.weaponId)
          if (entry) entry.stats._evo = upgrade.id
```

- [ ] **Step 7: Add `evolution` category to `UpgradeScene.js`**

In `UpgradeScene.js`, the `CATEGORY` map starts at line 5. Add:
```javascript
  evolution:  { color: 0xff4444, label: '覚醒', text: '#ff8888' },
```

- [ ] **Step 8: Verify**

Run `npm run dev`. Level up several times. The evolution cards will not yet appear (weapons don't have the required affixes by default), but the code should load without errors. Open the browser console — no import errors or runtime exceptions on startup.

- [ ] **Step 9: Commit**

```bash
git add src/affixes/evolutions.js src/affixes/index.js src/scenes/GameScene.js src/scenes/UpgradeScene.js
git commit -m "feat: evolution infrastructure — evolutions.js, injection, apply handler, UpgradeScene badge"
```

---

## Task 2: Shuriken — 回転刃, 散花, 雷轟剣 evo

**Files:**
- Modify: `src/weapons/Shuriken.js`

- [ ] **Step 1: Add `_boomerang`, `_scatter` to `upgrades[]`**

In `Shuriken.js`, the `upgrades` array currently has 4 entries. Add two more:
```javascript
    { id: 'boomerang', name: '回転刃', desc: '抵達射程後反彈飛回', apply: s => { s._boomerang = true } },
    { id: 'scatter',   name: '散花',   desc: '消失時分裂成3個小手裏剣（0.4倍傷害）', apply: s => { s._scatter = true } },
```

- [ ] **Step 2: Update `fire()` to store pool on each sprite**

In `fire()`, after `s._hitRadius = HIT_RADIUS * stats._scale`, add:
```javascript
      s._pool = pool
      s._reversed = false
```

- [ ] **Step 3: Update `update()` for boomerang**

Replace the current `update(sprite)` method:
```javascript
  update(sprite) {
    if (!sprite.active) return
    sprite.angle += 8

    const dist = Phaser.Math.Distance.Between(sprite.spawnX, sprite.spawnY, sprite.x, sprite.y)

    if (sprite._boomerang) {
      if (!sprite._reversed && dist >= sprite.range) {
        // Reverse velocity
        sprite.body.velocity.x *= -1
        sprite.body.velocity.y *= -1
        sprite._reversed = true
      } else if (sprite._reversed && dist <= 30) {
        // Back near spawn — expire
        if (sprite._scatter) _doScatter(sprite)
        sprite.disableBody(true, true)
      }
    } else {
      if (dist >= sprite.range) {
        if (sprite._scatter) _doScatter(sprite)
        sprite.disableBody(true, true)
      }
    }
  },
```

- [ ] **Step 4: Add `_doScatter` helper at the bottom of the file**

Also add this import at the top of the file (alongside the existing imports):
```javascript
import { getOrCreate } from './_pool.js'
```

After the closing `}` of the exported object, add:
```javascript
function _doScatter(proj) {
  if (!proj._pool || proj._scatterFired) return
  proj._scatterFired = true
  const baseAngle = Math.atan2(proj.body.velocity.y, proj.body.velocity.x)
  const scene     = proj.scene
  for (let i = -1; i <= 1; i++) {
    const s = getOrCreate(proj._pool, proj.x, proj.y, 'shuriken')
    s.setDisplaySize(proj.displayWidth * 0.5, proj.displayHeight * 0.5)
    s.damage     = proj.damage * 0.4
    s.hitSet     = new Set()
    s.spawnX     = proj.x
    s.spawnY     = proj.y
    s.range      = 120
    s.penetrate  = false
    s.knockback  = 0
    s._hitRadius = (proj._hitRadius || 14) * 0.5
    s._boomerang = false
    s._scatter   = false
    s._pool      = proj._pool
    s._reversed  = false
    const angle  = baseAngle + Phaser.Math.DegToRad(i * 45)
    scene.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), 400, s.body.velocity)
  }
}
```

- [ ] **Step 5: Add 雷轟剣 (raikou) evo to `updateActive()`**

The current `updateActive` inner loop reads (inside the `if (Distance < hitRadius)` block):
```javascript
            proj.hitSet.add(e)
            Enemy.takeDamage(e, proj.damage, proj.x, proj.y, affixes, proj.knockback ?? 60)
            if (!proj.penetrate) proj._spent = true
```

Replace those three lines with the following complete block (one `hitSet.add`, then damage, then raikou chain, then spent logic):
```javascript
            proj.hitSet.add(e)
            Enemy.takeDamage(e, proj.damage, proj.x, proj.y, affixes, proj.knockback ?? 60)
            // 雷轟剣 evo — 100% chain bounce, bounces = projectileCount
            if (entry.stats._evo === 'raikou') {
              const bounces = entry.stats.projectileCount || 3
              let src = e
              for (let b = 0; b < bounces; b++) {
                const next = enemies.getChildren()
                  .filter(en => en.active && !en.dying && !proj.hitSet.has(en) &&
                    Phaser.Math.Distance.Between(src.x, src.y, en.x, en.y) < 120)
                  .sort((a, bb) =>
                    Phaser.Math.Distance.Between(src.x, src.y, a.x, a.y) -
                    Phaser.Math.Distance.Between(src.x, src.y, bb.x, bb.y))[0]
                if (!next) break
                proj.hitSet.add(next)
                Enemy.takeDamage(next, proj.damage * 0.5, src.x, src.y, affixes, 0)
                // Lightning visual
                const g = scene.add.graphics().setDepth(10)
                g.lineStyle(2, 0xffff44, 0.9)
                g.lineBetween(src.x, src.y, next.x, next.y)
                scene.time.delayedCall(120, () => g.destroy())
                src = next
              }
            }
            if (!proj.penetrate) proj._spent = true
```

- [ ] **Step 6: Verify**

Run `npm run dev`. Pick Shuriken. Level up and select 回転刃 — shurikens should reverse and fly back. Select 散花 — shurikens should spawn 3 small ones on expiry. For 雷轟剣: also pick chain affix; a 覚醒 card should appear; after evolution, hits should chain 100%.

- [ ] **Step 7: Commit**

```bash
git add src/weapons/Shuriken.js
git commit -m "feat: shuriken — 回転刃/散花 mechanic upgrades + 雷轟剣 evo"
```

---

## Task 3: Kunai — 連刃, 穿心, 氷刃苦無 evo

**Files:**
- Modify: `src/weapons/Kunai.js`

- [ ] **Step 1: Add `_chainHit`, `_alwaysPierce` to `upgrades[]`**

```javascript
    { id: 'chainHit',    name: '連刃', desc: '命中後跳躍至最近120px敵人（同等傷害）', apply: s => { s._chainHit = true } },
    { id: 'alwaysPierce',name: '穿心', desc: '永遠貫穿敵人',                          apply: s => { s._alwaysPierce = true } },
```

- [ ] **Step 2: Force `penetrate = true` in `fire()` when `_alwaysPierce`**

After `s.penetrate = stats.penetrate`, change to:
```javascript
      s.penetrate   = stats.penetrate || stats._alwaysPierce || false
```

- [ ] **Step 3: Update `updateActive()` for 連刃 and 氷刃苦無 evo**

After the existing hit confirmation (`proj.hitSet.add(e)`, `Enemy.takeDamage`, `if (!proj.penetrate) proj._spent = true`), add the following **before** setting `_spent`:

```javascript
          proj.hitSet.add(e)
          Enemy.takeDamage(e, proj.damage, proj.x, proj.y, affixes, proj.knockback ?? 60)

          // 氷刃苦無 evo — freeze on hit
          if (entry.stats._evo === 'koori' && e._statusEffects) {
            e._statusEffects.frozen.active = true
            e._statusEffects.frozen.timer  = 2000
          }

          // 連刃 — one chain-bounce to nearest unhit enemy
          if (entry.stats._chainHit && !proj._chained) {
            const nearest = enemies.getChildren()
              .filter(en => en.active && !en.dying && !proj.hitSet.has(en) &&
                Phaser.Math.Distance.Between(proj.x, proj.y, en.x, en.y) < 120)
              .sort((a, b) =>
                Phaser.Math.Distance.Between(proj.x, proj.y, a.x, a.y) -
                Phaser.Math.Distance.Between(proj.x, proj.y, b.x, b.y))[0]
            if (nearest) {
              proj.hitSet.add(nearest)
              proj._chained = true
              // Teleport projectile to bounce target
              proj.x = nearest.x
              proj.y = nearest.y
              Enemy.takeDamage(nearest, proj.damage, proj.x, proj.y, affixes, proj.knockback ?? 60)
              // 氷刃苦無 on bounce target too
              if (entry.stats._evo === 'koori' && nearest._statusEffects) {
                nearest._statusEffects.frozen.active = true
                nearest._statusEffects.frozen.timer  = 2000
              }
            }
          }

          // 氷刃苦無 — pierce frozen enemies (don't expire)
          const targetFrozen = e._statusEffects && e._statusEffects.frozen.active
          const shouldPierce = proj.penetrate || (entry.stats._evo === 'koori' && targetFrozen)
          if (!shouldPierce) proj._spent = true
```

Also reset `_chained = false` in `fire()` when initialising the sprite, after the other property assignments:
```javascript
      s._chained    = false
```

- [ ] **Step 4: Verify**

Run dev server. Pick Kunai, then select 連刃 — hitting one enemy should jump the kunai to a second nearby enemy. Select 穿心 — kunai should pass through all enemies. For 氷刃苦無: also pick chill; evolution card should appear; hits should instantly freeze.

- [ ] **Step 5: Commit**

```bash
git add src/weapons/Kunai.js
git commit -m "feat: kunai — 連刃/穿心 mechanic upgrades + 氷刃苦無 evo"
```

---

## Task 4: Tachi — 居合, 殘影, 妖刀村正 evo

**Files:**
- Modify: `src/weapons/Tachi.js`

- [ ] **Step 1: Add `_iaijutsu`, `_shadow` to `upgrades[]`**

```javascript
    { id: 'iaijutsu', name: '居合', desc: '延遲0.3秒→範圍×2、傷害×1.5（不可重疊蓄力）', apply: s => { s._iaijutsu = true } },
    { id: 'shadow',   name: '殘影', desc: '揮擊後留下1秒傷害殘影（0.6倍傷害，300ms間隔）', apply: s => { s._shadow = true } },
```

- [ ] **Step 2: Rewrite `fire()` to support all new behaviours**

Replace the entire `fire()` method:
```javascript
  fire(scene, _pool, fromX, fromY, stats, enemies, player, affixes = []) {
    // 居合: block re-entry during pending slash
    if (stats._iaijutsu && stats._pendingSlash) return
    if (stats._iaijutsu) stats._pendingSlash = true

    const doSlash = () => {
      const isMuramasa = stats._evo === 'muramasa'
      const range  = stats.range * (stats._iaijutsu ? 2 : 1) * (isMuramasa ? 1.5 : 1)
      const damage = stats.damage * (stats._iaijutsu ? 1.5 : 1) * (isMuramasa ? 1.3 : 1)

      const scale  = (range * 2) / 166
      const hitSet = new Set()

      const slash = scene.add.sprite(player.x, player.y, 'tachi-slash', 0)
        .setDepth(6).setOrigin(0.5, 0.5).setScale(scale)

      const onUpdate = () => {
        slash.setPosition(player.x, player.y)
        enemies.getChildren()
          .filter(e => e.active && !e.dying && !hitSet.has(e) &&
            Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y) < range)
          .forEach(e => {
            hitSet.add(e)
            Enemy.takeDamage(e, damage, player.x, player.y, affixes, stats.knockback ?? 120)
            // 妖刀村正 evo — heal on each hit
            if (isMuramasa) scene._player.heal(damage * 0.30)
          })
      }

      scene.events.on('update', onUpdate)
      slash.play('tachi-slash')
      scene.tweens.add({ targets: slash, angle: 360, duration: 500, ease: 'Linear' })

      slash.once('animationcomplete', () => {
        scene.events.off('update', onUpdate)
        stats._pendingSlash = false

        // 殘影 or 妖刀村正 — leave damage zone at player position
        if (stats._shadow || isMuramasa) {
          const sx = player.x, sy = player.y
          const zoneW = range, zoneH = range * 0.4
          const shadowColor = isMuramasa ? 0x880000 : 0x4400aa
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
                  Enemy.takeDamage(e, damage * 0.6, sx, sy, affixes, 0)
                }
              }
            })
          }
          scene.events.on('update', shadowHit)
          scene.time.delayedCall(1000, () => {
            scene.events.off('update', shadowHit)
            g.destroy()
          })
        }

        slash.destroy()
      })
    }

    if (stats._iaijutsu) {
      scene.time.delayedCall(300, doSlash)
    } else {
      doSlash()
    }
  },
```

- [ ] **Step 3: Verify**

Run dev server. Pick Tachi. Select 居合 — there should be a 0.3s pause before the slash, and it should hit farther. Select 殘影 — a purple zone should appear where you stood after the slash. For 妖刀村正: pick leech affix; evolution card should appear; slashes should show a red shadow zone and heal you.

- [ ] **Step 4: Commit**

```bash
git add src/weapons/Tachi.js
git commit -m "feat: tachi — 居合/殘影 mechanic upgrades + 妖刀村正 evo"
```

---

## Task 5: Ogi — 旋風, 衝波, 死神扇 evo

**Files:**
- Modify: `src/weapons/Ogi.js`

- [ ] **Step 1: Add `_whirlwind`, `_shockwave` to `upgrades[]`**

```javascript
    { id: 'whirlwind', name: '旋風', desc: '扇形持續旋轉一整圈（800ms）',            apply: s => { s._whirlwind = true } },
    { id: 'shockwave', name: '衝波', desc: '結束後發出擴張衝擊波（0.5倍傷害）',     apply: s => { s._shockwave = true } },
```

- [ ] **Step 2: Rewrite `fire()` to support whirlwind, shockwave, shinigami evo**

Replace the entire `fire()` method:
```javascript
  fire(scene, _pool, fromX, fromY, stats, enemies, player, affixes = []) {
    const isShinigami = stats._evo === 'shinigami'
    const hitSet  = new Set()
    let elapsed   = 0
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

      // 旋風: rotate facing angle each frame for full 360
      if (stats._whirlwind) facingDeg = (facingDeg + delta * (360 / duration)) % 360

      g.clear()
      g.setPosition(player.x, player.y)
      g.fillStyle(0xff8800, 0.45 * (1 - t))
      g.beginPath()
      g.moveTo(0, 0)
      const segs = 12
      for (let i = 0; i <= segs; i++) {
        const a = Phaser.Math.DegToRad(facingDeg - 60 + 120 * i / segs)
        g.lineTo(Math.cos(a) * stats.range, Math.sin(a) * stats.range)
      }
      g.closePath()
      g.fillPath()

      enemies.getChildren()
        .filter(e => e.active && !e.dying && !hitSet.has(e))
        .forEach(e => {
          const dist = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y)
          if (dist > stats.range) return
          const angleDeg = Phaser.Math.RadToDeg(
            Phaser.Math.Angle.Between(player.x, player.y, e.x, e.y))
          const diff = Phaser.Math.Wrap(angleDeg - facingDeg, -180, 180)
          if (Math.abs(diff) <= 60) {
            hitSet.add(e)
            Enemy.takeDamage(e, stats.damage, player.x, player.y, affixes, stats.knockback ?? 200)
            // 死神扇 evo — force curse on hit
            if (isShinigami && e._statusEffects) {
              e._statusEffects.curse.active = true
              e._statusEffects.curse.timer  = 4000
            }
          }
        })

      if (elapsed >= duration) {
        scene.events.off('update', updateFn)
        g.destroy()

        // 衝波 — expanding ring after swing
        if (stats._shockwave) {
          const shockHit = new Set()
          const sg = scene.add.graphics().setDepth(6)
          let r = 0
          const shockFn = (_, dt) => {
            r = Math.min(stats.range, r + stats.range * dt / 300)
            sg.clear().setPosition(player.x, player.y)
            sg.lineStyle(3, 0xff8800, 0.8)
            sg.strokeCircle(0, 0, r)
            enemies.getChildren().filter(e => e.active && !e.dying && !shockHit.has(e)).forEach(e => {
              const d = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y)
              if (Math.abs(d - r) < 18) {
                shockHit.add(e)
                Enemy.takeDamage(e, stats.damage * 0.5, player.x, player.y, affixes, 0)
              }
            })
            if (r >= stats.range) {
              scene.events.off('update', shockFn)
              sg.destroy()
            }
          }
          scene.events.on('update', shockFn)
        }
      }
    }
    scene.events.on('update', updateFn)
  },
```

- [ ] **Step 3: Verify**

Run dev server. Pick Ogi. Select 旋風 — the fan arc should rotate a full circle over 800ms. Select 衝波 — after the swing an orange ring should expand outward. For 死神扇: also pick curse affix; evolution card should appear; every hit should apply curse status.

- [ ] **Step 4: Commit**

```bash
git add src/weapons/Ogi.js
git commit -m "feat: ogi — 旋風/衝波 mechanic upgrades + 死神扇 evo"
```

---

## Task 6: Kusarigama — 引力場, 雙軌道, 毒蛇鎖鎌 evo

**Files:**
- Modify: `src/weapons/Kusarigama.js`

- [ ] **Step 1: Add `_gravity`, `_doubleOrbit` to `upgrades[]`**

```javascript
    { id: 'gravity',     name: '引力場', desc: '軌道內敵人緩慢被拉向玩家',                     apply: s => { s._gravity = true } },
    { id: 'doubleOrbit', name: '雙軌道', desc: '新增外圈軌道（半徑140px）同等鎌刃數量',        apply: s => { s._doubleOrbit = true } },
```

- [ ] **Step 2: Rewrite `updateActive()` to support gravity, double orbit, dokuja evo**

Replace the entire `updateActive` method:
```javascript
  updateActive(entry, scene, enemies, player, affixes, delta) {
    if (!entry.sickles) {
      entry.sickles  = []
      entry.damageCd = new Map()
    }

    const SICKLE_LEN     = 80
    const CHAIN_ATTACH_Y = 1.0
    const isDokuja   = entry.stats._evo === 'dokuja'
    const innerRadius = isDokuja ? 120 : SICKLE_LEN

    // Grow inner sickle array
    while (entry.sickles.length < entry.stats.sickleCount) {
      const img = scene.add.image(0, 0, 'kusarigama').setDepth(8)
      const aspect = img.width / img.height
      img.setDisplaySize(SICKLE_LEN * aspect, SICKLE_LEN).setOrigin(0.5, CHAIN_ATTACH_Y)
      entry.sickles.push(img)
    }

    const now       = scene.time.now
    const baseAngle = (now / 1000) * 180

    // Gravity pull
    if (entry.stats._gravity) {
      enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
        const dx  = player.x - e.x
        const dy  = player.y - e.y
        const len = Math.hypot(dx, dy) || 1
        if (len < 160) {
          const pull = 40 * (delta / 1000)
          e.body.velocity.x += (dx / len) * pull
          e.body.velocity.y += (dy / len) * pull
        }
      })
    }

    // Inner orbit
    for (let i = 0; i < entry.sickles.length; i++) {
      const sickle = entry.sickles[i]
      const angle  = Phaser.Math.DegToRad(baseAngle + (360 / entry.sickles.length) * i)
      sickle.setPosition(player.x, player.y).setRotation(angle + Math.PI / 2)
      const sx = player.x + Math.cos(angle) * innerRadius * CHAIN_ATTACH_Y
      const sy = player.y + Math.sin(angle) * innerRadius * CHAIN_ATTACH_Y

      enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
        if (Phaser.Math.Distance.Between(sx, sy, e.x, e.y) < 20) {
          const last = entry.damageCd.get(e) || 0
          if (now - last >= 200) {
            entry.damageCd.set(e, now)
            Enemy.takeDamage(e, entry.stats.damage, sx, sy, affixes, 0)
            // 毒蛇鎖鎌 evo — apply poison stack on contact
            if (isDokuja && e._statusEffects) {
              const ps = e._statusEffects.poison
              ps.stacks = Math.min(ps.maxStacks ?? 10, ps.stacks + 1)
            }
          }
        }
      })
    }

    // Outer orbit (雙軌道 or dokuja upgrades radius, not count)
    if (entry.stats._doubleOrbit) {
      if (!entry.outerSickles)    entry.outerSickles    = []
      if (!entry.outerDamageCd)   entry.outerDamageCd   = new Map()
      const OUTER_RADIUS = 140
      while (entry.outerSickles.length < entry.stats.sickleCount) {
        const img = scene.add.image(0, 0, 'kusarigama').setDepth(7)
        const aspect = img.width / img.height
        img.setDisplaySize(SICKLE_LEN * aspect, SICKLE_LEN).setOrigin(0.5, CHAIN_ATTACH_Y)
        entry.outerSickles.push(img)
      }
      for (let i = 0; i < entry.outerSickles.length; i++) {
        const sickle = entry.outerSickles[i]
        const angle  = Phaser.Math.DegToRad(baseAngle + (360 / entry.outerSickles.length) * i + 30)
        sickle.setPosition(player.x, player.y).setRotation(angle + Math.PI / 2)
        const sx = player.x + Math.cos(angle) * OUTER_RADIUS
        const sy = player.y + Math.sin(angle) * OUTER_RADIUS
        enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
          if (Phaser.Math.Distance.Between(sx, sy, e.x, e.y) < 20) {
            const last = entry.outerDamageCd.get(e) || 0
            if (now - last >= 200) {
              entry.outerDamageCd.set(e, now)
              Enemy.takeDamage(e, entry.stats.damage, sx, sy, affixes, 0)
            }
          }
        })
      }
    }
  },
```

- [ ] **Step 3: Verify**

Run dev server. Pick Kusarigama. Select 引力場 — enemies should slowly drift toward you. Select 雙軌道 — a second ring of sickles should appear at larger radius. For 毒蛇鎖鎌: also pick poison affix; evolution card should appear; each sickle contact should add poison stacks (check via visual DoT numbers).

- [ ] **Step 4: Commit**

```bash
git add src/weapons/Kusarigama.js
git commit -m "feat: kusarigama — 引力場/雙軌道 mechanic upgrades + 毒蛇鎖鎌 evo"
```

---

## Task 7: Homura — 焦土, 連鎖爆炸, 龍炎矢 evo + GameScene explosion handler

**Files:**
- Modify: `src/weapons/Homura.js`
- Modify: `src/scenes/GameScene.js` (lines ~158–163, the explosion callback)

- [ ] **Step 1: Add `_scorch`, `_chainExplode` to `upgrades[]` in `Homura.js`**

```javascript
    { id: 'scorch',       name: '焦土',   desc: '爆炸後留下3秒燃燒火場（0.15倍傷害/300ms）', apply: s => { s._scorch = true } },
    { id: 'chainExplode', name: '連鎖爆炸', desc: '25%機率觸發二次爆炸',                     apply: s => { s._chainExplode = true } },
```

- [ ] **Step 2: Copy flags + evo onto `proj` in Homura `fire()`**

In `fire()`, after `s._explodeMult = 1.2`, add:
```javascript
      s._scorch       = stats._scorch || stats._evo === 'ryuen'
      s._chainExplode = stats._chainExplode
      s._chainDepth   = 0
      // 龍炎矢 evo — bigger projectile, more damage, doubled explosion
      if (stats._evo === 'ryuen') {
        s.setDisplaySize(72, 72)
        s.damage *= 1.5
        s._explodeRadius = s._explodeRadius * 2
      }
```

- [ ] **Step 3: Add scorch zone helper in `GameScene.js`**

Before the `_addWeapon` method (around line 146), add a new helper method to the class:
```javascript
  _createScorchZone(x, y, radius, damage, affixes) {
    const gz = this.add.graphics().setDepth(4)
    gz.fillStyle(0xff4400, 0.30)
    gz.fillCircle(x, y, radius)
    const damageCd = new Map()
    const tick = () => {
      const now = this.time.now
      this._enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
        if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < radius) {
          const last = damageCd.get(e) || 0
          if (now - last >= 300) {
            damageCd.set(e, now)
            Enemy.takeDamage(e, damage * 0.15, x, y, affixes, 0)
          }
        }
      })
    }
    this.events.on('update', tick)
    this.time.delayedCall(3000, () => {
      this.events.off('update', tick)
      gz.destroy()
    })
  }
```

- [ ] **Step 4: Expand the explosion callback in `GameScene._addWeapon()`**

The current explosion block (lines 158–163) reads:
```javascript
        if (proj._explodeRadius) {
          this._enemies.getChildren()
            .filter(e => e.active && !e.dying && e !== enemy &&
              Phaser.Math.Distance.Between(proj.x, proj.y, e.x, e.y) < proj._explodeRadius)
            .forEach(e => Enemy.takeDamage(e, proj.damage * (proj._explodeMult || 1), proj.x, proj.y, this._affixes, 0))
        }
```

Replace with:
```javascript
        if (proj._explodeRadius) {
          const explodeR = proj._evoKaku ? proj._explodeRadius * 2.5 : proj._explodeRadius
          this._enemies.getChildren()
            .filter(e => e.active && !e.dying && e !== enemy &&
              Phaser.Math.Distance.Between(proj.x, proj.y, e.x, e.y) < explodeR)
            .forEach(e => Enemy.takeDamage(e, proj.damage * (proj._explodeMult || 1), proj.x, proj.y, this._affixes, 0))

          // 焦土 / 龍炎矢 evo — scorch zone
          if (proj._scorch) {
            this._createScorchZone(proj.x, proj.y, explodeR, proj.damage, this._affixes)
          }

          // 連鎖爆炸 — 25% chance second explosion (depth-guarded)
          if (proj._chainExplode && proj._chainDepth === 0 && Math.random() < 0.25) {
            const chainR = proj._explodeRadius
            this._enemies.getChildren()
              .filter(e => e.active && !e.dying && e !== enemy &&
                Phaser.Math.Distance.Between(proj.x, proj.y, e.x, e.y) < chainR)
              .forEach(e => Enemy.takeDamage(e, proj.damage * 0.5, proj.x, proj.y, this._affixes, 0))
          }

          // 核符 evo (kaku) — inline AoE + linger (handled in Ofuda task)
        }
```

- [ ] **Step 5: Verify**

Run dev server. Pick Homura. Select 焦土 — after explosions a red circle should remain for 3 seconds dealing periodic damage. Select 連鎖爆炸 — occasionally a second flash/damage should occur at the same spot. For 龍炎矢: pick burn affix; evolution card should appear; fireball should be 3× bigger and leave a permanent fire zone.

- [ ] **Step 6: Commit**

```bash
git add src/weapons/Homura.js src/scenes/GameScene.js
git commit -m "feat: homura — 焦土/連鎖爆炸 upgrades + 龍炎矢 evo + GameScene scorch zone"
```

---

## Task 8: Ofuda — 分裂, 滯留, 核符 evo + GameScene linger zone

**Files:**
- Modify: `src/weapons/Ofuda.js`
- Modify: `src/scenes/GameScene.js` (explosion callback, linger zone helper)

- [ ] **Step 1: Add `_split`, `_linger` to `upgrades[]` in `Ofuda.js`**

```javascript
    { id: 'split',  name: '分裂', desc: '射程到達後分裂成3個小符（0.5倍傷害、無追蹤）', apply: s => { s._split = true } },
    { id: 'linger', name: '滯留', desc: '命中爆炸後留下2秒輻射區（0.2倍傷害/300ms）',   apply: s => { s._linger = true } },
```

- [ ] **Step 2: Copy flags + evo onto `proj` in Ofuda `fire()`**

After `s._speed = stats.speed`, add:
```javascript
      s._split   = stats._split
      s._linger  = stats._linger
      s._evoKaku = stats._evo === 'kaku'
      // 核符 evo — force both linger and bigger explosion
      if (s._evoKaku) {
        s._linger = true
        s._explodeRadius = 60 * 2.5   // kaku doubles the base radius
      }
```

- [ ] **Step 3: Update `update()` for split-on-expire**

In Ofuda's `update(sprite)`, when the projectile expires by range (the `disableBody(true, true)` branch), replace with:
```javascript
    if (Phaser.Math.Distance.Between(sprite.spawnX, sprite.spawnY, sprite.x, sprite.y) >= sprite.range) {
      if (sprite._split && !sprite._splitFired) {
        sprite._splitFired = true
        _doSplit(sprite)
      }
      sprite.disableBody(true, true)
      return
    }
```

Add `_splitFired = false` to `fire()` after `s._speed = stats.speed`:
```javascript
      s._splitFired = false
```

- [ ] **Step 4: Add `_doSplit` helper at the bottom of `Ofuda.js`**

Also add this import at the top of the file (alongside the existing imports):
```javascript
import { getOrCreate } from './_pool.js'
```

```javascript
function _doSplit(proj) {
  const scene     = proj.scene
  const baseAngle = Math.atan2(proj.body.velocity.y, proj.body.velocity.x)
  const group     = scene._weapons.find(w => w.weapon.id === 'ofuda')?.projectiles
  if (!group) return
  for (let i = -1; i <= 1; i++) {
    const s = getOrCreate(group, proj.x, proj.y, 'ofuda-tex')
    s.setDisplaySize(proj.displayWidth * 0.5, proj.displayHeight * 0.5)
    s.damage         = proj.damage * 0.5
    s.hitSet         = new Set()
    s.spawnX         = proj.x
    s.spawnY         = proj.y
    s.range          = 150
    s.penetrate      = false
    s._target        = null      // no homing
    s._explodeRadius = 30
    s._explodeMult   = 1.5
    s._speed         = 250
    s._split         = false
    s._splitFired    = true
    s._linger        = false
    s._evoKaku       = false
    const angle = baseAngle + Phaser.Math.DegToRad(i * 45)
    scene.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), 250, s.body.velocity)
  }
}
```

- [ ] **Step 5: Add linger zone helper and wire into GameScene explosion callback**

Add `_createLingerZone` helper method to `GameScene` (alongside `_createScorchZone`):
```javascript
  _createLingerZone(x, y, radius, damage, affixes) {
    const gz = this.add.graphics().setDepth(4)
    gz.fillStyle(0x8800cc, 0.25)
    gz.fillCircle(x, y, radius)
    const damageCd = new Map()
    const tick = () => {
      const now = this.time.now
      this._enemies.getChildren().filter(e => e.active && !e.dying).forEach(e => {
        if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < radius) {
          const last = damageCd.get(e) || 0
          if (now - last >= 300) {
            damageCd.set(e, now)
            Enemy.takeDamage(e, damage * 0.20, x, y, affixes, 0)
          }
        }
      })
    }
    this.events.on('update', tick)
    this.time.delayedCall(2000, () => {
      this.events.off('update', tick)
      gz.destroy()
    })
  }
```

In the explosion callback (already expanded in Task 7), add after the `_scorch` block:
```javascript
          // 滯留 / 核符 evo — linger zone
          if (proj._linger) {
            this._createLingerZone(proj.x, proj.y, explodeR, proj.damage, this._affixes)
          }

          // 核符 evo — unconditional AoE splash (100%, no burst-affix RNG)
          if (proj._evoKaku) {
            this._enemies.getChildren()
              .filter(e => e.active && !e.dying && e !== enemy &&
                Phaser.Math.Distance.Between(proj.x, proj.y, e.x, e.y) < explodeR)
              .forEach(e => Enemy.takeDamage(e, proj.damage * 0.4, proj.x, proj.y, this._affixes, 0))
          }
```

- [ ] **Step 6: Verify**

Run dev server. Pick Ofuda. Select 分裂 — when a projectile expires by range, 3 small ones should fan outward. Select 滯留 — after explosion a purple circle should remain for 2 seconds. For 核符: also pick burst affix; evolution card should appear; explosions should be 2.5× bigger with a purple linger zone.

- [ ] **Step 7: Final end-to-end verification**

Test all 7 evolutions by forcing conditions in browser (pick specific weapons + affixes):
- 龍炎矢: Homura + burn affix → 覚醒 card appears → fireball visually bigger, fire zone after explosion ✓
- 雷轟剣: Shuriken + chain affix → 100% chain with lightning arc ✓
- 氷刃苦無: Kunai + chill affix → every hit freezes enemy (blue tint, stops moving) ✓
- 妖刀村正: Tachi + leech affix → HP should increase on each slash hit ✓
- 毒蛇鎖鎌: Kusarigama + poison affix → DoT numbers appear on each sickle contact ✓
- 核符: Ofuda + burst affix → much larger explosion + purple zone ✓
- 死神扇: Ogi + curse affix → cursed enemies glow; death causes AoE explosion ✓

- [ ] **Step 8: Commit**

```bash
git add src/weapons/Ofuda.js src/scenes/GameScene.js
git commit -m "feat: ofuda — 分裂/滯留 upgrades + 核符 evo + GameScene linger zone"
```
