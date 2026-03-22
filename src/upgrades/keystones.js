// src/upgrades/keystones.js
// Keystones — fundamentally alter gameplay

export const ALL_KEYSTONES = [
  {
    id:      'iron_will',
    name:    '【不動如山】',
    desc:    '站定不動時每秒傷害提升 20%（最高 100%），並獲得霸體',
    minLevel: 8,
    oneTime: true,
  },
  {
    id:      'glass_cannon',
    name:    '【狂戰士・誓約】',
    desc:    '受到的傷害加倍，但輸出的傷害變為三倍',
    minLevel: 8,
    oneTime: true,
    apply(_player, scene) { scene._glassCannon = true },
  },
  {
    id:      'spell_echo',
    name:    '【萬劍歸宗】',
    desc:    '投射物收回時，在玩家周圍觸發一次 360° 斬擊',
    minLevel: 10,
    oneTime: true,
  },
  {
    id:      'ice_thunder',
    name:    '【超導爆裂】',
    desc:    '對凍結目標造成的傷害加倍，且產生全銀幕電弧效果',
    minLevel: 10,
    oneTime: true,
  },
  {
    id:      'gravity_burst',
    name:    '【重力爆裂】',
    desc:    '黑洞吸入怪物瞬間，觸發最大生命值 10% 的真實傷害爆炸',
    minLevel: 10,
    oneTime: true,
  },
]
