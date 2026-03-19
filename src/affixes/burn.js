// src/affixes/burn.js
export default {
  id:   'burn',
  name: '炎上',
  desc: '點燃敵人：每秒5傷害，持續2秒（疊加：時間延長、傷害倍率提升）',

  onHit(enemy, damage, scene) {
    const se = enemy._statusEffects
    if (!se) return
    const count    = scene._affixCounts ? (scene._affixCounts.get('burn') || 1) : 1
    const duration = count >= 2 ? 4000 : 2000
    const dps      = count >= 3 ? 7.5 : 5
    se.burn.stacks = 1
    se.burn.dps    = dps
    se.burn.timer  = duration
  },
}
