import { smooth } from '../kit.js';
import { scenery, shots } from './scenery.js';

export async function build(ctx) {
  const s = scenery(ctx, {
    id: 'asia', points: [[-32, -160], [-32, -25], [-32, 42], [22, 148], [110, 236]],
    height: (t) => 68 * smooth(0.25, 0.76, t),
    floor: -0.04, ground: '#758b78', stop: 0.92, radius: 24, bounds: 410, storyRate: 2.4,
    card: { key: 'ch4', photo: '/media/korea-cherry-signpost.webp', href: '/trajectory/#ch4' },
    day: { skyTop: '#89adc4', fog: '#d3dce2', skyHorizon: '#e9d3bd', fogNear: 150, fogFar: 470 },
    shots: shots([0, 39, 47, 19, 0, 3.5, 44], [0.24, 53, -19, 15, 4, 4.6, 46], [0.55, 40, 38, 13, 4, 3.3, 48], [1, 58, 43, 18, 7, 4.2, 46]),
    establishing: { from: [23, 25, -197], look: [-32, 4, -139] },
  });
  s.groundStrip('#595e60', 43, -0.016, 0, 0, 0.43);
  s.groundStrip('#857f74', 16, -0.018, 27, 0, 0.25);
  for (const o of [-19.8, 19.8]) s.groundStrip('#dedacf', 0.32, -0.01, o, 0.006, 0.425);
  for (let t = 0.015; t < 0.405; t += 0.026) {
    s.groundStrip('#e1dfd6', 0.5, -0.01, 0, t, t + 0.013);
    for (const offset of [-21.8, 21.8]) {
      const p = s.beside(t, offset);
      s.stamp('asia/runway_light', p.x, p.z, { y: 0 });
    }
  }
  s.tile('asia/terminal_bay', 26, -153, 10, { yaw: 0, y: 0 });
  s.stamp('asia/jet_bridge', 15.8, -139, { yaw: -Math.PI / 2, y: 0 });
  s.stamp('asia/baggage_cart', 12.5, -130, { yaw: Math.PI * 0.8, y: 0 });
  s.stamp('asia/baggage_cart', 12.7, -107, { yaw: -0.5, y: 0 });
  for (let i = 0; i < 36; i++) {
    const x = 53 + s.random() * 70;
    s.stamp('asia/bamboo_clump', x, -182 + s.random() * 190, { yaw: s.random() * 6 });
  }
  await ctx.step('scenery', 0.85);
  return s.finish();
}
