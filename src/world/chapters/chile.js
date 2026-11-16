import { scenery, shots } from './scenery.js';

export async function build(ctx) {
  const s = scenery(ctx, {
    id: 'chile', points: [[-17, -29], [-15, -13], [-5, 5], [0, 22], [0, 37]],
    floor: -0.025, driveY: 0, ground: '#a69b75', stop: 1, radius: 8, bounds: 105,
    link: '/trajectory/', exitCopy: 'world.closing.invitation',
    card: { key: 'ch10', photo: '/media/eu-delegation-now.webp', href: '/trajectory/#ch10' },
    day: {
      skyTop: '#7a9cb7', skyMid: '#efd9c2', skyHorizon: '#f4c097', fog: '#e9ceb9',
      sun: '#ffd7ab', sunDir: [0.42, 0.30, -0.86], fogNear: 135, fogFar: 660,
    },
    shots: shots([0, 8, 5, 3.7, 4, 1.2, 48], [0.49, 8, -4, 3.1, 6, 1.8, 49], [1, 8, 4, 4.4, 10, 3, 51]),
    establishing: { from: [-43, 21, -60], look: [10, 16, 65] },
  });
  s.groundStrip('#c5ae81', 3.8, -0.012);
  s.stamp('chile_v2/lookout_terrace', 0, 41, { y: 0 });
  for (const [asset, z, y, scale] of [
    ['city_basin_backdrop', 218, -2.6, 1.35],
    ['foothill_ridge', 341, -10, 2.6],
    ['cordillera_backdrop', 485, -17, 5.4],
  ]) {
    for (const x of [-1, 0, 1]) {
      s.stamp('chile_v2/' + asset, x * scale * 58, z - Math.abs(x) * 11, { y, yaw: Math.PI, scale });
    }
  }
  for (const x of [-40, -19, 18, 39]) {
    s.stamp('chile_v2/vineyard_rows', x, 79, { y: -0.02 });
    s.stamp('chile_v2/poplar_row', x + 8, 91, { y: 0, yaw: Math.PI / 2 });
  }
  s.stamp('chile_v2/espino_tree', 9, 31, { y: 0, scale: 0.85, solid: true });
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
