const STORAGE_KEY = 'neko_meta_v1'
const CURRENT_VERSION = 1

const NODE_DEFS = {
  atk:        { cost: 80,  max: 5 },
  hp:         { cost: 100, max: 5 },
  spd:        { cost: 80,  max: 3 },
  luck:       { cost: 120, max: 3 },
  pickup:     { cost: 90,  max: 3 },
  cd:         { cost: 150, max: 3 },
  gold:       { cost: 90,  max: 3 },
  exp:        { cost: 110, max: 3 },
  char_kuroka:  { cost: 500, max: 1 },
  map_shrine:   { cost: 600, max: 1 },
}

function defaultSave() {
  return {
    version: CURRENT_VERSION,
    souls: 0,
    nodes: Object.fromEntries(Object.keys(NODE_DEFS).map(k => [k, 0])),
    unlocked: [],
    settings: { musicVol: 0.8, sfxVol: 1.0 },
    stats: { totalRuns: 0, bestTime: 0, totalKills: 0 },
  }
}

function migrate(raw) {
  const def = defaultSave()
  const out = { ...def, ...raw, nodes: { ...def.nodes, ...(raw.nodes || {}) } }
  out.version = CURRENT_VERSION
  return out
}

export default class MetaProgress {
  constructor(storage = localStorage) {
    this._storage = storage
    this.data = this.load()
  }

  load() {
    const raw = this._storage.getItem(STORAGE_KEY)
    if (!raw) { this.data = defaultSave(); return this.data }
    try {
      const parsed = JSON.parse(raw)
      this.data = migrate(parsed)
    } catch {
      this.data = defaultSave()
    }
    return this.data
  }

  save() {
    this._storage.setItem(STORAGE_KEY, JSON.stringify(this.data))
  }

  addSouls(n) { this.data.souls += n }

  upgradeNode(id) {
    const def = NODE_DEFS[id]
    if (!def) return false
    const cur = this.data.nodes[id] ?? 0
    if (cur >= def.max) return false
    if (this.data.souls < def.cost) return false
    this.data.souls -= def.cost
    this.data.nodes[id] = cur + 1
    if (id === 'char_kuroka') this.data.unlocked.push('kuroka')
    if (id === 'map_shrine')  this.data.unlocked.push('shrine')
    return true
  }

  getStatBonuses() {
    const n = this.data.nodes
    return {
      atkMult:    1 + (n.atk  || 0) * 0.05,
      hpMult:     1 + (n.hp   || 0) * 0.10,
      spdMult:    1 + (n.spd  || 0) * 0.05,
      luck:           (n.luck || 0) * 10,
      pickupMult: 1 + (n.pickup || 0) * 0.20,
      cdMult:     1 - (n.cd   || 0) * 0.05,
      goldMult:   1 + (n.gold || 0) * 0.15,
      expMult:    1 + (n.exp  || 0) * 0.10,
    }
  }

  isUnlocked(id) { return this.data.unlocked.includes(id) }
  static get NODE_DEFS() { return NODE_DEFS }
}
