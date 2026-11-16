// A chapter's route: the line the story follows and vehicles are recovered to.
//
// Every chapter builds one from a handful of control points. Roads, rails and
// sea lanes are all "a route" to the engine; what differs is how a vehicle is
// allowed to leave it.

import * as THREE from 'three';
import { clamp, lerp } from './kit.js';

/**
 * @param points  [[x, z], ...] control points in world metres
 * @param samples resolution of the lookup tables
 * @param closed  true for loops (rail circuits, harbour tours)
 */
export function createRoute(points, { samples = 640, closed = false } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), closed, 'centripetal');
  const pts = curve.getSpacedPoints(samples);
  const N = pts.length;
  const length = curve.getLength();
  const RX = new Float32Array(N);
  const RZ = new Float32Array(N);
  const TX = new Float32Array(N);
  const TZ = new Float32Array(N);
  const RY = new Float32Array(N); // height profile — the chapter fills this in
  for (let i = 0; i < N; i++) {
    RX[i] = pts[i].x;
    RZ[i] = pts[i].z;
  }
  for (let i = 0; i < N; i++) {
    const a = closed ? (i - 1 + N - 1) % (N - 1) : Math.max(0, i - 1);
    const b = closed ? (i + 1) % (N - 1) : Math.min(N - 1, i + 1);
    const dx = RX[b] - RX[a];
    const dz = RZ[b] - RZ[a];
    const l = Math.hypot(dx, dz) || 1;
    TX[i] = dx / l;
    TZ[i] = dz / l;
  }

  const shared = { i: 0, d: 0, t: 0, y: 0, side: 0, f: 0 };

  /** Closest point on the route: distance, param t, height, signed side (>0 = left). */
  function nearest(x, z, out = shared) {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < N; i += 2) {
      const dx = x - RX[i];
      const dz = z - RZ[i];
      const d = dx * dx + dz * dz;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    let bi = best;
    let bf = 0;
    bd = Infinity;
    for (let s = Math.max(0, best - 2); s < Math.min(N - 1, best + 2); s++) {
      const ax = RX[s];
      const az = RZ[s];
      const ex = RX[s + 1] - ax;
      const ez = RZ[s + 1] - az;
      const f = clamp(((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1));
      const dx = x - (ax + ex * f);
      const dz = z - (az + ez * f);
      const d = dx * dx + dz * dz;
      if (d < bd) {
        bd = d;
        bi = s;
        bf = f;
      }
    }
    out.i = bi;
    out.f = bf;
    out.d = Math.sqrt(bd);
    out.t = (bi + bf) / (N - 1);
    out.y = lerp(RY[bi], RY[bi + 1], bf);
    out.side = (x - RX[bi]) * TZ[bi] - (z - RZ[bi]) * TX[bi];
    return out;
  }

  /** Position, tangent and height at param t (0..1; wraps on closed routes). */
  function pointAt(t, out = {}) {
    const tt = closed ? ((t % 1) + 1) % 1 : clamp(t);
    const u = tt * (N - 1);
    const i = Math.min(N - 2, Math.floor(u));
    const f = u - i;
    out.x = lerp(RX[i], RX[i + 1], f);
    out.z = lerp(RZ[i], RZ[i + 1], f);
    out.y = lerp(RY[i], RY[i + 1], f);
    out.tx = lerp(TX[i], TX[i + 1], f);
    out.tz = lerp(TZ[i], TZ[i + 1], f);
    const l = Math.hypot(out.tx, out.tz) || 1;
    out.tx /= l;
    out.tz /= l;
    return out;
  }

  /** A spot beside the route: `side` metres to the left (+) or right (-). */
  function beside(t, side) {
    const p = pointAt(t);
    return { x: p.x + p.tz * side, z: p.z - p.tx * side, tx: p.tx, tz: p.tz, yaw: Math.atan2(p.tx, p.tz) };
  }

  return { N, length, closed, RX, RZ, TX, TZ, RY, nearest, pointAt, beside };
}
