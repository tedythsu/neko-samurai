// src/enemies/BossManager.js
import Phaser  from 'phaser'
import Enemy   from '../entities/Enemy.js'
import { CFG } from '../config.js'

// Boss definitions (triggers checked by elapsed time)
const BOSS_DEFS = [
  {
    id:        'kijo',
    name:      '鬼将',
    triggerMs: 5 * 60 * 1000,
    tint:      0x8844cc,
    scale:     2.5,
    hp:        CFG.ENEMY_HP * 15,
    speed:     CFG.ENEMY_SPEED * 0.8,
  },
  {
    id:        'raiki',
    name:      '雷鬼',
    triggerMs: 10 * 60 * 1000,
    tint:      0x2266ff,
    scale:     2.5,
    hp:        CFG.ENEMY_HP * 25,
    speed:     CFG.ENEMY_SPEED * 0.9,
  },
  {
    id:        'daiyoma',
    name:      '大妖魔',
    triggerMs: 15 * 60 * 1000,
    tint:      0xcc1133,
    scale:     3.0,
    hp:        CFG.ENEMY_HP * 40,
    speed:     CFG.ENEMY_SPEED * 0.7,
  },
]

export default class BossManager {
  constructor(scene) {
    this._scene        = scene
    this._triggered    = new Set()   // boss IDs already triggered
    this._activeEvents = []          // TimeEvent handles for current boss skills
    this.activeBoss    = null        // current boss sprite (null when none)
    this._bossMaxHp    = 0
    this._bossHpPct    = 0
    this._bossName     = ''
    this._phase2Done   = false
  }

  /** Call every frame from GameScene.update() */
  update(elapsedMs) {
    for (const def of BOSS_DEFS) {
      if (!this._triggered.has(def.id) && elapsedMs >= def.triggerMs) {
        this._triggered.add(def.id)
        this._spawnBoss(def)
        return   // one boss at a time
      }
    }

    // Update HP % for HUD
    if (this.activeBoss && this.activeBoss.active) {
      this._bossHpPct = Math.max(0, this.activeBoss.hp / this._bossMaxHp)

      // 大妖魔 phase 2 transition
      if (this.activeBoss._bossId === 'daiyoma' && !this._phase2Done &&
          this._bossHpPct <= 0.5) {
        this._enterDaiyomaPhase2()
      }
    }
  }

