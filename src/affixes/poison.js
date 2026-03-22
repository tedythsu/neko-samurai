// src/affixes/poison.js
export function ensurePoisonState(enemy) {
  const se = enemy?._statusEffects
  if (!se) return null
  if (!se.poison) se.poison = { active: false, timer: 0, stacks: 0, rate: 0.01, flat: 0, _accum: 0 }
  if (se.poison.stacks == null) se.poison.stacks = 0
  if (se.poison.rate == null) se.poison.rate = 0.01
  if (se.poison.flat == null) se.poison.flat = 0
  if (se.poison._accum == null) se.poison._accum = 0
  return se.poison
}

export function poisonMaxStacks(scene) {
  const count = scene?._affixCounts ? (scene._affixCounts.get('poison') || 1) : 1
  return count >= 3 ? 12 : count >= 2 ? 8 : 5
}

export function applyPoisonStacks(enemy, scene, stacks = 1, durationMs = 5000) {
  const poison = ensurePoisonState(enemy)
  if (!poison) return
  poison.stacks = Math.min((poison.stacks || 0) + stacks, poisonMaxStacks(scene))
  poison.active = poison.stacks > 0
  poison.timer = Math.max(poison.timer, durationMs * (scene?._ailmentDurMult || 1))
}

export default {
  id:   'poison',
  name: '毒',
  desc: '疊加毒層（最多5層）：每層每秒3傷害',

  onHit(enemy, damage, scene) {
    applyPoisonStacks(enemy, scene, 1, 5000)
  },
}
