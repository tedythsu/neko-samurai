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
