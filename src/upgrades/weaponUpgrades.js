// src/upgrades/weaponUpgrades.js
// Per-weapon upgrades — 4 unique enhancements per weapon, all oneTime

export const WEAPON_UPGRADES_MAP = {
  tachi: [
    {
      id: 'tachi_wide',
      name: '【斬鐵・廣域】',
      desc: '攻擊半徑與扇形角度增加 40%',
      oneTime: true,
      apply(stats) {
        stats.range   *= 1.4
        stats._arcMult = (stats._arcMult || 1) * 1.4
      },
    },
    {
      id: 'tachi_chain',
      name: '【極意・連斬】',
      desc: '每次攻擊有 25% 機率觸發第二次斬擊，連斬瞬間獲得 20% 減傷',
      oneTime: true,
      apply(stats) {
        stats._doubleStrike       = true
        stats._doubleStrikeChance = 0.25
        stats._comboGuard         = 0.20
      },
    },
    {
      id: 'tachi_windblade',
      name: '【鐮鼬・真空】',
      desc: '揮砍時發出 3 道穿透風刃，解決近戰手短問題',
      oneTime: true,
      apply(stats) { stats._windBlade = true },
    },
    {
      id: 'tachi_knockback',
      name: '【血風・重擊】',
      desc: '攻擊附帶極高擊退，強制推開貼身怪群',
      oneTime: true,
      apply(stats) { stats.knockback = (stats.knockback || 120) * 3 },
    },
  ],

  kunai: [
    {
      id: 'kunai_multi',
      name: '【影分身・量】',
      desc: '額外增加 2 個投射物（平行發射）',
      oneTime: true,
      apply(stats) { stats.projectileCount = (stats.projectileCount || 1) + 2 },
    },
    {
      id: 'kunai_homing',
      name: '【咒印・自動】',
      desc: '苦無自動轉向飛行，優先攻擊最近的敵人',
      oneTime: true,
      apply(stats) { stats._homing = true },
    },
    {
      id: 'kunai_pierce',
      name: '【穿雲・貫通】',
      desc: '苦無可穿透 3 個目標，每穿透一個目標傷害提升 15%',
      oneTime: true,
      apply(stats) {
        stats.penetrate    = true
        stats._pierceBonus = 0.15
        stats._pierceMax   = 3
      },
    },
    {
      id: 'kunai_stun',
      name: '【影縫・定身】',
      desc: '命中時 40% 機率使怪物「原地停止」1 秒',
      oneTime: true,
      apply(stats) { stats._stun = true },
    },
  ],

  shuriken: [
    {
      id: 'shuriken_boomerang',
      name: '【回旋・歸刃】',
      desc: '到達射程終點後原路飛回，造成二次傷害',
      oneTime: true,
      apply(stats) { stats._boomerang = true },
    },
    {
      id: 'shuriken_chain',
      name: '【彈跳・亂舞】',
      desc: '命中後自動彈向附近目標，最多彈射 4 次',
      oneTime: true,
      apply(stats) {
        stats._ricochet    = true
        stats._ricochetMax = 4
      },
    },
    {
      id: 'shuriken_linger',
      name: '【回天・滯留】',
      desc: '到達終點後在原地旋轉 1.5 秒，形成短暫傷害牆',
      oneTime: true,
      apply(stats) { stats._lingerZone = true },
    },
    {
      id: 'shuriken_omni',
      name: '【六道・全周】',
      desc: '向角色四周 360° 均勻發射，防止被包圍',
      oneTime: true,
      apply(stats) { stats._omni = true },
    },
  ],

  homura: [
    {
      id: 'homura_burnfield',
      name: '【業火・殘留】',
      desc: '爆炸後留下燃燒火海 3 秒，對衝鋒怪造成持續傷害',
      oneTime: true,
      apply(stats) { stats._scorch = true },
    },
    {
      id: 'homura_pierceburst',
      name: '【貫穿・連爆】',
      desc: '箭矢穿透每個目標時都觸發一次小爆炸',
      oneTime: true,
      apply(stats) {
        stats.penetrate     = true
        stats._chainExplode = true
      },
    },
    {
      id: 'homura_gravity',
      name: '【陰陽・黑洞】',
      desc: '爆炸中心產生微型引力場，將怪往中心吸入',
      oneTime: true,
      apply(stats) { stats._gravity = true },
    },
    {
      id: 'homura_doubleburst',
      name: '【連爆・擴散】',
      desc: '爆炸範圍 +50%，且有 30% 機率在原位引發二次爆炸',
      oneTime: true,
      apply(stats) {
        stats._explodeRadius = (stats._explodeRadius || 80) * 1.5
        stats._secondBurst   = true
      },
    },
  ],

  kusarigama: [
    {
      id: 'kusa_arc',
      name: '【雷獄・連結】',
      desc: '鎖鏈間產生電弧，自動電擊進入旋轉範圍的怪',
      oneTime: true,
      apply(stats) { stats._arcLightning = true },
    },
    {
      id: 'kusa_radius',
      name: '【不動・重力】',
      desc: '鎖鏈半徑增大，並附帶強力擊退效果',
      oneTime: true,
      apply(stats) {
        stats._orbitRadius  = (stats._orbitRadius || 80) * 1.5
        stats._aoeKnockback = true
      },
    },
    {
      id: 'kusa_deflect',
      name: '【不壞・化勁】',
      desc: '旋轉時產生護盾氣場，週期性強力擊退貼近的怪',
      oneTime: true,
      apply(stats) { stats._deflect = true },
    },
    {
      id: 'kusa_heavyball',
      name: '【重鎚・碎裂】',
      desc: '鎖鏈末端增加重型鐵球，造成範圍粉碎傷害與翻倍擊退',
      oneTime: true,
      apply(stats) { stats._heavyBall = true },
    },
  ],
}
