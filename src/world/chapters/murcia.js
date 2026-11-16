// Chapter 1 — Murcia. Where it began.
//
// A compact diorama of the valley: the huerta (lemon orchards in rows) on the
// south bank, the river Segura, a stone bridge, a plaza with a stylised tower,
// and a mirador on the northern hill. Nothing here is a scan or a downloaded
// model: the land, the tower and the people are generated below; the bridge,
// houses and lemon trees are our own Blender assets (see docs/world).
//
// The chapter owns its geography (height field + route), its props, its
// colliders, its ambient life and its lighting. The engine (game.js) only
// asks: "how high is the ground here?", "where is the road?", "what is near?".

import * as THREE from 'three';
import { Batch, M, P, rng, noise, clamp, lerp, smooth, between, textTexture } from '../kit.js';
import { createRoute } from '../route.js';
import { createAtmosphere, DEFAULT_PALETTE } from '../atmosphere.js';
import { enhance, createWaterMaterial } from '../shading.js';

const WATER_Y = -0.5;
const ROAD_HALF = 1.7;
const DECK_Y = 2.95; // the bridge asset needs this much air under its arches
const DECK_HALF = 2.45; // rideable half-width between the parapets
const BOUNDS = 74;

// Route control points (x, z). South (+z) is the huerta, north the old town.
// The three points around the river are collinear so the crossing is straight.
const ROUTE = [
  [-48, 56], [-37, 44], [-46, 30], [-31, 19], [-13, 22], [1, 12],
  [4, -3], [7, -18], [15, -29], [11, -44], [22, -54], [36, -50], [45, -60],
];

const riverZ = (x) => -4 + 4 * Math.sin(x * 0.045 + 0.6);

// Late-afternoon Mediterranean light by day; moonlit town by night.
const PALETTE = {
  day: { ...DEFAULT_PALETTE.day },
  night: { ...DEFAULT_PALETTE.night },
};
const THEME = {
  day: { deep: '#3f8f88', shallow: '#8cc6b6', foam: '#f3efe0', window: '#3b4747', glow: 0, cloud: 0.9, lamp: '#f1e9d6', signal: '#3fbf16', paint: '#ffffff', glint: 0.36 },
  night: { deep: '#0f2a2b', shallow: '#1f4a47', foam: '#6f8c86', window: '#ffd98a', glow: 1, cloud: 0.14, lamp: '#ffe1a0', signal: '#93f75a', paint: '#8f8a7c', glint: 0.14 },
};

