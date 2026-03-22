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
    id: 'aoe', name: '【靈力・擴張】', desc: '範圍型效果半徑 +25%',
    rarity: 'common', oneTime: true,
    apply: (_p, scene) => {
      for (const entry of scene._weapons || []) {
        if (entry.stats._explodeRadius != null) entry.stats._explodeRadius *= 1.25
        if (entry.stats._orbitRadius   != null) entry.stats._orbitRadius   *= 1.25
        if (entry.stats._lingerRadius  != null) entry.stats._lingerRadius  *= 1.25
        if (entry.stats._gravityRadius != null) entry.stats._gravityRadius *= 1.25
      }
    },
  },
  {
    id: 'soul_drain', name: '【魂吸・奪命】', desc: '擊殺有 2% 機率回復 1 點生命值',
    rarity: 'common', oneTime: true,
    apply: (_p, scene) => { scene._soulDrain = true },
  },
  {
    id: 'daimyo', name: '【大名・増幅】', desc: '每升一級全傷害 +5%',
    rarity: 'common', oneTime: true,
    apply: (_p, scene) => { scene._daimyoStacks = (scene._daimyoStacks || 0) + 1 },
  },

  // ─── Stackable stat reinforcements (maxStacks: 3) ────────────────────────
  {
    id: 'power_up', name: '【武魂‧剛力】', desc: '全局傷害 +18%（可疊 2 層）',
    rarity: 'common', maxStacks: 2,
    apply: (_p, scene) => { scene._globalDmgMult = (scene._globalDmgMult || 1) * 1.18 },
  },
  {
    id: 'crit_eye', name: '【隙見‧心眼】', desc: '爆擊率 +8%（可疊 2 層）',
    rarity: 'common', maxStacks: 2,
    apply: (_p, scene) => { scene._critBonus = (scene._critBonus || 0) + 0.08 },
  },
  {
    id: 'crit_blade', name: '【痛擊‧一刀】', desc: '爆擊傷害 +35%（可疊 2 層）',
    rarity: 'common', maxStacks: 2,
    apply: (_p, scene) => { scene._critDmgBonus = (scene._critDmgBonus || 0) + 0.35 },
  },
  {
    id: 'attack_spd', name: '【速斬‧無間】', desc: '攻擊頻率 +12%（可疊 2 層）',
    rarity: 'rare', maxStacks: 2,
    apply: (_p, scene) => { scene._attackSpeedMult = (scene._attackSpeedMult || 1) * 1.12 },
  },
  {
    id: 'armor_pen', name: '【破甲‧貫穿】', desc: '無視敵人 12% 防禦（可疊 2 層）',
    rarity: 'rare', maxStacks: 2,
    apply: (_p, scene) => { scene._armorPen = (scene._armorPen || 0) + 0.12 },
  },
  {
    id: 'vitality', name: '【頑強‧不屈】', desc: '最大生命 +30%（可疊 3 層）',
    rarity: 'common', maxStacks: 3,
    apply: (player) => { player.maxHp *= 1.30; player.heal(player.maxHp * 0.10) },
  },
  {
    id: 'ailment_dur', name: '【長久‧咒印】', desc: '異常、標記與持續效果時間 +30%（可疊 2 層）',
    rarity: 'rare', maxStacks: 2,
    apply: (_p, scene) => { scene._ailmentDurMult = (scene._ailmentDurMult || 1) * 1.30 },
  },
  {
    id: 'swift', name: '【靈動‧疾風】', desc: '移速 +8%、投射物速度 +8%（可疊 2 層）',
    rarity: 'common', maxStacks: 2,
    apply: (player, scene) => {
      player.speed *= 1.08
      scene._projSpeedMult = (scene._projSpeedMult || 1) * 1.08
    },
  },

  // ─── Tactical / utility (oneTime) ────────────────────────────────────────
  {
    id: 'first_strike', name: '【拔刀・一閃】', desc: '對滿血敵人必定爆擊，且本次傷害額外 +35%',
    rarity: 'rare', oneTime: true,
    apply: (_p, scene) => { scene._firstStrikeCrit = true },
  },
  {
    id: 'shadow_dodge', name: '【影分身・閃】', desc: '移動時會週期性留下爆裂殘影；碰撞時有 40% 機率閃避並立刻觸發更強殘影，觸發後短暫加速',
    rarity: 'rare', oneTime: true,
    apply: (_p, scene) => { scene._shadowDodge = true; scene._shadowCloneTimer = 0 },
  },
  {
    id: 'crit_soul', name: '【處決‧魂吸】', desc: '爆擊擊殺時，掉落的經驗球價值 +80%',
    rarity: 'rare', oneTime: true,
    apply: (_p, scene) => { scene._critSoul = true },
  },
  {
    id: 'substitution', name: '【替身術】', desc: '致死傷害改為留下替身，回復 20% 最大生命並獲得 1.5 秒無敵（冷卻 45 秒）',
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
    id: 'steady_stance', name: '【流轉‧見切】', desc: '持續移動時受傷 -20%，且造成傷害 +8%',
    rarity: 'rare', oneTime: true,
    apply: (_p, scene) => { scene._steadyStance = true },
  },
  {
    id: 'cooldown_cut', name: '【冷卻‧縮減】', desc: '戰吼、菱釘、兵糧丸、月讀、替身術冷卻縮短 30%',
    rarity: 'common', oneTime: true,
    apply: (_p, scene) => { scene._cdMult = (scene._cdMult || 1) * 0.70 },
  },
  {
    id: 'ki_blast', name: '【間合‧極】', desc: '太刀在刀尖命中時傷害 +25%，且擊退略微提升',
    rarity: 'rare', oneTime: true,
    requiresWeapons: ['tachi'],   // melee swing only
    apply: (_p, scene) => { scene._tachiMaai = true },
  },
  {
    id: 'ricochet_arc', name: '【折射‧弧刃】', desc: '投射物首次碰到場地邊緣時反彈一次',
    rarity: 'rare', oneTime: true,
    requiresWeapons: ['kunai', 'shuriken', 'homura'],   // projectile only
    apply: (_p, scene) => { scene._ricochetWall = true },
  },
  {
    id: 'second_split', name: '【分裂‧二次】', desc: '苦無與手裏劍命中後分裂出兩枚微型彈',
    rarity: 'epic', oneTime: true,
    requiresWeapons: ['kunai', 'shuriken'],   // multi-projectile weapons only
    apply: (_p, scene) => { scene._secondSplit = true },
  },
  {
    id: 'toxicology', name: '【毒傷‧見切】', desc: '對中毒或流血的敵人造成傷害 +16%',
    rarity: 'rare', oneTime: true,
    apply: (_p, scene) => { scene._ailmentExpose = true },
  },
  {
    id: 'blood_rush', name: '【血狩‧疾走】', desc: '擊殺中毒或流血的敵人時，3 秒內移速與攻擊頻率 +12%',
    rarity: 'rare', oneTime: true,
    apply: (_p, scene) => { scene._bloodRush = true },
  },
  {
    id: 'weakpoint_focus', name: '【弱點‧收束】', desc: '對同一目標連續命中時，使其後續 3 秒承受更多傷害',
    rarity: 'rare', oneTime: true,
    apply: (_p, scene) => { scene._weakpointFocus = true },
  },
  {
    id: 'pathogen_spread', name: '【病灶‧擴散】', desc: '異常目標死亡時，把部分剩餘持續時間傳給最近敵人',
    rarity: 'epic', oneTime: true,
    apply: (_p, scene) => { scene._pathogenSpread = true },
  },

  // ─── Trigger Passives (formerly procs) ───────────────────────────────────
  {
    id: 'war_cry', name: '【戰吼・威壓】', desc: '每 5 秒自動發出震波，強力推開身邊怪物，並使其 4 秒內更容易受創',
    rarity: 'epic', oneTime: true, minLevel: 5, subtype: 'proc',
  },
  {
    id: 'thorns', name: '【棘甲・反震】', desc: '怪物碰撞玩家時，反彈 300% 傷害並強制擊退',
    rarity: 'epic', oneTime: true, minLevel: 5, subtype: 'proc',
  },
  {
    id: 'life_leech', name: '【血祭・吸取】', desc: '造成傷害的 1% 轉化為生命',
    rarity: 'epic', oneTime: true, minLevel: 5, subtype: 'proc',
  },
  {
    id: 'sanctuary_aura', name: '【聖域・靈光】', desc: '腳下產生圓圈，範圍內怪物移速降低 30%，半徑隨等級成長',
    rarity: 'epic', oneTime: true, minLevel: 5, subtype: 'proc',
  },
  {
    id: 'soul_burst', name: '【魂之爆發】', desc: '每擊殺 45 隻敵人，觸發全畫面衝擊波，震飛並傷害所有怪物',
    rarity: 'epic', oneTime: true, minLevel: 5, subtype: 'proc',
  },
  {
    id: 'ration', name: '【兵糧丸・回氣】', desc: '每 20 秒恢復最大生命 6%，並進入 5 秒戰備狀態：攻速、移速、傷害提升',
    rarity: 'epic', oneTime: true, minLevel: 5, subtype: 'proc',
  },
  {
    id: 'culling', name: '【斬殺・黃泉】', desc: '直接秒殺血量低於 15% 的敵人',
    rarity: 'epic', oneTime: true, minLevel: 8, subtype: 'proc',
  },
  {
    id: 'dark_aura', name: '【邪氣・吸取】', desc: '光環內怪物承受更多傷害；在光環內死亡時，縮短戰吼、兵糧丸、月讀、替身術冷卻',
    rarity: 'epic', oneTime: true, minLevel: 8, subtype: 'proc',
  },
  {
    id: 'iron_body', name: '【殘影・護身】', desc: '持續移動 1.5 秒後獲得護盾；護盾被打破時，釋放護身震波反擊周圍敵人',
    rarity: 'epic', oneTime: true, minLevel: 8, subtype: 'proc',
  },

  // ─── Legendary Passives (formerly keystones) ─────────────────────────────
  {
    id: 'iron_will', name: '【疾風如火】', desc: '持續移動時每秒傷害提升 12%（最高 60%），停下來會逐步衰減',
    rarity: 'legendary', oneTime: true, minLevel: 10, subtype: 'keystone',
  },
  {
    id: 'glass_cannon', name: '【狂戰士・誓約】', desc: '受到的傷害加倍，但輸出的傷害變為三倍',
    rarity: 'legendary', oneTime: true, minLevel: 10, subtype: 'keystone',
    apply(_player, scene) { scene._glassCannon = true },
  },
  {
    id: 'spell_echo', name: '【萬劍歸宗】', desc: '投射物收回時，在玩家周圍觸發一次 360° 斬擊',
    rarity: 'legendary', oneTime: true, minLevel: 10, subtype: 'keystone', requires: 'shuriken_boomerang',
  },
  {
    id: 'ice_thunder', name: '【雷鼓・鳴動】', desc: '戰吼會造成傷害並施加導雷印；帶印敵人死亡時，向周圍敵人釋放連鎖雷擊',
    rarity: 'legendary', oneTime: true, minLevel: 10, subtype: 'keystone', requires: 'war_cry',
  },
  {
    id: 'gravity_burst', name: '【重力爆裂】', desc: '黑洞將敵人拉到核心時，觸發其最大生命值 8% 的重力爆裂',
    rarity: 'legendary', oneTime: true, minLevel: 10, subtype: 'keystone', requires: 'homura_gravity',
  },
  {
    id: 'amaterasu', name: '【天照・大御神】', desc: '武器命中有 10% 機率立刻重置該武器冷卻，並使後續 2 秒連鎖效果強化',
    rarity: 'legendary', oneTime: true, minLevel: 10, subtype: 'keystone',
    apply(_player, scene) { scene._amaterasu = true },
  },
  {
    id: 'susano', name: '【須佐・守護】', desc: '受到致命傷害時保留 1 HP，並震滅周邊怪物（冷卻 30 秒）',
    rarity: 'legendary', oneTime: true, minLevel: 10, subtype: 'keystone',
    apply(_player, scene) { scene._susano = true; scene._susanoCd = 0 },
  },
  {
    id: 'tsukuyomi', name: '【月讀・幻境】', desc: '每 15 秒使畫面上所有怪物短暫停滯並陷入幻惑',
    rarity: 'legendary', oneTime: true, minLevel: 10, subtype: 'keystone',
    apply(_player, scene) { scene._tsukuyomi = true; scene._tsukuyomiTimer = 0 },
  },
  {
    id: 'yamatanoorochi', name: '【八岐・狂亂】', desc: '每次擊殺永久增加 0.5% 攻擊速度（最高 +50%）',
    rarity: 'legendary', oneTime: true, minLevel: 10, subtype: 'keystone',
    apply(_player, scene) { scene._yamatano = true },
  },
]
