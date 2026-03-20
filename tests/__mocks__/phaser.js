// Minimal Phaser stub for unit tests (no browser APIs needed)
const Phaser = {
  Math: {
    Distance: { Between: () => 0 },
    Angle: { Between: () => 0 },
    DegToRad: v => v * Math.PI / 180,
    RadToDeg: v => v * 180 / Math.PI,
    Wrap: (v) => v,
  },
  GameObjects: { Sprite: class {} },
  Physics: { Arcade: { Sprite: class {} } },
}
export default Phaser
