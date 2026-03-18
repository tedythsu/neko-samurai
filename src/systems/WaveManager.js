export default class WaveManager {
  constructor(mapDef) {
    this._map = mapDef
    this._schedule = [...mapDef.waveSchedule]
    this._triggeredTimes = new Set()
    this.spawnRateMultiplier = 1.0
    this.activeBoss = null
  }

  getBossAt(elapsedSeconds) {
    const entry = this._schedule.find(e => e.time === elapsedSeconds)
    return entry || null
  }

  checkAndTrigger(elapsedSeconds) {
    if (this._triggeredTimes.has(elapsedSeconds)) return null
    const entry = this.getBossAt(elapsedSeconds)
    if (entry) { this._triggeredTimes.add(elapsedSeconds); return entry }
    return null
  }

  onBossKilled() {
    this.activeBoss = null
    this.spawnRateMultiplier = Math.min(2.5, this.spawnRateMultiplier + 0.15)
  }

  get currentSpawnInterval() {
    return this._map.spawnRate / this.spawnRateMultiplier
  }

  get isFinalBossActive() {
    return this.activeBoss?.final === true
  }
}
