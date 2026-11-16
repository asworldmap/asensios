// Small construction kit for the diorama.
//
// Every asset in Pedal the World is built here, in code, from primitives —
// there are no imported models. Static pieces are painted with vertex colours
// and merged into a handful of meshes, so a whole town costs a few draw calls.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Deterministic PRNG (mulberry32) so the world is identical on every visit. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Frame-rate independent exponential approach. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export function dampAngle(a, b, lambda, dt) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
}

// Smooth value noise on a hashed lattice — enough for rolling ground.
function hash(ix, iz) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
}

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

/** Compose a transform: position, yaw, scale (uniform or per-axis). */
export function M(x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ');
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(sx, sy, sz));
}

const _c = new THREE.Color();

/**
 * Accumulates coloured primitives and merges them into one geometry.
 * `sway` batches carry a per-vertex weight used by the wind shader.
 */
export class Batch {
  constructor({ sway = false, jitter = 0.035, seed = 7 } = {}) {
    this.parts = [];
    this.sway = sway;
    this.jitter = jitter;
    this.rand = rng(seed);
  }

  /**
   * @param geo     source geometry (not mutated, may be shared)
   * @param color   hex / css colour
   * @param matrix  placement
   * @param swayFn  (localY) => weight, only read by sway batches
   */
  add(geo, color, matrix, swayFn) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (g.attributes.uv) g.deleteAttribute('uv');
    const n = g.attributes.position.count;

    if (this.sway) {
      const w = new Float32Array(n);
      if (swayFn) {
        const pos = g.attributes.position;
        for (let i = 0; i < n; i++) w[i] = swayFn(pos.getY(i));
      }
      g.setAttribute('sway', new THREE.BufferAttribute(w, 1));
    }

    // Primitives are faceted on purpose; authored assets keep their normals.
    g.computeVertexNormals();
    if (matrix) g.applyMatrix4(matrix);

    _c.set(color);
    if (this.jitter) _c.offsetHSL(0, 0, (this.rand() - 0.5) * this.jitter);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = _c.r;
      col[i * 3 + 1] = _c.g;
      col[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts.push(g);
    return this;
  }

  /**
   * Add an authored (Blender) geometry that already carries vertex colours and
   * normals. COLOR_0 alpha encodes wind: sway = 1 - alpha. `tint` multiplies.
   */
  addGeometry(geo, matrix, tint) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    const n = g.attributes.position.count;
    const src = g.attributes.color;
    const col = new Float32Array(n * 3);
    const w = this.sway ? new Float32Array(n) : null;
    if (tint) _c.set(tint);
    for (let i = 0; i < n; i++) {
      let r = 1;
      let gg = 1;
      let b = 1;
      if (src) {
        r = src.getX(i);
        gg = src.getY(i);
        b = src.getZ(i);
        if (w && src.itemSize === 4) w[i] = 1 - src.getW(i);
      }
      if (tint) {
        r *= _c.r;
        gg *= _c.g;
        b *= _c.b;
      }
      col[i * 3] = r;
      col[i * 3 + 1] = gg;
      col[i * 3 + 2] = b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (w) g.setAttribute('sway', new THREE.BufferAttribute(w, 1));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (matrix) g.applyMatrix4(matrix);
    this.parts.push(g);
    return this;
  }

  get empty() {
    return this.parts.length === 0;
  }

  build() {
    if (!this.parts.length) return new THREE.BufferGeometry();
    const merged = mergeGeometries(this.parts, false);
    this.parts.forEach((g) => g.dispose());
    this.parts = [];
    return merged;
  }
}

/** Shared unit primitives — scaled through the placement matrix. */
export const P = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl12: new THREE.CylinderGeometry(1, 1, 1, 12),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  cone6: new THREE.ConeGeometry(1, 1, 6),
  cone8: new THREE.ConeGeometry(1, 1, 8),
  ico: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  dome: new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
  taper: new THREE.CylinderGeometry(0.72, 1, 1, 6),
};

const UP = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();

/** Matrix that stretches a unit Y cylinder/box from point a to point b. */
export function between(a, b, r) {
  _d.subVectors(b, a);
  const len = _d.length() || 1e-6;
  _q.setFromUnitVectors(UP, _d.divideScalar(len));
  _p.addVectors(a, b).multiplyScalar(0.5);
  return new THREE.Matrix4().compose(_p, _q, _s.set(r, len, r));
}

/** Point a live mesh (unit Y cylinder) from a to b — used for legs and stays. */
export function aim(mesh, a, b, r) {
  _d.subVectors(b, a);
  const len = _d.length() || 1e-6;
  mesh.quaternion.setFromUnitVectors(UP, _d.divideScalar(len));
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.scale.set(r, len, r);
}

/** Canvas texture with editorial type, used for road paint and small signs. */
export function textTexture(text, { size = 150, color = '#f6efdf', font = 'Instrument Serif', italic = false, pad = 24 } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const f = `${italic ? 'italic ' : ''}400 ${size}px "${font}", Georgia, serif`;
  g.font = f;
  const w = Math.ceil(g.measureText(text).width) + pad * 2;
  c.width = Math.min(2048, w);
  c.height = Math.ceil(size * 1.25);
  g.font = f;
  g.fillStyle = color;
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  g.fillText(text, c.width / 2, c.height / 2 + size * 0.04, c.width - pad);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, aspect: c.width / c.height };
}
