import { scenery, shots } from './scenery.js';

export async function build(ctx) {
  const s = scenery(ctx, {
    id: 'europe', points: [[0, -86], [0, 0], [0, 94]], floor: -0.74, driveY: 0,
    ground: '#78816a', stop: 1, radius: 11,
    card: { key: 'ch5', href: '/trajectory/#ch5' },
    day: { skyTop: '#8bb4c9', fog: '#d5dcca' },
    shots: shots([0, 5, 8, 3.9, -10, 1.6, 49], [0.44, 8, 11, 4.1, -17, 2, 48], [1, 5, -7, 2.7, -12, 2, 44]),
    establishing: { from: [38, 18, -76], look: [0, 2, -101] },
  });
  s.tile('europe/rail_track_straight', 0, -145, 26, { y: 0 });
  const platforms = [-123, 57];
  for (const z of platforms) {
    s.tile('europe/rail_platform', 0, z, 5, { y: 0 });
    for (let i = 0; i < 3; i++) {
      const at = z + 10 + 10 * i;
      s.stamp('europe/station_shelter', 4.25, at, { y: 0.91, yaw: Math.PI });
      s.stamp('common/street_lamp', 5.4, at + 4, { y: 0.92 });
    }
    s.stamp('europe/rail_signal', -3.3, z + 39, { y: 0 });
  }
  for (let z = -138; z <= 106; z += 19) s.stamp('europe/catenary_mast', -3.4, z, { y: 0 });
  for (let i = 0; i < 67; i++) {
    const x = (i % 2 ? -1 : 1) * (11 + 53 * s.random());
    s.stamp('europe/conifer', x, -175 + 320 * s.random(), { yaw: s.random() * 6, scale: 0.8 + s.random() });
  }
  await ctx.step('scenery', 0.85);
  return s.finish();
}
