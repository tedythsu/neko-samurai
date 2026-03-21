// src/affixes/index.js
import { ALL_EVOLUTIONS } from './evolutions.js'
import burn    from './burn.js'
import poison  from './poison.js'
import chain   from './chain.js'
import chill   from './chill.js'
import curse   from './curse.js'
import leech   from './leech.js'
import burst   from './burst.js'
import lucky   from './lucky.js'
import tier2   from './tier2.js'

export { checkResonances } from './resonances.js'

export const ALL_AFFIXES = [burn, poison, chain, chill, curse, leech, burst, lucky]

export const ALL_TIER2_AFFIXES = tier2

export { ALL_EVOLUTIONS }
