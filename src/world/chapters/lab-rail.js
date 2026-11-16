// Lab — rail test track.
//
// Not a chapter of the story. It exists to prove that the engine can load a
// second place with a second kind of vehicle through the same two contracts
// (chapter + vehicle), reuse Blender assets from another pack, and free
// everything again. Reachable only with ?chapter=lab-rail.

import * as THREE from 'three';
import { Batch, M, P, rng, textTexture } from '../kit.js';
import { createRoute } from '../route.js';
import { createAtmosphere } from '../atmosphere.js';
import { enhance } from '../shading.js';

const LOOP = [[-62, 4], [-44, -36], [6, -48], [56, -34], [68, 6], [34, 40], [-22, 38]];
const RAIL_Y = 0.25;

export async function build({ scene, step, assets, shared }) {
  const R = rng(77);
  const group = new THREE.Group();
  scene.add(group);
  const disposables = [];
  const track = (o) => (disposables.push(o), o);

  const route = createRoute(LOOP, { samples: 720, closed: true });
  const { N, length, RX, RZ, TX, TZ, RY, nearest, pointAt, beside } = route;
  RY.fill(RAIL_Y);
  await step('track', 0.3);

  const atmo = createAtmosphere(scene);

  // Ground: one calm plane; the breakup shader keeps it from looking like a floor.
  {
    const g = track(new THREE.PlaneGeometry(520, 520, 1, 1));
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, track(enhance(new THREE.MeshLambertMaterial({ color: '#cdbd92' }), shared, { breakup: 0.28 })));
    m.receiveShadow = true;
    group.add(m);
  }

  // Track bed, rails and sleepers.
  const S = new Batch({ seed: 3 });
  const V = new Batch({ sway: true, seed: 5 });
  const Wn = new Batch({ jitter: 0 });
  const Lg = new Batch({ jitter: 0 });
  {
    const pos = [];
    const col = [];
    const c = new THREE.Color();
    const strip = (o0, o1, y, hex) => {
      c.set(hex);
      for (let i = 0; i < N - 1; i++) {
        const q = [[i, o0], [i + 1, o0], [i + 1, o1], [i, o1]].map(([j, o]) => [RX[j] + TZ[j] * o, y, RZ[j] - TX[j] * o]);
        for (const k of [0, 1, 2, 0, 2, 3]) {
          pos.push(...q[k]);
          col.push(c.r, c.g, c.b);
        }
      }
    };
    strip(-2.1, 2.1, 0.08, '#a79a82');
    strip(-0.8, -0.66, RAIL_Y, '#5d5850');
    strip(0.66, 0.8, RAIL_Y, '#5d5850');
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    S.addGeometry(g);
    g.dispose();
    const count = Math.floor(length / 0.85);
    const sleepers = new THREE.InstancedMesh(track(new THREE.BoxGeometry(2.5, 0.12, 0.26)), track(new THREE.MeshLambertMaterial({ color: '#6b513a' })), count);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const p = pointAt(i / count);
      sleepers.setMatrixAt(i, m.copy(M(p.x, 0.15, p.z, Math.atan2(p.tx, p.tz))));
    }
    sleepers.receiveShadow = true;
    group.add(sleepers);
  }

  // A platform, so the loop has a "here".
  const station = beside(0, -4.4);
  {
    const base = M(station.x, 0, station.z, station.yaw);
    const at = (x, y, z, sx, sy, sz) => base.clone().multiply(M(x, y, z, 0, sx, sy, sz));
    S.add(P.box, '#cdb48a', at(0, 0.45, 0, 4.2, 0.9, 30));
    S.add(P.box, '#efe6d2', at(0.5, 0.93, 0, 0.3, 0.06, 30));
    for (const z of [-10, 0, 10]) {
      S.add(P.box, '#7a5a3a', at(-1.2, 2.4, z, 0.16, 3, 0.16));
      S.add(P.box, '#b5573a', at(-0.6, 3.95, z, 3.4, 0.14, 9.4));
    }
  }
  const batches = { static: S, veg: V, window: Wn, glow: Lg };
  // Assets from the Murcia pack, reused untouched: the proof that a pack is
  // not tied to the chapter it was made for.
  const house = beside(0.02, -16);
  assets.stamp('murcia/farmhouse', batches, M(house.x, 0, house.z, house.yaw + Math.PI / 2));
  for (let k = 0; k < 26; k++) {
    const q = beside(R(), (R() > 0.5 ? 1 : -1) * (9 + R() * 26));
    if (Math.hypot(q.x - station.x, q.z - station.z) < 22) continue;
    assets.stamp('murcia/lemon_tree', batches, M(q.x, 0, q.z, R() * 6.28, 0.9 + R() * 0.3));
  }
  await step('scenery', 0.7);

  const windowMat = track(new THREE.MeshBasicMaterial({ color: '#3b4747' }));
  const lampMat = track(new THREE.MeshBasicMaterial({ color: '#f1e9d6' }));
  {
    const sm = new THREE.Mesh(track(S.build()), track(enhance(new THREE.MeshLambertMaterial({ vertexColors: true }), shared, { breakup: 0.2 })));
    const vm = new THREE.Mesh(track(V.build()), track(enhance(new THREE.MeshLambertMaterial({ vertexColors: true }), shared, { sway: true, breakup: 0.14 })));
    sm.castShadow = sm.receiveShadow = vm.castShadow = true;
    group.add(sm, vm, new THREE.Mesh(track(Wn.build()), windowMat), new THREE.Mesh(track(Lg.build()), lampMat));
  }
  atmo.onBlend((k) => {
    windowMat.color.set(k > 0.6 ? '#ffd98a' : '#3b4747');
    lampMat.color.set(k > 0.6 ? '#ffe1a0' : '#f1e9d6');
  });

  // A sign that says plainly what this place is.
  try {
    await Promise.race([document.fonts.load('400 150px "Instrument Serif"'), new Promise((r) => setTimeout(r, 800))]);
  } catch {
    /* falls back to Georgia */
  }
  {
    const { tex, aspect } = textTexture('VÍA DE PRUEBAS', { size: 110 });
    track(tex);
    const sign = new THREE.Mesh(track(new THREE.PlaneGeometry(0.9 * aspect, 0.9)), track(new THREE.MeshBasicMaterial({ map: tex, transparent: true })));
    const back = new THREE.Mesh(track(new THREE.BoxGeometry(0.9 * aspect + 0.4, 1.2, 0.08)), track(new THREE.MeshLambertMaterial({ color: '#27512f' })));
    const p = beside(0, -5.4);
    back.position.set(p.x, 2.4, p.z);
    back.rotation.y = p.yaw + Math.PI / 2;
    sign.position.copy(back.position);
    sign.rotation.copy(back.rotation);
    sign.translateZ(0.05);
    group.add(back, sign);
  }

  const groundOut = { y: RAIL_Y, onRoad: true, onBridge: false, water: false, routeD: 0, t: 0 };
  const own = (id) => ({ meta: `world.beat.${id}.meta`, title: `world.beat.${id}.title`, text: `world.beat.${id}.text` });
  const events = [];
  await step('ready', 1);

  return {
    id: 'lab-rail',
    group,
    atmosphere: atmo,
    route: { length, RX, RZ, N, closed: true },
    pointAt, nearest,
    heightAt: () => 0,
    groundAt(x, z, out = groundOut) {
      const n = nearest(x, z);
      out.y = RAIL_Y;
      out.routeD = n.d;
      out.t = n.t;
      return out;
    },
    waterY: -50,
    rideHeight: 0,
    bounds: 400,
    colliders: [],
    pois: [],
    beats: [
      { t: 0, id: 'lab_start', keys: own('lab_start'), place: 'world.place.lab_start' },
      { t: 0.5, id: 'lab_far', keys: own('lab_far'), place: 'world.place.lab_far' },
    ],
    shots: [
      { t: 0, back: -7, side: -5, up: 2.2, ahead: -4, lift: 1.4, fov: 40 },
      { t: 0.12, back: 9, side: 5, up: 3.4, ahead: 2, lift: 1.5, fov: 46 },
      { t: 0.5, back: 2, side: 11, up: 2.2, ahead: -3, lift: 1.5, fov: 34 },
      { t: 0.85, back: 10, side: -4, up: 5, ahead: 3, lift: 1.2, fov: 48 },
      { t: 1, back: -7, side: -5, up: 2.2, ahead: -4, lift: 1.4, fov: 40 },
    ],
    cine: [],
    establishing: { from: [RX[0] + 50, 46, RZ[0] + 40], look: [0, 0, 0] },
    update() {
      events.length = 0;
      return events;
    },
    dispose() {
      disposables.forEach((d) => d.dispose && d.dispose());
      atmo.dispose();
      scene.remove(group);
    },
  };
}
