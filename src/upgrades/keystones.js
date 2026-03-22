// src/upgrades/keystones.js
// 傳奇質變 — rarity: 'legendary', 5 分鐘後解鎖 (minTimeMs 300000)
// 需持有特定藍/紫詞條作為前置：在 _buildUpgradePool 中過濾

export const ALL_KEYSTONES = [
  {
    id:         'iron_will',
    name:       '【不動如山】',
    desc:       '站定不動時每秒傷害提升 20%（最高 100%），並獲得霸體',
    rarity:     'legendary',
    minTimeMs:  5 * 60 * 1000,
    oneTime:    true,
  },
  {
    id:         'glass_cannon',
    name:       '【狂戰士・誓約】',
    desc:       '受到的傷害加倍，但輸出的傷害變為三倍',
    rarity:     'legendary',
    minTimeMs:  5 * 60 * 1000,
    oneTime:    true,
    apply(_player, scene) { scene._glassCannon = true },
  },
  {
    id:         'spell_echo',
    name:       '【萬劍歸宗】',
    desc:       '投射物收回時，在玩家周圍觸發一次 360° 斬擊',
    rarity:     'legendary',
    minTimeMs:  5 * 60 * 1000,
    requires:   'shuriken_boomerang',   // 需先持有回旋・歸刃
    oneTime:    true,
  },
  {
    id:         'ice_thunder',
    name:       '【超導爆裂】',
    desc:       '對凍結目標造成的傷害加倍，且產生全銀幕電弧效果',
    rarity:     'legendary',
    minTimeMs:  5 * 60 * 1000,
    requires:   'chill',                // 需先持有冰元素
    oneTime:    true,
  },
  {
    id:         'gravity_burst',
    name:       '【重力爆裂】',
    desc:       '黑洞將敵人拉到核心時，觸發其最大生命值 8% 的重力爆裂',
    rarity:     'legendary',
    minTimeMs:  5 * 60 * 1000,
    requires:   'homura_gravity',       // 需先持有陰陽・黑洞
    oneTime:    true,
  },
  {
    id:         'amaterasu',
    name:       '【天照・大御神】',
    desc:       '武器命中有 10% 機率立刻重置該武器冷卻，並使後續 2 秒連鎖效果強化',
    rarity:     'legendary',
    minTimeMs:  5 * 60 * 1000,
    oneTime:    true,
    apply(_player, scene) { scene._amaterasu = true },
  },
  {
    id:         'susano',
    name:       '【須佐・守護】',
    desc:       '受到致命傷害時，將傷害反射給周邊所有怪物（冷卻 30 秒）',
    rarity:     'legendary',
    minTimeMs:  5 * 60 * 1000,
    oneTime:    true,
    apply(_player, scene) { scene._susano = true; scene._susanoCd = 0 },
  },
  {
    id:         'tsukuyomi',
    name:       '【月讀・幻境】',
    desc:       '每 15 秒使畫面上所有怪物短暫混亂，互相碰撞造成傷害',
    rarity:     'legendary',
    minTimeMs:  5 * 60 * 1000,
    oneTime:    true,
    apply(_player, scene) { scene._tsukuyomi = true; scene._tsukuyomiTimer = 0 },
  },
  {
    id:         'yamatanoorochi',
    name:       '【八岐・狂亂】',
    desc:       '每次擊殺永久增加 0.5% 攻擊速度（最高 +50%）',
    rarity:     'legendary',
    minTimeMs:  5 * 60 * 1000,
    oneTime:    true,
    apply(_player, scene) { scene._yamatano = true },
  },
]
