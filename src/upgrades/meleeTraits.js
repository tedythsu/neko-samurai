// src/upgrades/meleeTraits.js

export const MELEE_WEAPON_IDS = new Set(['tachi', 'ogi', 'kusarigama'])
export const SWING_WEAPON_IDS = new Set(['tachi', 'ogi'])

export const ALL_MELEE_TRAITS = [
  // ── Universal melee ────────────────────────────────────────────────────────
  {
    id: 'mt_range',
    name: '攻擊範圍 +20%',
    desc: '所有近戰武器攻擊範圍 +20%',
    oneTime: true,
    apply(stats) { if (stats.range != null) stats.range *= 1.2 },
  },
  {
    id: 'mt_deathburst',
    name: '死爆',
    desc: '擊殺時在60px範圍內爆炸，造成100%傷害',
    oneTime: true,
    apply(stats) { stats._deathBurst = true },
  },
  {
    id: 'mt_doom',
    name: '命運印記',
    desc: '命中後2秒，觸發60px死亡爆炸（1.5倍傷害）',
    oneTime: true,
    apply(stats) { stats._doom = true },
  },
  {
    id: 'mt_rapidvortex',
    name: '疾旋',
    desc: '周圍每有1個敵人，本次攻擊傷害+25%（最多+100%）',
    oneTime: true,
    apply(stats) { stats._rapidVortex = true },
  },
  {
    id: 'mt_afterimage',
    name: '殘像',
    desc: '攻擊結束後留下殘像傷害區（1s，0.5倍傷害）',
    oneTime: true,
    apply(stats) { stats._afterimage = true },
  },
  {
    id: 'mt_shockwave',
    name: '衝波',
    desc: '攻擊結束後放出擴張環，對經過的敵人造成0.5倍傷害',
    oneTime: true,
    apply(stats) { stats._shockwave = true },
  },
  // ── Swing-only (tachi + ogi) ───────────────────────────────────────────────
  {
    id: 'mt_charge',
    name: '蓄力',
    desc: '延遲300ms後揮砍，射程×2、傷害×1.5',
    oneTime: true,
    swingOnly: true,
    apply(stats) { stats._charge = true },
  },
  {
    id: 'mt_whirlwind',
    name: '旋風',
    desc: '揮砍期間旋轉360°，覆蓋全方位',
    oneTime: true,
    swingOnly: true,
    apply(stats) { stats._whirlwind = true },
  },
]
