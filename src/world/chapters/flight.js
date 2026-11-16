import { smooth } from '../kit.js';
import { scenery, shots } from './scenery.js';

const TOUCHDOWN = 0.83;

export async function build(ctx) {
  const s = scenery(ctx, {
    id: 'flight',
    points: [[-44, -490], [-44, -310], [-44, -240], [8, -120], [88, -8],
      [115, 110], [115, 235], [115, 350], [115, 535]],
    height: (t) => 84 * smooth(0.14, 0.4, t) * (1 - smooth(0.59, TOUCHDOWN, t)),
    floor: -0.045, ground: '#7d8b78', stop: 1, discoverAt: 0.50, radius: 32, bounds: 705,
    storyRate: 4.6, storySpeed: 103, landing: TOUCHDOWN, exitCopy: 'world.bridge.t05',
    card: { key: 'ch4', photo: '/media/korea-cherry-signpost.webp', href: '/trajectory/#ch4' },
    day: { skyTop: '#85aaca', fog: '#dad8d5', skyHorizon: '#ecd4ba', sunDir: [-0.8, 0.24, -0.42], fogNear: 150, fogFar: 520 },
    shots: shots([0, 30, 45, 12, 0, 3.5, 46], [0.18, 46, -22, 10, 4, 3.8, 49],
      [0.5, 42, 30, 12, 4, 3.6, 45], [0.72, 42, 36, 13, 5, 3.2, 46],
      [0.84, 24, -37, 7, 1, 3.1, 46], [1, 33, -32, 10, 5, 3.3, 45]),
    establishing: { from: [4, 12, -465], look: [-43, 4, -481] },
  });

  for (const [from, to] of [[0, 0.22], [0.75, 1]]) {
    s.groundStrip('#5b5d61', 45, -0.015, 0, from, to);
    for (const side of [-21, 21]) {
      s.groundStrip('#dfdcd0', 0.32, -0.009, side, from, to);
      for (let t = from + 0.012; t < to; t += 0.023) {
        const p = s.beside(t, side * 1.09);
        s.stamp('asia/runway_light', p.x, p.z, { y: 0 });
      }
    }
    for (let t = from + 0.007; t < to - 0.01; t += 0.018) {
      s.groundStrip('#e2dfd4', 0.5, -0.01, 0, t, t + 0.008);
    }
  }

  let beacon;
  for (const [x, z] of [[-4, -473], [154, 493]]) {
    s.stamp('asia_v2/terminal_hall', x + 25, z, { y: 0, yaw: -Math.PI / 2 });
    const tower = s.stamp('asia_v2/control_tower', x + 48, z + 40, { y: 0, scale: 0.68 });
    beacon ??= tower.find((a) => a.name === 'beacon');
    s.stamp('asia_v2/windsock', x, z + 39, { y: 0 });
    s.stamp('asia/baggage_cart', x + 9, z + 5, { y: 0, yaw: 0.6 });
    for (const row of [-20, 0, 20]) s.stamp('asia_v2/apron_tile', x + 8, z + row, { y: -0.031 });
  }
  for (const z of [-532, -503, -445, -409]) s.stamp('asia_v2/rain_tree', 71, z, { scale: 0.84 });
  for (const [x, z, size] of [[-61, 480, 3.6], [25, 618, 4], [159, 698, 4.6], [305, 653, 5]]) {
    s.stamp('chile_v2/cordillera_backdrop', x, z, { y: -10, yaw: Math.PI, scale: size });
  }
  // Cloud banks flank the descent and leave the approach and both runways clear.
  s.stamp('journey/cloud_sea', -114, 47, { y: 24, scale: 1.8, unlit: true });
  s.stamp('journey/cloud_sea', 224, 145, { y: 26, scale: 1.25, unlit: true });
  s.stamp('journey/cloud_bank', 175, 254, { y: 26, scale: 1.5, unlit: true });
  s.stamp('journey/cloud_bank', 37, 209, { y: 44, scale: 1.6, unlit: true });
  await ctx.step('scenery', 0.85);
  return { ...s.finish(), cineMarks: { beacon } };
}
