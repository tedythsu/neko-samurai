// src/scenes/UpgradeScene.js
import Phaser from 'phaser'

// Per-category accent color + label
const CATEGORY = {
  weapon:     { color: 0xc8a84b, label: '武器',   text: '#c8a84b' },
  affix:      { color: 0x8888ee, label: '符印',   text: '#aaaaff' },
  mechanical: { color: 0x44ccff, label: '機関',   text: '#44ccff' },
  new_weapon: { color: 0xaa55ff, label: '新武器', text: '#bb88ff' },
  player:     { color: 0x44ddbb, label: '身法',   text: '#55eedd' },
  evolution:  { color: 0xff4444, label: '覚醒', text: '#ff8888' },
  proj_trait: { color: 0x0088ff, label: '投射', text: '#88ccff' },
  melee_trait: { color: 0xff6600, label: '近戰', text: '#ffaa44' },
}

const AFFIX_COLOR = {
  burn:    0xff6600, burn2:    0xff3300,
  poison:  0x44cc44, poison2:  0x00ff44,
  chain:   0xffee00, chain2:   0xffff00,
  chill:   0x88ccff, chill2:   0x44aaff,
  curse:   0xaa44aa, curse2:   0xcc00cc,
  leech:   0xff4488, leech2:   0xff0066,
  burst:   0xff4400, burst2:   0xff6600,
  lucky:   0xffdd88, lucky2:   0xffaa00,
}

export default class UpgradeScene extends Phaser.Scene {
  constructor() { super('UpgradeScene') }

  init(data) {
    this._level    = data.level
    this._upgrades = data.upgrades
  }

  create() {
    const { width: W, height: H } = this.cameras.main

    // Overlay
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.80)

    // Decorative lines
    const gfx = this.add.graphics()
    gfx.lineStyle(1, 0xb8943f, 0.4)
    gfx.lineBetween(W * 0.08, H * 0.19, W * 0.92, H * 0.19)
    gfx.lineBetween(W * 0.08, H * 0.85, W * 0.92, H * 0.85)

    // Level number
    this.add.text(W / 2, H * 0.09, `Level  ${this._level}`, {
      fontSize: '36px', color: '#c8a84b',
      fontFamily: '"Cinzel", "Palatino Linotype", serif',
      fontStyle: 'bold',
      stroke: '#3a2800', strokeThickness: 3,
    }).setOrigin(0.5)

    // Subtitle
    this.add.text(W / 2, H * 0.205, '選擇強化', {
      fontSize: '14px', color: '#6a5e40',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
    }).setOrigin(0.5)

    // Cards
    const cardW   = Math.min(252, (W - 120) / 3)
    const cardH   = 196
    const spacing = cardW + 22
    const startX  = W / 2 - spacing
    const cardY   = H / 2 + H * 0.025

    this._containers = []
    this._upgrades.forEach((upg, i) => {
      this._buildCard(startX + i * spacing, cardY, cardW, cardH, upg, i)
    })
  }

  _buildCard(cx, cy, w, minH, upg, idx) {
    const cat = CATEGORY[upg.target] || CATEGORY.player
    let accent = cat.color
    // Elemental affixes use their element colour
    if (upg.target === 'affix' && upg.affix) {
      accent = AFFIX_COLOR[upg.affix.id] ?? AFFIX_COLOR[upg.id] ?? cat.color
    }

    // Measure text heights first so the card can adapt to content.
    // useAdvancedWrap: true is required for CJK text (no spaces) to wrap
    // at character boundaries instead of overflowing horizontally.
    const tmpName = this.add.text(-9999, -9999, upg.name, {
      fontSize: '15px',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
      fontStyle: 'bold',
      wordWrap: { width: w - 44, useAdvancedWrap: true },
    })
    const tmpDesc = this.add.text(-9999, -9999, upg.desc || '', {
      fontSize: '11px',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
      wordWrap: { width: w - 36, useAdvancedWrap: true },
      lineSpacing: 3,
    })
    const nameH = tmpName.height
    const descH = tmpDesc.height
    tmpName.destroy()
    tmpDesc.destroy()

    // Layout constants (distance from card top edge)
    const NAME_TOP = 24
    const SEP_Y    = NAME_TOP + nameH + 10
    const DESC_TOP = SEP_Y + 10
    const h = Math.max(minH, DESC_TOP + descH + 14)

    const container = this.add.container(cx, cy)

    // Card background
    const bg = this.add.rectangle(0, 0, w, h, 0x0b0b1c)
      .setStrokeStyle(1, 0x2a2a42)
      .setInteractive()

    // Left accent strip
    const strip = this.add.rectangle(-w / 2 + 2, 0, 4, h - 2, accent, 1)

    // Category badge (top-right corner)
    const badge = this.add.text(w / 2 - 10, -h / 2 + 12, cat.label, {
      fontSize: '9px', color: cat.text,
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
    }).setOrigin(1, 0)

    // Upgrade name
    const nameText = this.add.text(-w / 2 + 18, -h / 2 + NAME_TOP, upg.name, {
      fontSize: '15px', color: '#f0e8d0',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
      fontStyle: 'bold',
      wordWrap: { width: w - 44, useAdvancedWrap: true },
    }).setOrigin(0, 0)

    // Separator
    const sepGfx = this.add.graphics()
    sepGfx.lineStyle(1, accent, 0.25)
    sepGfx.lineBetween(-w / 2 + 14, -h / 2 + SEP_Y, w / 2 - 14, -h / 2 + SEP_Y)

    // Description
    const descText = this.add.text(-w / 2 + 18, -h / 2 + DESC_TOP, upg.desc || '', {
      fontSize: '11px', color: '#6a6878',
      fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
      wordWrap: { width: w - 36, useAdvancedWrap: true },
      lineSpacing: 3,
    }).setOrigin(0, 0)

    container.add([bg, strip, badge, nameText, sepGfx, descText])
    this._containers.push(container)

    // Entrance: slide up + fade
    container.setAlpha(0).setY(cy + 26)
    this.tweens.add({
      targets: container, alpha: 1, y: cy,
      duration: 310, delay: idx * 85, ease: 'Back.easeOut',
    })

    // Hover
    bg.on('pointerover', () => {
      bg.setFillStyle(0x14142a).setStrokeStyle(1.5, accent, 0.9)
      this.tweens.add({ targets: container, scaleX: 1.04, scaleY: 1.04, duration: 100 })
    })
    bg.on('pointerout', () => {
      bg.setFillStyle(0x0b0b1c).setStrokeStyle(1, 0x2a2a42)
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 120 })
    })
    bg.on('pointerdown', () => this._choose(upg))
  }

  _choose(upgrade) {
    // Disable all cards immediately to prevent double-clicks
    this._containers.forEach(c => c.getAt(0).removeInteractive())

    // Exit: slide back down + fade out (reverse of entrance)
    const last = this._containers.length - 1
    this._containers.forEach((c, i) => {
      this.tweens.add({
        targets: c, alpha: 0, y: c.y + 26,
        duration: 200, delay: i * 50, ease: 'Back.easeIn',
        onComplete: i === last ? () => {
          this.scene.get('GameScene').events.emit('upgrade-chosen', upgrade)
          this.scene.stop()
        } : undefined,
      })
    })
  }
}
