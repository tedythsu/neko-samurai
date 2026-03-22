// src/upgrades/passives.js
// Passive utility upgrades — rarity: common / rare / epic
//
// maxStacks: N  → can be chosen up to N times; removed from pool when full
// oneTime: true → removed after first pick (no maxStacks)
// (neither)     → infinite-stack repeatable

export const ALL_PASSIVES = [

  // ─── Original passives ───────────────────────────────────────────────────
  {
    id: 'speed', name: '【神速・走位】', desc: '移動速度 +20%',
    rarity: 'common',
    apply: (player) => { player.speed *= 1.20 },
  },
  {
    id: 'defense', name: '【金剛・護體】', desc: '所有傷害降低 15%',
    rarity: 'common', oneTime: true,
    apply: (_p, scene) => { scene._defenseBonus = (scene._defenseBonus || 0) + 0.15 },
  },
  {
    id: 'aoe', name: '【靈力・擴張】', desc: '所有武器 AoE / 鎖鏈半徑 +25%',
    rarity: 'common', oneTime: true,
    apply: (_p, scene) => {
      for (const entry of scene._weapons || []) {
        if (entry.stats._explodeRadius != null) entry.stats._explodeRadius *= 1.25
        if (entry.stats.range          != null) entry.stats.range          *= 1.25
        if (entry.stats._orbitRadius   != null) entry.stats._orbitRadius   *= 1.25
      }
    },
  },
  {
    id: 'pickup', name: '【磁力・取物】', desc: '拾取半徑 +100%',
    rarity: 'common',
    apply: (_p, scene) => { scene._orbAttractRadius = (scene._orbAttractRadius || 130) * 2 },
  },
  {
    id: 'soul_drain', name: '【魂吸・奪命】', desc: '擊殺有 2% 機率回復 1 點生命值',
    rarity: 'common', oneTime: true,
    apply: (_p, scene) => { scene._soulDrain = true },
  },
  {
    id: 'daimyo', name: '【大名・増幅】', desc: '每升一級全傷害 +2%（疊加無上限）',
    rarity: 'common',
    apply: (_p, scene) => { scene._daimyoStacks = (scene._daimyoStacks || 0) + 1 },
  },

  // ─── Stackable stat reinforcements (maxStacks: 3) ────────────────────────
  {
    id: 'power_up', name: '【武魂‧剛力】', desc: '全局傷害 +20%（可疊 3 層）',
    rarity: 'common', maxStacks: 3,
    apply: (_p, scene) => { scene._globalDmgMult = (scene._globalDmgMult || 1) * 1.20 },
  },
  {
    id: 'crit_eye', name: '【隙見‧心眼】', desc: '爆擊率 +10%（可疊 3 層）',
    rarity: 'common', maxStacks: 3,
    apply: (_p, scene) => { scene._critBonus = (scene._critBonus || 0) + 0.10 },
  },
  {
    id: 'crit_blade', name: '【痛擊‧一刀】', desc: '爆擊傷害 +50%（可疊 3 層）',
    rarity: 'common', maxStacks: 3,
    apply: (_p, scene) => { scene._critDmgBonus = (scene._critDmgBonus || 0) + 0.50 },
  },
  {
    id: 'attack_spd', name: '【速斬‧無間】', desc: '攻擊頻率 +15%（可疊 3 層）',
    rarity: 'rare', maxStacks: 3,
    apply: (_p, scene) => { scene._attackSpeedMult = (scene._attackSpeedMult || 1) * 1.15 },
  },
  {
    id: 'armor_pen', name: '【破甲‧貫穿】', desc: '無視敵人 20% 防禦（可疊 3 層）',
    rarity: 'rare', maxStacks: 3,
    apply: (_p, scene) => { scene._armorPen = (scene._armorPen || 0) + 0.20 },
  },
  {
    id: 'vitality', name: '【頑強‧不屈】', desc: '最大生命 +30%（可疊 3 層）',
    rarity: 'common', maxStacks: 3,
    apply: (player) => { player.maxHp *= 1.30; player.heal(player.maxHp * 0.10) },
  },
  {
    id: 'ailment_dur', name: '【長久‧咒印】', desc: '元素異常持續時間 +50%（可疊 3 層）',
    rarity: 'rare', maxStacks: 3,
    apply: (_p, scene) => { scene._ailmentDurMult = (scene._ailmentDurMult || 1) * 1.50 },
  },
  {
    id: 'swift', name: '【靈動‧疾風】', desc: '移速 +10%、投射物速度 +10%（可疊 3 層）',
    rarity: 'common', maxStacks: 3,
    apply: (player, scene) => {
      player.speed *= 1.10
      scene._projSpeedMult = (scene._projSpeedMult || 1) * 1.10
    },
  },

  // ─── Tactical / utility (oneTime) ────────────────────────────────────────
  {
    id: 'first_strike', name: '【拔刀・一閃】', desc: '對滿血敵人必定爆擊，且傷害翻倍',
    rarity: 'rare', oneTime: true,
    apply: (_p, scene) => { scene._firstStrikeCrit = true },
  },
  {
    id: 'shadow_dodge', name: '【影分身・閃】', desc: '移動時有 15% 機率使碰撞傷害無效',
    rarity: 'rare', oneTime: true,
    apply: (_p, scene) => { scene._shadowDodge = true },
  },
  {
    id: 'crit_soul', name: '【處決‧魂吸】', desc: '所有擊殺掉落的經驗球價值翻倍',
    rarity: 'rare', oneTime: true,
    apply: (_p, scene) => { scene._critKillXpMult = 2 },
  },
  {
    id: 'substitution', name: '【替身術】', desc: '致死傷害時無效化一次（冷卻 60s）',
    rarity: 'epic', oneTime: true,
    apply: (_p, scene) => { scene._substitutionReady = true; scene._substitutionCd = 0 },
  },
  {
    id: 'fury', name: '【憤怒‧反擊】', desc: '血量低於 30% 時傷害 +50%、擊退翻倍',
    rarity: 'epic', oneTime: true,
    apply: (_p, scene) => { scene._furyMode = true },
  },
  {
    id: 'caltrops', name: '【忍具‧菱釘】', desc: '每 3 秒在腳下撒菱釘，敵人踩中緩速 50% 並受傷',
    rarity: 'rare', oneTime: true,
    apply: (_p, scene) => { scene._caltrops = true; scene._caltropTimer = 0 },
  },
  {
    id: 'steady_stance', name: '【防禦‧姿態】', desc: '站立不動時受到傷害降低 40%',
    rarity: 'rare', oneTime: true,
    apply: (_p, scene) => { scene._steadyStance = true },
  },
  {
    id: 'cooldown_cut', name: '【冷卻‧縮減】', desc: '所有觸發技能冷卻時間縮短 20%',
    rarity: 'common', oneTime: true,
    apply: (_p, scene) => { scene._cdMult = (scene._cdMult || 1) * 0.80 },
  },
  {
    id: 'xp_hunger', name: '【經驗‧渴望】', desc: '經驗獲取 +15%，但敵人跑速 +5%',
    rarity: 'common', oneTime: true,
    apply: (_p, scene) => {
      scene._xpMult        = (scene._xpMult        || 1) * 1.15
      scene._enemySpeedBuff = (scene._enemySpeedBuff || 1) * 1.05
    },
  },
  {
    id: 'daimyo_tax', name: '【大名‧徵稅】', desc: '每獲得 100 XP，全傷害永久 +1%',
    rarity: 'rare', oneTime: true,
    apply: (_p, scene) => { scene._daimyoTax = true },
  },
  {
    id: 'ki_blast', name: '【空振‧氣勁】', desc: '近戰攻擊末端發出氣勁，距離翻倍但傷害減半',
    rarity: 'rare', oneTime: true,
    requiresWeapons: ['tachi'],   // melee swing only
    apply: (_p, scene) => { scene._kiBlast = true },
  },
  {
    id: 'ricochet_arc', name: '【折射‧弧刃】', desc: '投射物在螢幕邊緣反彈一次',
    rarity: 'rare', oneTime: true,
    requiresWeapons: ['kunai', 'shuriken', 'homura'],   // projectile only
    apply: (_p, scene) => { scene._ricochetWall = true },
  },
  {
    id: 'second_split', name: '【分裂‧二次】', desc: '分裂子彈命中後再次分裂為兩枚微型子彈',
    rarity: 'epic', oneTime: true,
    requiresWeapons: ['kunai', 'shuriken'],   // multi-projectile weapons only
    apply: (_p, scene) => { scene._secondSplit = true },
  },
]
