// src/affixes/index.js
import burn    from './burn.js'
import poison  from './poison.js'
import chain   from './chain.js'
import chill   from './chill.js'
import curse   from './curse.js'
import leech   from './leech.js'
import burst   from './burst.js'
import lucky   from './lucky.js'

export { checkResonances } from './resonances.js'

export const ALL_AFFIXES = [burn, poison, chain, chill, curse, leech, burst, lucky]

export const ALL_MECHANICAL = [
  {
    id:   'multishot',
    name: '乱射',
    desc: '所有武器：投射數+1（近戰：射程+15%）',
  },
  {
    id:   'piercing',
    name: '貫通',
    desc: '所有投射型武器：彈丸貫穿敵人',
  },
  {
    id:   'orbit_shield',
    name: '護盾術',
    desc: '產生環繞護盾（60px軌道，接觸造成6傷害/秒）',
  },
]
