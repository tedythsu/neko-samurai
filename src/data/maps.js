export const MAPS = {
  bamboo_village: {
    id: 'bamboo_village', name: '竹林村', locked: false,
    bgColor: 0x1a2a0a, difficulty: 1,
    enemies: ['oni_soldier'],
    waveSchedule: [
      { time: 60,  boss: 'oni_general',      hpMult: 1.0 },
      { time: 180, boss: 'oni_general',      hpMult: 1.2, count: 2 },
      { time: 300, boss: 'oni_general',      hpMult: 1.5, count: 3 },
      { time: 480, boss: 'oni_general',      hpMult: 2.0, behavior: 'chase' },
      { time: 660, boss: 'kitsune_vanguard', hpMult: 2.5 },
      { time: 900, boss: 'bamboo_fox_final', hpMult: 5.0, final: true },
    ],
    spawnRate: 1200,
  },
}
