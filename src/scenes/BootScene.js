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
