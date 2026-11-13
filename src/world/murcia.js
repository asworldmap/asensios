// Chapter 1 — Murcia. Where it began.
//
// A compact diorama of the valley: the huerta (lemon orchards in rows) on the
// south bank, the river Segura, a stone bridge, a plaza with a stylised tower,
// and a mirador on the northern hill. Nothing here is a scan or a downloaded
// model: terrain, buildings, trees and people are all generated below.
//
// The chapter owns its geography (height field + route), its props, its
// colliders, its ambient life and its lighting. The engine (game.js) only
// asks: "how high is the ground here?", "where is the road?", "what is near?".

import * as THREE from 'three';
import { Batch, M, P, rng, noise, clamp, lerp, smooth, between, textTexture } from './kit.js';

const WATER_Y = -0.5;
const ROAD_HALF = 1.7;
const DECK_Y = 1.55;
const SAMPLES = 640;
const BOUNDS = 74;

// Route control points (x, z). South (+z) is the huerta, north the old town.
const ROUTE = [
  [-48, 56], [-37, 44], [-46, 30], [-31, 19], [-13, 22], [0, 12],
  [4, -3], [7, -17], [15, -29], [11, -44], [22, -54], [36, -50], [45, -60],
];

const riverZ = (x) => -4 + 4 * Math.sin(x * 0.045 + 0.6);

const PAL = {
  day: {
    skyTop: '#9cc3c4', skyHorizon: '#e5d6bb', fog: '#e5d6bb',
    sun: '#fff0d2', sunI: 2.25, hemiSky: '#fbf1dc', hemiGround: '#b79a68', hemiI: 1.35,
    water: '#5fa39a', window: '#3d4a4a', glow: 0, cloud: 0.92, orb: '#fff6dc',
  },
  night: {
    skyTop: '#060a08', skyHorizon: '#13211a', fog: '#0c120e',
    sun: '#9fc0d8', sunI: 0.75, hemiSky: '#3f5f66', hemiGround: '#10160f', hemiI: 0.95,
    water: '#16302f', window: '#ffd98a', glow: 1, cloud: 0.16, orb: '#e9f2e4',
  },
};

