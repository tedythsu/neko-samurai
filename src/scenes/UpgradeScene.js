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

const RES      = Math.min(2, Math.ceil(window?.devicePixelRatio || 1))
const SERIF_JP = '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif'
const CINZEL   = '"Cinzel", "Palatino Linotype", serif'

export default class UpgradeScene extends Phaser.Scene {
  constructor() { super('UpgradeScene') }

  init(data) {
    this._level      = data.level
    this._upgrades   = data.upgrades
    this._mode       = data.mode || 'normal'
    this._weaponName = data.weaponName || ''
  }

  create() {
    if (this._mode === 'weapon_branch') {
      this._createWeaponBranchUI()
    } else {
      this._createNormalUI()
    }
  }

  // ── Normal upgrade UI (3 cards) ─────────────────────────────────────────────
  _createNormalUI() {
    const { width: W, height: H } = this.cameras.main
    const isLegendary = this._mode === 'legendary_milestone'

    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.82)

    const gfx = this.add.graphics()
    const lineColor = isLegendary ? 0xcc8800 : 0xb8943f
    gfx.lineStyle(1, lineColor, 0.30)
    gfx.lineBetween(Math.round(W * 0.06), Math.round(H * 0.17), Math.round(W * 0.94), Math.round(H * 0.17))
    gfx.lineBetween(Math.round(W * 0.06), Math.round(H * 0.88), Math.round(W * 0.94), Math.round(H * 0.88))

    const titleColor = isLegendary ? '#ffaa00' : '#c8a84b'
    const subtitle   = isLegendary ? '傳奇顯現・命運交匯' : '選擇強化'

    this.add.text(Math.round(W / 2), Math.round(H * 0.08), `Level  ${this._level}`, {
      fontSize: '34px', color: titleColor,
      fontFamily: CINZEL, fontStyle: 'bold',
      stroke: '#2a1800', strokeThickness: 4,
    }).setOrigin(0.5).setResolution(RES)

    this.add.text(Math.round(W / 2), Math.round(H * 0.145), subtitle, {
      fontSize: '13px', color: isLegendary ? '#9a7a30' : '#7a6e52',
      fontFamily: SERIF_JP,
    }).setOrigin(0.5).setResolution(RES)

    const GAP    = 14
    const MARGIN = Math.round(W * 0.04)
    const cardW  = Math.round((W - MARGIN * 2 - GAP * 2) / 3)
    const cardY  = Math.round(H / 2 + H * 0.02)

