// Bicycle — the first vehicle, and the reference implementation of the
// vehicle interface (see vehicles/index.js).
//
// The model is a Blender hero asset (vehicles/city_bike) with named parts. The
// engine owns the motion: wheel spin from distance travelled, cranks that turn
// only while pedalling (it freewheels), legs and arms solved with two-bone IK
// onto pedals and grips, lean, fork steer, a sprung body, a pennant that trails
// with speed. The arcade physics for free riding live here too, because how a
// thing moves is what makes it that vehicle.

import * as THREE from 'three';
import { aim, damp, dampAngle, clamp } from '../kit.js';

const WHEEL_R = 0.36;
const WHEELBASE = 1.08;
const RADIUS = 0.42;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const bicycle = {
  id: 'bicycle',
  assets: ['vehicles/city_bike'],
  onRails: false,
  actions: { a: 'hop', b: 'bell' },

  create({ assets }) {
    const root = new THREE.Group(); // world position + yaw
    const tilt = new THREE.Group(); // pitch (slope) + roll (lean), pivot on the ground
    const body = new THREE.Group(); // sprung mass
    root.add(tilt);
    tilt.add(body);

    const { scene: model, nodes } = assets.instance('vehicles/city_bike');
    body.add(model);
    const glow = [];
    model.traverse((o) => {
      if (o.isMesh && o.userData.surface === 'glow') glow.push(o.material);
    });

    const mats = {
      shirt: new THREE.MeshLambertMaterial({ color: '#f1e8d3' }),
      shorts: new THREE.MeshLambertMaterial({ color: '#27512f' }),
      skin: new THREE.MeshLambertMaterial({ color: '#d7a27c' }),
      metal: new THREE.MeshLambertMaterial({ color: '#b9b3a6' }),
      lemon: new THREE.MeshLambertMaterial({ color: '#f4d326' }),
      flag: new THREE.MeshLambertMaterial({ color: '#f4ecd9', side: THREE.DoubleSide }),
    };
    const geos = {
      limb: new THREE.CylinderGeometry(0.82, 1, 1, 8),
      joint: new THREE.SphereGeometry(1, 8, 6),
      lemon: new THREE.IcosahedronGeometry(0.055, 1),
      stick: new THREE.CylinderGeometry(1, 1, 1, 5),
    };
    const limb = (mat) => {
      const m = new THREE.Mesh(geos.limb, mat);
      m.castShadow = true;
      body.add(m);
      return m;
    };
    const joint = (mat, r) => {
      const m = new THREE.Mesh(geos.joint, mat);
      m.scale.setScalar(r);
      body.add(m);
      return m;
    };

    // Reference points in body space (+Z forward, +Y up, +X the rider's left).
    const bb = V(0, 0.33, -0.08);
    const hip = V(0, 0.95, -0.28);
    const chest = V(0, 1.4, 0.0);
    const headTop = nodes.steer.position.clone();
    const steerAxis = V(0, 0.84 - 0.66, 0.34 - 0.39).normalize();
    const grips = [V(0.296, 1.0, 0.16).sub(headTop), V(-0.296, 1.0, 0.16).sub(headTop)];
    const CRANK = 0.17;
    const PEDAL_X = 0.13;
    const pedals = [
      { side: 1, node: nodes.pedal_l, shoe: nodes.shoe_l, pos: V(0, 0, 0) },
      { side: -1, node: nodes.pedal_r, shoe: nodes.shoe_r, pos: V(0, 0, 0) },
    ];

    const limbs = {
      thigh: [limb(mats.shorts), limb(mats.shorts)],
      shin: [limb(mats.skin), limb(mats.skin)],
      upper: [limb(mats.shirt), limb(mats.shirt)],
      fore: [limb(mats.skin), limb(mats.skin)],
      knee: [joint(mats.skin, 0.052), joint(mats.skin, 0.052)],
      elbow: [joint(mats.shirt, 0.043), joint(mats.shirt, 0.043)],
      hand: [joint(mats.skin, 0.04), joint(mats.skin, 0.04)],
    };

    // Lemons that appear in the basket as they are collected.
    const basketAt = V(0, 0.86, 0.56).sub(headTop);
    const cargo = [];
    for (let i = 0; i < 6; i++) {
      const l = new THREE.Mesh(geos.lemon, mats.lemon);
      l.position.set(basketAt.x - 0.09 + (i % 3) * 0.09, basketAt.y + 0.03 + Math.floor(i / 3) * 0.07, basketAt.z - 0.04 + ((i * 7) % 3) * 0.04);
      l.scale.set(1, 0.85, 1.25);
      l.visible = false;
      nodes.steer.add(l);
      cargo.push(l);
    }

    // Pennant on a springy pole: personality, and a readable speed cue.
    const pole = new THREE.Group();
    pole.position.set(0, 0.745, -0.84);
    body.add(pole);
    const stick = new THREE.Mesh(geos.stick, mats.metal);
    aim(stick, V(0, 0, 0), V(0, 0.95, 0), 0.006);
    pole.add(stick);
    const flagGeo = new THREE.BufferGeometry();
    flagGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0.95, 0, 0, 0.75, 0, 0, 0.85, -0.3]), 3));
    flagGeo.computeVertexNormals();
    const flag = new THREE.Mesh(flagGeo, mats.flag);
    pole.add(flag);

    const headlight = new THREE.SpotLight('#ffe9b0', 0, 24, 0.55, 0.7, 1.1);
    headlight.position.set(0, 1, 0.5);
    headlight.target.position.set(0, 0, 9);
    root.add(headlight, headlight.target);

    // Soft contact shadow for tiers that run without shadow maps.
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.75, 16), new THREE.MeshBasicMaterial({ color: '#1c140c', transparent: true, opacity: 0.22, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.scale.set(0.7, 1.25, 1);
    blob.position.y = 0.03;
    blob.renderOrder = 2;
    root.add(blob);

    const an = { wheel: 0, crank: 0, lean: 0, pitch: 0, steer: 0, bob: 0, bobV: 0, flag: 0, look: 0, effort: 0, lastPitch: 0 };
    const tA = V(0, 0, 0);
    const tB = V(0, 0, 0);
    const knee = V(0, 0, 0);
    const elbow = V(0, 0, 0);
    const up = V(0, 1, 0);
    const dir = V(0, 0, 0);
    const THIGH = 0.44;
    const SHIN = 0.46;

    function solveLeg(i, side, foot) {
      // Two-bone IK in the sagittal plane; the knee always bends forward.
      tA.set(side * 0.1, hip.y - 0.03, hip.z + 0.02);
      const dy = foot.y - tA.y;
      const dz = foot.z - tA.z;
      const d = clamp(Math.hypot(dy, dz), 0.05, THIGH + SHIN - 0.005);
      const a = Math.acos(clamp((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d), -1, 1));
      const ang = Math.atan2(dz, -dy) + a;
      knee.set(side * 0.125, tA.y - Math.cos(ang) * THIGH, tA.z + Math.sin(ang) * THIGH);
      aim(limbs.thigh[i], tA, knee, 0.072);
      aim(limbs.shin[i], knee, foot, 0.05);
      limbs.knee[i].position.copy(knee);
    }

    /** Pose the model from the engine state. Called every frame, in every mode. */
    function animate({ dt, time, st, calm }) {
      const sp = st.speed;
      an.wheel += (sp * dt) / WHEEL_R;
      nodes.wheel_rear.rotation.x = an.wheel;
      nodes.wheel_front.rotation.x = an.wheel;

      // Cadence follows road speed, but only while there is effort on the pedals.
      an.effort = damp(an.effort, st.pedal, 7, dt);
      an.crank += clamp(Math.abs(sp) * 1.15 + 1.2, 0, 11) * an.effort * dt * Math.sign(sp || 1);
      nodes.crank.rotation.x = an.crank;

      an.steer = damp(an.steer, st.steer, 9, dt);
      nodes.steer.quaternion.setFromAxisAngle(steerAxis, an.steer * 0.55);

      const leanTarget = calm ? 0 : clamp(-an.steer * Math.min(Math.abs(sp), 9) * 0.055, -0.5, 0.5);
      an.lean = damp(an.lean, leanTarget, 6, dt);
      an.pitch = damp(an.pitch, -st.slope, 8, dt);
      tilt.rotation.set(an.pitch, 0, an.lean, 'YXZ');

      // Sprung body: slope changes and landings kick it; it settles on its own.
      const kick = (an.pitch - an.lastPitch) * 2.2 + (st.jolt || 0);
      an.lastPitch = an.pitch;
      an.bobV += (-an.bob * 160 - an.bobV * 13) * dt - kick;
      an.bob = clamp(an.bob + an.bobV * dt, -0.09, 0.07);
      body.position.y = calm ? 0 : an.bob;

      pedals.forEach((p, i) => {
        const a = an.crank + (p.side > 0 ? 0 : Math.PI);
        p.pos.set(p.side * PEDAL_X, bb.y + Math.cos(a) * CRANK, bb.z + Math.sin(a) * CRANK);
        p.node.position.copy(p.pos);
        p.shoe.position.set(p.pos.x, p.pos.y + 0.05, p.pos.z);
        p.shoe.rotation.x = Math.sin(a) * 0.22;
        tB.set(p.pos.x, p.pos.y + 0.085, p.pos.z - 0.02);
        solveLeg(i, p.side, tB);
      });

      // Torso leans into the effort and rocks slightly with the cadence.
      const rock = calm ? 0 : Math.sin(an.crank) * 0.018 * an.effort;
      const crouch = clamp(Math.abs(sp) / 12, 0, 1) * 0.07;
      tB.set(chest.x + rock, chest.y - crouch - an.bob * 0.4, chest.z + crouch);
      nodes.torso.position.copy(hip);
      nodes.torso.quaternion.setFromUnitVectors(up, dir.subVectors(tB, hip).normalize());

      an.look = damp(an.look, an.steer * 0.7, 5, dt);
      nodes.head.position.copy(hip).addScaledVector(dir, 0.66);
      nodes.head.rotation.set(0.1, an.look, 0);

      // Arms reach the grips wherever the bars are.
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? 1 : -1;
        const hand = nodes.steer.localToWorld(tA.copy(grips[i]));
        body.worldToLocal(hand);
        const sh = knee.copy(hip).addScaledVector(dir, 0.47);
        sh.x += side * 0.19;
        elbow.addVectors(sh, hand).multiplyScalar(0.5);
        elbow.y -= 0.075;
        elbow.x += side * 0.06;
        aim(limbs.upper[i], sh, elbow, 0.052);
        aim(limbs.fore[i], elbow, hand, 0.04);
        limbs.elbow[i].position.copy(elbow);
        limbs.hand[i].position.copy(hand);
      }

      const flutter = calm ? 0 : Math.sin(time * 14) * 0.04 * clamp(Math.abs(sp) / 4, 0.15, 1);
      an.flag = damp(an.flag, clamp(sp * 0.03, -0.1, 0.34), 4, dt);
      pole.rotation.x = -an.flag;
      pole.rotation.z = -an.lean * 0.5 + flutter;
      flag.rotation.y = flutter * 6;

      blob.material.opacity = st.airborne ? 0.1 : 0.22;
    }

    const g0 = {};
    const g1 = {};

    /**
     * Free riding (Explore). Arcade physics: acceleration, drag, off-road drag,
     * slope gravity, speed-dependent steering, hops, falls and collisions.
     */
    function drive(dt, input, world, st, fx) {
      const throttle = clamp(input.up - input.down + input.joyY, -1, 1);
      const steerIn = clamp(input.left - input.right - input.joyX, -1, 1);
      const g = world.groundAt(st.x, st.z, g0);

      const max = g.onRoad ? 10 : 6.8;
      if (throttle > 0.05) st.speed += 9.5 * throttle * dt * clamp(1 - st.speed / max, 0, 1);
      else if (throttle < -0.05) st.speed += (st.speed > 0.4 ? 17 : 4) * throttle * dt;
      st.speed -= st.speed * (g.onRoad ? 0.32 : 1.05) * dt;
      // Gravity helps downhill and costs uphill, but a parked bike stays parked.
      if (!st.airborne && (Math.abs(st.speed) > 0.7 || Math.abs(throttle) > 0.05)) st.speed -= Math.sin(st.slope) * 7 * dt;
      else if (Math.abs(throttle) < 0.05) st.speed = damp(st.speed, 0, 8, dt);
      st.speed = clamp(st.speed, -2.6, 13);
      if (Math.abs(st.speed) < 0.04 && Math.abs(throttle) < 0.05) st.speed = 0;
      st.pedal = throttle > 0.05 ? 1 : 0;

      // Steer: quick at low speed, calmer at pace.
      st.steer = damp(st.steer, steerIn, 8, dt);
      const grip = clamp(Math.abs(st.speed) / 2.4, 0, 1) / (1 + Math.abs(st.speed) * 0.07);
      st.yaw += st.steer * 2.6 * grip * dt * Math.sign(st.speed || 1);

      let nx = st.x + Math.sin(st.yaw) * st.speed * dt;
      let nz = st.z + Math.cos(st.yaw) * st.speed * dt;

      // Collisions: circles and wall segments, pushed out along the normal.
      const cs = world.colliders;
      for (let i = 0; i < cs.length; i++) {
        const c = cs[i];
        let cx = c.x;
        let cz = c.z;
        if (c.type === 'segment') {
          const ex = c.bx - c.ax;
          const ez = c.bz - c.az;
          const f = clamp(((nx - c.ax) * ex + (nz - c.az) * ez) / (ex * ex + ez * ez || 1));
          cx = c.ax + ex * f;
          cz = c.az + ez * f;
        }
        const dx = nx - cx;
        const dz = nz - cz;
        const rr = c.r + RADIUS;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.001;
        if (st.airborne && c.r < 0.4 && c.type !== 'segment' && st.y - world.heightAt(cx, cz) > 1.2) continue;
        nx = cx + (dx / d) * rr;
        nz = cz + (dz / d) * rr;
        const head = -((dx / d) * Math.sin(st.yaw) + (dz / d) * Math.cos(st.yaw)) * Math.sign(st.speed || 1);
        if (head > 0.35 && Math.abs(st.speed) > 1.2) {
          fx.bump(c, st);
          st.jolt = Math.min(0.9, Math.abs(st.speed) * 0.09);
          st.speed *= -0.22;
        } else st.speed *= 1 - 1.5 * dt;
      }
      st.x = nx;
      st.z = nz;

      // Ground, hops and falls.
      const gn = world.groundAt(st.x, st.z, g0);
      if (st.airborne) {
        st.vy -= 20 * dt;
        st.y += st.vy * dt;
        if (st.y <= gn.y) {
          st.y = gn.y;
          st.jolt = Math.min(1.1, Math.abs(st.vy) * 0.11);
          st.vy = 0;
          st.airborne = false;
        }
      } else if (st.y - gn.y > 0.45) {
        st.airborne = true; // rode off an edge
        st.vy = 0;
      } else st.y = damp(st.y, gn.y, 26, dt);

      const f = world.groundAt(st.x + Math.sin(st.yaw) * 0.54, st.z + Math.cos(st.yaw) * 0.54, g1).y;
      const r = world.groundAt(st.x - Math.sin(st.yaw) * 0.54, st.z - Math.cos(st.yaw) * 0.54, g1).y;
      st.slope = st.airborne ? clamp(-st.vy * 0.03, -0.3, 0.3) : clamp(Math.atan2(f - r, WHEELBASE), -0.5, 0.5);

      // Recovery: water, the edge of the map, or simply being stuck.
      if (gn.water && st.y < world.waterY + 0.15 && st.lock <= 0) {
        fx.splash(st.x, st.z);
        fx.respawn('water');
      } else if (Math.hypot(st.x, st.z) > world.bounds) fx.respawn('edge');
      if (throttle > 0.3 && Math.abs(st.speed) < 0.35) {
        st.stuck += dt;
        if (st.stuck > 1.6) fx.respawn('stuck');
      } else st.stuck = 0;

      st.t = st.tTarget = gn.t;
    }

    /** Camera the vehicle wants while driven freely. */
    function chase(st, cam, want, { portrait, calm, dt }) {
      cam.yaw = dampAngle(cam.yaw, st.yaw, 3.2, dt);
      const back = (portrait ? 8.8 : 6.9) + Math.abs(st.speed) * 0.12;
      const upY = portrait ? 4.9 : 3.5;
      want.pos.set(st.x - Math.sin(cam.yaw) * back, st.y + upY, st.z - Math.cos(cam.yaw) * back);
      want.look.set(st.x + Math.sin(st.yaw) * 2.4, st.y + 1.15, st.z + Math.cos(st.yaw) * 2.4);
      want.fov = (portrait ? 60 : 50) + (calm ? 0 : clamp(Math.abs(st.speed), 0, 12) * 0.8);
    }

    function action(id, st, fx) {
      if (id === 'hop') {
        if (st.mode !== 'explore' || st.airborne) return;
        st.vy = 6.2;
        st.airborne = true;
      } else if (id === 'bell') fx.sound('bell');
    }

    return {
      id: 'bicycle',
      object: root,
      radius: RADIUS,
      onRails: false,
      storyScale: 1,
      focusHeight: 1.0,
      animate,
      drive,
      chase,
      action,
      place(st) {
        root.position.set(st.x, st.y, st.z);
        root.rotation.y = st.yaw;
      },
      setTheme(dark) {
        headlight.intensity = dark ? 46 : 0;
        glow.forEach((m) => m.color.set(dark ? '#fff3c4' : '#e9e1cc'));
      },
      setCargo(n) {
        cargo.forEach((l, i) => (l.visible = i < n));
      },
      setShadowBlob(on) {
        blob.visible = on;
      },
      dispose() {
        Object.values(mats).forEach((m) => m.dispose());
        Object.values(geos).forEach((g) => g.dispose());
        flagGeo.dispose();
        blob.geometry.dispose();
        blob.material.dispose();
      },
    };
  },
};
