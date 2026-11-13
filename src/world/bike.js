// The protagonist: a small city bike and its rider, built from primitives.
//
// The model is deliberately a toy — fat tyres, short frame, a basket and a
// pennant — because it has to read as a character from thirty metres away.
// Everything that sells the motion is driven from here: wheel spin from
// distance travelled, cranks that turn only while pedalling (it freewheels
// when coasting), legs solved with two-bone IK onto the pedals, lean, fork
// steer, a sprung body and a pennant that lags behind the speed.

import * as THREE from 'three';
import { aim, damp, clamp } from './kit.js';

const WHEEL_R = 0.36;
const WHEELBASE = 1.08;

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function createBike() {
  const root = new THREE.Group(); // world position + yaw
  const tilt = new THREE.Group(); // pitch (slope) + roll (lean), pivot on the ground
  const body = new THREE.Group(); // sprung mass
  root.add(tilt);
  tilt.add(body);

  const mats = {
    frame: new THREE.MeshLambertMaterial({ color: '#3fbf16' }),
    tyre: new THREE.MeshLambertMaterial({ color: '#2a231d' }),
    metal: new THREE.MeshLambertMaterial({ color: '#cfc6b4' }),
    leather: new THREE.MeshLambertMaterial({ color: '#6b4a2e' }),
    basket: new THREE.MeshLambertMaterial({ color: '#b8935a' }),
    shirt: new THREE.MeshLambertMaterial({ color: '#f4ecd9' }),
    shorts: new THREE.MeshLambertMaterial({ color: '#27512f' }),
    skin: new THREE.MeshLambertMaterial({ color: '#d7a27c' }),
    helmet: new THREE.MeshLambertMaterial({ color: '#b5573a' }),
    lemon: new THREE.MeshLambertMaterial({ color: '#f2d024' }),
    flag: new THREE.MeshLambertMaterial({ color: '#f4ecd9', side: THREE.DoubleSide }),
    lamp: new THREE.MeshBasicMaterial({ color: '#fff3c4' }),
  };

  const cyl = new THREE.CylinderGeometry(1, 1, 1, 7);
  const tubeMesh = (mat) => {
    const m = new THREE.Mesh(cyl, mat);
    m.castShadow = true;
    return m;
  };
  const tube = (a, b, r, mat, parent = body) => {
    const m = tubeMesh(mat);
    aim(m, a, b, r);
    parent.add(m);
    return m;
  };

  // --- Wheels --------------------------------------------------------------
  const tyreGeo = new THREE.TorusGeometry(WHEEL_R - 0.055, 0.055, 6, 18);
  const rimGeo = new THREE.TorusGeometry(WHEEL_R - 0.11, 0.012, 4, 18);
  const makeWheel = () => {
    const w = new THREE.Group();
    const tyre = new THREE.Mesh(tyreGeo, mats.tyre);
    tyre.castShadow = true;
    w.add(tyre, new THREE.Mesh(rimGeo, mats.metal));
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(cyl, mats.metal);
      s.scale.set(0.008, (WHEEL_R - 0.1) * 2, 0.008);
      s.rotation.z = (i / 4) * Math.PI;
      w.add(s);
    }
    const hub = new THREE.Mesh(cyl, mats.metal);
    hub.scale.set(0.035, 0.09, 0.035);
    hub.rotation.x = Math.PI / 2;
    w.add(hub);
    return w;
  };

  // Local frame: +Z forward, +Y up, +X is the rider's left.
  const rearAxle = V(0, WHEEL_R, -WHEELBASE / 2);
  const frontAxle = V(0, WHEEL_R, WHEELBASE / 2);
  const bb = V(0, 0.33, -0.08); // bottom bracket
  const seatTop = V(0, 0.86, -0.3);
  const headTop = V(0, 0.84, 0.34);
  const headBot = V(0, 0.66, 0.39);

  const rear = makeWheel();
  rear.position.copy(rearAxle);
  rear.rotation.y = Math.PI / 2;
  body.add(rear);

  // Steering assembly rotates around the head tube axis.
  const steer = new THREE.Group();
  steer.position.copy(headTop);
  const steerAxis = V(0, headTop.y - headBot.y, headTop.z - headBot.z).normalize();
  body.add(steer);
  const inSteer = (v) => v.clone().sub(headTop);

  const front = makeWheel();
  front.position.copy(inSteer(frontAxle));
  front.rotation.y = Math.PI / 2;
  steer.add(front);

  // --- Frame ---------------------------------------------------------------
  tube(bb, seatTop, 0.026, mats.frame); // seat tube
  tube(V(0, 0.78, -0.27), headTop.clone().add(V(0, -0.05, -0.01)), 0.026, mats.frame); // top tube
  tube(bb, headBot, 0.03, mats.frame); // down tube
  tube(headBot, headTop, 0.034, mats.frame); // head tube
  for (const sx of [-0.05, 0.05]) {
    tube(V(sx, bb.y, bb.z), V(sx, rearAxle.y, rearAxle.z), 0.016, mats.frame); // chain stays
    tube(V(sx, 0.76, -0.27), V(sx, rearAxle.y, rearAxle.z), 0.014, mats.frame); // seat stays
    tube(inSteer(V(sx, headBot.y, headBot.z)), inSteer(V(sx, frontAxle.y, frontAxle.z)), 0.017, mats.frame, steer); // fork
  }
  // Mudguard hints and rear rack
  tube(V(0, 0.76, -0.27), V(0, 0.74, -0.86), 0.012, mats.metal);
  tube(V(0, 0.74, -0.86), V(0, WHEEL_R, rearAxle.z - 0.02), 0.01, mats.metal);

  // Saddle
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.3), mats.leather);
  saddle.position.set(0, 0.89, -0.31);
  saddle.castShadow = true;
  body.add(saddle);

  // Handlebar, stem, grips, lamp, basket (all turn with the fork)
  tube(V(0, 0, 0), V(0, 0.16, -0.02), 0.02, mats.metal, steer);
  tube(V(-0.27, 0.17, -0.06), V(0.27, 0.17, -0.06), 0.016, mats.metal, steer);
  tube(V(-0.27, 0.17, -0.06), V(-0.27, 0.17, -0.17), 0.02, mats.leather, steer);
  tube(V(0.27, 0.17, -0.06), V(0.27, 0.17, -0.17), 0.02, mats.leather, steer);
  const gripL = V(0.27, 0.17, -0.13);
  const gripR = V(-0.27, 0.17, -0.13);

  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.24), mats.basket);
  basket.position.set(0, 0.02, 0.2);
  basket.castShadow = true;
  steer.add(basket);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mats.lamp);
  lamp.position.set(0, -0.12, 0.34);
  steer.add(lamp);

  // Lemons that appear in the basket as they are collected.
  const lemonGeo = new THREE.IcosahedronGeometry(0.06, 0);
  const basketLemons = [];
  for (let i = 0; i < 6; i++) {
    const l = new THREE.Mesh(lemonGeo, mats.lemon);
    l.position.set(-0.1 + (i % 3) * 0.1, 0.13 + Math.floor(i / 3) * 0.07, 0.15 + ((i * 7) % 3) * 0.05);
    l.scale.set(1, 0.85, 1.25);
    l.visible = false;
    steer.add(l);
    basketLemons.push(l);
  }

  // --- Drivetrain ----------------------------------------------------------
  const crank = new THREE.Group();
  crank.position.copy(bb);
  body.add(crank);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 12), mats.metal);
  ring.rotation.z = Math.PI / 2;
  ring.position.x = -0.07;
  crank.add(ring);
  const CRANK = 0.17;
  const PEDAL_X = 0.13;
  const pedals = [];
  for (const side of [1, -1]) {
    const arm = new THREE.Mesh(cyl, mats.metal);
    aim(arm, V(side * 0.08, 0, 0), V(side * 0.08, side * CRANK, 0), 0.014);
    crank.add(arm);
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.07), mats.tyre);
    body.add(pedal); // kept level, positioned every frame
    pedals.push({ side, mesh: pedal, pos: V(0, 0, 0) });
  }

  // --- Rider ---------------------------------------------------------------
  const rider = new THREE.Group();
  body.add(rider);
  const hip = V(0, 0.95, -0.28);
  const chest = V(0, 1.38, 0.02);
  const torso = tubeMesh(mats.shirt);
  rider.add(torso);
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), mats.shorts);
  pelvis.position.copy(hip);
  pelvis.scale.set(1.15, 0.8, 1);
  rider.add(pelvis);

  const head = new THREE.Group();
  rider.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mats.skin);
  skull.castShadow = true;
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.155, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), mats.helmet);
  helmet.position.y = 0.01;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.1), mats.helmet);
  visor.position.set(0, 0.03, 0.15);
  head.add(skull, helmet, visor);

  const limbs = {
    thigh: [tubeMesh(mats.shorts), tubeMesh(mats.shorts)],
    shin: [tubeMesh(mats.skin), tubeMesh(mats.skin)],
    upper: [tubeMesh(mats.shirt), tubeMesh(mats.shirt)],
    fore: [tubeMesh(mats.skin), tubeMesh(mats.skin)],
  };
  Object.values(limbs).forEach((pair) => pair.forEach((m) => rider.add(m)));
  const shoes = [0, 1].map(() => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.2), mats.leather);
    rider.add(s);
    return s;
  });

  // --- Pennant on a springy pole (personality + a readable speed cue) ------
  const pole = new THREE.Group();
  pole.position.set(0, 0.74, -0.84);
  body.add(pole);
  const stick = new THREE.Mesh(cyl, mats.metal);
  aim(stick, V(0, 0, 0), V(0, 0.95, 0), 0.008);
  pole.add(stick);
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0.95, 0, 0, 0.75, 0, 0, 0.85, -0.3]), 3));
  flagGeo.computeVertexNormals();
  const flag = new THREE.Mesh(flagGeo, mats.flag);
  pole.add(flag);

  // Soft contact shadow for tiers that run without shadow maps.
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.75, 16),
    new THREE.MeshBasicMaterial({ color: '#1c140c', transparent: true, opacity: 0.22, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.scale.set(0.7, 1.25, 1);
  blob.position.y = 0.03;
  blob.renderOrder = 2;
  root.add(blob);

  // --- Animation state -----------------------------------------------------
  const st = { wheel: 0, crank: 0, lean: 0, pitch: 0, steer: 0, bob: 0, bobV: 0, flag: 0, look: 0, effort: 0, lastPitch: 0 };
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const knee = new THREE.Vector3();
  const elbow = new THREE.Vector3();
  const THIGH = 0.44;
  const SHIN = 0.46;

  function solveLeg(i, side, foot) {
    // Two-bone IK in the sagittal plane; the knee always bends forward.
    tmpA.set(side * 0.1, hip.y - 0.02, hip.z);
    tmpB.copy(foot);
    const dy = tmpB.y - tmpA.y;
    const dz = tmpB.z - tmpA.z;
    const d = clamp(Math.hypot(dy, dz), 0.05, THIGH + SHIN - 0.005);
    const a = Math.acos(clamp((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d), -1, 1));
    const base = Math.atan2(dz, -dy); // angle from straight down toward +Z
    const ang = base + a;
    knee.set(side * 0.12, tmpA.y - Math.cos(ang) * THIGH, tmpA.z + Math.sin(ang) * THIGH);
    aim(limbs.thigh[i], tmpA, knee, 0.062);
    aim(limbs.shin[i], knee, tmpB, 0.045);
    shoes[i].position.set(foot.x, foot.y - 0.01, foot.z + 0.03);
  }

  /**
   * @param s { speed, steer(-1..1), pedalling(0..1), slope(rad), jolt, dt, time, airborne, calm }
   */
  function update(s) {
    const { dt } = s;
    const sp = s.speed;

    st.wheel += (sp * dt) / WHEEL_R;
    rear.rotation.x = st.wheel;
    front.rotation.x = st.wheel;

    // Cadence follows road speed but only while there is effort on the pedals.
    st.effort = damp(st.effort, s.pedalling, 7, dt);
    st.crank += clamp(Math.abs(sp) * 1.15 + 1.2, 0, 11) * st.effort * dt * Math.sign(sp || 1);
    crank.rotation.x = st.crank;

    st.steer = damp(st.steer, s.steer, 9, dt);
    steer.setRotationFromAxisAngle(steerAxis, st.steer * 0.55);

    const leanTarget = s.calm ? 0 : clamp(-st.steer * Math.min(Math.abs(sp), 9) * 0.055, -0.5, 0.5);
    st.lean = damp(st.lean, leanTarget, 6, dt);
    st.pitch = damp(st.pitch, -s.slope, 8, dt);
    tilt.rotation.set(st.pitch, 0, st.lean, 'YXZ');

    // Sprung body: slope changes and landings kick it, it settles on its own.
    const kick = (st.pitch - st.lastPitch) * 2.2 + (s.jolt || 0);
    st.lastPitch = st.pitch;
    st.bobV += (-st.bob * 160 - st.bobV * 13) * dt - kick;
    st.bob = clamp(st.bob + st.bobV * dt, -0.09, 0.07);
    body.position.y = s.calm ? 0 : st.bob;

    // Pedals + legs
    pedals.forEach((p, i) => {
      const a = st.crank + (p.side > 0 ? 0 : Math.PI);
      p.pos.set(p.side * PEDAL_X, bb.y + Math.cos(a) * CRANK, bb.z + Math.sin(a) * CRANK);
      p.mesh.position.copy(p.pos);
      tmpB.set(p.pos.x, p.pos.y + 0.045, p.pos.z);
      solveLeg(i, p.side, tmpB.clone());
    });

    // Torso leans into the effort and rocks slightly with the cadence.
    const rock = s.calm ? 0 : Math.sin(st.crank) * 0.018 * st.effort;
    const crouch = clamp(Math.abs(sp) / 12, 0, 1) * 0.07;
    tmpA.copy(hip);
    tmpB.set(chest.x + rock, chest.y - crouch - st.bob * 0.4, chest.z + crouch);
    aim(torso, tmpA, tmpB, 0.125);

    st.look = damp(st.look, st.steer * 0.7, 5, dt);
    head.position.set(tmpB.x, tmpB.y + 0.2, tmpB.z + 0.05);
    head.rotation.set(0.08, st.look, 0);

    // Arms reach the grips wherever the bars are.
    [gripL, gripR].forEach((g, i) => {
      const side = i === 0 ? 1 : -1;
      const hand = steer.localToWorld(g.clone());
      body.worldToLocal(hand);
      const sh = tmpA.set(side * 0.16, tmpB.y - 0.06, tmpB.z - 0.02).clone();
      elbow.addVectors(sh, hand).multiplyScalar(0.5);
      elbow.y -= 0.07;
      elbow.x += side * 0.05;
      aim(limbs.upper[i], sh, elbow, 0.045);
      aim(limbs.fore[i], elbow, hand, 0.036);
    });

    // Pennant trails with speed and flutters.
    const flutter = s.calm ? 0 : Math.sin(s.time * 14) * 0.04 * clamp(Math.abs(sp) / 4, 0.15, 1);
    st.flag = damp(st.flag, clamp(sp * 0.03, -0.1, 0.34), 4, dt);
    pole.rotation.x = -st.flag;
    pole.rotation.z = -st.lean * 0.5 + flutter;
    flag.rotation.y = flutter * 6;

    blob.material.opacity = s.airborne ? 0.1 : 0.22;
  }

  function setLemons(n) {
    basketLemons.forEach((l, i) => (l.visible = i < n));
  }

  function setShadowBlob(on) {
    blob.visible = on;
  }

  function dispose() {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    Object.values(mats).forEach((m) => m.dispose());
  }

  return { root, body, lamp, update, setLemons, setShadowBlob, dispose, WHEELBASE, mats };
}
