import { scenery, shots } from './scenery.js';

export async function build(ctx) {
  const s = scenery(ctx, {
    id: 'chile', points: [[-17, -29], [-15, -13], [-5, 5], [0, 22], [0, 37]],
    floor: -0.025, driveY: 0, ground: '#a69b75', stop: 0.96, radius: 8, bounds: 105,
    link: '/trajectory/',
    card: { key: 'ch10', photo: '/media/eu-delegation-now.webp', href: '/trajectory/#ch10' },
    day: {
      skyTop: '#7a9cb7', skyMid: '#efd9c2', skyHorizon: '#f4c097', fog: '#e9ceb9',
      sun: '#ffd7ab', sunDir: [-0.62, 0.42, 0.68], fogNear: 115, fogFar: 480,
    },
    shots: shots([0, 8, 5, 3.7, 4, 1.2, 48], [0.49, 8, -4, 3.1, 6, 1.8, 49], [1, 8, 4, 4.4, 10, 3, 51]),
    establishing: { from: [-43, 21, -60], look: [10, 16, 65] },
  });
  s.groundStrip('#c5ae81', 3.8, -0.012);
  const ridges = [
    [-164, 173, 2.4], [-118, 160, 1.85], [-72, 194, 2.5], [-23, 171, 2.15],
    [30, 190, 2.8], [75, 211, 2.08], [119, 177, 2.3], [164, 200, 2.4],
    [-80, 126, 1.04], [75, 137, 1.1], [111, 119, 1.25],
  ];
  for (const [x, z, scale] of ridges) s.stamp('chile/andes_peak', x, z, { scale, yaw: (s.random() - 0.5) * 0.75 });
  for (let i = 0; i < 47; i++) {
    const p = s.beside(s.random(), (i % 2 ? 1 : -1) * (3 + 31 * s.random()));
    const options = { yaw: s.random() * 6, scale: 0.7 + s.random() * 0.65 };
    if (i % 6 === 0) s.stamp('chile/araucaria', p.x, p.z, { ...options, solid: true });
    else if (i % 5 === 0) s.stamp('chile/rock_outcrop', p.x, p.z, { ...options, solid: true });
    else s.stamp('chile/tussock_grass', p.x, p.z, options);
  }
  s.stamp('common/park_bench', 4.1, 34, { yaw: Math.PI, solid: true });
  s.stamp('common/signpost', -3.7, 30, { solid: true });
  await ctx.step('scenery', 0.85);
  return s.finish();
}
