import * as THREE from 'three';
import { Batch, M, rng } from '../kit.js';
import { createRoute } from '../route.js';
import { createAtmosphere, DEFAULT_PALETTE } from '../atmosphere.js';
import { enhance } from '../shading.js';

export function scenery({ scene, assets, shared }, spec) {
  const group = new THREE.Group();
  const owned = [];
  const colliders = [];
  const route = createRoute(spec.points);
  const { pointAt, nearest, beside } = route;
  for (let i = 0; i < route.N; i++) route.RY[i] = spec.height?.(i / (route.N - 1)) ?? 0;

  const palette = {
    day: { ...DEFAULT_PALETTE.day, fogNear: 105, fogFar: 330, ...spec.day },
    night: { ...DEFAULT_PALETTE.night, fogNear: 82, fogFar: 295, ...spec.night },
  };
  const atmosphere = createAtmosphere(scene, palette);
  scene.add(group);
  const batches = {
    static: new Batch({ jitter: 0 }), veg: new Batch({ sway: true, jitter: 0 }),
    window: new Batch({ jitter: 0 }), glow: new Batch({ jitter: 0 }),
  };

  function mesh(geometry, material) {
    owned.push(geometry, material);
    const obj = new THREE.Mesh(geometry, material);
    obj.receiveShadow = material.isMeshLambertMaterial;
    group.add(obj);
    return obj;
  }

  function stamp(key, x, z, { y = spec.floor, yaw = 0, scale = 1, solid = false } = {}) {
    const stamped = assets.stamp(key, batches, M(x, y, z, yaw, scale));
    if (solid) colliders.push(...stamped.colliders);
    return stamped.anchors;
  }

  function tile(key, x, z, count, opts) {
    for (let i = 0; i < count; i++) {
      const next = stamp(key, x, z, opts).find((a) => a.name === 'next');
      ({ x, z } = next);
    }
  }

  function groundStrip(color, width, y, offset = 0, from = 0, to = 1) {
    const vertices = [];
    const n = Math.max(1, Math.ceil((to - from) * 120));
    function side(t, direction) {
      const p = beside(t, offset + direction * width / 2);
      return [p.x, y, p.z];
    }
    for (let i = 0; i < n; i++) {
      const a = from + (to - from) * i / n;
      const b = from + (to - from) * (i + 1) / n;
      const l = side(a, 1), r = side(a, -1), nextL = side(b, 1), nextR = side(b, -1);
      vertices.push(...l, ...r, ...nextR, ...l, ...nextR, ...nextL);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    mesh(geometry, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  }

  const ground = new THREE.PlaneGeometry(1500, 1500);
  ground.rotateX(-Math.PI / 2);
  const groundMat = enhance(new THREE.MeshLambertMaterial({ color: spec.ground }), shared, { breakup: 0.24 });
  mesh(ground, groundMat).position.y = spec.floor;
  if (spec.water) {
    atmosphere.onBlend((k) => groundMat.color.set(k > 0.68 ? '#183f50' : spec.ground));
  }

  function finish() {
    for (const [kind, batch] of Object.entries(batches)) {
      const geometry = batch.build();
      if (!geometry.attributes.position?.count) {
        geometry.dispose();
        continue;
      }
      const veg = kind === 'veg';
      const material = kind === 'static' || veg
        ? enhance(new THREE.MeshLambertMaterial({ vertexColors: true }), shared, { sway: veg, breakup: 0.12 })
        : new THREE.MeshBasicMaterial({ color: '#ece4ce' });
      const obj = mesh(geometry, material);
      obj.castShadow = material.isMeshLambertMaterial;
      if (!material.isMeshLambertMaterial) {
        atmosphere.onBlend((k) => material.color.set(kind === 'glow' ? '#ffe8ae' : k > 0.63 ? '#ffd687' : '#455a60'));
      }
    }

    const poiAt = pointAt(spec.stop);
    const id = spec.id;
    const poi = { id, t: spec.stop, x: poiAt.x, z: poiAt.z, focus: poiAt, radius: spec.radius || 14, ...spec.card };
    const opening = { id: id + '_start', t: 0, keys: storyKeys(id + '_start'), place: 'world.leg.' + id + '.start' };
    const end = { id, t: spec.stop, poi: id, keys: storyKeys(id), place: 'world.leg.' + id + '.stop', next: true };
    return {
      id, group, route, pointAt, nearest, colliders, atmosphere,
      waterY: spec.water ? spec.floor : -30,
      rideHeight: 0,
      bounds: spec.bounds || 245,
      heightAt: () => spec.floor,
      groundAt(x, z, out = {}) {
        const n = nearest(x, z);
        return Object.assign(out, { y: spec.driveY ?? spec.floor, t: n.t, routeD: n.d, water: !!spec.water, onRoad: n.d < 7 });
      },
      pois: [poi], beats: [opening, end],
      shots: spec.shots, cine: [[0.09, spec.stop - 0.07]],
      establishing: spec.establishing,
      storyRate: spec.storyRate,
      update: () => [],
      dispose() {
        for (const resource of owned) resource.dispose();
        atmosphere.dispose();
        scene.remove(group);
      },
    };
  }

  return { route, pointAt, beside, stamp, tile, groundStrip, finish, random: rng(spec.seed || 13) };
}

function storyKeys(id) {
  const prefix = 'world.leg.' + id;
  return { meta: prefix + '.meta', title: prefix + '.title', text: prefix + '.text' };
}

export function shots(...frames) {
  return frames.map(([t, back, side, up, ahead, lift, fov]) => ({ t, back, side, up, ahead, lift, fov }));
}
