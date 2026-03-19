// src/affixes/leech.js
export default {
  id:   'leech',
  name: '吸血',
  desc: '每次攻擊回復傷害量的10% HP',

  onHit(enemy, damage, scene) {
    if (scene._player) scene._player.heal(damage * 0.10)
  },
}
