// src/upgrades/procs.js
// Proc/Aura upgrade definitions — runtime behavior in GameScene.update()

export const ALL_PROCS = [
  {
    id:      'war_cry',
    name:    '【戰吼・威壓】',
    desc:    '每 5 秒自動發出震波，強力推開身邊所有怪物',
    minLevel: 3,
    oneTime: true,
  },
  {
    id:      'thorns',
    name:    '【棘甲・反震】',
    desc:    '怪物碰撞玩家時，反彈 300% 傷害並強制擊退',
    minLevel: 4,
    oneTime: true,
  },
  {
    id:      'life_leech',
    name:    '【血祭・吸取】',
    desc:    '造成傷害的 1% 轉化為生命',
    minLevel: 3,
    oneTime: true,
  },
  {
    id:      'culling',
    name:    '【斬殺・黃泉】',
    desc:    '直接秒殺血量低於 15% 的敵人',
    minLevel: 5,
    oneTime: true,
  },
  {
    id:      'sanctuary_aura',
    name:    '【聖域・靈光】',
    desc:    '腳下產生圓圈，範圍內怪物移速降低 30%，半徑隨等級成長',
    minLevel: 4,
    oneTime: true,
  },
  {
    id:      'dark_aura',
    name:    '【邪氣・吸取】',
    desc:    '光環內怪物防禦力降低 20%，死亡時更高機率掉落經驗球',
    minLevel: 6,
    oneTime: true,
  },
  {
    id:      'iron_body',
    name:    '【不動・護盾】',
    desc:    '站定不動 1.5 秒後獲得護盾，抵擋一次傷害且護盾期間減傷 20%',
    minLevel: 5,
    oneTime: true,
  },
]
