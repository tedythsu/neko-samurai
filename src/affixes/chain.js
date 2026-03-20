// src/affixes/chain.js
import Phaser   from 'phaser'
import Enemy    from '../entities/Enemy.js'

export default {
  id:   'chain',
  name: '電撃',
  desc: '25%機率：閃電跳躍至周圍敵人（0.5倍傷害）',

  onHit(enemy, damage, scene) {
    if (Math.random() > 0.25) return
    const hasChain2 = scene._affixCounts?.has('chain2')
    const bounces   = hasChain2 ? 3 : (scene._affixCounts ? (scene._affixCounts.get('chain') || 1) : 1)

    const visited = [enemy]
    for (let b = 0; b < bounces; b++) {
      const src = visited[visited.length - 1]
      const next = scene._enemies.getChildren()
        .filter(e => e.active && !e.dying && !visited.includes(e) &&
          Phaser.Math.Distance.Between(src.x, src.y, e.x, e.y) < 120)
        .sort((ea, eb) =>
          Phaser.Math.Distance.Between(src.x, src.y, ea.x, ea.y) -
          Phaser.Math.Distance.Between(src.x, src.y, eb.x, eb.y))[0]
      if (!next) break
      visited.push(next)

      const poisoned   = next._statusEffects && next._statusEffects.poison.stacks > 0
      const toxicChain = scene._resonances && scene._resonances.has('toxic_chain')
      const dmgMult    = 0.5 * (toxicChain && poisoned ? 2 : 1)
      Enemy.takeDamage(next, damage * dmgMult, src.x, src.y, [], 0)

      // Blizzard arc resonance: chill all bounced targets
      if (scene._resonances && scene._resonances.has('blizzard_arc') && next._statusEffects) {
        next._statusEffects.chill.active = true
        next._statusEffects.chill.timer  = 1500
      }

      // Visual: lightning arc line
      const g = scene.add.graphics().setDepth(10)
      g.lineStyle(2, 0xffff44, 0.9)
      g.lineBetween(src.x, src.y, next.x, next.y)
      scene.time.delayedCall(150, () => g.destroy())
    }
  },
}
