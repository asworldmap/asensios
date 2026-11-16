import { scenery, shots } from './scenery.js';

export async function build(ctx) {
  const s = scenery(ctx, {
    id: 'japan', points: [[-24, -106], [-23, -40], [-36, 8], [-34, 49], [-24, 106]],
    floor: 0, water: true, ground: '#4a8494', stop: 1, discoverAt: 0.56, radius: 20, storyRate: 1.45, exitCopy: 'world.bridge.t04',
    card: { key: 'ch8', photo: '/media/japan-fuji-swy.webp', href: '/trajectory/#ch8' },
    day: { skyTop: '#79a6be', skyHorizon: '#e8d5c2', fog: '#d7dde0', sunDir: [-0.55, 0.26, 0.62], fogNear: 140, fogFar: 460 },
    shots: shots([0, 44, 43, 16, 0, 6, 47], [0.48, 32, -57, 20, 0, 5.5, 48], [1, 41, 37, 19, 2, 5.2, 43]),
    establishing: { from: [15, 24, -146], look: [-24, 7, -106] },
  });
  for (const origin of [-132, 74]) {
    s.tile('maritime/quay_section', -15, origin, 7, { y: 0 });
    s.stamp('maritime_v2/harbour_office', -7, origin + 31, { y: 1.6, yaw: -Math.PI / 2, scale: 0.8 });
    s.stamp('maritime_v2/dock_clutter', -11, origin + 37, { y: 1.6 });
    s.stamp('maritime_v2/fishing_boat', 1, origin + 20, { y: 0, yaw: 0.3 });
    for (const z of [origin + 10, origin + 46]) {
      s.stamp('maritime/harbour_light', -10.2, z, { y: 1.6 });
      s.stamp('maritime/cargo_crate', -10.2, z + 5, { y: 1.6, yaw: 0.6 });
      s.stamp('maritime/cargo_crate', -9.6, z + 8, { y: 1.6, yaw: -0.3 });
    }
  }
  for (const t of [0.28, 0.43, 0.59, 0.74]) {
    for (const side of [-20, 18]) {
      const p = s.beside(t, side);
      s.stamp('maritime/mooring_buoy', p.x, p.z, { y: 0 });
    }
  }
  const lighthouse = s.stamp('maritime_v2/lighthouse', 16, 139, { y: 0 }).find((a) => a.name === 'light');
  s.tile('maritime_v2/breakwater', 21, 139, 3, { y: 0, yaw: Math.PI / 2 });
  s.stamp('maritime_v2/horizon_islands', -112, 171, { y: 0, yaw: Math.PI * 0.87, scale: 4.5 });
  await ctx.step('scenery', 0.85);
  return { ...s.finish(), cineMarks: { lighthouse } };
}
