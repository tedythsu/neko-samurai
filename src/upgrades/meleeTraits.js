// src/upgrades/meleeTraits.js

export const MELEE_WEAPON_IDS = new Set(['tachi', 'kusarigama'])
export const SWING_WEAPON_IDS = new Set(['tachi'])

export const ALL_MELEE_TRAITS = [
  // ── Universal melee ────────────────────────────────────────────────────────
  {
    id: 'mt_deathburst',
    name: '死爆',
    desc: '{weapon} 擊殺時在周圍爆炸',
    oneTime: true,
    apply(stats) { stats._deathBurst = true },
  },
  {
    id: 'mt_doom',
    name: '命運印記',
    desc: '{weapon} 命中後延遲觸發死亡爆炸',
    oneTime: true,
    apply(stats) { stats._doom = true },
  },
  {
    id: 'mt_shockwave',
    name: '衝波',
    desc: '{weapon} 攻擊後放出劍氣傷害周圍敵人',
    oneTime: true,
    apply(stats) { stats._shockwave = true },
  },
  // ── Swing-only (tachi) ─────────────────────────────────────────────────────
  {
    id: 'mt_cooldown',
    name: '迅刀',
    desc: '{weapon} 攻擊速度 +25%',
    oneTime: true,
    swingOnly: true,
    apply(stats) { stats.fireRate = Math.max(300, stats.fireRate * 0.75) },
  },
  {
    id: 'mt_doublestrike',
    name: '二刀連擊',
    desc: '{weapon} 命中時有機率立即再次揮斬',
    oneTime: true,
    swingOnly: true,
    apply(stats) { stats._doubleStrike = true },
  },
  {
    id: 'mt_charge',
    name: '蓄力',
    desc: '{weapon} 蓄力後揮砍，射程與傷害大幅提升',
    oneTime: true,
    swingOnly: true,
    apply(stats) { stats._charge = true },
  },
  {
    id: 'mt_whirlwind',
    name: '旋風',
    desc: '{weapon} 揮砍時旋轉360°，覆蓋全方位',
    oneTime: true,
    swingOnly: true,
    apply(stats) { stats._whirlwind = true },
  },
]
