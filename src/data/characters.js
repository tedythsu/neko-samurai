export const CHARACTERS = {
  mikenomaru: {
    id: 'mikenomaru', name: '三毛丸', breed: '三毛貓',
    passive: { type: 'goldBonus', value: 0.2 },
    startWeapon: 'kunai',
    stats: { hp: 100, speed: 140, armor: 0, luck: 0 },
    spriteKey: 'cat_mikenomaru',
    color: 0xf0a040,
  },
  kuroka: {
    id: 'kuroka', name: '黒影', breed: '黒貓', locked: true,
    passive: { type: 'critBonus', value: 0.15 },
    startWeapon: 'tachi',
    stats: { hp: 90, speed: 155, armor: 0, luck: 0 },
    spriteKey: 'cat_kuroka',
    color: 0x333366,
  },
}
