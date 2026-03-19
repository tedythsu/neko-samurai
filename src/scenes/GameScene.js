import Phaser from 'phaser'

const SPEED = 200
const RUN_COLS  = 6, RUN_ROWS  = 6   // 6×6 = 36 frames
const IDLE_COLS = 6, IDLE_ROWS = 6   // 6×6 grid（只用前9格）
const AURA_COLS = 6, AURA_ROWS = 6   // 6×6 = 36 frames
const RUN_FRAME_COUNT  = RUN_COLS  * RUN_ROWS
const IDLE_FRAME_COUNT = 9
const AURA_FRAME_COUNT = AURA_COLS * AURA_ROWS
const RUN_FPS  = 24
const IDLE_FPS = 12
const AURA_FPS = 36
const CHAR_HEIGHT    = 120   // 角色顯示高度（px）
const AURA_SCALE     = 1.5   // 劍氣相對角色的大小倍率
const AURA_INTERVAL  = 3000  // 劍氣出現間隔（ms）
const AURA_DURATION  = 300   // 劍氣顯示持續時間（ms）
const AURA_FADE      = 60    // 淡入 / 淡出時間（ms）
const CHAR_PATH = 'assets/sprites/potemaru'

export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene') }

  // ─── Preload ───────────────────────────────────────────────────────────────

  preload() {
    this.load.image('run',  `${CHAR_PATH}/run.png`)
    this.load.image('idle', `${CHAR_PATH}/idle.png`)
    this.load.image('aura', `${CHAR_PATH}/aura.png`)
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  create() {
    this._sliceSheet('run',  RUN_COLS,  RUN_ROWS)
    this._sliceSheet('idle', IDLE_COLS, IDLE_ROWS)
    this._sliceSheet('aura', AURA_COLS, AURA_ROWS)

    // 每個動畫各自計算顯示寬度（高度統一為 CHAR_HEIGHT）
    this._dH = CHAR_HEIGHT
    this._dW = {
      run:  this._frameAspectW('run'),
      idle: this._frameAspectW('idle'),
      aura: this._frameAspectW('aura'),
    }

    this._spawnCharacter()
    this._setupKeyboard()
    this._setupTouch()

    // Animation state
    this._runFrame  = 0;  this._runTimer  = 0
    this._idleFrame = 0;  this._idleTimer = 0
    this._auraFrame = 0;  this._auraTimer = 0
    this._auraActive = false

    // 定時觸發劍氣
    this.time.addEvent({ delay: AURA_INTERVAL, loop: true, callback: this._triggerAura, callbackScope: this })

    this._state  = 'idle'
    this._facing = 1
    this._setState('idle')
  }

  // ─── Frame helpers ─────────────────────────────────────────────────────────

  _frameAspectW(key) {
    const f = this.textures.get(key).frames[0]
    const aspect = f.realWidth > 0 ? f.realWidth / f.realHeight : 1
    return Math.round(CHAR_HEIGHT * aspect)
  }

  // ─── Sprite sheet slicer ───────────────────────────────────────────────────

  _sliceSheet(key, cols, rows) {
    const tex = this.textures.get(key)
    const src = tex.source[0]
    const fw  = Math.floor(src.width  / cols)
    const fh  = Math.floor(src.height / rows)
    let idx = 0
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        tex.add(idx++, 0, c * fw, r * fh, fw, fh)
      }
    }
  }

  // ─── Character ─────────────────────────────────────────────────────────────

  _spawnCharacter() {
    const { width: W, height: H } = this.scale
    this._pos = { x: W / 2, y: H / 2 }

    // 劍氣（在角色下層，預設隱藏）
    this._aura = this.add.image(W / 2, H / 2, 'aura', 0)
      .setDisplaySize(this._dW.aura * AURA_SCALE, this._dH * AURA_SCALE)
      .setDepth(9)
      .setAlpha(0)

    // 角色（在劍氣上層）
    this._sprite = this.add.image(W / 2, H / 2, 'idle', 0)
      .setDisplaySize(this._dW.idle, this._dH)
      .setDepth(10)
  }

  // ─── Input ─────────────────────────────────────────────────────────────────

  _setupKeyboard() {
    this._keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT')
  }

  _setupTouch() {
    this._touch = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 }
    this._joyBase = this.add.circle(0, 0, 55, 0x000000, 0.15).setDepth(100).setVisible(false)
    this._joyKnob = this.add.circle(0, 0, 28, 0x000000, 0.30).setDepth(101).setVisible(false)

    this.input.on('pointerdown', (p) => {
      this._touch.active = true
      this._touch.startX = p.x; this._touch.startY = p.y
      this._touch.dx = 0; this._touch.dy = 0
      this._joyBase.setPosition(p.x, p.y).setVisible(true)
      this._joyKnob.setPosition(p.x, p.y).setVisible(true)
    })
    this.input.on('pointermove', (p) => {
      if (!this._touch.active) return
      const dx = p.x - this._touch.startX
      const dy = p.y - this._touch.startY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const maxR = 55, ratio = dist > maxR ? maxR / dist : 1
      this._touch.dx = (dx / maxR) * ratio
      this._touch.dy = (dy / maxR) * ratio
      this._joyKnob.setPosition(this._touch.startX + dx * ratio, this._touch.startY + dy * ratio)
    })
    this.input.on('pointerup', () => {
      this._touch.active = false; this._touch.dx = 0; this._touch.dy = 0
      this._joyBase.setVisible(false); this._joyKnob.setVisible(false)
    })
  }

  // ─── State machine ─────────────────────────────────────────────────────────

  _setState(next) {
    if (this._state === next) return
    this._state = next
    if (next === 'idle') { this._idleFrame = 0; this._idleTimer = 0 }
    if (next === 'run')  { this._runFrame  = 0; this._runTimer  = 0 }
  }

  _triggerAura() {
    this._auraActive = true
    this._auraFrame  = 0
    this._auraTimer  = 0
    this.tweens.killTweensOf(this._aura)
    // 淡入 → 停留 → 淡出
    this.tweens.chain({
      targets: this._aura,
      tweens: [
        { alpha: 1, duration: AURA_FADE, ease: 'Sine.In' },
        { alpha: 1, duration: AURA_DURATION - AURA_FADE * 2 },
        { alpha: 0, duration: AURA_FADE, ease: 'Sine.Out',
          onComplete: () => { this._auraActive = false } },
      ],
    })
  }

  _isMoving() {
    const k = this._keys
    return k.W.isDown || k.A.isDown || k.S.isDown || k.D.isDown ||
           k.UP.isDown || k.DOWN.isDown || k.LEFT.isDown || k.RIGHT.isDown ||
           (this._touch.active && (Math.abs(this._touch.dx) > 0.1 || Math.abs(this._touch.dy) > 0.1))
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  update(_, delta) {
    const dt = delta / 1000
    const { width: W, height: H } = this.scale
    const k = this._keys

    // Input
    let vx = 0, vy = 0
    if (k.A.isDown || k.LEFT.isDown)  vx -= 1
    if (k.D.isDown || k.RIGHT.isDown) vx += 1
    if (k.W.isDown || k.UP.isDown)    vy -= 1
    if (k.S.isDown || k.DOWN.isDown)  vy += 1
    if (this._touch.active) { vx += this._touch.dx; vy += this._touch.dy }
    const len = Math.sqrt(vx * vx + vy * vy)
    if (len > 1) { vx /= len; vy /= len }

    // Move
    const half = 48
    this._pos.x = Phaser.Math.Clamp(this._pos.x + vx * SPEED * dt, half, W - half)
    this._pos.y = Phaser.Math.Clamp(this._pos.y + vy * SPEED * dt, half, H - half)

    // Flip
    if (vx > 0.05)       { this._facing = 1;  this._sprite.setFlipX(false) }
    else if (vx < -0.05) { this._facing = -1; this._sprite.setFlipX(true)  }

    // State transitions
    this._setState(this._isMoving() ? 'run' : 'idle')

    // Advance frames
    let sheetKey, frameIdx
    if (this._state === 'run') {
      this._runTimer += delta
      if (this._runTimer >= 1000 / RUN_FPS) {
        this._runTimer -= 1000 / RUN_FPS
        this._runFrame = (this._runFrame + 1) % RUN_FRAME_COUNT
      }
      sheetKey = 'run'; frameIdx = this._runFrame
    } else {
      this._idleTimer += delta
      if (this._idleTimer >= 1000 / IDLE_FPS) {
        this._idleTimer -= 1000 / IDLE_FPS
        this._idleFrame = (this._idleFrame + 1) % IDLE_FRAME_COUNT
      }
      sheetKey = 'idle'; frameIdx = this._idleFrame
    }

    // Advance aura frames（只在顯示期間推進）
    if (this._auraActive) {
      this._auraTimer += delta
      if (this._auraTimer >= 1000 / AURA_FPS) {
        this._auraTimer -= 1000 / AURA_FPS
        this._auraFrame = (this._auraFrame + 1) % AURA_FRAME_COUNT
      }
    }

    // Apply every frame (single source of truth)
    this._aura
      .setTexture('aura', this._auraFrame)
      .setDisplaySize(this._dW.aura * AURA_SCALE, this._dH * AURA_SCALE)
      .setPosition(this._pos.x, this._pos.y)
    this._sprite
      .setTexture(sheetKey, frameIdx)
      .setDisplaySize(this._dW[sheetKey], this._dH)
      .setPosition(this._pos.x, this._pos.y)
  }
}
