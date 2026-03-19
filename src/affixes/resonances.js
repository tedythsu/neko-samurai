// src/affixes/resonances.js

const RESONANCE_REQS = {
  explode_burn: ['burn', 'burst'],
  toxic_chain:  ['poison', 'chain'],
  blizzard_arc: ['chain', 'chill'],
  corrosion:    ['burn', 'poison'],
  dark_harvest: ['leech', 'curse'],
}

/**
 * Returns a Set of active resonance IDs based on which affixes have been acquired.
 * @param {Map<string, number>} affixCounts  id → pick count
 * @returns {Set<string>}
 */
export function checkResonances(affixCounts) {
  const active = new Set()
  for (const [id, required] of Object.entries(RESONANCE_REQS)) {
    if (required.every(r => (affixCounts.get(r) || 0) >= 1))
      active.add(id)
  }
  return active
}
