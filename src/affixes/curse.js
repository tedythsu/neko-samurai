// src/affixes/curse.js
export default {
  id:   'curse',
  name: '詛咒',
  desc: '敵人受到+25%傷害，持續3秒（擊中時刷新）',

  onHit(enemy, damage, scene) {
    const se = enemy._statusEffects
    if (!se) return
    se.curse.active = true
    se.curse.timer  = 3000
  },
}