    this._containers = []
    this._upgrades.forEach((upg, i) => {
      const cx = Math.round(MARGIN + cardW / 2 + i * (cardW + GAP))
      this._buildCard(cx, cardY, cardW, upg, i, false)
    })
  }

  // ── Weapon Branch UI (2 cards, crimson theme, normal header) ──────────────
  _createWeaponBranchUI() {
    const { width: W, height: H } = this.cameras.main

    // Slightly darker overlay for drama
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.88)

    // Crimson border lines
    const gfx = this.add.graphics()
    gfx.lineStyle(2, 0xaa1122, 0.7)
    gfx.lineBetween(Math.round(W * 0.06), Math.round(H * 0.17), Math.round(W * 0.94), Math.round(H * 0.17))
    gfx.lineBetween(Math.round(W * 0.06), Math.round(H * 0.88), Math.round(W * 0.94), Math.round(H * 0.88))
    // Gold inner lines
    gfx.lineStyle(1, 0xb8943f, 0.22)
    gfx.lineBetween(Math.round(W * 0.06), Math.round(H * 0.185), Math.round(W * 0.94), Math.round(H * 0.185))
    gfx.lineBetween(Math.round(W * 0.06), Math.round(H * 0.865), Math.round(W * 0.94), Math.round(H * 0.865))

    // Same header as normal upgrade
    this.add.text(Math.round(W / 2), Math.round(H * 0.08), `Level  ${this._level}`, {
      fontSize: '34px', color: '#c8a84b',
      fontFamily: CINZEL, fontStyle: 'bold',
      stroke: '#2a1800', strokeThickness: 4,
    }).setOrigin(0.5).setResolution(RES)

    this.add.text(Math.round(W / 2), Math.round(H * 0.145), '選擇強化', {
      fontSize: '13px', color: '#7a6e52',
      fontFamily: SERIF_JP,
    }).setOrigin(0.5).setResolution(RES)

    // 2 cards — centered, wider since only two
    const GAP    = 20
    const cardW  = Math.round(Math.min(310, (W - 100) / 2))
    const totalW = cardW * 2 + GAP
    const cardY  = Math.round(H / 2 + H * 0.02)

    this._containers = []
    this._upgrades.forEach((upg, i) => {
      const cx = Math.round(W / 2 - totalW / 2 + cardW / 2 + i * (cardW + GAP))
      this._buildCard(cx, cardY, cardW, upg, i, true)
    })
  }

  // ── Card builder ─────────────────────────────────────────────────────────────
  _buildCard(cx, cy, w, upg, idx, isWeaponBranch) {
    const cat = CATEGORY[upg.target] || CATEGORY.passive
    let accent = cat.color
    if (upg.target === 'elemental' && upg.elemental) {
      accent = ELEMENTAL_COLOR[upg.elemental.id] ?? cat.color
    }
    // Weapon branch: all cards share the weapon gold accent
    if (isWeaponBranch) accent = 0xc8a84b

    const rui          = RARITY_UI[upg.rarity] || RARITY_UI.common
    const rarityBorder = isWeaponBranch ? 0xaa3300 : rui.border

    // ── Measure text ──────────────────────────────────────────────────────────
    const CONTENT_W  = w - 28
    const HEADER_H   = isWeaponBranch ? 36 : 44
    const NAME_PAD   = 10
    const SEP_PAD    = 8
    const DESC_PAD   = 8
    const BOTTOM_PAD = isWeaponBranch ? 14 : 16

    const tmpName = this.add.text(-9999, -9999, upg.name, {
      fontSize: isWeaponBranch ? '13px' : '14px',
      fontFamily: SERIF_JP, fontStyle: 'bold',
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

    const NAME_Y = HEADER_H + NAME_PAD
    const SEP_Y  = NAME_Y + nameH + SEP_PAD
    const DESC_Y = SEP_Y + SEP_PAD
    const minH   = isWeaponBranch ? 200 : 220
    const h      = Math.max(minH, DESC_Y + descH + BOTTOM_PAD)
    const halfH  = Math.round(h / 2)
    const halfW  = Math.round(w / 2)

    const container = this.add.container(cx, cy)

    // Background
    const bgFill = isWeaponBranch ? 0x0d0508 : 0x0a0a18
    const bg = this.add.rectangle(0, 0, w, h, bgFill)
      .setStrokeStyle(1.5, rarityBorder, 0.9)
      .setInteractive()

    // Header band
    const headerFill = isWeaponBranch ? 0x140808 : 0x0f0f22
    const headerBg = this.add.rectangle(0, -halfH + Math.round(HEADER_H / 2), w, HEADER_H, headerFill, 1)

    // Top accent bar
    const topBar = this.add.rectangle(0, -halfH + 1, w, isWeaponBranch ? 4 : 3, accent, isWeaponBranch ? 1.0 : 0.9)

    // For weapon branch: ornamental bottom bar
    const extraDeco = []
    if (isWeaponBranch) {
      const bottomBar = this.add.rectangle(0, halfH - 1, w, 2, 0xaa3300, 0.6)
      extraDeco.push(bottomBar)
    }

    // Badges
    const catLabel = isWeaponBranch ? '武器技・稀有' : cat.label
    const catColor = isWeaponBranch ? '#c8a84b' : cat.text
    const catBadge = this.add.text(
      Math.round(-halfW + 10), Math.round(-halfH + 8),
      catLabel,
      {
        fontSize: '10px', color: catColor,
        fontFamily: SERIF_JP, fontStyle: 'bold',
        backgroundColor: '#00000066', padding: { x: 3, y: 2 },
      }
    ).setOrigin(0, 0).setResolution(RES)

    const rarBadge = isWeaponBranch ? null : this.add.text(
      Math.round(halfW - 10), Math.round(-halfH + 8),
      rui.label,
      {
        fontSize: '10px', color: rui.text,
        fontFamily: SERIF_JP, fontStyle: 'bold',
        backgroundColor: '#00000066', padding: { x: 3, y: 2 },
      }
    ).setOrigin(1, 0).setResolution(RES)

    // Stack pip (normal mode only)
    const stackItems = []
    if (!isWeaponBranch && upg.stackMax != null) {
      const nextStack = (upg.stackCur || 0) + 1
      const pip = this.add.text(
        Math.round(halfW - 10), Math.round(-halfH + 26),
        `Lv ${nextStack} / ${upg.stackMax}`,
        {
          fontSize: '10px', color: '#88ddcc',
          fontFamily: CINZEL,
          backgroundColor: '#08152066', padding: { x: 3, y: 1 },
        }
      ).setOrigin(1, 0).setResolution(RES)
      stackItems.push(pip)
    }

    // Separator
    const sepGfx = this.add.graphics()
    sepGfx.lineStyle(1, accent, isWeaponBranch ? 0.50 : 0.35)
    sepGfx.lineBetween(
      Math.round(-halfW + 12), Math.round(-halfH + SEP_Y),
      Math.round(halfW - 12),  Math.round(-halfH + SEP_Y)
    )

    // Name
    const nameFontSize = isWeaponBranch ? '13px' : '14px'
    const nameColor    = isWeaponBranch ? '#f5e8c0' : '#ede4cc'
    const nameText = this.add.text(
      Math.round(-halfW + 14), Math.round(-halfH + NAME_Y),
      upg.name,
      {
        fontSize: nameFontSize, color: nameColor,
        fontFamily: SERIF_JP, fontStyle: 'bold',
        wordWrap: { width: CONTENT_W, useAdvancedWrap: true },
      }
    ).setOrigin(0, 0).setResolution(RES)

    // Description
    const descColor = isWeaponBranch ? '#d8d0e0' : '#c8c0d0'
    const descText = this.add.text(
      Math.round(-halfW + 14), Math.round(-halfH + DESC_Y),
      upg.desc || '',
      {
        fontSize: '12px', color: descColor,
        fontFamily: SERIF_JP,
        wordWrap: { width: CONTENT_W, useAdvancedWrap: true },
        lineSpacing: 4,
      }
    ).setOrigin(0, 0).setResolution(RES)

    const items = [bg, headerBg, topBar, ...extraDeco, catBadge,
                   ...(rarBadge ? [rarBadge] : []), ...stackItems,
                   sepGfx, nameText, descText]
    container.add(items)
    this._containers.push(container)

    // Entrance animation
    if (isWeaponBranch) {
      // Weapon branch: dramatic scale-in from center
      container.setAlpha(0).setScale(0.88)
      this.tweens.add({
        targets: container, alpha: 1, scaleX: 1, scaleY: 1,
        duration: 340, delay: idx * 70, ease: 'Back.easeOut',
      })
    } else {
      container.setAlpha(0).setY(cy + 22)
      this.tweens.add({
        targets: container, alpha: 1, y: cy,
        duration: 300, delay: idx * 80, ease: 'Back.easeOut',
      })
    }

    // Hover
    bg.on('pointerover', () => {
      const hoverFill = isWeaponBranch ? 0x1a0a0c : 0x12122a
      bg.setFillStyle(hoverFill).setStrokeStyle(2, rarityBorder, 1.0)
      headerBg.setFillStyle(isWeaponBranch ? 0x201010 : 0x16162e)
      this.tweens.add({ targets: container, scaleX: 1.03, scaleY: 1.03, duration: 90, ease: 'Quad.easeOut' })
    })
    bg.on('pointerout', () => {
      bg.setFillStyle(bgFill).setStrokeStyle(1.5, rarityBorder, 0.9)
      headerBg.setFillStyle(headerFill)
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 110, ease: 'Quad.easeOut' })
    })
    bg.on('pointerdown', () => this._choose(upg))
  }

  // ── Choose ────────────────────────────────────────────────────────────────
  _choose(upgrade) {
    this._containers.forEach(c => c.getAt(0).removeInteractive())

    // Same exit animation for all modes
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
