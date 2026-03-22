// src/upgrades/procs.js
// Proc/Aura upgrade definitions — rarity: 'epic'
// 防禦類 (war_cry / thorns / life_leech / sanctuary_aura) 出現較早 (2 分鐘後)
// culling / dark_aura / iron_body 4 分鐘後解鎖
// soul_burst / ration 2 分鐘後解鎖

export const ALL_PROCS = [
  {
    id:        'war_cry',
    name:      '【戰吼・威壓】',
    desc:      '每 5 秒自動發出震波，強力推開身邊所有怪物',
    rarity:    'epic',
    minTimeMs: 2 * 60 * 1000,
    oneTime:   true,
  },
  {
    id:        'thorns',
    name:      '【棘甲・反震】',
    desc:      '怪物碰撞玩家時，反彈 300% 傷害並強制擊退',
    rarity:    'epic',
    minTimeMs: 2 * 60 * 1000,
    oneTime:   true,
  },
  {
    id:        'life_leech',
    name:      '【血祭・吸取】',
    desc:      '造成傷害的 1% 轉化為生命',
    rarity:    'epic',
    minTimeMs: 2 * 60 * 1000,
    oneTime:   true,
  },
  {
    id:        'sanctuary_aura',
    name:      '【聖域・靈光】',
    desc:      '腳下產生圓圈，範圍內怪物移速降低 30%，半徑隨等級成長',
    rarity:    'epic',
    minTimeMs: 2 * 60 * 1000,
    oneTime:   true,
  },
  {
    id:        'soul_burst',
    name:      '【魂之爆發】',
    desc:      '每擊殺 50 隻敵人，觸發全畫面衝擊波，震飛並傷害所有怪物',
    rarity:    'epic',
    minTimeMs: 2 * 60 * 1000,
    oneTime:   true,
  },
  {
    id:        'ration',
    name:      '【兵糧丸・回氣】',
    desc:      '每 30 秒自動恢復最大生命 5%',
    rarity:    'epic',
    minTimeMs: 2 * 60 * 1000,
    oneTime:   true,
  },
  {
    id:        'culling',
    name:      '【斬殺・黃泉】',
    desc:      '直接秒殺血量低於 15% 的敵人',
    rarity:    'epic',
    minTimeMs: 4 * 60 * 1000,   // 4 分鐘後解鎖
    oneTime:   true,
  },
  {
    id:        'dark_aura',
    name:      '【邪氣・吸取】',
    desc:      '光環內怪物防禦力降低 20%，死亡時更高機率掉落經驗球',
    rarity:    'epic',
    minTimeMs: 4 * 60 * 1000,
    oneTime:   true,
  },
  {
    id:        'iron_body',
    name:      '【不動・護盾】',
    desc:      '站定不動 1.5 秒後獲得護盾，抵擋一次傷害且護盾期間減傷 20%',
    rarity:    'epic',
    minTimeMs: 4 * 60 * 1000,
    oneTime:   true,
  },
]
