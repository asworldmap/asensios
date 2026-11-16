import { scenery, shots } from './scenery.js';

export async function build(ctx) {
  const s = scenery(ctx, {
    id: 'europe-bus', points: [[-25, -76], [-25, -30], [4, 5], [33, 16], [43, 49], [43, 82]],
    floor: -0.035, driveY: 0, ground: '#8e936e', stop: 0.93, radius: 12,
    card: { key: 'ch7', photo: '/media/eu-parliament.webp' },
    day: { sunDir: [-0.57, 0.53, -0.32], fog: '#e6dfc8' },
    shots: shots([0, 13, 12, 7, 1, 2.6, 45], [0.4, 13, -12, 5.4, 3, 2.2, 46], [1, 12, 8, 5, 2, 2.2, 44]),
    establishing: { from: [-46, 15, -91], look: [-25, 2.9, -64] },
  });
  s.groundStrip('#666b62', 12, -0.015);
  s.groundStrip('#ded0a8', 0.15, -0.009, 5.2);
  s.groundStrip('#ded0a8', 0.15, -0.009, -5.2);
  for (let t = 0.025; t < 0.98; t += 0.03) s.groundStrip('#e7d7ae', 0.13, -0.009, 0, t, t + 0.012);
  for (const t of [0.04, 0.48, 0.93]) {
    const p = s.beside(t, -8.1);
    const opts = { yaw: p.yaw, solid: true };
    s.stamp('europe/road_sign', p.x, p.z, opts);
    const rest = s.beside(t + 0.017, -8.9);
    s.stamp('common/park_bench', rest.x, rest.z, { yaw: p.yaw + Math.PI / 2, solid: true });
    const lamp = s.beside(t - 0.018, -8.5);
    s.stamp('common/street_lamp', lamp.x, lamp.z, opts);
  }
  for (let t = 0.18; t < 0.42; t += 0.022) {
    const p = s.beside(t, -6.8);
    s.stamp('europe/road_guardrail', p.x, p.z, { yaw: p.yaw, solid: true });
  }
  for (let i = 0; i < 68; i++) {
    const p = s.beside(s.random(), (i % 2 ? -1 : 1) * (11.5 + 32 * s.random()));
    s.stamp('europe/conifer', p.x, p.z, { yaw: s.random() * 6, scale: 0.65 + s.random(), solid: true });
  }
  await ctx.step('scenery', 0.85);
  return s.finish();
}