  /** Remove all active skill TimeEvents. Call before registering new ones or on boss death. */
  cleanup() {
    for (const ev of this._activeEvents) ev.remove()
    this._activeEvents = []
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  _spawnBoss(def) {
    const scene = this._scene

    // Pause regular spawning
    scene._spawnEvent.paused = true
    scene._bossActive = true

    // Announcement overlay
    const W  = scene.cameras.main.width
    const H  = scene.cameras.main.height
    const overlay = scene.add.text(W / 2, H / 2, `「${def.name} 降臨」`, {
      fontSize: '36px', color: '#ffffff',
      fontFamily: '"Noto Serif JP", serif',
      stroke: '#000000', strokeThickness: 4,
    }).setScrollFactor(0).setDepth(500).setOrigin(0.5).setAlpha(0)
    scene.tweens.add({ targets: overlay, alpha: 1, duration: 400 })
    scene.time.delayedCall(1500, () => {
      scene.tweens.add({ targets: overlay, alpha: 0, duration: 400,
        onComplete: () => overlay.destroy() })
    })

    // Spawn boss sprite from enemy pool
    const { x, y } = _randomEdge(scene)
    let sprite = scene._enemies.getFirstDead(false)
    if (!sprite) {
      sprite = scene._enemies.create(x, y, 'kisotsu-run', 0)
      sprite.setDepth(5)
    }

    // Manual activate (bypass type system — boss uses fixed HP/speed)
    sprite.enableBody(true, x, y, true, true)
    sprite.hp             = def.hp
    sprite.damageCd       = 0
    sprite.knockbackTimer = 0
    sprite.dying          = false
    sprite._frame         = 0
    sprite._timer         = 0
    sprite._baseTint      = def.tint
    sprite._typeConfig    = { id: def.id, behaviorFlags: {} }
    sprite._speed         = def.speed
    sprite._bossId        = def.id
    sprite._pulseTween    = null
    sprite.setAlpha(1).setTint(def.tint)
    sprite._statusEffects = {
      burn:   { stacks: 0, timer: 0, dps: 5, _accum: 0 },
      poison: { stacks: 0, timer: 0, _accum: 0 },
      chill:  { active: false, timer: 0 },
      curse:  { active: false, timer: 0 },
      frozen: { active: false, timer: 0 },
    }

    // Size the boss
    const frame0 = scene.textures.get('kisotsu-run').frames[0]
    const dH = Math.round(64 * def.scale)
    const dW = Math.round(dH * frame0.realWidth / frame0.realHeight)
    sprite.setDisplaySize(dW, dH)
    sprite.body.setSize(Math.round(18 * def.scale), Math.round(38 * def.scale))

    this.activeBoss  = sprite
    this._bossMaxHp  = def.hp
    this._bossHpPct  = 1.0
    this._bossName   = def.name
    this._phase2Done = false

    // Register boss-death watcher
    const deathWatcher = () => {
      if (sprite.dying || !sprite.active || sprite.hp <= 0) {
        scene.events.off('update', deathWatcher)
        this._onBossDead(def)
      }
    }
    scene.events.on('update', deathWatcher)
    sprite._bossDeathWatcher = deathWatcher

    // Register skills by boss ID
    if (def.id === 'kijo')    this._registerKijoSkills(sprite)
    if (def.id === 'raiki')   this._registerRaikiSkills(sprite)    // implemented in Task 5
    if (def.id === 'daiyoma') this._registerDaiyomaPhase1(sprite)  // implemented in Task 5
  }

  // Stub methods — expanded in Task 5
  _registerRaikiSkills(_boss)   { /* Task 5 */ }
  _enterDaiyomaPhase2()         { /* Task 5 */ }
  _registerDaiyomaPhase1(_boss) { /* Task 5 */ }

  _onBossDead(def) {
    this.cleanup()
    const scene       = this._scene
    const boss        = this.activeBoss
    this.activeBoss   = null
    this._bossHpPct   = 0

    if (def.id === 'daiyoma') {
      // Victory!
      scene.time.delayedCall(500, () => scene._onVictory())
      return
    }

    // XP burst
    const { x, y } = boss
    for (let i = 0; i < 12; i++) {
      scene.time.delayedCall(i * 60, () => scene._spawnOrb(
        x + Phaser.Math.Between(-80, 80),
        y + Phaser.Math.Between(-80, 80)
      ))
    }

    // Resume spawning after short pause
    scene.time.delayedCall(500, () => {
      scene._spawnEvent.paused = false
      scene._bossActive = false
    })
  }

  // ─── 鬼将 Skills ─────────────────────────────────────────────────────────

  _registerKijoSkills(boss) {
    const scene = this._scene

    // 衝刺突進: every 4 seconds, dash toward player at 600px/s for 0.3s
    const dashEvent = scene.time.addEvent({
      delay: 4000, loop: true,
      callback: () => {
        if (!boss.active || boss.dying) return
        const player = scene._player
        scene.physics.moveToObject(boss, player.sprite, 600)
        boss._dashing = true
        boss.damageCd = 0  // allow damage during dash
        scene.time.delayedCall(300, () => {
          if (boss.active && !boss.dying) {
            boss.body.velocity.set(0, 0)
            boss._dashing = false
          }
        })
      },
    })
    this._activeEvents.push(dashEvent)

    // 震地: every 3 seconds when HP < 50%
    const tremorEvent = scene.time.addEvent({
      delay: 3000, loop: true,
      callback: () => {
        if (!boss.active || boss.dying) return
        if (boss.hp / this._bossMaxHp >= 0.5) return
        const { x, y } = boss
        // AoE damage to nearby enemies
        scene._enemies.getChildren()
          .filter(e => e.active && !e.dying && e !== boss &&
            Phaser.Math.Distance.Between(x, y, e.x, e.y) < 80)
          .forEach(e => Enemy.takeDamage(e, CFG.ENEMY_DAMAGE * 1.5, x, y, [], 0))
        // Check player proximity
        const pDist = Phaser.Math.Distance.Between(x, y, scene._player.x, scene._player.y)
        if (pDist < 80) scene._player.takeDamage(CFG.ENEMY_DAMAGE * 1.5)
        // Expanding ring visual
        const ring = scene.add.graphics().setDepth(8)
        ring.lineStyle(3, 0xff8800, 0.9)
        ring.strokeCircle(x, y, 80)
        scene.tweens.add({
          targets: ring, alpha: 0, scaleX: 1.4, scaleY: 1.4,
          duration: 400, onComplete: () => ring.destroy(),
        })
      },
    })
    this._activeEvents.push(tremorEvent)
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _randomEdge(scene) {
  const W = CFG.WORLD_WIDTH, H = CFG.WORLD_HEIGHT, inset = 20
  const edge = Math.floor(Math.random() * 4)
  switch (edge) {
    case 0: return { x: Math.random() * W,  y: inset }
    case 1: return { x: Math.random() * W,  y: H - inset }
    case 2: return { x: inset,              y: Math.random() * H }
    default: return { x: W - inset,         y: Math.random() * H }
  }
}
