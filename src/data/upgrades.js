export const PASSIVES = {
  hpUp:    { id: 'hpUp',    name: '生命符',  rarity: 'common', effect: { type: 'hp',    value: 20 } },
  spdUp:   { id: 'spdUp',   name: '疾風符',  rarity: 'rare',   effect: { type: 'speed', value: 15 } },
  atkUp:   { id: 'atkUp',   name: '攻擊符',  rarity: 'common', effect: { type: 'atk',   value: 0.1 } },
  cdUp:    { id: 'cdUp',    name: '冷卻符',  rarity: 'rare',   effect: { type: 'cd',    value: 0.1 } },
  luckUp:  { id: 'luckUp',  name: '幸運符',  rarity: 'epic',   effect: { type: 'luck',  value: 20 } },
  kazeFu:  { id: 'kazeFu',  name: '疾風符★', rarity: 'epic',   effect: { type: 'speed', value: 10 }, evolveKey: true },
  steelAmulet: { id: 'steelAmulet', name: '鋼鐵護符', rarity: 'epic', effect: { type: 'armor', value: 10 }, evolveKey: true },
}
