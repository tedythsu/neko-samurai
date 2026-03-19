// src/affixes/poison.js
export default {
  id:   'poison',
  name: '毒',
  desc: '疊加毒層（最多5層）：每層每秒3傷害',

  onHit(enemy, damage, scene) {
    const se = enemy._statusEffects
    if (!se) return
    const count     = scene._affixCounts ? (scene._affixCounts.get('poison') || 1) : 1
    const maxStacks = count >= 3 ? 12 : count >= 2 ? 8 : 5
    se.poison.stacks = Math.min(se.poison.stacks + 1, maxStacks)
    se.poison.timer  = 5000
  },
}
