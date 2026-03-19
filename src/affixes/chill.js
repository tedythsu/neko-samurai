// src/affixes/chill.js
export default {
  id:   'chill',
  name: '凍結',
  desc: '30%機率：減速50%，持續1.5秒',

  onHit(enemy, damage, scene) {
    if (Math.random() > 0.30) return
    const se = enemy._statusEffects
    if (!se) return
    se.chill.active = true
    se.chill.timer  = 1500
  },
}