export async function buildMurcia({ scene, tier, step }) {
  const R = rng(20260);
  const group = new THREE.Group();
  scene.add(group);
  const disposables = [];
  const track = (o) => (disposables.push(o), o);

  // ------------------------------------------------------------------ Route
  const curve = new THREE.CatmullRomCurve3(ROUTE.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const pts = curve.getSpacedPoints(SAMPLES);
  const N = pts.length;
  const length = curve.getLength();
  const RX = new Float32Array(N);
  const RZ = new Float32Array(N);
  const TX = new Float32Array(N);
  const TZ = new Float32Array(N);
  const RY = new Float32Array(N);
  const bridge = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    RX[i] = pts[i].x;
    RZ[i] = pts[i].z;
  }
  for (let i = 0; i < N; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(N - 1, i + 1);
    const dx = RX[b] - RX[a];
    const dz = RZ[b] - RZ[a];
    const l = Math.hypot(dx, dz) || 1;
    TX[i] = dx / l;
    TZ[i] = dz / l;
  }

  function raw(x, z) {
    let h = 0.95 + 0.55 * noise(x * 0.045, z * 0.045) + 0.22 * noise(x * 0.13 + 7, z * 0.13 - 3);
    const hill = (cx, cz, s, amp) => amp * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * s * s));
    h += hill(-50, 56, 21, 6.2) + hill(46, -62, 17, 9.5) + hill(-62, -48, 22, 5) + hill(62, 40, 24, 4.5);
    const rd = Math.abs(z - riverZ(x));
    h = lerp(-1.7, h, smooth(3.2, 9.5, rd));
    return h;
  }

  const nearestOut = { i: 0, d: 0, t: 0, y: 0, side: 0, f: 0 };
  /** Closest point on the route: distance, param t, road height, signed side. */
  function nearest(x, z, out = nearestOut) {
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
    // Refine onto the neighbouring segments so d and t are continuous.
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
    out.side = (x - RX[bi]) * TZ[bi] - (z - RZ[bi]) * TX[bi]; // >0 = left of travel
    return out;
  }

  /** Position/tangent/height on the route at param t (0..1). */
  function pointAt(t, out = {}) {
    const u = clamp(t) * (N - 1);
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
  /** A spot beside the road: `side` metres to the left (+) or right (-). */
  const beside = (t, side) => {
    const p = pointAt(t);
    return { x: p.x + p.tz * side, z: p.z - p.tx * side, tx: p.tx, tz: p.tz, yaw: Math.atan2(p.tx, p.tz) };
  };

  // Plaza: a paved disc the road runs through.
  const plazaAt = beside(0.66, 6.5);
  const plaza = { x: plazaAt.x, z: plazaAt.z, r: 11, y: raw(plazaAt.x, plazaAt.z) + 0.15 };
  const inPlaza = (x, z) => Math.hypot(x - plaza.x, z - plaza.z) < plaza.r;

  // Road profile: follows the land, levels on the bridge and through the plaza.
  {
    const tmp = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const h = raw(RX[i], RZ[i]);
      bridge[i] = h < 0.3 ? 1 : 0;
      RY[i] = bridge[i] ? DECK_Y : inPlaza(RX[i], RZ[i]) ? plaza.y : Math.max(h, 0.45);
    }
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < N; i++) {
        let s = 0;
        let n = 0;
        for (let k = -16; k <= 16; k++) {
          const j = clamp(i + k, 0, N - 1);
          s += RY[j];
          n++;
        }
        tmp[i] = s / n;
      }
      RY.set(tmp);
    }
  }
  let b0 = bridge.indexOf(1);
  let b1 = bridge.lastIndexOf(1);
  b0 = Math.max(0, b0 - 4);
  b1 = Math.min(N - 1, b1 + 4);
  for (let i = b0; i <= b1; i++) bridge[i] = 1;
  const bridgeT = [b0 / (N - 1), b1 / (N - 1)];

  // Level pads for buildings and sets; filled in before the terrain is meshed.
  const pads = [plaza];
  const _n = { ...nearestOut };
  function heightNoPads(x, z) {
    let h = raw(x, z);
    const n = nearest(x, z, _n);
    if (!bridge[n.i]) h = lerp(h, n.y - 0.15, 1 - smooth(2.6, 7.5, n.d));
    return h;
  }
  function heightAt(x, z) {
    let h = heightNoPads(x, z);
    for (let k = 0; k < pads.length; k++) {
      const p = pads[k];
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r + 3.5) h = lerp(h, p.y, 1 - smooth(p.r, p.r + 3.5, d));
    }
    return h;
  }
  const addPad = (x, z, r) => {
    const p = { x, z, r, y: Math.max(heightNoPads(x, z), 0.5) };
    pads.push(p);
    return p;
  };

  const _g = { ...nearestOut };
  const groundOut = { y: 0, onRoad: false, onBridge: false, water: false, routeD: 0, t: 0 };
  /** What the wheels are on. */
  function groundAt(x, z, out = groundOut) {
    const n = nearest(x, z, _g);
    const terr = heightAt(x, z);
    out.routeD = n.d;
    out.t = n.t;
    out.onBridge = false;
    out.onRoad = n.d < ROAD_HALF + 0.3;
    if (bridge[n.i] && n.d < ROAD_HALF + 0.45 && terr < n.y) {
      out.y = n.y + 0.05;
      out.onBridge = true;
    } else {
      out.y = lerp(terr, n.y + 0.05, 1 - smooth(ROAD_HALF, ROAD_HALF + 0.8, n.d));
      if (bridge[n.i]) out.y = terr;
    }
    out.water = !out.onBridge && terr < WATER_Y - 0.12;
    return out;
  }

  // --------------------------------------------------------------- Layout
  const colliders = [];
  const solid = (x, z, r, extra) => colliders.push({ x, z, r, ...extra });

  const sites = {
    divulgalo: beside(0.145, 6.5),
    beemoney: beside(0.335, -7),
    mwy: { x: plaza.x + plazaAt.tz * 2.5, z: plaza.z - plazaAt.tx * 2.5 },
    eu: beside(0.815, -9.5),
    mirador: beside(0.992, 0),
  };
  const tower = { x: plaza.x + plazaAt.tz * 15 - plazaAt.tx * 3, z: plaza.z - plazaAt.tx * 15 - plazaAt.tz * 3 };
  const arcade = { x: plaza.x - plazaAt.tx * 8.2 + plazaAt.tz * 2, z: plaza.z - plazaAt.tz * 8.2 - plazaAt.tx * 2 };
  addPad(sites.divulgalo.x, sites.divulgalo.z, 3.4);
  addPad(sites.beemoney.x, sites.beemoney.z, 3.6);
  addPad(sites.eu.x, sites.eu.z, 6);
  addPad(tower.x, tower.z, 6);
  addPad(sites.mirador.x, sites.mirador.z, 4.5);

  const reserved = [
    { ...sites.divulgalo, r: 7 }, { ...sites.beemoney, r: 6 }, { ...sites.eu, r: 10 },
    { ...tower, r: 9 }, { x: plaza.x, z: plaza.z, r: plaza.r + 2 }, { ...sites.mirador, r: 7 },
  ];
  const free = (x, z, roadGap = 4.2) => {
    if (Math.hypot(x, z) > 118) return false;
    if (nearest(x, z, _n).d < roadGap) return false;
    if (Math.abs(z - riverZ(x)) < 9.5) return false;
    for (const r of reserved) if (Math.hypot(x - r.x, z - r.z) < r.r) return false;
    return !inSight(x, z);
  };

  // ------------------------------------------------------------ Story data
  const mid = (bridgeT[0] + bridgeT[1]) / 2;
  const beats = [
    { t: 0, id: 'start' },
    { t: 0.145, id: 'divulgalo', poi: 'divulgalo' },
    { t: 0.335, id: 'beemoney', poi: 'beemoney' },
    { t: mid, id: 'bridge', cine: true },
    { t: 0.66, id: 'mwy', poi: 'mwy' },
    { t: 0.815, id: 'eu', poi: 'eu' },
    { t: 1, id: 'end' },
  ];
  const sideOf = (id) => Math.sign(nearest(sites[id].x, sites[id].z, _n).side) || 1;
  // Camera keyframes in the bike's frame: metres behind, to its left, above; look-ahead; lens.
  const shots = [
    { t: 0, back: -5.2, side: 3.4, up: 1.5, ahead: 0, lift: 0.9, fov: 36 },
    { t: 0.045, back: 6.4, side: 0.6, up: 2.9, ahead: 3, lift: 1, fov: 46 },
    { t: 0.145, back: 6.8, side: -5.4 * sideOf('divulgalo'), up: 3.1, ahead: 1.5, lift: 1.2, fov: 42 },
    { t: 0.24, back: 9.5, side: 0, up: 5.6, ahead: 5, lift: 0.6, fov: 48 },
    { t: 0.335, back: 6.4, side: -5 * sideOf('beemoney'), up: 2.7, ahead: 1.5, lift: 1.1, fov: 42 },
    { t: bridgeT[0] - 0.035, back: 7.5, side: 1.5, up: 3.2, ahead: 4, lift: 1, fov: 46 },
    { t: mid, back: 0.5, side: 15, up: 2.7, ahead: 0.5, lift: 1.1, fov: 27 },
    { t: bridgeT[1] + 0.04, back: 8, side: -1.5, up: 3.6, ahead: 4, lift: 1, fov: 46 },
    { t: 0.66, back: 8.5, side: -7.5 * sideOf('mwy'), up: 6.6, ahead: 0, lift: 0.4, fov: 44, lookSide: 5 * sideOf('mwy') },
    { t: 0.745, back: 7.5, side: 0, up: 3.4, ahead: 4, lift: 1, fov: 46 },
    { t: 0.815, back: 7, side: -6 * sideOf('eu'), up: 2.9, ahead: 1, lift: 1.6, fov: 44, lookSide: 3 * sideOf('eu') },
    { t: 0.91, back: 8.5, side: 0.5, up: 4, ahead: 5, lift: 1, fov: 48 },
    { t: 0.965, back: 7.5, side: 1, up: 3.6, ahead: 4, lift: 1, fov: 48 },
    { t: 1, back: -8.5, side: 2.6, up: 4.4, ahead: -9, lift: -0.6, fov: 50 },
  ];

  // Keep the directed camera's sight lines free of trees and houses.
  const sight = [];
  for (let t = 0; t <= 1.0001; t += 0.008) {
    let i = 0;
    while (i < shots.length - 2 && t > shots[i + 1].t) i++;
    const a = shots[i];
    const b = shots[i + 1];
    const f = smooth(a.t, b.t, t);
    const p = pointAt(t);
    const back = lerp(a.back, b.back, f);
    const side = lerp(a.side, b.side, f);
    const cx = p.x - p.tx * back + p.tz * side;
    const cz = p.z - p.tz * back - p.tx * side;
    for (const k of [1, 0.72, 0.45]) sight.push([lerp(p.x, cx, k), lerp(p.z, cz, k), k === 1 ? 3.4 : 2.4]);
  }
  const inSight = (x, z) => {
    for (let k = 0; k < sight.length; k++) if (Math.hypot(x - sight[k][0], z - sight[k][1]) < sight[k][2]) return true;
    return false;
  };

  await step('terrain', 0.15);

  // -------------------------------------------------------------- Terrain
  {
    const SIZE = 280;
    const SEG = 140;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
    const flat = geo.toNonIndexed();
    geo.dispose();
    const p = flat.attributes.position;
    const col = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i += 3) {
      const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
      const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
      const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      const rd = Math.abs(z - riverZ(x));
      const south = z > riverZ(x);
      if (y < WATER_Y) c.set('#8f9a72');
      else if (rd < 10.5 && y < 0.75) c.set('#d6c493');
      else if (Math.hypot(x - plaza.x, z - plaza.z) < plaza.r + 1.2) c.set((Math.floor(x / 2) + Math.floor(z / 2)) % 2 ? '#dccba6' : '#d3c099');
      else if (y > 4.2) c.set(y > 7 ? '#bfa277' : '#c9ac7c');
      else if (south) c.set(Math.floor((x + z * 0.35) / 5.2) % 2 ? '#9fb05c' : '#8ea552');
      else c.set(noise(x * 0.09, z * 0.09) > 0.1 ? '#d9c28e' : '#d1b781');
      c.offsetHSL(0, 0, (R() - 0.5) * 0.045 + noise(x * 0.2, z * 0.2) * 0.012);
      for (let k = 0; k < 3; k++) {
        col[(i + k) * 3] = c.r;
        col[(i + k) * 3 + 1] = c.g;
        col[(i + k) * 3 + 2] = c.b;
      }
    }
    flat.setAttribute('color', new THREE.BufferAttribute(col, 3));
    flat.computeVertexNormals();
    const mesh = new THREE.Mesh(track(flat), track(new THREE.MeshLambertMaterial({ vertexColors: true })));
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  await step('road', 0.3);

  // ----------------------------------------------------------------- Road
  const paintMat = [];
  {
    const pos = [];
    const col = [];
    const road = new THREE.Color('#8b7b68');
    const edge = new THREE.Color('#a39178');
    const push = (x, y, z, c) => {
      pos.push(x, y, z);
      col.push(c.r, c.g, c.b);
    };
    const W = [-ROAD_HALF - 0.75, -ROAD_HALF, ROAD_HALF, ROAD_HALF + 0.75];
    const D = [-0.3, 0, 0, -0.3];
    for (let i = 0; i < N - 1; i++) {
      for (let k = 0; k < 3; k++) {
        const quad = [[i, k], [i + 1, k], [i + 1, k + 1], [i, k + 1]].map(([j, q]) => [
          RX[j] + TZ[j] * W[q], RY[j] + 0.05 + (bridge[j] ? 0 : D[q]), RZ[j] - TX[j] * W[q],
        ]);
        const c = k === 1 ? road : edge;
        [0, 1, 2, 0, 2, 3].forEach((v) => push(...quad[v], c));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(track(g), track(new THREE.MeshLambertMaterial({ vertexColors: true })));
    mesh.receiveShadow = true;
    group.add(mesh);

    // Centre dashes, as one cheap unlit mesh.
    const dp = [];
    for (let i = 6; i < N - 8; i += 14) {
      const a = i;
      const b = i + 5;
      const w = 0.07;
      const q = [
        [RX[a] + TZ[a] * w, RY[a] + 0.075, RZ[a] - TX[a] * w], [RX[b] + TZ[b] * w, RY[b] + 0.075, RZ[b] - TX[b] * w],
        [RX[b] - TZ[b] * w, RY[b] + 0.075, RZ[b] + TX[b] * w], [RX[a] - TZ[a] * w, RY[a] + 0.075, RZ[a] + TX[a] * w],
      ];
      [0, 1, 2, 0, 2, 3].forEach((v) => dp.push(...q[v]));
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
    const dm = track(new THREE.MeshBasicMaterial({ color: '#efe4cc', transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    paintMat.push(dm);
    group.add(new THREE.Mesh(track(dg), dm));
  }

  // Words painted on the tarmac, the way fans do on a mountain stage.
  function roadPaint(text, t, { width = 2.6, italic = false, across = true, opacity = 0.82 } = {}) {
    const { tex, aspect } = textTexture(text, { italic });
    track(tex);
    const p = pointAt(t);
    const p2 = pointAt(t + 0.004);
    const mat = track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    paintMat.push(mat);
    const w = across ? width : width * aspect;
    const h = across ? width / aspect : width;
    const m = new THREE.Mesh(track(new THREE.PlaneGeometry(across ? w : h * aspect, across ? h : h)), mat);
    m.position.set(p.x, p.y + 0.085, p.z);
    const slope = Math.atan2(p2.y - p.y, Math.hypot(p2.x - p.x, p2.z - p.z));
    // Readable for a rider approaching: text top points along the direction of travel.
    m.rotation.set(-Math.PI / 2 + slope, Math.atan2(p.tx, p.tz) + Math.PI, 0, 'YXZ');
    m.renderOrder = 1;
    group.add(m);
  }

  await step('town', 0.45);

  // ------------------------------------------------- Static batches & kit
  const S = new Batch({ seed: 11 }); // stone, walls, roofs, props
  const V = new Batch({ sway: true, seed: 23, jitter: 0.06 }); // vegetation
  const Wn = new Batch({ jitter: 0 }); // windows (one flat material, glows at night)
  const Lg = new Batch({ jitter: 0 }); // lamp bulbs (unlit)

  const prism = P.cyl6.clone();
  {
    const g = new THREE.CylinderGeometry(1, 1, 1, 3).toNonIndexed();
    g.rotateZ(Math.PI / 2);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.5, 0);
    g.scale(1, 1 / 1.5, 1 / 1.732);
    prism.copy(g);
    g.dispose();
  }
  const local = (base, x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => base.clone().multiply(M(x, y, z, ry, sx, sy, sz, rx, rz));

  const WALLS = ['#f2e7d1', '#ecd9b6', '#e6c79c', '#dcae86', '#efe0c4', '#d9b06a'];
  const ROOFS = ['#b5573a', '#a94f35', '#c0623f'];
  const glowSpots = [];

  function house(x, z, yaw, w, d, h, style) {
    const y = heightAt(x, z);
    const base = M(x, y, z, yaw);
    const wall = WALLS[Math.floor(R() * WALLS.length)];
    S.add(P.box, wall, local(base, 0, h / 2 - 0.4, 0, 0, w, h + 0.8, d));
    if (style === 'flat') {
      S.add(P.box, wall, local(base, 0, h + 0.12, 0, 0, w + 0.25, 0.24, d + 0.25));
      S.add(P.box, WALLS[0], local(base, w * 0.2, h + 0.6, -d * 0.15, 0, w * 0.35, 0.9, d * 0.4));
    } else {
      S.add(prism, ROOFS[Math.floor(R() * ROOFS.length)], local(base, 0, h, 0, 0, w + 0.5, Math.min(w, d) * 0.42, d + 0.5));
    }
    const cols = Math.max(1, Math.round(w / 1.6));
    const floors = Math.max(1, Math.round(h / 1.9));
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const lx = (c - (cols - 1) / 2) * (w / cols);
        const ly = 1.25 + f * 1.8;
        if (f === 0 && c === Math.floor(cols / 2)) {
          S.add(P.box, '#6b4a2e', local(base, lx, 0.75, d / 2 + 0.03, 0, 0.7, 1.5, 0.08));
        } else {
          Wn.add(P.box, '#ffffff', local(base, lx, ly, d / 2 + 0.03, 0, 0.5, 0.7, 0.06));
          if (R() > 0.5) S.add(P.box, '#3f6b55', local(base, lx - 0.36, ly, d / 2 + 0.04, 0, 0.14, 0.74, 0.05));
        }
        if (R() > 0.4) Wn.add(P.box, '#ffffff', local(base, lx, ly, -d / 2 - 0.03, 0, 0.5, 0.7, 0.06));
      }
    }
    solid(x, z, Math.max(w, d) * 0.56);
    if (Math.min(w, d) / Math.max(w, d) < 0.72) {
      const o = Math.abs(w - d) * 0.3;
      const ax = w > d ? Math.cos(yaw) : Math.sin(yaw);
      const az = w > d ? -Math.sin(yaw) : Math.cos(yaw);
      solid(x + ax * o, z + az * o, Math.min(w, d) * 0.6);
      solid(x - ax * o, z - az * o, Math.min(w, d) * 0.6);
    }
  }

  function lamp(x, z) {
    const y = groundAt(x, z).y;
    S.add(P.cyl6, '#4a4034', M(x, y + 1.4, z, 0, 0.05, 2.8, 0.05));
    S.add(P.cone6, '#4a4034', M(x, y + 2.95, z, 0, 0.28, 0.22, 0.28));
    Lg.add(P.ico, '#ffffff', M(x, y + 2.78, z, 0, 0.13));
    glowSpots.push([x, y, z]);
    solid(x, z, 0.18);
  }

  // Bridge: deck, curbs and piers over the Segura.
  {
    const STONE = '#cdb48a';
    for (let i = b0; i < b1; i += 4) {
      const j = Math.min(b1, i + 4);
      const a = new THREE.Vector3(RX[i], RY[i] - 0.3, RZ[i]);
      const b = new THREE.Vector3(RX[j], RY[j] - 0.3, RZ[j]);
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      const len = a.distanceTo(b) + 0.05;
      const mid = a.clone().add(b).multiplyScalar(0.5);
      S.add(P.box, STONE, M(mid.x, mid.y, mid.z, yaw, ROAD_HALF * 2 + 1.5, 0.6, len));
      for (const s of [-1, 1]) {
        const ox = Math.cos(yaw) * s * (ROAD_HALF + 0.55);
        const oz = -Math.sin(yaw) * s * (ROAD_HALF + 0.55);
        S.add(P.box, '#d9c39b', M(mid.x + ox, mid.y + 0.42, mid.z + oz, yaw, 0.32, 0.3, len));
      }
    }
    const span = b1 - b0;
    for (const f of [0.3, 0.7]) {
      const i = Math.round(b0 + span * f);
      const yaw = Math.atan2(TX[i], TZ[i]);
      S.add(P.box, STONE, M(RX[i], (RY[i] - 2.2) / 2 - 0.3, RZ[i], yaw, ROAD_HALF * 2 + 2.1, RY[i] + 2.2, 1.3));
      S.add(P.cyl8, STONE, M(RX[i], WATER_Y + 0.15, RZ[i], yaw, 1.1, 0.5, 1.1));
    }
    for (const i of [b0 + 2, b1 - 2]) {
      for (const s of [-1, 1]) lamp(RX[i] + TZ[i] * s * (ROAD_HALF + 0.55), RZ[i] - TX[i] * s * (ROAD_HALF + 0.55));
    }
  }

  // Tower and nave — inspired by a baroque bell tower, proportions invented.
  const bell = { x: tower.x, z: tower.z, y: 0 };
  {
    const y = heightAt(tower.x, tower.z);
    const yaw = Math.atan2(plaza.x - tower.x, plaza.z - tower.z);
    const base = M(tower.x, y, tower.z, yaw);
    const ST = '#d9bf8f';
    const ST2 = '#ceb07c';
    S.add(P.box, ST, local(base, 0, 4.2, 0, 0, 4.6, 9.2, 4.6));
    S.add(P.box, ST2, local(base, 0, 8.95, 0, 0, 5, 0.35, 5));
    S.add(P.box, ST, local(base, 0, 11.6, 0, 0, 4, 5, 4));
    S.add(P.box, ST2, local(base, 0, 14.25, 0, 0, 4.4, 0.35, 4.4));
    S.add(P.box, ST, local(base, 0, 16.2, 0, 0, 3.3, 3.6, 3.3));
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      Wn.add(P.box, '#ffffff', local(base, Math.sin(a) * 1.66, 16.3, Math.cos(a) * 1.66, a, 1.1, 2, 0.06));
      Wn.add(P.box, '#ffffff', local(base, Math.sin(a) * 2.01, 11.8, Math.cos(a) * 2.01, a, 0.7, 1.6, 0.06));
      S.add(P.cone4, ST2, local(base, Math.sin(a + 0.785) * 2.2, 18.5, Math.cos(a + 0.785) * 2.2, 0, 0.3, 1, 0.3));
    }
    S.add(P.cyl8, ST2, local(base, 0, 18.9, 0, 0, 1.55, 1.8, 1.55));
    S.add(P.dome, '#6f8f8a', local(base, 0, 19.8, 0, 0, 1.75, 1.9, 1.75));
    S.add(P.cyl6, ST, local(base, 0, 22, 0, 0, 0.32, 0.9, 0.32));
    S.add(P.cone6, '#6f8f8a', local(base, 0, 22.9, 0, 0, 0.42, 1, 0.42));
    // Nave behind the tower
    S.add(P.box, '#e4cfa3', local(base, 5.4, 3, -1.5, 0, 6.4, 6.8, 9));
    S.add(prism, ROOFS[0], local(base, 5.4, 6.4, -1.5, Math.PI / 2, 9.4, 2, 6.9));
    S.add(P.box, '#6b4a2e', local(base, 5.4, 1.3, 3.03, 0, 1.6, 2.6, 0.1));
    Wn.add(P.cyl12, '#ffffff', local(base, 5.4, 4.6, 3.02, 0, 0.8, 0.06, 0.8, Math.PI / 2));
    solid(tower.x, tower.z, 3.2);
    const nx = tower.x + Math.cos(yaw) * 5.4 - Math.sin(yaw) * 1.5;
    const nz = tower.z - Math.sin(yaw) * 5.4 - Math.cos(yaw) * 1.5;
    solid(nx, nz, 4.2);
    solid(nx - Math.sin(yaw) * 3.2, nz - Math.cos(yaw) * 3.2, 3.6);
    solid(nx + Math.sin(yaw) * 2.6, nz + Math.cos(yaw) * 2.6, 3.4);
    bell.y = y + 16.3;
  }

  // Town: a loose ring of houses around the plaza, plus a few on the huerta.
  {
    let made = 0;
    for (let k = 0; k < 60 && made < 19; k++) {
      const a = (k / 30) * Math.PI * 2 + R() * 0.3;
      const r = plaza.r + 7 + (k % 3) * 6.5 + R() * 2.5;
      const x = plaza.x + Math.cos(a) * r;
      const z = plaza.z + Math.sin(a) * r;
      if (!free(x, z, 5.5) || heightAt(x, z) > 4.5) continue;
      if (colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 4.4)) continue;
      const w = 3.4 + R() * 2.6;
      const d = 3.2 + R() * 1.6;
      house(x, z, Math.atan2(plaza.x - x, plaza.z - z) + (R() - 0.5) * 0.5, w, d, 2.6 + Math.floor(R() * 3) * 1.5, R() > 0.62 ? 'flat' : 'gable');
      made++;
    }
    for (const [x, z, yaw] of [[-20, 36, 0.6], [14, 30, -0.4], [-66, 22, 1.2], [30, 12, 0.2]]) {
      if (free(x, z, 5)) house(x, z, yaw, 5, 3.6, 2.6, 'gable');
    }
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.5;
      const lx = plaza.x + Math.cos(a) * (plaza.r - 0.6);
      const lz = plaza.z + Math.sin(a) * (plaza.r - 0.6);
      if (nearest(lx, lz, _n).d > 3) lamp(lx, lz);
    }
  }

  await step('nature', 0.6);

  // ------------------------------------------------------------ Vegetation
  const lemonTrees = [];
  const swayTop = (y0, y1) => (y) => smooth(y0, y1, y);
  function lemonTree(x, z) {
    const y = heightAt(x, z);
    const s = 0.85 + R() * 0.4;
    const base = M(x, y, z, R() * 6, s);
    V.add(P.cyl6, '#6b4a2e', local(base, 0, 0.7, 0, 0, 0.13, 1.5, 0.13));
    const g1 = ['#4f7f3a', '#58893e', '#477436'][Math.floor(R() * 3)];
    V.add(P.ico1, g1, local(base, 0, 2.1, 0, R() * 3, 1.25, 1.05, 1.25), swayTop(-1, 1));
    V.add(P.ico, '#5f9143', local(base, 0.5, 2.6, 0.2, R() * 3, 0.75, 0.65, 0.75), swayTop(-1, 1));
    for (let k = 0; k < 5; k++) {
      const a = R() * 6.28;
      V.add(P.ico, '#f2d024', local(base, Math.cos(a) * 1.05, 1.7 + R() * 0.8, Math.sin(a) * 1.05, 0, 0.11, 0.1, 0.14), () => 0.6);
    }
    const tree = { x, z, y: y + 2 * s, drops: 2, cool: 0 };
    lemonTrees.push(tree);
    solid(x, z, 0.5, { tree });
  }
  function palm(x, z) {
    const y = heightAt(x, z);
    const h = 4.2 + R() * 2;
    const lean = (R() - 0.5) * 0.25;
    const base = M(x, y, z, R() * 6);
    for (let k = 0; k < 4; k++) {
      V.add(P.taper, k % 2 ? '#8a6a45' : '#7d5f3d', local(base, lean * k * 0.5, (k + 0.5) * (h / 4), 0, 0, 0.2 - k * 0.02, h / 4 + 0.05, 0.2 - k * 0.02, 0, -lean), () => k * 0.12);
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      V.add(P.cone4, k % 2 ? '#5b8a45' : '#4f7c3e', local(base, lean * 2 + Math.cos(a) * 1.05, h - 0.1, Math.sin(a) * 1.05, -a, 0.34, 2.5, 0.09, 0, -Math.PI / 2 - 0.45), () => 0.9);
    }
    V.add(P.ico, '#6b4a2e', local(base, lean * 2, h, 0, 0, 0.3));
    solid(x, z, 0.3);
  }
  function pine(x, z) {
    const y = heightAt(x, z);
    const s = 0.9 + R() * 0.6;
    const base = M(x, y, z, R() * 6, s);
    V.add(P.cyl6, '#6a4b32', local(base, 0, 1.4, 0, 0, 0.16, 2.9, 0.16));
    V.add(P.ico1, '#3c6b3a', local(base, 0, 3.3, 0, 0, 1.9, 0.75, 1.9), swayTop(-1, 1));
    V.add(P.ico, '#467a41', local(base, 0.5, 3.75, -0.3, 1, 1.1, 0.5, 1.1), swayTop(-1, 1));
    solid(x, z, 0.32);
  }
  function cypress(x, z) {
    const y = heightAt(x, z);
    const s = 0.9 + R() * 0.5;
    V.add(P.cone8, '#2f5a36', M(x, y + 2.4 * s, z, 0, 0.55 * s, 4.8 * s, 0.55 * s), swayTop(-0.3, 0.5));
    solid(x, z, 0.4);
  }

  // Huerta: lemon trees in rows on the south bank.
  for (let gx = -86; gx <= 84; gx += 5.2) {
    for (let gz = 8; gz <= 84; gz += 5.2) {
      if (R() < 0.3) continue;
      const x = gx + (R() - 0.5) * 1.1 + gz * 0.35 * 0.2;
      const z = gz + (R() - 0.5) * 1.1;
      if (z < riverZ(x) + 10 || !free(x, z)) continue;
      const h = heightAt(x, z);
      if (h > 5.4) continue;
      const far = Math.hypot(x, z) > 82;
      if (far && R() < 0.5) continue;
      lemonTree(x, z);
    }
  }
  for (let k = 0; k < 30; k++) {
    const x = -90 + k * 6.2 + R() * 3;
    const s = k % 2 ? 1 : -1;
    const z = riverZ(x) + s * (10 + R() * 2.5);
    if (free(x, z, 3.4)) palm(x, z);
  }
  for (const a of [0.9, 2.6, 4.1, 5.5]) {
    const x = plaza.x + Math.cos(a) * (plaza.r - 2.2);
    const z = plaza.z + Math.sin(a) * (plaza.r - 2.2);
    if (nearest(x, z, _n).d > 3.4 && !inSight(x, z)) palm(x, z);
  }
  for (let k = 0; k < 150; k++) {
    const x = (R() - 0.5) * 220;
    const z = (R() - 0.5) * 220;
    const h = heightAt(x, z);
    if (!free(x, z)) continue;
    if (z < riverZ(x) && h > 2.6) (R() > 0.35 ? pine : cypress)(x, z);
    else if (z > riverZ(x) && h > 5.4) pine(x, z);
  }
  {
    const yaw = Math.atan2(plaza.x - tower.x, plaza.z - tower.z);
    for (const o of [-4.2, 4.2]) cypress(tower.x + Math.cos(yaw) * o + Math.sin(yaw) * 3.4, tower.z - Math.sin(yaw) * o + Math.cos(yaw) * 3.4);
  }
  // Rocks, reeds and bushes — small things that stop the ground reading as flat colour.
  for (let k = 0; k < 260; k++) {
    const x = (R() - 0.5) * 200;
    const z = (R() - 0.5) * 200;
    if (nearest(x, z, _n).d < 3 || inPlaza(x, z)) continue;
    const h = heightAt(x, z);
    const rd = Math.abs(z - riverZ(x));
    if (h < WATER_Y) continue;
    if (rd < 9 && h < 0.4) {
      for (let j = 0; j < 3; j++) V.add(P.cone4, '#7f9a55', M(x + j * 0.2, h + 0.55, z + (j % 2) * 0.2, 0, 0.07, 1.2, 0.07), swayTop(-0.4, 0.5));
    } else if (R() > 0.55) {
      S.add(P.ico, '#b9a17a', M(x, h + 0.08, z, R() * 6, 0.3 + R() * 0.5, 0.25 + R() * 0.25, 0.3 + R() * 0.4));
    } else if (free(x, z, 3)) {
      V.add(P.ico, z > riverZ(x) ? '#6f9a48' : '#8a9a5a', M(x, h + 0.25, z, R() * 6, 0.5 + R() * 0.5, 0.4 + R() * 0.2, 0.5 + R() * 0.5), swayTop(-1, 1));
    }
  }
  // Distant sierras that close the valley.
  {
    const B = new Batch({ jitter: 0.03, seed: 5 });
    for (let k = 0; k < 44; k++) {
      const a = (k / 44) * Math.PI * 2 + R() * 0.1;
      const r = 150 + R() * 26;
      const h = 8 + R() * 9;
      const w = 30 + R() * 22;
      B.add(P.ico1, k % 3 ? '#d3c09a' : '#c9b48c', M(Math.cos(a) * r, -3, Math.sin(a) * r, R() * 6, w, h, w * (0.6 + R() * 0.3)));
      if (k % 2) B.add(P.ico, '#cfbb94', M(Math.cos(a + 0.07) * (r - 14), -2, Math.sin(a + 0.07) * (r - 14), R() * 6, w * 0.5, h * 0.55, w * 0.4));
    }
    group.add(new THREE.Mesh(track(B.build()), track(new THREE.MeshLambertMaterial({ vertexColors: true }))));
  }

  await step('stories', 0.75);

  // ------------------------------------------------- Story sets and easels
  const easels = [];
  function easel(x, z, yaw, src, w = 2.5) {
    const y = heightAt(x, z);
    const base = M(x, y, z, yaw);
    const WOOD = '#7a5a3a';
    S.add(P.box, WOOD, local(base, -w * 0.36, 1.25, -0.28, 0, 0.09, 2.7, 0.09, -0.2));
    S.add(P.box, WOOD, local(base, w * 0.36, 1.25, -0.28, 0, 0.09, 2.7, 0.09, -0.2));
    S.add(P.box, WOOD, local(base, 0, 1.1, -0.75, 0, 0.09, 2.4, 0.09, 0.35));
    S.add(P.box, WOOD, local(base, 0, 0.72, -0.02, 0, w + 0.3, 0.1, 0.22));
    const mat = track(new THREE.MeshBasicMaterial({ color: '#cbb892' }));
    const mesh = new THREE.Mesh(track(new THREE.PlaneGeometry(1, 1)), mat);
    mesh.position.set(x, y + 0.8 + w * 0.34, z);
    mesh.rotation.set(-0.2, yaw, 0, 'YXZ');
    mesh.scale.set(w, w * 0.68, 1);
    mesh.translateZ(-0.06);
    group.add(mesh);
    easels.push({ mesh, mat, src, x, z, w, y: y + 0.78, state: 0 });
    solid(x, z, 0.9);
  }
  const facing = (site, off = 0) => {
    const n = nearest(site.x, site.z, _n);
    const p = pointAt(n.t);
    return Math.atan2(p.x - site.x, p.z - site.z) + off;
  };
  const offset = (site, yaw, right, fwd) => ({ x: site.x + Math.cos(yaw) * right + Math.sin(yaw) * fwd, z: site.z - Math.sin(yaw) * right + Math.cos(yaw) * fwd });

  // Divulgalo — a small outdoor film set: camera on a tripod and an atom model.
  const atom = new THREE.Group();
  {
    const s = sites.divulgalo;
    const yaw = facing(s);
    const y = heightAt(s.x, s.z);
    const cam = offset(s, yaw, -1.7, 1);
    const cb = M(cam.x, y, cam.z, yaw + 2.4);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      S.add(P.cyl6, '#3a2a1c', between(new THREE.Vector3(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5), new THREE.Vector3(0, 1.3, 0), 0.03).premultiply(cb));
    }
    S.add(P.box, '#3a3530', local(cb, 0, 1.45, 0, 0, 0.3, 0.3, 0.5));
    S.add(P.cyl8, '#2a2622', local(cb, 0, 1.45, 0.34, 0, 0.11, 0.2, 0.11, Math.PI / 2));
    S.add(P.cyl8, '#b5573a', local(cb, 0.02, 1.72, -0.05, 0, 0.14, 0.06, 0.14, 0, Math.PI / 2));
    solid(cam.x, cam.z, 0.5);
    const at = offset(s, yaw, 1.9, 0.6);
    S.add(P.cyl6, '#7a5a3a', M(at.x, y + 0.5, at.z, 0, 0.5, 1, 0.5));
    atom.position.set(at.x, y + 1.75, at.z);
    const ringGeo = track(new THREE.TorusGeometry(0.55, 0.025, 5, 28));
    const ringMat = track(new THREE.MeshLambertMaterial({ color: '#27512f' }));
    for (let k = 0; k < 3; k++) {
      const r = new THREE.Mesh(ringGeo, ringMat);
      r.rotation.set(Math.PI / 2, (k * Math.PI) / 3, 0.5, 'YXZ');
      atom.add(r);
    }
    atom.add(new THREE.Mesh(track(new THREE.IcosahedronGeometry(0.17, 1)), track(new THREE.MeshLambertMaterial({ color: '#b5573a' }))));
    group.add(atom);
    solid(at.x, at.z, 0.6);
    const e = offset(s, yaw, 0, -0.8);
    easel(e.x, e.z, yaw, '/media/divulgalo-muncyt.webp');
  }

  // BeeMoney — beehives between the lemon trees (and a few bees).
  const bees = [];
  {
    const s = sites.beemoney;
    const yaw = facing(s);
    const y = heightAt(s.x, s.z);
    const HIVE = ['#e8c44a', '#f2e7d1', '#7fb0a4'];
    [-2.1, 2.2, 3.3].forEach((r, k) => {
      const p = offset(s, yaw, r, k === 2 ? -1.1 : 0.5);
      const hb = M(p.x, y, p.z, yaw + (k - 1) * 0.3);
      S.add(P.box, '#7a5a3a', local(hb, 0, 0.14, 0, 0, 0.7, 0.28, 0.6));
      S.add(P.box, HIVE[k], local(hb, 0, 0.55, 0, 0, 0.82, 0.5, 0.7));
      S.add(P.box, HIVE[(k + 1) % 3], local(hb, 0, 1.02, 0, 0, 0.82, 0.42, 0.7));
      S.add(P.box, '#cfc6b4', local(hb, 0, 1.3, 0, 0, 0.98, 0.1, 0.86));
      S.add(P.box, '#3a2a1c', local(hb, 0, 0.4, 0.36, 0, 0.22, 0.05, 0.03));
      solid(p.x, p.z, 0.62);
    });
    const beeGeo = track(new THREE.IcosahedronGeometry(0.05, 0));
    const beeMat = track(new THREE.MeshBasicMaterial({ color: '#f0c020' }));
    for (let k = 0; k < 9; k++) {
      const m = new THREE.Mesh(beeGeo, beeMat);
      group.add(m);
      const p = offset(s, yaw, k % 2 ? -2.1 : 2.6, 0.3);
      bees.push({ m, x: p.x, z: p.z, y: y + 1.3, r: 0.5 + R() * 0.9, sp: 1.5 + R() * 2, ph: R() * 6 });
    }
    const e = offset(s, yaw, 0, -0.9);
    easel(e.x, e.z, yaw, '/media/beemoney-byg-stage.webp');
  }

  // Murcia Welcomes You — a ring of people in the plaza, echoing the 360° photo.
  const people = [];
  let peopleBody;
  let peopleHead;
  const bunting = [];
  {
    const s = sites.mwy;
    const COUNT = 14;
    const SHIRTS = ['#b5573a', '#f4ecd9', '#27512f', '#d9a441', '#5d8fa0', '#c98a6a', '#7a5a8a', '#3fbf16', '#e8c44a', '#44635a'];
    const SKIN = ['#e3b591', '#c98f67', '#8f5e3f', '#f0c8a4', '#a8744f'];
    peopleBody = new THREE.InstancedMesh(P.taper, track(new THREE.MeshLambertMaterial()), COUNT);
    peopleHead = new THREE.InstancedMesh(P.ico1, track(new THREE.MeshLambertMaterial()), COUNT);
    peopleBody.castShadow = true;
    const c = new THREE.Color();
    for (let k = 0; k < COUNT; k++) {
      const a = (k / COUNT) * Math.PI * 2;
      const person = { x: s.x + Math.cos(a) * 3.3, z: s.z + Math.sin(a) * 3.3, a, h: 0.86 + R() * 0.28, ph: R() * 6, hop: 0 };
      people.push(person);
      peopleBody.setColorAt(k, c.set(SHIRTS[k % SHIRTS.length]));
      peopleHead.setColorAt(k, c.set(SKIN[k % SKIN.length]));
      solid(person.x, person.z, 0.34);
    }
    group.add(peopleBody, peopleHead);

    // Bunting between four poles: many colours, no real flags.
    const BC = ['#b5573a', '#e8c44a', '#27512f', '#5d8fa0', '#f4ecd9', '#c98a6a'];
    const poles = [0.4, 1.97, 3.54, 5.11].map((a) => ({ x: plaza.x + Math.cos(a) * (plaza.r - 1.2), z: plaza.z + Math.sin(a) * (plaza.r - 1.2) }));
    poles.forEach((p) => {
      if (nearest(p.x, p.z, _n).d < 2.6) {
        const n = nearest(p.x, p.z, _n);
        const pt = pointAt(n.t);
        const push = (2.9 - n.d) * Math.sign(n.side || 1);
        p.x += pt.tz * push;
        p.z -= pt.tx * push;
      }
      S.add(P.cyl6, '#7a5a3a', M(p.x, plaza.y + 2.3, p.z, 0, 0.06, 4.6, 0.06));
      solid(p.x, p.z, 0.2);
    });
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.2, 0, 0, 0.2, 0, 0, 0, -0.42, 0]), 3));
    tri.computeVertexNormals();
    const bMat = track(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }));
    const perSpan = 11;
    const bMesh = new THREE.InstancedMesh(track(tri), bMat, poles.length * perSpan);
    let bi = 0;
    poles.forEach((p, k) => {
      const q = poles[(k + 1) % poles.length];
      for (let j = 0; j < perSpan; j++) {
        const f = (j + 0.5) / perSpan;
        const sag = Math.sin(f * Math.PI) * 0.9;
        bunting.push({ x: lerp(p.x, q.x, f), y: plaza.y + 4.5 - sag, z: lerp(p.z, q.z, f), yaw: Math.atan2(q.x - p.x, q.z - p.z) + Math.PI / 2, ph: f * 9 + k });
        bMesh.setColorAt(bi++, c.set(BC[(j + k) % BC.length]));
      }
    });
    bunting.mesh = bMesh;
    group.add(bMesh);

    const yaw = Math.atan2(pointAt(0.66).x - s.x, pointAt(0.66).z - s.z);
    const e = offset(s, yaw, 5.6, -1.5);
    easel(e.x, e.z, yaw - 0.45, '/media/mwy-community-360.webp', 2.8);
  }

  // Oficina de Proyectos Europeos — a civic building with a flag.
  let flag;
  {
    const s = sites.eu;
    const yaw = facing(s);
    const y = heightAt(s.x, s.z);
    const base = M(s.x, y, s.z, yaw);
    S.add(P.box, '#ecdcbc', local(base, 0, 2.3, -1.6, 0, 9, 5.4, 4.6));
    S.add(P.box, '#d9c39b', local(base, 0, 5.15, -1.6, 0, 9.5, 0.4, 5.1));
    S.add(prism, '#e4cfa3', local(base, 0, 5.3, 0.55, 0, 4.2, 1.1, 0.5));
    S.add(P.box, '#d9c39b', local(base, 0, 0.18, 1.5, 0, 5.2, 0.36, 2.2));
    for (const cx of [-1.8, -0.6, 0.6, 1.8]) S.add(P.cyl8, '#f2e7d1', local(base, cx, 2.6, 1.6, 0, 0.2, 4.9, 0.2));
    S.add(P.box, '#d9c39b', local(base, 0, 5.1, 1.5, 0, 4.6, 0.3, 0.9));
    S.add(P.box, '#6b4a2e', local(base, 0, 1.4, 0.72, 0, 1.3, 2.4, 0.08));
    for (const cx of [-3.4, -2.3, 2.3, 3.4]) {
      Wn.add(P.box, '#ffffff', local(base, cx, 1.5, 0.72, 0, 0.6, 1.1, 0.06));
      Wn.add(P.box, '#ffffff', local(base, cx, 3.6, 0.72, 0, 0.6, 1.1, 0.06));
    }
    for (const o of [-3, 0, 3]) {
      const c = offset(s, yaw, o, -1.6);
      solid(c.x, c.z, 2.9);
    }
    const fp = offset(s, yaw, -5.4, 2.6);
    S.add(P.cyl6, '#cfc6b4', M(fp.x, y + 3, fp.z, 0, 0.05, 6, 0.05));
    solid(fp.x, fp.z, 0.2);
    // Flag: twelve gold stars on blue, drawn here on a canvas.
    const cv = document.createElement('canvas');
    cv.width = 192;
    cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#143c8c';
    g.fillRect(0, 0, 192, 128);
    g.fillStyle = '#f5cf2e';
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const cx = 96 + Math.sin(a) * 40;
      const cy = 64 - Math.cos(a) * 40;
      g.beginPath();
      for (let j = 0; j < 10; j++) {
        const rr = j % 2 ? 2.8 : 7;
        const b = (j / 10) * Math.PI * 2 - Math.PI / 2;
        g.lineTo(cx + Math.cos(b) * rr, cy + Math.sin(b) * rr);
      }
      g.fill();
    }
    const tex = track(new THREE.CanvasTexture(cv));
    tex.colorSpace = THREE.SRGBColorSpace;
    const fg = track(new THREE.PlaneGeometry(1.8, 1.2, 8, 2));
    fg.translate(0.9, 0, 0);
    flag = new THREE.Mesh(fg, track(new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })));
    flag.position.set(fp.x, y + 5.3, fp.z);
    flag.rotation.y = yaw + 0.4;
    flag.userData.rest = fg.attributes.position.array.slice();
    group.add(flag);
    const e = offset(s, yaw, 5.9, 2.2);
    easel(e.x, e.z, yaw - 0.3, '/media/eu-parliament.webp', 2);
  }

  // Arcade cabinet in the plaza — the door to the Playroom.
  {
    const yaw = Math.atan2(plaza.x - arcade.x, plaza.z - arcade.z);
    const base = M(arcade.x, plaza.y, arcade.z, yaw);
    S.add(P.box, '#27512f', local(base, 0, 0.95, 0, 0, 0.9, 1.9, 0.8));
    S.add(P.box, '#1c3a22', local(base, 0, 1.0, 0.5, 0, 0.9, 0.12, 0.5, 0.25));
    S.add(P.box, '#3fbf16', local(base, 0, 2.0, 0.05, 0, 0.94, 0.26, 0.86));
    Wn.add(P.box, '#ffffff', local(base, 0, 1.5, 0.41, 0, 0.66, 0.5, 0.04, -0.15));
    S.add(P.ico, '#b5573a', local(base, -0.2, 1.12, 0.56, 0, 0.06));
    S.add(P.ico, '#e8c44a', local(base, 0.15, 1.1, 0.6, 0, 0.045));
    solid(arcade.x, arcade.z, 0.7);
  }

  // Mirador: a bench, a railing and a signpost toward the next chapter.
  let signpost;
  {
    const s = sites.mirador;
    const end = pointAt(1);
    const yaw = Math.atan2(end.tx, end.tz);
    const y = heightAt(s.x, s.z);
    for (let k = -3; k <= 3; k++) {
      const p = offset(s, yaw, k * 1.1, 4.2 - Math.abs(k) * 0.25);
      S.add(P.cyl6, '#7a5a3a', M(p.x, heightAt(p.x, p.z) + 0.5, p.z, 0, 0.07, 1, 0.07));
      solid(p.x, p.z, 0.45);
    }
    const r0 = offset(s, yaw, -3.3, 3.45);
    const r1 = offset(s, yaw, 3.3, 3.45);
    S.add(P.box, '#7a5a3a', between(new THREE.Vector3(r0.x, y + 0.9, r0.z), new THREE.Vector3(r1.x, y + 0.9, r1.z), 0.09));
    const b = offset(s, yaw, -2.7, 1.6);
    S.add(P.box, '#8a6a45', M(b.x, y + 0.45, b.z, yaw + 0.5, 1.6, 0.1, 0.5));
    S.add(P.box, '#7a5a3a', M(b.x, y + 0.22, b.z, yaw + 0.5, 1.3, 0.44, 0.12));
    solid(b.x, b.z, 0.8);
    const sp = offset(s, yaw, 2.8, 1.4);
    S.add(P.cyl6, '#6b4a2e', M(sp.x, y + 1.5, sp.z, 0, 0.07, 3, 0.07));
    solid(sp.x, sp.z, 0.25);
    signpost = { x: sp.x, y, z: sp.z, yaw };
    pine(offset(s, yaw, -5.5, -1).x, offset(s, yaw, -5.5, -1).z);
  }

  // Commit the merged static geometry.
  const windowMat = track(new THREE.MeshBasicMaterial({ color: PAL.day.window }));
  const lampMat = track(new THREE.MeshBasicMaterial({ color: '#fff3c4' }));
  const wind = { value: 0 };
  const vegMat = track(new THREE.MeshLambertMaterial({ vertexColors: true }));
  vegMat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = wind;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float sway;\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float ph = uWind * 1.4 + position.x * 0.31 + position.z * 0.27;
         transformed.x += sin(ph) * 0.085 * sway;
         transformed.z += cos(ph * 0.83) * 0.06 * sway;`
      );
  };
  {
    const sm = new THREE.Mesh(track(S.build()), track(new THREE.MeshLambertMaterial({ vertexColors: true })));
    const vm = new THREE.Mesh(track(V.build()), vegMat);
    sm.castShadow = sm.receiveShadow = vm.castShadow = true;
    vm.receiveShadow = true;
    group.add(sm, vm, new THREE.Mesh(track(Wn.build()), windowMat), new THREE.Mesh(track(Lg.build()), lampMat));
  }

  // Warm pools of light under the lamps — night only, no real lights involved.
  const glowMat = track(new THREE.MeshBasicMaterial({ color: '#ffcf7a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  {
    const gm = new THREE.InstancedMesh(track(new THREE.CircleGeometry(3.2, 20)), glowMat, glowSpots.length);
    const m = new THREE.Matrix4();
    glowSpots.forEach(([x, y, z], i) => gm.setMatrixAt(i, m.makeRotationX(-Math.PI / 2).setPosition(x, y + 0.12, z)));
    gm.renderOrder = 1;
    group.add(gm);
  }

  await step('life', 0.88);

  // ---------------------------------------------------------- Water & sky
  const waterMat = track(new THREE.MeshLambertMaterial({ color: PAL.day.water, transparent: true, opacity: 0.9 }));
  {
    const w = new THREE.Mesh(track(new THREE.PlaneGeometry(290, 46)), waterMat);
    w.rotation.x = -Math.PI / 2;
    w.position.set(0, WATER_Y, -4);
    group.add(w);
  }
  const glints = [];
  const glintMat = track(new THREE.MeshBasicMaterial({ color: '#f6efdf', transparent: true, opacity: 0.4, depthWrite: false }));
  {
    const gg = track(new THREE.PlaneGeometry(1.6, 0.07));
    gg.rotateX(-Math.PI / 2);
    for (let k = 0; k < (tier === 'mobile' ? 18 : 34); k++) {
      const m = new THREE.Mesh(gg, glintMat);
      group.add(m);
      glints.push({ m, x: (R() - 0.5) * 200, o: (R() - 0.5) * 5, sp: 1.4 + R() * 1.6, len: 0.6 + R() });
    }
  }

  const skyU = { top: { value: new THREE.Color(PAL.day.skyTop) }, horizon: { value: new THREE.Color(PAL.day.skyHorizon) } };
  const sky = new THREE.Mesh(
    track(new THREE.SphereGeometry(400, 20, 12)),
    track(
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: skyU,
        vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader:
          'uniform vec3 top; uniform vec3 horizon; varying float h; void main(){ float t = smoothstep(0.02, 0.5, h); gl_FragColor = vec4(mix(horizon, top, t), 1.0); \n#include <colorspace_fragment>\n }',
      })
    )
  );
  sky.renderOrder = -10;
  group.add(sky);
  const orbMat = track(new THREE.MeshBasicMaterial({ color: PAL.day.orb, fog: false }));
  const orb = new THREE.Mesh(track(new THREE.CircleGeometry(9, 28)), orbMat);
  group.add(orb);

  const clouds = [];
  const cloudMat = track(new THREE.MeshBasicMaterial({ color: '#fbf5e6', transparent: true, opacity: PAL.day.cloud, fog: false }));
  {
    const B = new Batch({ jitter: 0 });
    for (let k = 0; k < 4; k++) B.add(P.ico1, '#ffffff', M((k - 1.5) * 3.2, (k % 2) * 0.9, (k % 3) * 0.8, k, 3 + (k % 2) * 1.2, 1.5, 2.4));
    const cg = track(B.build());
    for (let k = 0; k < 7; k++) {
      const m = new THREE.Mesh(cg, cloudMat);
      m.position.set((R() - 0.5) * 300, 46 + R() * 22, (R() - 0.5) * 300);
      m.scale.setScalar(1.2 + R() * 1.4);
      group.add(m);
      clouds.push(m);
    }
  }

  // --------------------------------------------------------------- Lights
  const hemi = new THREE.HemisphereLight(PAL.day.hemiSky, PAL.day.hemiGround, PAL.day.hemiI);
  const sun = new THREE.DirectionalLight(PAL.day.sun, PAL.day.sunI);
  const sunDir = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();
  group.add(hemi, sun, sun.target);
  const fog = new THREE.Fog(PAL.day.fog, 55, 150);
  scene.fog = fog;
  orb.position.copy(sunDir).multiplyScalar(-1).setY(0.2).normalize().multiplyScalar(380);
  orb.position.y = 70;
  orb.lookAt(0, 0, 0);

  // ----------------------------------------------------------- Ambient life
  const pigeons = [];
  {
    const body = track(new THREE.IcosahedronGeometry(0.13, 0));
    const wingG = new THREE.BufferGeometry();
    wingG.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.1, 0, 0, -0.1, 0.36, 0, 0]), 3));
    wingG.computeVertexNormals();
    track(wingG);
    const mat = track(new THREE.MeshLambertMaterial({ color: '#8d8f96', side: THREE.DoubleSide }));
    const yaw = Math.atan2(plaza.x - tower.x, plaza.z - tower.z);
    for (let k = 0; k < 9; k++) {
      const g = new THREE.Group();
      const b = new THREE.Mesh(body, mat);
      b.scale.set(0.8, 0.8, 1.5);
      const wl = new THREE.Mesh(wingG, mat);
      const wr = new THREE.Mesh(wingG, mat);
      wr.scale.x = -1;
      g.add(b, wl, wr);
      const hx = tower.x + Math.sin(yaw) * (5 + R() * 3) + (R() - 0.5) * 5;
      const hz = tower.z + Math.cos(yaw) * (5 + R() * 3) + (R() - 0.5) * 5;
      group.add(g);
      pigeons.push({ g, wl, wr, hx, hz, hy: heightAt(hx, hz) + 0.12, t: 0, fly: 0, ph: R() * 6, r: 5 + R() * 4, h: 9 + R() * 8 });
    }
  }

  // Loose things the bike can knock around: lemons (pooled) and a football.
  const balls = [];
  const lemonGeo = track(new THREE.IcosahedronGeometry(0.16, 0));
  const lemonMat = track(new THREE.MeshLambertMaterial({ color: '#f2d024' }));
  for (let k = 0; k < 16; k++) {
    const m = new THREE.Mesh(lemonGeo, lemonMat);
    m.scale.set(1, 0.85, 1.25);
    m.visible = false;
    m.castShadow = true;
    group.add(m);
    balls.push({ m, kind: 'lemon', live: false, r: 0.16, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0 });
  }
  {
    const m = new THREE.Mesh(track(new THREE.IcosahedronGeometry(0.3, 1)), track(new THREE.MeshLambertMaterial({ color: '#f4ecd9', flatShading: true })));
    m.castShadow = true;
    group.add(m);
    const x = plaza.x - plazaAt.tz * 1.5 + plazaAt.tx * 4;
    const z = plaza.z + plazaAt.tx * 1.5 + plazaAt.tz * 4;
    balls.push({ m, kind: 'ball', live: true, r: 0.3, x, y: plaza.y + 0.3, z, vx: 0, vy: 0, vz: 0, age: 0, home: [x, z] });
  }

  // Markers: one small green beacon per story point. The only "UI" in the world.
  const markerMat = track(new THREE.MeshBasicMaterial({ color: '#3fbf16' }));
  const markerGeo = track(new THREE.OctahedronGeometry(0.26, 0));
  const ringGeo = track(new THREE.RingGeometry(1.5, 1.62, 40));
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = track(new THREE.MeshBasicMaterial({ color: '#3fbf16', transparent: true, opacity: 0.5, depthWrite: false }));

  const pois = [
    { id: 'divulgalo', t: 0.145, site: sites.divulgalo, key: 'ch1', photo: '/media/divulgalo-muncyt.webp', radius: 6.5 },
    { id: 'beemoney', t: 0.335, site: sites.beemoney, key: 'ch9', photo: '/media/beemoney-byg-stage.webp', radius: 6.5 },
    { id: 'mwy', t: 0.66, site: sites.mwy, key: 'ch6', photo: '/media/mwy-community-360.webp', radius: 10.5, stats: true },
    { id: 'eu', t: 0.815, site: sites.eu, key: 'ch7', photo: '/media/eu-parliament.webp', radius: 8.5, anchor: [0, 3.2] },
    { id: 'playroom', t: 0.69, site: arcade, kind: 'link', radius: 3.6, minor: true },
  ];
  pois.forEach((p) => {
    const n = nearest(p.site.x, p.site.z, _n);
    p.side = Math.sign(n.side) || 1;
    p.x = p.site.x;
    p.z = p.site.z;
    p.y = heightAt(p.x, p.z);
    const m = new THREE.Mesh(markerGeo, markerMat);
    const lift = p.id === 'eu' ? 7.4 : p.id === 'playroom' ? 2.9 : p.id === 'mwy' ? 3 : 3.6;
    m.position.set(p.x, p.y + lift, p.z);
    m.userData.baseY = p.y + lift;
    if (p.minor) m.scale.setScalar(0.7);
    p.marker = m;
    group.add(m);
    if (!p.minor) {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      const fx = p.id === 'mwy' ? p.x : lerp(p.x, pointAt(p.t).x, 0.45);
      const fz = p.id === 'mwy' ? p.z : lerp(p.z, pointAt(p.t).z, 0.45);
      ring.position.set(fx, heightAt(fx, fz) + 0.1, fz);
      if (p.id === 'mwy') ring.scale.setScalar(0.75);
      p.ring = ring;
      p.focus = { x: fx, z: fz };
      group.add(ring);
    } else p.focus = { x: p.x, z: p.z };
  });

  // Road paint and the mirador sign need the display face; wait briefly for it.
  try {
    await Promise.race([document.fonts.load('400 150px "Instrument Serif"'), new Promise((r) => setTimeout(r, 1200))]);
  } catch {
    /* falls back to Georgia */
  }
  roadPaint('MURCIA', 0.035, { width: 2.9 });
  roadPaint('¡VENGA!', 0.235, { width: 2.7, italic: true });
  roadPaint('SEGURA', bridgeT[0] - 0.022, { width: 2.6 });
  roadPaint('¡ÁNIMO!', 0.9, { width: 2.7, italic: true });
  {
    const { tex, aspect } = textTexture('EUROPA →', { size: 120, color: '#f6efdf' });
    track(tex);
    const board = new THREE.Mesh(track(new THREE.PlaneGeometry(0.5 * aspect, 0.5)), track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })));
    const back = new THREE.Mesh(track(new THREE.BoxGeometry(0.5 * aspect + 0.16, 0.62, 0.05)), track(new THREE.MeshLambertMaterial({ color: '#27512f' })));
    board.position.set(signpost.x, signpost.y + 2.6, signpost.z);
    board.rotation.y = signpost.yaw + Math.PI - 0.35;
    back.position.copy(board.position);
    back.rotation.copy(board.rotation);
    const board2 = board.clone();
    board2.rotation.y += Math.PI;
    board.translateZ(0.03);
    board2.translateZ(0.03);
    group.add(back, board, board2);
    signpost.board = board;
  }

  // --------------------------------------------------------------- Theming
  let dark = false;
  const cA = new THREE.Color();
  function setTheme(isDark) {
    dark = isDark;
    const p = isDark ? PAL.night : PAL.day;
    skyU.top.value.set(p.skyTop);
    skyU.horizon.value.set(p.skyHorizon);
    fog.color.set(p.fog);
    scene.background = cA.set(p.fog).clone();
    sun.color.set(p.sun);
    sun.intensity = p.sunI;
    hemi.color.set(p.hemiSky);
    hemi.groundColor.set(p.hemiGround);
    hemi.intensity = p.hemiI;
    waterMat.color.set(p.water);
    windowMat.color.set(p.window);
    glowMat.opacity = p.glow * 0.22;
    cloudMat.opacity = p.cloud;
    orbMat.color.set(p.orb);
    orb.scale.setScalar(isDark ? 0.55 : 1);
    lampMat.color.set(isDark ? '#ffe1a0' : '#f6efdf');
    markerMat.color.set(isDark ? '#93f75a' : '#3fbf16');
    ringMat.color.set(isDark ? '#93f75a' : '#3fbf16');
    paintMat.forEach((m) => m.color.set(isDark ? '#8f8a7c' : '#ffffff'));
    glintMat.opacity = isDark ? 0.16 : 0.4;
  }

  // ---------------------------------------------------------------- Update
  const loader = new THREE.TextureLoader();
  const mtx = new THREE.Matrix4();
  const events = [];
  let scatter = 0;

  function dropLemon(tree, fromX, fromZ) {
    if (tree.drops <= 0 || tree.cool > 0) return false;
    const b = balls.find((q) => q.kind === 'lemon' && !q.live);
    if (!b) return false;
    tree.drops--;
    tree.cool = 0.8;
    const a = Math.atan2(tree.x - fromX, tree.z - fromZ) + (R() - 0.5) * 2.4;
    Object.assign(b, { live: true, age: 0, x: tree.x + Math.sin(a) * 0.9, y: tree.y, z: tree.z + Math.cos(a) * 0.9, vx: Math.sin(a) * 1.6, vy: 1.5, vz: Math.cos(a) * 1.6 });
    b.m.visible = true;
    return true;
  }

  function scatterPigeons() {
    if (scatter > 0) return;
    scatter = 9;
    pigeons.forEach((p, i) => (p.fly = 0.001 + i * 0.0001));
  }

  /**
   * @param s { dt, time, x, z, speed, calm, canCollect }
   * @returns array of events: {type:'lemon'} | {type:'pigeons'}
   */
  function update(s) {
    const { dt, time } = s;
    events.length = 0;
    if (!s.calm) wind.value = time;

    // Photo boards load when the rider is heading their way, not before.
    for (const e of easels) {
      if (e.state === 0 && Math.hypot(e.x - s.x, e.z - s.z) < 55) {
        e.state = 1;
        loader.load(
          e.src,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = 4;
            const a = tex.image.width / tex.image.height;
            const w = a >= 1 ? e.w : e.w * 0.78;
            e.mesh.scale.set(w, w / a, 1);
            e.mesh.position.y = e.y + w / a / 2 + 0.02;
            e.mat.map = track(tex);
            e.mat.color.set('#ffffff');
            e.mat.needsUpdate = true;
            e.state = 2;
          },
          undefined,
          () => (e.state = 3)
        );
      }
    }

    // People: an easy sway; they jump when the bike rides into the circle.
    const inRing = Math.hypot(sites.mwy.x - s.x, sites.mwy.z - s.z) < 2.6;
    people.forEach((p, k) => {
      p.hop = inRing ? Math.min(1, p.hop + dt * 3) : Math.max(0, p.hop - dt * 2);
      const bob = s.calm ? 0 : Math.abs(Math.sin(time * (inRing ? 7 : 1.6) + p.ph)) * (0.04 + p.hop * 0.3);
      const y = plaza.y + bob;
      mtx.compose(_v.set(p.x, y + p.h * 0.5, p.z), _qq.setFromAxisAngle(_up, -p.a + Math.PI / 2 + Math.sin(time + p.ph) * 0.1), _sc.set(0.27, p.h, 0.27));
      peopleBody.setMatrixAt(k, mtx);
      mtx.compose(_v.set(p.x, y + p.h + 0.17, p.z), _qq, _sc.set(0.19, 0.19, 0.19));
      peopleHead.setMatrixAt(k, mtx);
    });
    peopleBody.instanceMatrix.needsUpdate = true;
    peopleHead.instanceMatrix.needsUpdate = true;

    bunting.forEach((b, k) => {
      mtx.compose(_v.set(b.x, b.y, b.z), _qq.setFromEuler(_eu.set(s.calm ? 0 : Math.sin(time * 2.2 + b.ph) * 0.35, b.yaw, 0, 'YXZ')), _sc.set(1, 1, 1));
      bunting.mesh.setMatrixAt(k, mtx);
    });
    bunting.mesh.instanceMatrix.needsUpdate = true;

    if (!s.calm) {
      atom.rotation.y = time * 0.7;
      atom.rotation.x = Math.sin(time * 0.5) * 0.25;
      const fp = flag.geometry.attributes.position;
      const rest = flag.userData.rest;
      for (let i = 0; i < fp.count; i++) {
        const x = rest[i * 3];
        fp.setZ(i, Math.sin(x * 3.2 - time * 5) * 0.11 * x);
      }
      fp.needsUpdate = true;
      clouds.forEach((c) => {
        c.position.x += dt * 0.9;
        if (c.position.x > 160) c.position.x = -160;
      });
      for (const g of glints) {
        g.x += g.sp * dt;
        if (g.x > 105) g.x = -105;
        g.m.position.set(g.x, WATER_Y + 0.03, riverZ(g.x) + g.o);
        g.m.rotation.y = -Math.atan(Math.cos(g.x * 0.045 + 0.6) * 0.18);
        g.m.scale.x = g.len * (0.6 + 0.4 * Math.sin(time * 1.3 + g.o * 3));
      }
      for (const b of bees) {
        const a = time * b.sp + b.ph;
        b.m.position.set(b.x + Math.cos(a) * b.r, b.y + Math.sin(a * 1.7) * 0.35, b.z + Math.sin(a) * b.r);
      }
    }
    pois.forEach((p, k) => {
      p.marker.position.y = p.marker.userData.baseY + (s.calm ? 0 : Math.sin(time * 1.8 + k) * 0.14);
      p.marker.rotation.y = time * 0.9 + k;
    });

    // Pigeons: scatter when the bike gets close (or the bell rings), then return.
    scatter = Math.max(0, scatter - dt);
    for (const p of pigeons) {
      if (!p.fly && Math.hypot(p.hx - s.x, p.hz - s.z) < 3.6 && Math.abs(s.speed) > 1) {
        scatterPigeons();
        events.push({ type: 'pigeons' });
      }
      if (p.fly) {
        p.fly += dt;
        const f = clamp(p.fly / 8.5);
        const up = Math.sin(f * Math.PI);
        const a = p.ph + f * 7;
        p.g.position.set(lerp(p.hx, tower.x + Math.cos(a) * p.r, smooth(0, 0.25, f) * (1 - smooth(0.8, 1, f))), p.hy + up * p.h, lerp(p.hz, tower.z + Math.sin(a) * p.r, smooth(0, 0.25, f) * (1 - smooth(0.8, 1, f))));
        p.g.rotation.y = -a;
        const flap = Math.sin(time * 22 + p.ph) * 0.9;
        p.wl.rotation.z = flap;
        p.wr.rotation.z = -flap;
        if (f >= 1) p.fly = 0;
      } else {
        p.g.position.set(p.hx, p.hy + (s.calm ? 0 : Math.max(0, Math.sin(time * 3 + p.ph)) * 0.03), p.hz);
        p.g.rotation.y = p.ph;
        p.wl.rotation.z = p.wr.rotation.z = -1.2;
      }
    }

    // Loose objects.
    for (const t of lemonTrees) if (t.cool > 0) t.cool -= dt;
    for (const b of balls) {
      if (!b.live) continue;
      b.age += dt;
      b.vy -= 14 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      const g = groundAt(b.x, b.z, _bg);
      const floor = g.y + b.r;
      if (b.y < floor) {
        b.y = floor;
        if (b.vy < -1.2) b.vy *= -0.42;
        else b.vy = 0;
        // Roll with the slope, lose energy to the ground.
        const e = 0.6;
        const sx = (groundAt(b.x + e, b.z, _bg2).y - g.y) / e;
        const sz = (groundAt(b.x, b.z + e, _bg2).y - g.y) / e;
        b.vx -= sx * 9 * dt;
        b.vz -= sz * 9 * dt;
        const fr = Math.exp(-(b.kind === 'ball' ? 0.9 : 2.2) * dt);
        b.vx *= fr;
        b.vz *= fr;
      }
      const dx = b.x - s.x;
      const dz = b.z - s.z;
      const d = Math.hypot(dx, dz);
      if (b.kind === 'lemon') {
        if (s.canCollect && b.age > 0.5 && d < 0.95) {
          b.live = false;
          b.m.visible = false;
          events.push({ type: 'lemon' });
          continue;
        }
        if (b.age > 40 || g.water) {
          b.live = false;
          b.m.visible = false;
          continue;
        }
      } else if (d < 0.85 && s.canCollect) {
        const k = Math.max(3, Math.abs(s.speed) * 1.25);
        b.vx = (dx / (d || 1)) * k + s.vx * 0.4;
        b.vz = (dz / (d || 1)) * k + s.vz * 0.4;
        b.vy = 2 + Math.abs(s.speed) * 0.25;
      }
      if (b.kind === 'ball' && (g.water || Math.hypot(b.x, b.z) > BOUNDS + 10)) {
        b.x = b.home[0];
        b.z = b.home[1];
        b.y = plaza.y + 3;
        b.vx = b.vz = b.vy = 0;
      }
      b.m.position.set(b.x, b.y, b.z);
      b.m.rotation.x += b.vz * dt * 3;
      b.m.rotation.z -= b.vx * dt * 3;
    }

    sky.position.set(s.x, 0, s.z);
    return events;
  }
  const _v = new THREE.Vector3();
  const _qq = new THREE.Quaternion();
  const _sc = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  const _eu = new THREE.Euler();
  const _bg = { ...groundOut };
  const _bg2 = { ...groundOut };

  function dispose() {
    disposables.forEach((d) => d.dispose && d.dispose());
    scene.remove(group);
    scene.fog = null;
  }

  await step('ready', 1);

  return {
    id: 'murcia',
    group, sun, sunDir, fog,
    heightAt, groundAt, nearest, pointAt,
    route: { length, RX, RZ, N, bridgeT },
    river: riverZ,
    bounds: BOUNDS,
    colliders, pois, beats, shots, plaza, tower, bell,
    dropLemon, scatterPigeons, update, setTheme, dispose,
    get dark() {
      return dark;
    },
  };
}