export async function build({ scene, tier, step, assets, shared }) {
  const R = rng(20260);
  const group = new THREE.Group();
  scene.add(group);
  const disposables = [];
  const track = (o) => (disposables.push(o), o);

  // ------------------------------------------------------------------ Route
  const route = createRoute(ROUTE, { samples: 640 });
  const { N, length, RX, RZ, TX, TZ, RY, nearest, pointAt, beside } = route;
  const bridge = new Uint8Array(N);

  function raw(x, z) {
    let h = 0.95 + 0.55 * noise(x * 0.045, z * 0.045) + 0.22 * noise(x * 0.13 + 7, z * 0.13 - 3);
    const hill = (cx, cz, s, amp) => amp * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * s * s));
    h += hill(-50, 56, 21, 6.2) + hill(46, -62, 17, 9.5) + hill(-62, -48, 22, 5) + hill(62, 40, 24, 4.5);
    const rd = Math.abs(z - riverZ(x));
    h = lerp(-1.7, h, smooth(3.2, 9.5, rd));
    return h;
  }

  const nearestOut = { i: 0, d: 0, t: 0, y: 0, side: 0, f: 0 };

  // Plaza: a paved disc the road runs through.
  const plazaAt = beside(0.66, 6.5);
  const plaza = { x: plazaAt.x, z: plazaAt.z, r: 11, y: raw(plazaAt.x, plazaAt.z) + 0.15 };
  const inPlaza = (x, z) => Math.hypot(x - plaza.x, z - plaza.z) < plaza.r;

  // The bridge is a fixed-length asset: find the middle of the water crossing
  // and give the deck exactly the span the asset has.
  const bridgeLen = assets.get('murcia/bridge_segura').entry.params.length;
  let w0 = -1;
  let w1 = -1;
  for (let i = 0; i < N; i++) {
    if (raw(RX[i], RZ[i]) < 0.3) {
      if (w0 < 0) w0 = i;
      w1 = i;
    }
  }
  const bMid = Math.round((w0 + w1) / 2);
  const perSample = length / (N - 1);
  const b0 = Math.max(0, Math.round(bMid - bridgeLen / 2 / perSample));
  const b1 = Math.min(N - 1, Math.round(bMid + bridgeLen / 2 / perSample));
  for (let i = b0; i <= b1; i++) bridge[i] = 1;
  const bridgeT = [b0 / (N - 1), b1 / (N - 1)];

  // Road profile: follows the land, levels on the bridge and through the plaza.
  {
    const tmp = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const h = raw(RX[i], RZ[i]);
      RY[i] = bridge[i] ? DECK_Y : inPlaza(RX[i], RZ[i]) ? plaza.y : Math.max(h, 0.45);
    }
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < N; i++) {
        let sum = 0;
        let n = 0;
        for (let k = -16; k <= 16; k++) {
          sum += RY[clamp(i + k, 0, N - 1)];
          n++;
        }
        tmp[i] = sum / n;
      }
      RY.set(tmp);
    }
    // The deck itself is level; only the approaches ramp.
    for (let i = b0; i <= b1; i++) RY[i] = DECK_Y;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < N - 1; i++) tmp[i] = bridge[i] ? DECK_Y : (RY[i - 1] + RY[i] * 2 + RY[i + 1]) / 4;
      tmp[0] = RY[0];
      tmp[N - 1] = RY[N - 1];
      RY.set(tmp);
    }
  }

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
    if (bridge[n.i] && n.d < DECK_HALF + 0.3) {
      out.y = DECK_Y + 0.05;
      out.onBridge = true;
      out.onRoad = true;
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
  const tr = (ch) => ({ meta: `traj.${ch}.meta`, title: `traj.${ch}.title` });
  const own = (id) => ({ meta: `world.beat.${id}.meta`, title: `world.beat.${id}.title`, text: `world.beat.${id}.text` });
  const beats = [
    { t: 0, id: 'start', keys: own('start'), place: 'world.place.start' },
    { t: 0.145, id: 'divulgalo', optional: true, poi: 'divulgalo', keys: tr('ch1'), place: 'world.place.divulgalo' },
    { t: 0.335, id: 'beemoney', poi: 'beemoney', keys: { ...tr('ch9'), title: 'world.beat.beemoney.title' }, place: 'world.place.beemoney' },
    { t: mid, id: 'bridge', optional: true, cine: true, keys: own('bridge'), place: 'world.place.bridge' },
    { t: 0.66, id: 'mwy', poi: 'mwy', keys: { ...tr('ch6'), title: 'world.beat.mwy.title' }, place: 'world.place.mwy' },
    { t: 0.815, id: 'eu', optional: true, poi: 'eu', keys: tr('ch7'), place: 'world.place.eu' },
    { t: 1, id: 'end', keys: { ...own('end'), text: 'world.bridge.t01' }, place: 'world.place.end', next: true },
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
    { t: mid, back: 0.5, side: 16, up: 3.5, ahead: 0.5, lift: 1.0, fov: 27 },
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

  // ------------------------------------------------------- Town planning
  // Decided before the land is meshed, so every house gets level ground.
  const HOUSES = ['murcia/townhouse_a', 'murcia/townhouse_b', 'murcia/townhouse_c'];
  const TINTS = ['#ffffff', '#fbf3e4', '#f3ede0', '#fff7ea'];
  const townPlan = [];
  const plan = (x, z, yaw, key, pad) => {
    townPlan.push({ x, z, yaw, key, tint: TINTS[townPlan.length % TINTS.length] });
    addPad(x, z, pad);
    reserved.push({ x, z, r: pad + 2 });
  };
  {
    let made = 0;
    for (let k = 0; k < 60 && made < 17; k++) {
      const a = (k / 30) * Math.PI * 2 + R() * 0.3;
      const r = plaza.r + 7.5 + (k % 3) * 6.5 + R() * 2.5;
      const x = plaza.x + Math.cos(a) * r;
      const z = plaza.z + Math.sin(a) * r;
      if (!free(x, z, 6) || heightNoPads(x, z) > 4.5) continue;
      if (townPlan.some((h) => Math.hypot(h.x - x, h.z - z) < 8.4)) continue;
      plan(x, z, Math.atan2(plaza.x - x, plaza.z - z) + (R() - 0.5) * 0.4, HOUSES[made % 3], 3.3);
      made++;
    }
    for (const [x, z, yaw] of [[-20, 37, 0.6], [14, 31, -0.4], [-66, 22, 1.2], [30, 13, 0.2]]) {
      if (free(x, z, 6.5)) plan(x, z, yaw, 'murcia/farmhouse', 4.6);
    }
  }
  // The start: a farmhouse beside the first metres of road, so the ride begins
  // somewhere instead of on a bare hill.
  // It sits just behind the start line, so the opening shot has a home in it.
  {
    const s0 = pointAt(0);
    const hx = s0.x - s0.tx * 10.5 + s0.tz * 6.5;
    const hz = s0.z - s0.tz * 10.5 - s0.tx * 6.5;
    plan(hx, hz, Math.atan2(s0.x + s0.tx * 6 - hx, s0.z + s0.tz * 6 - hz), 'murcia/farmhouse', 4.8);
  }

  await step('terrain', 0.15);

  // -------------------------------------------------------------- Terrain
  // Smooth-shaded and painted per vertex: zones blend into each other the way
  // land does, instead of changing colour along triangle edges.
  const terrainMat = track(enhance(new THREE.MeshLambertMaterial({ vertexColors: true }), shared, { furrows: true, breakup: 0.2 }));
  {
    const SIZE = 280;
    const SEG = 140;
    const geo = track(new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG));
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const zone = new Float32Array(pos.count);
    const C = (h) => new THREE.Color(h);
    const K = {
      huertaA: C('#93a956'), huertaB: C('#aab861'), dryA: C('#dcc590'), dryB: C('#cdb27c'), rockA: C('#c8ab7b'), rockB: C('#b6986c'),
      scrub: C('#a8a66a'), sand: C('#dccb9a'), bed: C('#7e8c69'), plaza: C('#d9c8a3'), verge: C('#cdb88c'),
    };
    const c = new THREE.Color();
    const t = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = heightAt(x, z);
      pos.setY(i, y);
      const rz = riverZ(x);
      const rd = Math.abs(z - rz);
      const n1 = noise(x * 0.06, z * 0.06) * 0.5 + 0.5;
      const n2 = noise(x * 0.21 + 9, z * 0.21 - 4);
      let zn = 0;
      if (z > rz) {
        c.lerpColors(K.huertaA, K.huertaB, n1);
        zn = 1;
      } else c.lerpColors(K.dryA, K.dryB, n1);
      // Hills: scrub first, then bare rock.
      const wS = smooth(2.8, 4.6, y);
      const wH = smooth(4.4, 7.2, y);
      if (wS > 0) c.lerp(K.scrub, wS * (z > rz ? 0.85 : 0.35));
      if (wH > 0) c.lerp(t.lerpColors(K.rockA, K.rockB, n2 * 0.5 + 0.5), wH);
      zn *= 1 - wS;
      // River banks and bed.
      const wB = (1 - smooth(8.5, 12.5, rd)) * (1 - smooth(0.35, 1.4, y));
      if (wB > 0) c.lerp(K.sand, wB);
      if (y < WATER_Y + 0.25) c.lerp(K.bed, smooth(WATER_Y + 0.25, WATER_Y - 0.5, y));
      zn *= 1 - wB;
      // Trodden ground beside the road, paving in the plaza.
      const nr = nearest(x, z, _n);
      const wR = bridge[nr.i] ? 0 : 1 - smooth(2.4, 5.6, nr.d);
      if (wR > 0) c.lerp(K.verge, wR * 0.6);
      zn *= 1 - wR;
      const wP = 1 - smooth(plaza.r + 0.4, plaza.r + 3.2, Math.hypot(x - plaza.x, z - plaza.z));
      if (wP > 0) c.lerp(K.plaza, wP);
      zn *= 1 - wP;
      const v = 1 + n2 * 0.05;
      col[i * 3] = c.r * v;
      col[i * 3 + 1] = c.g * v;
      col[i * 3 + 2] = c.b * v;
      zone[i] = zn;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('zone', new THREE.BufferAttribute(zone, 1));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, terrainMat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  await step('road', 0.3);

  // ----------------------------------------------------------------- Road
  const paintMat = [];
  {
    const pos = [];
    const col = [];
    const road = new THREE.Color('#8f7f6b');
    const edge = new THREE.Color('#b3a184');
    const push = (x, y, z, c) => {
      pos.push(x, y, z);
      col.push(c.r, c.g, c.b);
    };
    const W = [-ROAD_HALF - 0.72, -ROAD_HALF, ROAD_HALF, ROAD_HALF + 0.72];
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
    const mesh = new THREE.Mesh(track(g), track(enhance(new THREE.MeshLambertMaterial({ vertexColors: true }), shared, { breakup: 0.16 })));
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

  const ROOFS = ['#b5573a', '#a94f35', '#c0623f'];
  const glowSpots = [];

  const batches = { static: S, veg: V, window: Wn, glow: Lg };
  /** Merge a Blender asset into the chapter's batches and register what it brings. */
  function stamp(key, x, z, yaw, { y = heightAt(x, z), scale = 1, tint, ownColliders = true } = {}) {
    const out = assets.stamp(key, batches, M(x, y, z, yaw, scale), { tint });
    if (ownColliders) out.colliders.forEach((c) => colliders.push(c));
    out.anchors.forEach((a) => {
      if (a.kind === 'lamp') glowSpots.push([a.x, groundAt(a.x, a.z).y, a.z]);
    });
    return out;
  }

  function lamp(x, z) {
    stamp('common/street_lamp', x, z, 0, { y: groundAt(x, z).y });
  }

  // Bridge over the Segura: a Blender asset, set down along the crossing.
  {
    const mx = (RX[b0] + RX[b1]) / 2;
    const mz = (RZ[b0] + RZ[b1]) / 2;
    stamp('murcia/bridge_segura', mx, mz, Math.atan2(RX[b1] - RX[b0], RZ[b1] - RZ[b0]), { y: DECK_Y });
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

  // Town and farmhouses, where the plan put them.
  const cameraBlockers = [];
  for (const h of townPlan) {
    const y = heightAt(h.x, h.z) - 0.06;
    stamp(h.key, h.x, h.z, h.yaw, { y, tint: h.tint });
    const [min, max] = assets.get(h.key).entry.bounds;
    const box = new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max));
    cameraBlockers.push(box.applyMatrix4(M(h.x, y, h.z, h.yaw)).expandByScalar(0.3));
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.5;
    const lx = plaza.x + Math.cos(a) * (plaza.r - 0.6);
    const lz = plaza.z + Math.sin(a) * (plaza.r - 0.6);
    if (nearest(lx, lz, _n).d > 3) lamp(lx, lz);
  }

  // Plaza floor: rings of pavers, a star of pale stone where people gather.
  {
    const pos = [];
    const col = [];
    const c = new THREE.Color();
    const tones = ['#dccba6', '#d2bf98', '#e2d3b1', '#c9b68f'];
    const quad = (pts, hex, j = 0.05) => {
      c.set(hex).offsetHSL(0, 0, (R() - 0.5) * j);
      for (const k of [0, 1, 2, 0, 2, 3]) {
        pos.push(pts[k][0], plaza.y + pts[k][1], pts[k][2]);
        col.push(c.r, c.g, c.b);
      }
    };
    for (let r0 = 0.6, ring = 0; r0 < plaza.r - 0.2; r0 += 1.15, ring++) {
      const r1 = Math.min(plaza.r, r0 + 1.1);
      const n = Math.max(8, Math.round((Math.PI * 2 * r1) / 1.5));
      for (let k = 0; k < n; k++) {
        const a0 = ((k + (ring % 2) * 0.5) / n) * Math.PI * 2;
        const a1 = a0 + (Math.PI * 2) / n - 0.035 / r1;
        const P2 = (r, a) => [plaza.x + Math.cos(a) * r, 0.02, plaza.z + Math.sin(a) * r];
        quad([P2(r0, a0), P2(r0, a1), P2(r1, a1), P2(r1, a0)], tones[(ring + (k % 2)) % tones.length]);
      }
    }
    const sx = sites.mwy.x;
    const sz = sites.mwy.z;
    for (let k = 0; k < 16; k++) {
      const a0 = (k / 16) * Math.PI * 2;
      const a1 = ((k + 1) / 16) * Math.PI * 2;
      const r0 = k % 2 ? 1.05 : 2.5;
      const r1 = k % 2 ? 2.5 : 1.05;
      c.set(k % 4 < 2 ? '#efe4c9' : '#e6d6b4');
      for (const [r, a] of [[0, 0], [r1, a1], [r0, a0]]) {
        pos.push(sx + Math.cos(a) * r, plaza.y + 0.032, sz + Math.sin(a) * r);
        col.push(c.r, c.g, c.b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    S.addGeometry(g);
    g.dispose();
    // Benches and planters round the edge.
    for (const a of [1.45, 3.05, 4.6]) {
      const bx = plaza.x + Math.cos(a) * (plaza.r - 1.6);
      const bz = plaza.z + Math.sin(a) * (plaza.r - 1.6);
      if (nearest(bx, bz, _n).d < 3.4 || inSight(bx, bz)) continue;
      stamp('common/park_bench', bx, bz, -a + Math.PI / 2, { y: plaza.y });
    }
    for (const a of [0.15, 2.25, 3.85, 5.6]) {
      const bx = plaza.x + Math.cos(a) * (plaza.r - 0.9);
      const bz = plaza.z + Math.sin(a) * (plaza.r - 0.9);
      if (nearest(bx, bz, _n).d < 3.2 || inSight(bx, bz)) continue;
      stamp('common/planter', bx, bz, a, { y: plaza.y });
    }
    for (const a of [0.1, 2.2, 4.2, 5.8]) {
      const x = plaza.x + Math.cos(a) * 4.4;
      const z = plaza.z + Math.sin(a) * 4.4;
      if (nearest(x, z, _n).d < 4 || inSight(x, z) || colliders.some((c) => Math.hypot(c.x - x, c.z - z) < 2.8)) continue;
      stamp('murcia/fountain', x, z, a, { y: plaza.y });
      break;
    }
  }

  // The start line: a banner across the road, a milestone and dry-stone walls.
  {
    const a = pointAt(0.034);
    const yaw = Math.atan2(a.tx, a.tz);
    const base = M(a.x, a.y, a.z, yaw);
    for (const o of [-2.75, 2.75]) {
      S.add(P.cyl8, '#7a5a3a', local(base, o, 2.1, 0, 0, 0.09, 4.2, 0.09));
      S.add(P.box, '#cdb48a', local(base, o, 0.22, 0, 0, 0.5, 0.44, 0.5));
      const wp = new THREE.Vector3(o, 0, 0).applyMatrix4(base);
      solid(wp.x, wp.z, 0.3);
    }
    S.add(P.box, '#27512f', local(base, 0, 3.75, 0, 0, 5.5, 0.62, 0.05));
    const ms = beside(0.011, -2.6);
    const my = heightAt(ms.x, ms.z);
    S.add(P.box, '#e6dcc4', M(ms.x, my + 0.32, ms.z, ms.yaw, 0.4, 0.7, 0.24));
    S.add(P.cyl8, '#b5573a', M(ms.x, my + 0.68, ms.z, ms.yaw, 0.2, 0.24, 0.12, 0, Math.PI / 2));
    solid(ms.x, ms.z, 0.3);
    for (const [t0, t1, side] of [[0.042, 0.072, 3.3], [0.05, 0.1, -3.3], [0.105, 0.128, 3.3]]) {
      const p = beside(t0, side);
      const piece = stamp('murcia/stone_wall', p.x, p.z, p.yaw);
      const seam = piece.anchors.find((a) => a.name === 'next');
      const spacing = 2 * Math.hypot(seam.x - p.x, seam.z - p.z) / route.length;
      for (let t = t0 + spacing; t < t1; t += spacing) {
        const q = beside(t, side);
        stamp('murcia/stone_wall', q.x, q.z, q.yaw);
      }
    }
  }

  await step('nature', 0.6);

  // ------------------------------------------------------------ Vegetation
  const lemonTrees = [];
  const swayTop = (y0, y1) => (y) => smooth(y0, y1, y);
  const LEAF_TINTS = ['#ffffff', '#f2f6e6', '#fff6e2', '#e8f0dc', '#f6f1d8'];
  function lemonTree(x, z) {
    const y = heightAt(x, z);
    const s = 0.88 + R() * 0.3;
    const close = nearest(x, z, _n).d < 15 || Object.values(sites).some((q) => Math.hypot(q.x - x, q.z - z) < 14);
    stamp(close ? 'murcia/lemon_tree' : 'murcia/lemon_tree_far', x, z, R() * 6.28, { y: y - 0.04, scale: s, tint: LEAF_TINTS[Math.floor(R() * LEAF_TINTS.length)], ownColliders: false });
    const tree = { x, z, y: y + 2.1 * s, drops: 2, cool: 0 };
    lemonTrees.push(tree);
    solid(x, z, 0.45 * s, { tree });
  }
  function palm(x, z) {
    const scale = 0.82 + R() * 0.35;
    const yaw = R() * 6;
    stamp('murcia/palm_tree', x, z, yaw, { scale });
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
      if (Math.hypot(x, z) > 96) continue;
      if (Math.hypot(x, z) > 80 && R() < 0.5) continue;
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
  // The horizon pieces face inward and stay out of the riding space.
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    stamp('murcia_v2/sierra_backdrop', Math.sin(a) * 180, Math.cos(a) * 180, a + Math.PI,
      { y: -3, scale: 1.9, ownColliders: false });
  }
  for (const t of [0.18, 0.22, 0.72]) {
    const p = beside(t, 7);
    if (free(p.x, p.z, 4) && !inSight(p.x, p.z)) stamp('murcia_v2/olive_tree', p.x, p.z, p.yaw, { scale: 0.8 });
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

  // Station forecourt, where the ride hands off to the train.
  let signpost;
  {
    const s = sites.mirador;
    const end = pointAt(1);
    const yaw = Math.atan2(end.tx, end.tz);
    const y = heightAt(s.x, s.z);
    const station = offset(s, yaw, 9, 9);
    stamp('europe_v2/station_building', station.x, station.z, yaw + Math.PI, { y: heightAt(station.x, station.z) - 0.25, scale: 0.62 });
    const notice = offset(s, yaw, -3.2, 1.2);
    stamp('murcia_v2/notice_board', notice.x, notice.z, yaw + Math.PI);
    for (let k = -3; k <= 3; k++) {
      const p = offset(s, yaw, k * 1.1, 4.2 - Math.abs(k) * 0.25);
      S.add(P.cyl6, '#7a5a3a', M(p.x, heightAt(p.x, p.z) + 0.5, p.z, 0, 0.07, 1, 0.07));
      solid(p.x, p.z, 0.45);
    }
    const r0 = offset(s, yaw, -3.3, 3.45);
    const r1 = offset(s, yaw, 3.3, 3.45);
    S.add(P.box, '#7a5a3a', between(new THREE.Vector3(r0.x, y + 0.9, r0.z), new THREE.Vector3(r1.x, y + 0.9, r1.z), 0.09));
    const b = offset(s, yaw, -2.7, 1.6);
    stamp('common/park_bench', b.x, b.z, yaw + 0.5, { y });
    const sp = offset(s, yaw, 2.8, 1.4);
    stamp('common/signpost', sp.x, sp.z, yaw, { y });
    signpost = { x: sp.x, y, z: sp.z, yaw };
    pine(offset(s, yaw, -5.5, -1).x, offset(s, yaw, -5.5, -1).z);
  }

  // Commit the merged static geometry.
  const windowMat = track(new THREE.MeshBasicMaterial({ color: THEME.day.window }));
  const lampMat = track(new THREE.MeshBasicMaterial({ color: THEME.day.lamp }));
  const staticMat = track(enhance(new THREE.MeshLambertMaterial({ vertexColors: true }), shared, { see: true, breakup: 0.2 }));
  const vegMat = track(enhance(new THREE.MeshLambertMaterial({ vertexColors: true }), shared, { sway: true, see: true, breakup: 0.14 }));
  {
    const sm = new THREE.Mesh(track(S.build()), staticMat);
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
  const waterMat = track(createWaterMaterial(shared));
  {
    const wg = track(new THREE.PlaneGeometry(290, 46, 145, 23));
    wg.rotateX(-Math.PI / 2);
    wg.translate(0, WATER_Y, -4);
    const wp = wg.attributes.position;
    const shore = new Float32Array(wp.count);
    // 1 where the bed is shallow (the banks), 0 in the deep channel.
    for (let i = 0; i < wp.count; i++) shore[i] = smooth(-1.45, -0.62, heightAt(wp.getX(i), wp.getZ(i)));
    wg.setAttribute('shore', new THREE.BufferAttribute(shore, 1));
    const w = new THREE.Mesh(wg, waterMat);
    w.receiveShadow = true;
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

  const clouds = [];
  const cloudMat = track(new THREE.MeshBasicMaterial({ color: '#fbf5e6', transparent: true, opacity: THEME.day.cloud, fog: false }));
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

  // ---------------------------------------------------------- Light and air
  const atmo = createAtmosphere(scene, PALETTE);

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
  roadPaint('MURCIA', 0.062, { width: 2.9 });
  {
    const { tex, aspect } = textTexture('SALIDA', { size: 120, color: '#f6efdf' });
    track(tex);
    const a = pointAt(0.034);
    const mat = track(new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    const geo = track(new THREE.PlaneGeometry(0.5 * aspect, 0.5));
    for (const flip of [0, Math.PI]) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(a.x, a.y + 3.75, a.z);
      m.rotation.y = Math.atan2(a.tx, a.tz) + flip;
      m.translateZ(0.035);
      group.add(m);
    }
  }
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
  // Chapter materials follow the atmosphere's day ↔ night blend.
  {
    const D = {};
    const Nn = {};
    for (const key of ['deep', 'shallow', 'foam', 'window', 'lamp', 'signal', 'paint']) {
      D[key] = new THREE.Color(THEME.day[key]);
      Nn[key] = new THREE.Color(THEME.night[key]);
    }
    const wc = waterMat.userData.colors;
    atmo.onBlend((k) => {
      wc.uDeep.value.lerpColors(D.deep, Nn.deep, k);
      wc.uShallow.value.lerpColors(D.shallow, Nn.shallow, k);
      wc.uFoam.value.lerpColors(D.foam, Nn.foam, k);
      // Windows and lamps come on as the light goes, not at the flick of a switch.
      const on = smooth(0.42, 0.78, k);
      windowMat.color.lerpColors(D.window, Nn.window, on);
      lampMat.color.lerpColors(D.lamp, Nn.lamp, on);
      glowMat.opacity = on * 0.22;
      cloudMat.opacity = lerp(THEME.day.cloud, THEME.night.cloud, k);
      markerMat.color.lerpColors(D.signal, Nn.signal, k);
      ringMat.color.copy(markerMat.color);
      paintMat.forEach((m) => m.color.lerpColors(D.paint, Nn.paint, k));
      glintMat.opacity = lerp(THEME.day.glint, THEME.night.glint, k);
    });
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
        events.push({ type: 'secret', id: 'pigeons' });
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
    atmo.dispose();
    scene.remove(group);
  }

  await step('ready', 1);

  const start = pointAt(0);
  return {
    id: 'murcia',
    group,
    atmosphere: atmo,
    route: { length, RX, RZ, N, closed: false, bridgeT },
    heightAt, groundAt, nearest, pointAt,
    waterY: WATER_Y,
    rideHeight: 0.05,
    bounds: BOUNDS,
    river: riverZ,
    colliders, cameraBlockers, pois, beats, shots, plaza, tower, bell,
    cine: [[bridgeT[0] - 0.012, bridgeT[1] + 0.012]],
    establishing: { from: [start.x + 44, start.y + 38, start.z + 26], look: [start.x + 14, start.y - 2, start.z - 22] },
    /** Nearest safe point on the route: never the middle of the bridge. */
    safeT(x, z) {
      const t = nearest(x, z).t;
      if (t > bridgeT[0] - 0.01 && t < bridgeT[1] + 0.01) return z > riverZ(x) ? bridgeT[0] - 0.02 : bridgeT[1] + 0.02;
      return t;
    },
    /** A vehicle hit something: lemon trees answer with a lemon. */
    bump(c, st) {
      return c.tree && dropLemon(c.tree, st.x, st.z) ? 'tree' : null;
    },
    /** A sound was made: ring the bell near the tower and the tower answers. */
    heard(kind, st) {
      if (kind !== 'bell' || Math.hypot(tower.x - st.x, tower.z - st.z) > 22) return null;
      scatterPigeons();
      return { tone: [392, 0.028, 1.2, 'sine', [1, 1.46]], delay: 380, secret: 'bell' };
    },
    update,
    dispose,
  };
}
