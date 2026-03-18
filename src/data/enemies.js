export const ENEMIES = {
  oni_soldier: {
    id: 'oni_soldier', name: '鬼兵',
    hp: 30, speed: 60, damage: 10, xp: 5, souls: 1,
    color: 0xcc3333, size: 12, type: 'normal',
  },
  oni_general: {
    id: 'oni_general', name: '大鬼兵將',
    hp: 300, speed: 45, damage: 20, xp: 50, souls: 15,
    color: 0xaa1111, size: 20, type: 'boss',
    isBoss: true,
  },
  kitsune_vanguard: {
    id: 'kitsune_vanguard', name: '妖狐前鋒',
    hp: 600, speed: 90, damage: 25, xp: 80, souls: 25,
    color: 0xff8800, size: 22, type: 'boss',
    isBoss: true, behavior: 'dash',
  },
  bamboo_fox_final: {
    id: 'bamboo_fox_final', name: '竹林妖狐',
    hp: 2000, speed: 70, damage: 30, xp: 200, souls: 80,
    color: 0xff6600, size: 32, type: 'final_boss',
    isBoss: true,
  },
}
