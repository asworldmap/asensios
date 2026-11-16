import { scenery, shots } from './scenery.js';

export async function build(ctx) {
  const s = scenery(ctx, {
    id: 'europe', points: [[0, -86], [0, 0], [0, 94]], floor: -0.74, driveY: 0,
    ground: '#78816a', stop: 1, discoverAt: 0.60, radius: 11, exitCopy: 'world.bridge.t02',
    card: { key: 'ch5', photo: '/media/alpadia-field.webp', href: '/trajectory/#ch5' },
    day: { skyTop: '#80aed1', fog: '#dfeaf0', sunDir: [-0.62, 0.48, -0.5] },
    shots: shots([0, 5, 8, 3.9, -10, 1.6, 49], [0.44, 8, 11, 4.1, -17, 2, 48], [1, 7, -10, 4.6, -7, 2.6, 44]),
    establishing: { from: [38, 18, -76], look: [0, 2, -101] },
  });
  s.tile('europe/rail_track_straight', 0, -145, 26, { y: 0 });
  const platforms = [-123, 57];
  let stationDoor;
  for (const z of platforms) {
    s.tile('europe/rail_platform', 0, z, 5, { y: 0 });
    for (let i = 0; i < 3; i++) {
      const at = z + 10 + 10 * i;
      s.stamp('europe/station_shelter', 4.25, at, { y: 0.91, yaw: Math.PI });
      s.stamp('common/street_lamp', 5.4, at + 4, { y: 0.92 });
    }
    s.stamp('europe/rail_signal', -3.3, z + 39, { y: 0 });
    s.tile('europe_v2/platform_paving', 8.87, z + 6, 4, { y: 0.92 });
    // The depot apron meets the plinth behind the station.
    const t = z < 0 ? 0 : 0.80;
    s.groundStrip('#8b8372', 11, 0.9, 16.8, t, t + 0.20);
    stationDoor = s.stamp('europe_v2/station_building', 12.5, z + 25, { y: 0.92, yaw: -Math.PI / 2 }).find((a) => a.name === 'door');
    s.stamp('europe_v2/station_canopy', 12.5, z + 25, { y: 0.92, yaw: -Math.PI / 2 });
  }
  for (let z = -138; z <= 106; z += 19) s.stamp('europe/catenary_mast', -3.4, z, { y: 0 });
  for (let i = 0; i < 67; i++) {
    const x = (i % 2 ? -1 : 1) * (11 + 53 * s.random());
    s.stamp('europe/conifer', x, -175 + 320 * s.random(), { yaw: s.random() * 6, scale: 0.8 + s.random() });
  }
  s.stamp('europe_v2/signal_box', -11, 35, { yaw: Math.PI / 2 });
  for (const z of [-123, -110, 69, 86]) s.stamp('europe_v2/birch_tree', 20, z);
  for (const x of [-122, 9, 133]) s.stamp('europe_v2/alps_backdrop', x, 211, { y: -4, yaw: Math.PI, scale: 2.35 });
  await ctx.step('scenery', 0.85);
  return { ...s.finish(), cineMarks: { stationDoor } };
}
