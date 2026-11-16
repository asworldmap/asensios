import * as THREE from 'three';
import { clamp, damp, dampAngle } from '../kit.js';
import { rig } from './rig.js';

const CAB = 'vehicles/train_cab';
const COACH = 'vehicles/train_coach';

export const train = {
  id: 'train',
  assets: [CAB, COACH],
  onRails: true,
  actions: { a: 'horn', b: null },

  create({ assets }) {
    const root = new THREE.Group();
    const cars = [CAB, COACH, CAB].map((key, i) => {
      const model = assets.instance(key);
      const reversed = i === 2;
      const front = model.scene.getObjectByName('ANCHOR_coupler_' + (reversed ? 'rear' : 'front'));
      const rear = model.scene.getObjectByName('ANCHOR_coupler_' + (reversed ? 'front' : 'rear'));
      root.add(model.scene);
      return { ...model, reversed, nose: Math.abs(front.position.z), tail: Math.abs(rear.position.z), parts: rig(model) };
    });
    let distance = 0;
    for (const car of cars) {
      car.offset = distance + car.nose;
      distance = car.offset + car.tail;
    }

    const headlight = new THREE.SpotLight('#ffe9b0', 0, 55, 0.42, 0.65, 1);
    const cab = cars[0].scene;
    const lamp = cab.getObjectByName('ANCHOR_headlight_l');
    headlight.position.set(0, lamp.position.y, lamp.position.z);
    headlight.target.position.set(0, 0, lamp.position.z + 28);
    cab.add(headlight, headlight.target);

    const p = {};
    const p2 = {};
    let door = 0;
    let roll = 0;

    function sample(world, t, out) {
      world.pointAt(t, out);
      if (!world.route.closed && t < 0) {
        out.x += out.tx * t * world.route.length;
        out.z += out.tz * t * world.route.length;
      }
      return out;
    }

    function place(st, world) {
      const length = world.route.length;
      for (const car of cars) {
        const t = st.t - car.offset / length;
        const bogies = car.parts.filter((part) => part.role === 'bogie');
        const sign = car.reversed ? -1 : 1;
        const a = sample(world, t + bogies[0].pivot[2] * sign / length, p);
        const b = sample(world, t + bogies[1].pivot[2] * sign / length, p2);
        const span = bogies[0].pivot[2] - bogies[1].pivot[2];
        const f = -bogies[1].pivot[2] / span;
        const yaw = Math.atan2(a.x - b.x, a.z - b.z);
        car.scene.position.set(b.x + f * (a.x - b.x), b.y + f * (a.y - b.y), b.z + f * (a.z - b.z));
        car.scene.rotation.y = yaw;
        a.yaw = Math.atan2(a.tx * sign, a.tz * sign);
        b.yaw = Math.atan2(b.tx * sign, b.tz * sign);
        bogies[0].turn(Math.atan2(Math.sin(a.yaw - yaw), Math.cos(a.yaw - yaw)));
        bogies[1].turn(Math.atan2(Math.sin(b.yaw - yaw), Math.cos(b.yaw - yaw)));
      }
    }

    function animate({ dt, st }) {
      roll = (roll + st.speed * dt / cars[0].entry.meta.wheel_radius) % (2 * Math.PI);
      door = damp(door, st.near && Math.abs(st.speed) < 0.2 ? 1 : 0, 4, dt);
      for (const car of cars) {
        for (const part of car.parts) {
          if (part.role === 'wheel') part.turn(roll * (car.reversed ? -1 : 1));
          if (part.role === 'door') part.slide(part.pivot[0] * (car.reversed ? -1 : 1) > 0 ? door : 0);
        }
      }
    }

    /** On rails there is one degree of freedom: how fast. */
    function drive(dt, input, world, st) {
      const throttle = clamp(input.up - input.down + input.joyY, -1, 1);
      if (throttle > 0.05) st.speed += 2.6 * throttle * dt;
      else if (throttle < -0.05) st.speed += (st.speed > 0.2 ? 6 : 1.2) * throttle * dt;
      st.speed -= st.speed * 0.1 * dt;
      st.speed = clamp(st.speed, -4, 19);
      if (Math.abs(st.speed) < 0.03 && Math.abs(throttle) < 0.05) st.speed = 0;
      let t = st.t + (st.speed * dt) / world.route.length;
      if (world.route.closed) t = ((t % 1) + 1) % 1;
      else if (t <= 0 || t >= 1) {
        t = clamp(t);
        st.speed = 0;
      }
      st.t = st.tTarget = t;
      const q = world.pointAt(t, p);
      st.x = q.x;
      st.z = q.z;
      st.y = q.y;
      st.yaw = Math.atan2(q.tx, q.tz);
      st.steer = 0;
      st.slope = 0;
      st.pedal = 0;
      st.airborne = false;
    }

    function chase(st, cam, want, { portrait, dt }) {
      cam.yaw = dampAngle(cam.yaw, st.yaw, 1.4, dt);
      const back = portrait ? 30 : 22;
      const side = 12;
      const fx = Math.sin(cam.yaw);
      const fz = Math.cos(cam.yaw);
      want.pos.set(st.x - fx * back + fz * side, st.y + (portrait ? 13 : 8.5), st.z - fz * back - fx * side);
      want.look.set(st.x - fx * 6, st.y + 1.6, st.z - fz * 6);
      want.fov = damp(want.fov, portrait ? 58 : 44, 4, dt);
    }

    return {
      id: 'train',
      object: root,
      radius: 1.4,
      onRails: true,
      storyScale: 2.6,
      focusHeight: 2,
      place,
      animate,
      drive,
      chase,
      action(id, st, fx) {
        if (id === 'horn') fx.sound('horn');
      },
      setTheme(dark) {
        headlight.intensity = dark ? 120 : 0;
      },
      setCargo() {},
      setShadowBlob() {},
      dispose() { headlight.dispose(); },
    };
  },
};
