// src/scenes/UpgradeScene.js
import Phaser from 'phaser'
import { RARITY_UI } from '../config.js'

const CATEGORY = {
  weapon:    { color: 0xc8a84b, label: '武器',   text: '#c8a84b' },
  elemental: { color: 0x8888ee, label: '元素',   text: '#aaaaff' },
  proc:      { color: 0x44ccff, label: '觸發',   text: '#66ddff' },
  keystone:  { color: 0xff4444, label: '傳奇',   text: '#ff8888' },
  passive:   { color: 0x44ddbb, label: '被動',   text: '#55eedd' },
}

const ELEMENTAL_COLOR = {
  ignite:      0xff4400,
  chill:       0x88ccff,
  shock:       0xffee00,
  bleed:       0xcc44ff,
  armor_shred: 0x884400,
  poison:      0x44cc00,
  holy:        0xffffaa,
}

// Sharp resolution factor for crisp text on high-DPI screens
const RES = Math.min(2, Math.ceil(window?.devicePixelRatio || 1))

// Shared font stacks
const SERIF_JP = '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif'
const CINZEL    = '"Cinzel", "Palatino Linotype", serif'

export default class UpgradeScene extends Phaser.Scene {
  constructor() { super('UpgradeScene') }

  init(data) {
    this._level    = data.level
    this._upgrades = data.upgrades
  }

  create() {
    const { width: W, height: H } = this.cameras.main

    // ── Backdrop ──────────────────────────────────────────────────────────────
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.82)

    // Subtle vignette lines (thin, gold, low opacity)
    const gfx = this.add.graphics()
    gfx.lineStyle(1, 0xb8943f, 0.25)
    gfx.lineBetween(Math.round(W * 0.06), Math.round(H * 0.17), Math.round(W * 0.94), Math.round(H * 0.17))
    gfx.lineBetween(Math.round(W * 0.06), Math.round(H * 0.88), Math.round(W * 0.94), Math.round(H * 0.88))

    // ── Header ────────────────────────────────────────────────────────────────
    this.add.text(Math.round(W / 2), Math.round(H * 0.08), `Level  ${this._level}`, {
      fontSize: '34px', color: '#c8a84b',
      fontFamily: CINZEL,
      fontStyle: 'bold',
      stroke: '#2a1800', strokeThickness: 4,
    }).setOrigin(0.5).setResolution(RES)

    this.add.text(Math.round(W / 2), Math.round(H * 0.145), '選擇強化', {
      fontSize: '13px', color: '#7a6e52',
      fontFamily: SERIF_JP,
      letterSpacing: 6,
    }).setOrigin(0.5).setResolution(RES)

    // ── Cards ─────────────────────────────────────────────────────────────────
    // Use more screen width — 3 cards with tighter outer margins
    const GAP    = 14
    const MARGIN = Math.round(W * 0.04)
    const cardW  = Math.round((W - MARGIN * 2 - GAP * 2) / 3)
    const cardY  = Math.round(H / 2 + H * 0.02)

