// src/entities/Player.js
import { CFG } from '../config.js'

const CHAR_H  = 64    // display height px
const RUN_FPS = 24
const IDL_FPS = 12

export default class Player {
  constructor(scene, x, y) {
    this.scene  = scene
    // Stats (mutable by upgrades)
    this.speed            = CFG.PLAYER_SPEED
    this.maxHp            = CFG.PLAYER_HP_MAX
    this.hp               = this.maxHp

    // Slice frames into each texture
    _sliceSheet(scene, 'idle',   6, 6)
    _sliceSheet(scene, 'run',    6, 6)

    // Precompute display widths (aspect-correct per sheet)
    this._dW = {
      idle:   _frameAspectW(scene, 'idle',   CHAR_H),
      run:    _frameAspectW(scene, 'run',    CHAR_H),
    }

    // Physics sprite
    this.sprite = scene.physics.add.sprite(x, y, 'idle', 0)
      .setDisplaySize(this._dW.idle, CHAR_H)
      .setCollideWorldBounds(true)
    this._syncHitbox()

    // Keyboard
    this._keys = scene.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT')

    // Touch joystick
    this._touch   = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 }
    this._joyBase = scene.add.circle(0, 0, 55, 0x000000, 0.15).setDepth(100).setScrollFactor(0).setVisible(false)
    this._joyKnob = scene.add.circle(0, 0, 28, 0x000000, 0.30).setDepth(101).setScrollFactor(0).setVisible(false)
    scene.input.on('pointerdown',  p  => this._onDown(p))
    scene.input.on('pointermove',  p  => this._onMove(p))
    scene.input.on('pointerup',    ()  => this._onUp())

    // Animation state
    this._state          = 'idle'
    this._frame          = { idle: 0, run: 0 }
    this._timer          = { idle: 0, run: 0 }
    this._dead           = false
  }

  // ── Public ────────────────────────────────────────────────────────────────

  get x() { return this.sprite.x }
  get y() { return this.sprite.y }

  update(delta) {
    if (this._dead) return
    this._move(delta)
    this._animateTick(delta)
  }

  takeDamage(amount) {
    this.scene.events.emit('player-hit')   // reset out-of-combat regen timer
    this.hp = Math.max(0, this.hp - amount)

    // 1. Sprite red tint flash
    this.sprite.setTint(0xff3333)
    this.scene.time.delayedCall(200, () => {
      if (!this._dead) this.sprite.clearTint()
    })

    // 2. Camera shake — physical weight
    this.scene.cameras.main.shake(150, 0.006)

    // 3. Full-screen red flash — unmissable peripheral signal
    this.scene.cameras.main.flash(250, 255, 20, 20, false)

    if (this.hp <= 0 && !this._dead) {
      // Substitution — negate lethal hit once (60s cooldown)
      const sc = this.scene
      if (sc._substitutionReady && sc._substitutionCd <= 0) {
        this.hp = Math.max(1, this.maxHp * 0.20)
        sc._substitutionCd = sc._cooldownAdjusted ? sc._cooldownAdjusted(45000) : 45000
        sc._substitutionGrace = 1500
        // Flash white to signal activation
        this.sprite.setTint(0xffffff)
        sc.time.delayedCall(300, () => { if (!this._dead) this.sprite.clearTint() })
        return
      }
      this._dead = true
      this.sprite.clearTint()
      this.scene.events.emit('player-dead')
    }
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount)
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _move(delta) {
    const k  = this._keys
    let vx = 0, vy = 0
    if (k.A.isDown || k.LEFT.isDown)  vx -= 1
    if (k.D.isDown || k.RIGHT.isDown) vx += 1
    if (k.W.isDown || k.UP.isDown)    vy -= 1
    if (k.S.isDown || k.DOWN.isDown)  vy += 1
    if (this._touch.active) { vx += this._touch.dx; vy += this._touch.dy }

    const len = Math.hypot(vx, vy)
    if (len > 1) { vx /= len; vy /= len }

    const tempSpeedMult = this.scene._shadowStrideUntil > this.scene.time.now ? 1.12 : 1
    this.sprite.setVelocity(vx * this.speed * tempSpeedMult, vy * this.speed * tempSpeedMult)

    if      (vx >  0.05) this.sprite.setFlipX(false)
    else if (vx < -0.05) this.sprite.setFlipX(true)

    const moving = len > 0.1
    this._state = moving ? 'run' : 'idle'
  }

  _animateTick(delta) {
    const key   = this._state === 'run' ? 'run' : 'idle'
    const fps   = this._state === 'run' ? RUN_FPS : IDL_FPS
    const count = this._state === 'run' ? 36 : 9

    this._timer[key] += delta
    const interval = 1000 / fps
    while (this._timer[key] >= interval) {
      this._timer[key] -= interval
      this._frame[key]  = (this._frame[key] + 1) % count
    }

    this.sprite
      .setTexture(key, this._frame[key])
      .setDisplaySize(this._dW[key], CHAR_H)

    this._syncHitbox()
  }

  _syncHitbox() {
    const frame = this.sprite.frame
    if (!frame || !this.sprite.body) return

    // Keep the hurtbox close to the visible silhouette so contact damage feels fair.
    const bodyW = Math.max(28, Math.round(frame.realWidth * 0.68))
    const bodyH = Math.max(44, Math.round(frame.realHeight * 0.82))
    this.sprite.body.setSize(bodyW, bodyH, true)
  }

  _onDown(p) {
    this._touch.active = true
    this._touch.startX = p.x; this._touch.startY = p.y
    this._touch.dx = 0; this._touch.dy = 0
    this._joyBase.setPosition(p.x, p.y).setVisible(true)
    this._joyKnob.setPosition(p.x, p.y).setVisible(true)
  }

  _onMove(p) {
    if (!this._touch.active) return
    const dx   = p.x - this._touch.startX
    const dy   = p.y - this._touch.startY
    const dist = Math.hypot(dx, dy)
    const maxR = 55, ratio = dist > maxR ? maxR / dist : 1
    this._touch.dx = (dx / maxR) * ratio
    this._touch.dy = (dy / maxR) * ratio
    this._joyKnob.setPosition(this._touch.startX + dx * ratio, this._touch.startY + dy * ratio)
  }

  _onUp() {
    this._touch.active = false; this._touch.dx = 0; this._touch.dy = 0
    this._joyBase.setVisible(false); this._joyKnob.setVisible(false)
  }
}

// ── Module-level helpers ──────────────────────────────────────────────────

function _sliceSheet(scene, key, cols, rows) {
  const tex = scene.textures.get(key)
  if (tex.has(0)) return            // already sliced (guard for scene restart)
  const src = tex.source[0]
  const fw  = Math.floor(src.width  / cols)
  const fh  = Math.floor(src.height / rows)
  let idx = 0
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      tex.add(idx++, 0, c * fw, r * fh, fw, fh)
}

function _frameAspectW(scene, key, h) {
  const frame0 = scene.textures.get(key).frames[0]
  if (!frame0) return h
  return Math.round(h * frame0.realWidth / frame0.realHeight)
}
