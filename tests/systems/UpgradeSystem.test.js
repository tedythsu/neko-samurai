import { describe, it, expect } from 'vitest'
import UpgradeSystem from '../../src/systems/UpgradeSystem.js'

describe('UpgradeSystem', () => {
  it('draws 3 cards', () => {
    const us = new UpgradeSystem({ weapons: ['kunai', 'tachi'], passives: ['hpUp', 'spdUp', 'atkUp'] })
    const cards = us.drawCards({ luck: 0, weapons: [] })
    expect(cards).toHaveLength(3)
  })

  it('does not offer already-maxed weapon', () => {
    const us = new UpgradeSystem({ weapons: ['kunai'], passives: ['hpUp', 'spdUp', 'atkUp', 'cdUp', 'luckUp'] })
    const cards = us.drawCards({ luck: 0, weapons: [{ id: 'kunai', level: 5 }] })
    const kunaiUpgrade = cards.filter(c => c.type === 'weapon' && c.id === 'kunai')
    expect(kunaiUpgrade).toHaveLength(0)
  })

  it('higher luck shifts rarity toward epic', () => {
    const us = new UpgradeSystem({ weapons: [], passives: ['hpUp','spdUp','atkUp','cdUp','luckUp'] })
    let epicCount = 0
    for (let i = 0; i < 300; i++) {
      const cards = us.drawCards({ luck: 100, weapons: [] })
      epicCount += cards.filter(c => c.rarity === 'epic').length
    }
    // With luck=100 (10 stacks of +10), epic chance ~15%, expect >100 in 900 draws
    expect(epicCount).toBeGreaterThan(100)
  })
})
