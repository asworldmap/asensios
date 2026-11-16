import { scenery, shots } from './scenery.js';

export async function build(ctx) {
  const s = scenery(ctx, {
    id: 'europe-bus', points: [[-25, -76], [-25, -30], [4, 5], [33, 16], [43, 49], [43, 82]],
    floor: -0.035, driveY: 0, ground: '#8e936e', stop: 0.93, discoverAt: 0.48, radius: 12, exitCopy: 'world.bridge.t03',
    card: { key: 'ch7', photo: '/media/eu-parliament.webp', href: '/trajectory/#ch7' },
    day: { skyTop: '#80aed1', sunDir: [-0.62, 0.48, -0.5], fog: '#dfeaf0' },
    shots: shots([0, 13, 12, 7, 1, 2.6, 45], [0.4, 13, -12, 5.4, 3, 2.2, 46], [1, 12, 8, 5, 2, 2.2, 44]),
    establishing: { from: [-44, 11, -87], look: [-18, 3.7, -70] },
  });
  s.groundStrip('#666b62', 12, -0.015);
  s.groundStrip('#ded0a8', 0.15, -0.009, 5.2);
  s.groundStrip('#ded0a8', 0.15, -0.009, -5.2);
  for (let t = 0.025; t < 0.98; t += 0.03) s.groundStrip('#e7d7ae', 0.13, -0.009, 0, t, t + 0.012);
  const stops = [0.04, 0.48, 0.93].map((t) => ({ ...s.pointAt(t), radius: 10 }));
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
  s.stamp('europe_v2/station_building', -12, -72, { y: 0, yaw: -Math.PI / 2, solid: true });
  for (const t of [0.22, 0.35, 0.51, 0.63]) {
    const p = s.beside(t, 13);
    s.stamp('europe_v2/hedgerow', p.x, p.z, { yaw: p.yaw, solid: true });
  }
  s.stamp('maritime_v2/harbour_office', 59, 76, { y: 0, yaw: -Math.PI / 2, solid: true });
  s.stamp('maritime_v2/dock_clutter', 50.6, 79, { y: 0, solid: true });
  // An angled strip of basin past the quay hints at the water still to cross.
  s.groundStrip('#508092', 35, -0.013, -25, 0.76, 1);
  await ctx.step('scenery', 0.85);
  return { ...s.finish(), stops };
}
