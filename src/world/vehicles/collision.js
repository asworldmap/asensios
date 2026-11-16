import { clamp } from '../kit.js';

export function touches(c, x, z, radius) {
  let cx = c.x;
  let cz = c.z;
  if (c.type === 'segment') {
    const dx = c.bx - c.ax;
    const dz = c.bz - c.az;
    const t = clamp(((x - c.ax) * dx + (z - c.az) * dz) / (dx * dx + dz * dz || 1));
    cx = c.ax + dx * t;
    cz = c.az + dz * t;
  }
  return Math.hypot(x - cx, z - cz) < c.r + radius;
}
