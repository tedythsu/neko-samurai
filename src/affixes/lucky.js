// src/affixes/lucky.js
// Passive — crit boost handled directly in Enemy.takeDamage() by counting lucky affixes.
export default {
  id:   'lucky',
  name: '幸運',
  desc: '爆擊率 +15%，爆擊倍率 +50%',
  onHit(enemy, damage, scene) { /* passive — applied in takeDamage */ },
}