    this._containers = []
    this._upgrades.forEach((upg, i) => {
      const cx = Math.round(MARGIN + cardW / 2 + i * (cardW + GAP))
      this._buildCard(cx, cardY, cardW, upg, i)
    })
  }

  _buildCard(cx, cy, w, upg, idx) {
    const cat = CATEGORY[upg.target] || CATEGORY.passive
    let accent = cat.color
    if (upg.target === 'elemental' && upg.elemental) {
      accent = ELEMENTAL_COLOR[upg.elemental.id] ?? cat.color
    }

    const rui         = RARITY_UI[upg.rarity] || RARITY_UI.common
    const rarityBorder = rui.border
    const accentHex   = '#' + accent.toString(16).padStart(6, '0')

    // ── Measure text to compute card height ──────────────────────────────────
    const CONTENT_W  = w - 28   // inner content width
    const HEADER_H   = 44       // zone for top bar + badges
    const NAME_PAD   = 10       // padding above name
    const SEP_PAD    = 8        // padding above/below separator
    const DESC_PAD   = 10       // padding above desc
    const BOTTOM_PAD = 16       // bottom breathing room

    const tmpName = this.add.text(-9999, -9999, upg.name, {
      fontSize: '14px', fontFamily: SERIF_JP, fontStyle: 'bold',
      wordWrap: { width: CONTENT_W, useAdvancedWrap: true },
    }).setResolution(RES)
    const tmpDesc = this.add.text(-9999, -9999, upg.desc || '', {
      fontSize: '12px', fontFamily: SERIF_JP,
      wordWrap: { width: CONTENT_W, useAdvancedWrap: true },
      lineSpacing: 4,
    }).setResolution(RES)
    const nameH = Math.ceil(tmpName.height)
    const descH = Math.ceil(tmpDesc.height)
    tmpName.destroy()
    tmpDesc.destroy()

    const NAME_Y  = HEADER_H + NAME_PAD
    const SEP_Y   = NAME_Y + nameH + SEP_PAD
    const DESC_Y  = SEP_Y + SEP_PAD
    const h       = Math.max(220, DESC_Y + descH + BOTTOM_PAD)
    const halfH   = Math.round(h / 2)
    const halfW   = Math.round(w / 2)

    const container = this.add.container(cx, cy)

    // ── Card background ───────────────────────────────────────────────────────
    const bg = this.add.rectangle(0, 0, w, h, 0x0a0a18)
      .setStrokeStyle(1.5, rarityBorder, 0.9)
      .setInteractive()

    // Subtle inner gradient feel — lighter top band
    const headerBg = this.add.rectangle(0, -halfH + Math.round(HEADER_H / 2), w, HEADER_H, 0x0f0f22, 1)

    // Rarity-colored top accent bar (3px, full width)
    const topBar = this.add.rectangle(0, -halfH + 1, w, 3, accent, 0.9)

    // ── Badges row (inside header zone) ──────────────────────────────────────
    // Category badge — left side of header
    const catBadge = this.add.text(
      Math.round(-halfW + 10),
      Math.round(-halfH + 10),
      cat.label,
      {
        fontSize: '11px', color: cat.text,
        fontFamily: SERIF_JP, fontStyle: 'bold',
        backgroundColor: '#00000055',
        padding: { x: 4, y: 2 },
      }
    ).setOrigin(0, 0).setResolution(RES)

    // Rarity badge — right side of header
    const rarBadge = this.add.text(
      Math.round(halfW - 10),
      Math.round(-halfH + 10),
      rui.label,
      {
        fontSize: '11px', color: rui.text,
        fontFamily: SERIF_JP, fontStyle: 'bold',
        backgroundColor: '#00000055',
        padding: { x: 4, y: 2 },
      }
    ).setOrigin(1, 0).setResolution(RES)

    // Stack badge — only for maxStacks passives, shown in header right below rarity
    const extraItems = []
    if (upg.stackMax != null) {
      const nextStack = (upg.stackCur || 0) + 1
      const pip = this.add.text(
        Math.round(halfW - 10),
        Math.round(-halfH + 28),
        `Lv ${nextStack} / ${upg.stackMax}`,
        {
          fontSize: '10px', color: '#88ddcc',
          fontFamily: CINZEL,
          backgroundColor: '#08152055',
          padding: { x: 3, y: 1 },
        }
      ).setOrigin(1, 0).setResolution(RES)
      extraItems.push(pip)
    }

    // ── Separator line ────────────────────────────────────────────────────────
    const sepGfx = this.add.graphics()
    sepGfx.lineStyle(1, accent, 0.35)
    sepGfx.lineBetween(
      Math.round(-halfW + 12), Math.round(-halfH + SEP_Y),
      Math.round(halfW - 12),  Math.round(-halfH + SEP_Y)
    )

    // ── Name ─────────────────────────────────────────────────────────────────
    // Name uses warm cream, bold — primary affordance
    const nameText = this.add.text(
      Math.round(-halfW + 14),
      Math.round(-halfH + NAME_Y),
      upg.name,
      {
        fontSize: '14px', color: '#ede4cc',
        fontFamily: SERIF_JP, fontStyle: 'bold',
        wordWrap: { width: CONTENT_W, useAdvancedWrap: true },
      }
    ).setOrigin(0, 0).setResolution(RES)

    // ── Description ──────────────────────────────────────────────────────────
    // Light warm grey — high contrast, clearly readable
    const descText = this.add.text(
      Math.round(-halfW + 14),
      Math.round(-halfH + DESC_Y),
      upg.desc || '',
      {
        fontSize: '12px', color: '#c8c0d0',
        fontFamily: SERIF_JP,
        wordWrap: { width: CONTENT_W, useAdvancedWrap: true },
        lineSpacing: 4,
      }
    ).setOrigin(0, 0).setResolution(RES)

    container.add([bg, headerBg, topBar, catBadge, rarBadge, ...extraItems, sepGfx, nameText, descText])
    this._containers.push(container)

    // ── Entrance animation ────────────────────────────────────────────────────
    container.setAlpha(0).setY(cy + 22)
    this.tweens.add({
      targets: container, alpha: 1, y: cy,
      duration: 300, delay: idx * 80, ease: 'Back.easeOut',
    })

    // ── Hover ─────────────────────────────────────────────────────────────────
    bg.on('pointerover', () => {
      bg.setFillStyle(0x12122a).setStrokeStyle(2, rarityBorder, 1.0)
      headerBg.setFillStyle(0x16162e)
      this.tweens.add({ targets: container, scaleX: 1.03, scaleY: 1.03, duration: 90, ease: 'Quad.easeOut' })
    })
    bg.on('pointerout', () => {
      bg.setFillStyle(0x0a0a18).setStrokeStyle(1.5, rarityBorder, 0.9)
      headerBg.setFillStyle(0x0f0f22)
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 110, ease: 'Quad.easeOut' })
    })
    bg.on('pointerdown', () => this._choose(upg))
  }

  _choose(upgrade) {
    this._containers.forEach(c => c.getAt(0).removeInteractive())

    const last = this._containers.length - 1
    this._containers.forEach((c, i) => {
      this.tweens.add({
        targets: c, alpha: 0, y: c.y + 22,
        duration: 190, delay: i * 45, ease: 'Back.easeIn',
        onComplete: i === last ? () => {
          this.scene.get('GameScene').events.emit('upgrade-chosen', upgrade)
          this.scene.stop()
        } : undefined,
      })
    })
  }
}
