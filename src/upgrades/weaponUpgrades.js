// src/upgrades/weaponUpgrades.js
// Per-weapon upgrades — 4 unique enhancements per weapon, all oneTime, rarity: 'rare'

export const WEAPON_UPGRADES_MAP = {
  tachi: [
    {
      id: 'tachi_wide',
      name: '【斬鐵・廣域】',
      desc: '攻擊半徑與扇形角度增加 40%',
      rarity: 'rare',
      oneTime: true,
      apply(stats) {
        stats.range   *= 1.4
        stats._arcMult = (stats._arcMult || 1) * 1.4
      },
    },
    {
      id: 'tachi_chain',
      name: '【極意・連斬】',
      desc: '每次攻擊有 20% 機率觸發第二次斬擊，連斬瞬間獲得 20% 減傷',
      rarity: 'rare',
      oneTime: true,
      apply(stats) {
        stats._doubleStrike       = true
        stats._doubleStrikeChance = 0.20
        stats._comboGuard         = 0.20
      },
    },
    {
      id: 'tachi_windblade',
      name: '【鐮鼬・真空】',
      desc: '揮砍時發出 3 道穿透風刃',
      rarity: 'rare',
      oneTime: true,
      apply(stats) { stats._windBlade = true },
    },
    {
      id: 'tachi_knockback',
      name: '【血風・重擊】',
      desc: '攻擊附帶極高擊退，強制推開貼身怪群',
      rarity: 'rare',
      oneTime: true,
      apply(stats) { stats.knockback = (stats.knockback || 120) * 3 },
    },
  ],

  kunai: [
    {
      id: 'kunai_multi',
      name: '【影分身・量】',
      desc: '額外增加 2 個投射物（扇形發射）',
      rarity: 'rare',
      oneTime: true,
      apply(stats) { stats.projectileCount = (stats.projectileCount || 1) + 2 },
    },
    {
      id: 'kunai_homing',
      name: '【咒印・自動】',
      desc: '苦無自動轉向飛行，優先攻擊最近的敵人',
      rarity: 'rare',
      oneTime: true,
      apply(stats) { stats._homing = true },
    },
    {
      id: 'kunai_pierce',
      name: '【穿雲・貫通】',
      desc: '苦無可穿透 3 個目標，每穿透一個目標傷害提升 10%',
      rarity: 'rare',
      oneTime: true,
      apply(stats) {
        stats.penetrate    = true
        stats._pierceBonus = 0.10
        stats._pierceMax   = 3
      },
    },
    {
      id: 'kunai_stun',
      name: '【影縫・定身】',
      desc: '命中時 40% 機率使怪物「原地停止」1 秒',
      rarity: 'rare',
      oneTime: true,
      apply(stats) { stats._stun = true },
    },
  ],

  shuriken: [
    {
      id: 'shuriken_boomerang',
      name: '【回旋・歸刃】',
      desc: '命中敵人或到達射程終點後，原路飛回並造成二次傷害',
      rarity: 'rare',
      oneTime: true,
      apply(stats) { stats._boomerang = true },
    },
    {
      id: 'shuriken_chain',
      name: '【彈跳・亂舞】',
      desc: '命中後自動彈向附近目標，最多彈射 3 次',
      rarity: 'rare',
      oneTime: true,
      apply(stats) {
        stats._ricochet    = true
        stats._ricochetMax = 3
      },
    },
    {
      id: 'shuriken_linger',
      name: '【回天・滯留】',
      desc: '到達終點後在原地旋轉 1.5 秒，形成短暫傷害牆',
      rarity: 'rare',
      oneTime: true,
      apply(stats) { stats._lingerZone = true },
    },
    {
      id: 'shuriken_omni',
      name: '【六道・全周】',
      desc: '手裏劍化為環身刃陣，持續繞行角色周圍並切割靠近的敵人',
      rarity: 'rare',
      oneTime: true,
      apply(stats) {
        stats._omni = true
        stats.fireRate = 0
        stats._orbitRadius = 92
      },
    },
  ],

  homura: [
    {
      id: 'homura_burnfield',
      name: '【業火・殘留】',
      desc: '爆炸後留下燃燒火海 2.5 秒，持續灼燒範圍內敵人',
      rarity: 'rare',
      oneTime: true,
      apply(stats) { stats._scorch = true },
    },
    {
      id: 'homura_pierceburst',
      name: '【貫穿・連爆】',
      desc: '箭矢最多穿透 3 個目標，且每次穿透都觸發一次小爆炸',
      rarity: 'rare',
      oneTime: true,
      apply(stats) {
        stats.penetrate     = true
        stats._pierceMax    = 3
        stats._chainExplode = true
      },
    },
    {
      id: 'homura_gravity',
      name: '【陰陽・黑洞】',
      desc: '爆炸中心產生微型引力場，將怪往中心吸入',
      rarity: 'rare',
      oneTime: true,
      apply(stats) { stats._gravity = true },
    },
    {
      id: 'homura_doubleburst',
      name: '【連爆・擴散】',
      desc: '爆炸範圍 +35%，且有 25% 機率在原位引發二次爆炸',
      rarity: 'rare',
      oneTime: true,
      apply(stats) {
        stats._explodeRadius = (stats._explodeRadius || 80) * 1.35
        stats._secondBurst   = true
      },
    },
  ],

  kusarigama: [
    {
      id: 'kusa_arc',
      name: '【雷獄・連結】',
      desc: '鎖鎌間產生電弧，自動電擊進入旋轉範圍的怪',
      rarity: 'rare',
      oneTime: true,
      apply(stats) { stats._arcLightning = true },
    },
    {
      id: 'kusa_radius',
      name: '【不動・重力】',
      desc: '鎖鎌半徑增大，並附帶強力擊退效果',
      rarity: 'rare',
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
      rarity: 'rare',
      oneTime: true,
      apply(stats) { stats._deflect = true },
    },
    {
      id: 'kusa_heavyball',
      name: '【重鎚・碎裂】',
      desc: '鎖鎌末端增加重型鐵球，造成範圍粉碎傷害與翻倍擊退',
      rarity: 'rare',
      oneTime: true,
      apply(stats) { stats._heavyBall = true },
    },
  ],
}
