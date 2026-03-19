// src/affixes/tier2.js
// Tier-2 affix upgrades. Each requires the parent tier-1 affix.
// Effects driven by parent files (chain, burst) or Enemy.js hooks read scene._affixCounts.

export default [
  {
    id: 'burn2', name: '業火', requires: 'burn',
    desc: '燃燒傷害 ×2',
    onHit(enemy) {
      const se = enemy._statusEffects
      if (se && se.burn.stacks > 0) se.burn.dps = 10
    },
  },
  {
    id: 'poison2', name: '猛毒擴散', requires: 'poison',
    desc: '中毒敵人死亡時：毒性傳播至周圍3個敵人（50%毒層數）',
    onHit() {},  // handled in Enemy._triggerDeath
  },
  {
    id: 'chain2', name: '落雷', requires: 'chain',
    desc: '連鎖擴展到3個目標',
    onHit() {},  // chain.js reads scene._affixCounts.has('chain2')
  },
  {
    id: 'chill2', name: '凍結', requires: 'chill',
    desc: '完全停止敵人移動2秒（取代減速）',
    onHit(enemy) {
      const se = enemy._statusEffects
      if (!se) return
      se.frozen.active = true
      se.frozen.timer  = 2000
      // Chill becomes irrelevant when frozen, but keep it active for resonance compatibility
    },
  },
  {
    id: 'curse2', name: '恐慌', requires: 'curse',
    desc: '被詛咒敵人死亡時：對周圍80px造成15傷害',
    onHit() {},  // handled in Enemy._triggerDeath
  },
  {
    id: 'leech2', name: '血饗', requires: 'leech',
    desc: '吸血效果 ×2（共回復傷害量20%）',
    onHit(enemy, damage, scene) {
      if (scene._player) scene._player.heal(damage * 0.10)  // extra 10% on top of leech's 10%
    },
  },
  {
    id: 'burst2', name: '大爆炸', requires: 'burst',
    desc: '爆炸範圍 +50%（40px → 60px）',
    onHit() {},  // burst.js reads scene._affixCounts.has('burst2')
  },
  {
    id: 'lucky2', name: '大吉', requires: 'lucky',
    desc: '爆擊傷害倍率 ×1.5',
    onHit() {},  // handled passively in Enemy.takeDamage via lucky2Count check
  },
]
