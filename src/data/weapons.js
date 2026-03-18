export const WEAPONS = {
  kunai: {
    id: 'kunai', name: '苦無投擲', type: 'projectile',
    levels: [
      { damage: 12, cooldown: 1200, count: 1, pierce: 1, speed: 300 },
      { damage: 16, cooldown: 1000, count: 2, pierce: 1, speed: 320 },
      { damage: 20, cooldown: 900,  count: 3, pierce: 1, speed: 340 },
      { damage: 26, cooldown: 800,  count: 4, pierce: 2, speed: 360 },
      { damage: 32, cooldown: 700,  count: 5, pierce: 2, speed: 380 },
    ],
    evolveWith: 'kazeFu', evolveTo: 'senbon',
    icon: '🗡️',
  },
  tachi: {
    id: 'tachi', name: '太刀斬擊', type: 'arc',
    levels: [
      { damage: 20, cooldown: 1400, arc: 120, range: 60 },
      { damage: 28, cooldown: 1200, arc: 150, range: 70 },
      { damage: 38, cooldown: 1100, arc: 180, range: 80 },
      { damage: 50, cooldown: 1000, arc: 240, range: 90 },
      { damage: 65, cooldown: 900,  arc: 360, range: 100 },
    ],
    evolveWith: 'steelAmulet', evolveTo: 'metsuYoTachi',
    icon: '⚔️',
  },
  shikigami: {
    id: 'shikigami', name: '召喚式神', type: 'orbit',
    levels: [
      { damage: 10, cooldown: 500, count: 1, orbitRadius: 60, orbitSpeed: 2 },
      { damage: 14, cooldown: 500, count: 2, orbitRadius: 65, orbitSpeed: 2.2 },
      { damage: 18, cooldown: 500, count: 3, orbitRadius: 70, orbitSpeed: 2.5 },
      { damage: 24, cooldown: 500, count: 4, orbitRadius: 75, orbitSpeed: 2.8 },
      { damage: 30, cooldown: 500, count: 5, orbitRadius: 80, orbitSpeed: 3.2 },
    ],
    evolveWith: null, evolveTo: null,
    icon: '✨',
  },
}
