// src/affixes/evolutions.js
// Weapon evolution cards — injected into upgrade pool when weapon + affix conditions are met.

export const ALL_EVOLUTIONS = [
  {
    id: 'ryuen', name: '龍炎矢', weaponId: 'homura', affixId: 'burn',
    desc: '炎矢覚醒：火球體積×3、爆炸範圍×2、直擊傷害×1.5、爆炸留下3秒火場',
  },
  {
    id: 'raikou', name: '雷轟剣', weaponId: 'shuriken', affixId: 'chain',
    desc: '手裏剣覚醒：命中100%觸發閃電連鎖（跳躍數=投射數），無機率限制',
  },
  {
    id: 'koori', name: '氷刃苦無', weaponId: 'kunai', affixId: 'chill',
    desc: '苦無覚醒：每次命中直接冰凍敵人2秒，冰凍敵人可被貫穿',
  },
  {
    id: 'muramasa', name: '妖刀村正', weaponId: 'tachi', affixId: 'leech',
    desc: '太刀覚醒：斬擊範圍×1.5、傷害×1.3、回復傷害量30%、留下血色殘影',
  },
  {
    id: 'dokuja', name: '毒蛇鎖鎌', weaponId: 'kusarigama', affixId: 'poison',
    desc: '鎖鎌覚醒：每次接觸施加毒疊層，軌道半徑+40px',
  },
]
