import * as THREE from 'three';
import { Batch, M, clamp, damp, dampAngle, smooth } from '../kit.js';
import { touches } from './collision.js';
import { chaseCamera, vehicleModel } from './rig.js';

const SHIP = 'vehicles/passenger_ship';
const CHAIR = 'maritime/deck_chair';
const RING = 'maritime/life_ring_stand';

export const ship = {
  id: 'ship',
  assets: [SHIP, CHAIR, RING],
  onRails: false,
  actions: { a: 'deck', b: 'horn' },

  create({ assets }) {
    const model = vehicleModel(assets, SHIP);
    const { object, parts } = model;
    const deck = model.entry.meta.decks.find((d) => d.name === 'main');
    const spawn = object.getObjectByName('ANCHOR_deck_spawn').position;
    const anchor = object.getObjectByName('ANCHOR_chase').position;
    const view = { back: -anchor.z, side: anchor.x, up: anchor.y, lift: 6 };
    const deckBatch = new Batch({ jitter: 0 });
    const batches = { static: deckBatch, veg: deckBatch, window: deckBatch, glow: deckBatch };
    const obstacles = [...assets.get(SHIP).colliders];
    for (const [key, x, z, yaw] of [[CHAIR, -2.9, 15.5, 0.5], [CHAIR, -2.1, 15.5, 0.5], [RING, 2.6, 15.5, Math.PI]]) {
      const prop = assets.stamp(key, batches, M(x, deck.y, z, yaw));
      obstacles.push(...prop.colliders);
    }
    const furniture = new THREE.Mesh(deckBatch.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    furniture.castShadow = true;
    object.add(furniture);

    const walker = spawn.clone();
    let deckYaw = Math.PI;
    let walking = false;
    let spin = 0;
    let dock = 0;
    let drift = 0;

    return {
      ...model, id: 'ship', radius: 6, onRails: false, storyScale: 1, focusHeight: 6,
      get walking() { return walking; },
      reset() { walking = false; drift = 0; },
      place(st) {
        object.position.set(st.x, st.y, st.z);
        object.rotation.set(0, st.yaw, 0, 'YXZ');
      },
      animate({ st, time, dt, calm }) {
        const swell = calm || walking ? 0 : 1;
        object.rotation.x = Math.sin(time * 0.7) * 0.009 * swell;
        object.rotation.z = (Math.sin(time * 0.9) * 0.015 + st.steer * 0.024) * swell;
        const moving = Math.abs(st.speed);
        spin = (spin + st.speed * dt * 2.4) % (2 * Math.PI);
        dock = damp(dock, moving < 0.45 && (st.t < 0.045 || st.near) ? 1 : 0, 3, dt);
        for (const part of parts) {
          if (part.role === 'propeller') part.turn(spin);
          if (part.role === 'rudder') part.turn(-st.steer * part.limit);
          if (part.role === 'gangway') part.turn(-part.limit * dock);
          if (part.role === 'radar') part.turn(calm ? 0 : time * 0.7);
        }
      },
      drive(dt, input, world, st) {
        const gas = clamp(input.up - input.down + input.joyY, -1, 1);
        const turn = clamp(input.left - input.right - input.joyX, -1, 1);
        if (walking) {
          deckYaw += turn * dt * 1.8;
          const z = clamp(walker.z + Math.cos(deckYaw) * gas * dt * 3.7, deck.z[0] + 2.5, deck.z[1] - 2.5);
          const taper = Math.max(smooth(21, 28, z), 1 - smooth(-29, -24, z));
          const width = deck.half_width - 0.3 - taper * 2.4;
          const x = clamp(walker.x + Math.sin(deckYaw) * gas * dt * 3.7, -width, width);
          if (!obstacles.some((c) => touches(c, x, z, 0.25))) walker.set(x, deck.y, z);
          st.speed = 0;
          return;
        }
        if (st.lock > 0) return;
        st.speed = clamp(st.speed + (gas * 2.4 - st.speed * 0.19) * dt, -3.8, 12);
        st.steer = damp(st.steer, turn, 2.2, dt);
        const t = clamp(st.t + st.speed * dt / world.route.length);
        if (st.t === t && (t === 0 || t === 1)) st.speed = 0;
        const p = world.pointAt(t);
        const lane = 7 * smooth(0.025, 0.2, t) * (1 - smooth(0.76, 0.96, t));
        drift = clamp(drift + st.steer * st.speed * dt * 0.16, -lane, lane);
        st.yaw = dampAngle(st.yaw, Math.atan2(p.tx, p.tz) + st.steer * 0.19 * (lane / 7), 1.5, dt);
        Object.assign(st, { t, y: p.y, x: p.x + p.tz * drift, z: p.z - p.tx * drift });
      },
      chase(st, cam, want, env) {
        chaseCamera(st, cam, want, env, view);
        if (!walking) return;
        want.pos.set(walker.x, walker.y + 1.66, walker.z);
        want.look.set(want.pos.x + Math.sin(deckYaw), want.pos.y - 0.08, want.pos.z + Math.cos(deckYaw));
        object.localToWorld(want.pos);
        object.localToWorld(want.look);
        want.fov = env.portrait ? 69 : 65;
      },
      action(id, st, fx) {
        if (id === 'horn') fx.sound('horn');
        if (id !== 'deck' || st.mode !== 'explore') return;
        walking = !walking;
        if (walking) {
          walker.copy(spawn);
          deckYaw = Math.PI / 2;
        }
        st.speed = 0;
        fx.snapCamera();
        fx.feedback(walking ? 'deckWalk' : 'deckExit');
      },
      dispose() {
        furniture.geometry.dispose();
        furniture.material.dispose();
      },
    };
  },
};
