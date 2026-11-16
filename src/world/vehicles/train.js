// Train — a prototype of the second vehicle, built to prove the interface.
//
// It is deliberately different from the bicycle in every way the engine has to
// care about: it cannot leave its route, it has momentum instead of agility,
// it is several bodies following one line, and its camera stands well back.
// The model is placeholder geometry made here; a production train will arrive
// as a hero asset through the Blender pipeline, behind this same interface.

import * as THREE from 'three';
import { clamp, damp, dampAngle } from '../kit.js';

const CAR = 9.2; // length of one car, metres
const GAP = 0.7;

export const train = {
  id: 'train',
  assets: [],
  onRails: true,
  actions: { a: 'horn', b: null },

  create() {
    const root = new THREE.Group(); // stays at the origin: cars are placed in world space
    const mats = {
      body: new THREE.MeshLambertMaterial({ color: '#efe6d2' }),
      band: new THREE.MeshLambertMaterial({ color: '#27512f' }),
      roof: new THREE.MeshLambertMaterial({ color: '#b9b3a6' }),
      glass: new THREE.MeshLambertMaterial({ color: '#33403f' }),
      under: new THREE.MeshLambertMaterial({ color: '#2f2b27' }),
      lamp: new THREE.MeshBasicMaterial({ color: '#fff3c4' }),
    };
    const box = new THREE.BoxGeometry(1, 1, 1);
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.14, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheels = [];
    const cars = [];
    const part = (parent, mat, sx, sy, sz, x, y, z) => {
      const m = new THREE.Mesh(box, mat);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    for (let i = 0; i < 3; i++) {
      const car = new THREE.Group();
      const lead = i === 0;
      part(car, mats.under, 2.3, 0.5, CAR - 0.6, 0, 0.75, 0);
      part(car, mats.body, 2.6, 1.9, CAR, 0, 1.95, 0);
      part(car, mats.band, 2.63, 0.42, CAR + 0.01, 0, 1.3, 0);
      part(car, mats.roof, 2.3, 0.22, CAR - 0.4, 0, 3.0, 0);
      for (const sx of [-1, 1]) for (let w = 0; w < 5; w++) part(car, mats.glass, 0.04, 0.72, 1.15, sx * 1.305, 2.25, -CAR / 2 + 1.25 + w * 1.66);
      if (lead) {
        const nose = part(car, mats.body, 2.4, 1.6, 1.2, 0, 1.8, CAR / 2 + 0.45);
        nose.rotation.x = -0.28;
        part(car, mats.glass, 2.0, 0.7, 0.05, 0, 2.3, CAR / 2 + 0.92).rotation.x = -0.28;
        for (const sx of [-0.8, 0.8]) part(car, mats.lamp, 0.26, 0.16, 0.06, sx, 1.25, CAR / 2 + 1.12);
      }
      for (const z of [-CAR / 2 + 1.5, CAR / 2 - 1.5]) {
        for (const sx of [-0.75, 0.75]) {
          const w = new THREE.Mesh(wheelGeo, mats.under);
          w.position.set(sx, 0.42, z);
          car.add(w);
          wheels.push(w);
        }
      }
      root.add(car);
      cars.push(car);
    }
    const headlight = new THREE.SpotLight('#ffe9b0', 0, 60, 0.4, 0.6, 1.0);
    cars[0].add(headlight, headlight.target);
    headlight.position.set(0, 2, CAR / 2 + 1);
    headlight.target.position.set(0, 0, CAR / 2 + 30);

    const p = {};
    const p2 = {};
    let spin = 0;

    /** Each car sits on the route at its own distance behind the front. */
    function place(st, world) {
      const L = world.route.length;
      cars.forEach((car, i) => {
        const back = CAR / 2 + i * (CAR + GAP);
        const a = world.pointAt(st.t - (back - CAR * 0.36) / L, p);
        const b = world.pointAt(st.t - (back + CAR * 0.36) / L, p2);
        car.position.set((a.x + b.x) / 2, (a.y + b.y) / 2 + 0.18, (a.z + b.z) / 2);
        car.rotation.y = Math.atan2(a.x - b.x, a.z - b.z);
      });
    }

    function animate({ dt, st }) {
      spin += (st.speed * dt) / 0.42;
      for (const w of wheels) w.rotation.x = spin;
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
        mats.lamp.color.set(dark ? '#fff3c4' : '#e9e1cc');
        mats.glass.color.set(dark ? '#ffd98a' : '#33403f');
      },
      setCargo() {},
      setShadowBlob() {},
      dispose() {
        Object.values(mats).forEach((m) => m.dispose());
        box.dispose();
        wheelGeo.dispose();
      },
    };
  },
};
