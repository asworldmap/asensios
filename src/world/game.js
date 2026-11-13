// Pedal the World — engine.
//
// One world, two ways of moving through it:
//   STORY    the bike rides the route; scroll / keys / drag move it along and
//            the camera is directed shot by shot. No skill needed.
//   EXPLORE  the same bike, the same place, driven freely with arcade physics.
//
// The engine knows nothing about Murcia. A chapter module hands it a height
// field, a route, colliders, points of interest and camera shots.

import * as THREE from 'three';
import { createBike } from './bike.js';
import { buildMurcia } from './murcia.js';
import { clamp, lerp, smooth, damp, dampAngle } from './kit.js';

const QUALITY = [
  { dpr: 1.25, shadow: 0 },
  { dpr: 1.5, shadow: 0 },
  { dpr: 1.75, shadow: 1024 },
  { dpr: 2, shadow: 2048 },
];

export async function createGame({ canvas, tier, reduced, dark, onProgress, emit }) {
  // ------------------------------------------------------------ Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'mobile', powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.3, 900);

  let quality = tier === 'mobile' ? 1 : tier === 'tablet' ? 2 : 3;
  let autoQuality = true;

  const step = (label, f) =>
    new Promise((res) => {
      onProgress(0.25 + f * 0.7, label);
      requestAnimationFrame(() => res());
    });

  const world = await buildMurcia({ scene, tier, step });
  const bike = createBike();
  scene.add(bike.root);

  // Shadow frustum travels with the bike so a small map stays sharp.
  const sun = world.sun;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -30;
  sun.shadow.camera.right = sun.shadow.camera.top = 30;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 170;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;

  const headlight = new THREE.SpotLight('#ffe9b0', 0, 22, 0.55, 0.7, 1.1);
  headlight.position.set(0, 1, 0.5);
  headlight.target.position.set(0, 0, 9);
  bike.root.add(headlight, headlight.target);

  function applyQuality() {
    const q = QUALITY[quality];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.dpr));
    const on = q.shadow > 0;
    if (on && sun.shadow.mapSize.x !== q.shadow) {
      sun.shadow.mapSize.set(q.shadow, q.shadow);
      if (sun.shadow.map) {
        sun.shadow.map.dispose();
        sun.shadow.map = null;
      }
    }
    sun.castShadow = on;
    bike.setShadowBlob(!on);
    resize();
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function setTheme(isDark) {
    world.setTheme(isDark);
    headlight.intensity = isDark ? 46 : 0;
    bike.lamp.material.color.set(isDark ? '#fff3c4' : '#d8d0bd');
    bike.mats.frame.color.set(isDark ? '#6fdc3c' : '#3fbf16');
  }

  // ---------------------------------------------------------------- State
  const st = {
    mode: 'story',
    started: false,
    paused: false,
    x: 0, y: 0, z: 0, yaw: 0, speed: 0, vy: 0, airborne: false,
    steer: 0, slope: 0, jolt: 0,
    t: 0, tTarget: 0, dir: 1, rejoin: 1,
    intro: reduced ? 1 : 0,
    near: null, beat: null, cine: false,
    lemons: 0, stuck: 0, lock: 0,
    pedal: 0, time: 0,
  };
  const input = { up: 0, down: 0, left: 0, right: 0, joyX: 0, joyY: 0, adv: 0, wheel: 0 };
  let calm = reduced;
  let sound = true;

  const start0 = world.pointAt(0);
  st.x = start0.x;
  st.z = start0.z;
  st.y = start0.y + 0.05;
  st.yaw = Math.atan2(start0.tx, start0.tz);

  const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 46, yaw: st.yaw, ready: false };
  const want = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 46 };
  const rp = {};
  const g0 = {};
  const g1 = {};

  // ---------------------------------------------------------------- Audio
  let ac = null;
  function ding(freq = 1560, gain = 0.12, len = 1.1) {
    if (!sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const now = ac.currentTime;
      [1, 2.76].forEach((m, i) => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'sine';
        o.frequency.value = freq * m;
        g.gain.setValueAtTime(gain / (i + 1), now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + len / (i + 1));
        o.connect(g).connect(ac.destination);
        o.start(now);
        o.stop(now + len);
      });
    } catch {
      /* no audio — the bell is silent, nothing else changes */
    }
  }

  function bell() {
    if (!st.started) return;
    ding(1560, 0.1, 0.9);
    setTimeout(() => ding(1560, 0.08, 0.9), 150);
    const d = Math.hypot(world.tower.x - st.x, world.tower.z - st.z);
    if (d < 22) {
      // The tower answers, and the pigeons have opinions about it.
      setTimeout(() => ding(392, 0.16, 2.6), 520);
      world.scatterPigeons();
      emit('secret', 'bell');
    }
  }

  // ----------------------------------------------------------------- Story
  function storyShot(t, out) {
    const S = world.shots;
    let i = 0;
    while (i < S.length - 2 && t > S[i + 1].t) i++;
    const a = S[i];
    const b = S[i + 1];
    const f = smooth(a.t, b.t, t);
    const p = world.pointAt(t, rp);
    const back = lerp(a.back, b.back, f);
    const side = lerp(a.side, b.side, f);
    const up = lerp(a.up, b.up, f);
    const ahead = lerp(a.ahead, b.ahead, f);
    const ls = lerp(a.lookSide || 0, b.lookSide || 0, f);
    const portrait = camera.aspect < 0.8 ? 1 : 0;
    const k = 1 + portrait * 0.28;
    out.pos.set(p.x - p.tx * back * k + p.tz * side * k, p.y + up * k, p.z - p.tz * back * k - p.tx * side * k);
    out.look.set(p.x + p.tx * ahead + p.tz * ls, p.y + lerp(a.lift, b.lift, f), p.z + p.tz * ahead - p.tx * ls);
    out.fov = lerp(a.fov, b.fov, f) + portrait * 12;
  }

  function updateStory(dt) {
    const hold = input.up - input.down + input.adv + (Math.abs(input.joyY) > 0.2 ? input.joyY : 0);
    st.tTarget = clamp(st.tTarget + hold * 0.06 * dt + input.wheel, 0, 1);
    input.wheel = 0;
    const prev = st.t;
    st.t = damp(st.t, st.tTarget, 3.4, dt);
    if (Math.abs(st.tTarget - st.t) < 1e-5) st.t = st.tTarget;
    const delta = st.t - prev;
    if (delta > 2e-5) st.dir = 1;
    else if (delta < -2e-5) st.dir = -1;

    const p = world.pointAt(st.t, rp);
    const routeYaw = Math.atan2(p.tx, p.tz) + (st.dir < 0 ? Math.PI : 0);
    const k = (st.rejoin = Math.min(1, st.rejoin + dt * 1.6));
    const e = k * k * (3 - 2 * k);
    st.x = lerp(st.x, p.x, e);
    st.z = lerp(st.z, p.z, e);
    st.y = lerp(st.y, p.y + 0.05, e);
    const prevYaw = st.yaw;
    st.yaw = dampAngle(st.yaw, routeYaw, 7, dt);
    st.speed = (Math.abs(delta) * world.route.length) / Math.max(dt, 1e-4);
    st.steer = clamp(((st.yaw - prevYaw) / Math.max(dt, 1e-4)) * 0.55, -1, 1);
    st.pedal = st.speed > 0.25 ? 1 : 0;
    st.airborne = false;

    const p2 = world.pointAt(st.t + 0.004 * st.dir, g0);
    st.slope = Math.atan2(p2.y - p.y, Math.hypot(p2.x - p.x, p2.z - p.z) || 1);

    storyShot(st.t, want);

    // Which beat is on screen?
    let beat = null;
    for (const b of world.beats) if (Math.abs(st.t - b.t) < (b.cine ? 0.03 : 0.04)) beat = b;
    if (beat !== st.beat) {
      st.beat = beat;
      emit('beat', beat ? beat.id : null);
      setNear(beat && beat.poi ? beat.poi : null);
    }
    const [ba, bb] = world.route.bridgeT;
    const cine = st.t > ba - 0.012 && st.t < bb + 0.012;
    if (cine !== st.cine) {
      st.cine = cine;
      emit('cine', cine);
    }
  }

  function setNear(id) {
    if (id === st.near) return;
    st.near = id;
    emit('near', id);
  }

  // --------------------------------------------------------------- Explore
  function respawn(reason, t) {
    if (st.lock > 0) return;
    st.lock = 0.7;
    emit('fade', reason || '');
    setTimeout(() => {
      let tt = t != null ? t : world.nearest(st.x, st.z).t;
      const [ba, bb] = world.route.bridgeT;
      if (t == null && tt > ba - 0.01 && tt < bb + 0.01) tt = st.z > world.river(st.x) ? ba - 0.02 : bb + 0.02;
      const p = world.pointAt(tt, rp);
      st.x = p.x;
      st.z = p.z;
      st.y = p.y + 0.05;
      st.yaw = Math.atan2(p.tx, p.tz);
      st.speed = 0;
      st.vy = 0;
      st.airborne = false;
      st.t = st.tTarget = tt;
      st.stuck = 0;
      cam.ready = false;
    }, 260);
  }

  const splash = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.62, 28),
    new THREE.MeshBasicMaterial({ color: '#f6efdf', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
  );
  splash.rotation.x = -Math.PI / 2;
  scene.add(splash);
  let splashT = 1;

  function hop() {
    if (st.mode !== 'explore' || st.airborne || st.paused) return;
    st.vy = 6.2;
    st.airborne = true;
  }

  function updateExplore(dt) {
    const throttle = clamp(input.up - input.down + input.joyY, -1, 1);
    const steerIn = clamp(input.left - input.right - input.joyX, -1, 1);
    const g = world.groundAt(st.x, st.z, g0);

    // Drive
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

    // Collisions: circles, pushed out along the normal.
    for (const c of world.colliders) {
      const dx = nx - c.x;
      const dz = nz - c.z;
      const rr = c.r + 0.42;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 0.001;
        if (st.airborne && c.r < 0.4 && st.y - world.heightAt(c.x, c.z) > 1.2) continue;
        nx = c.x + (dx / d) * rr;
        nz = c.z + (dz / d) * rr;
        const head = -((dx / d) * Math.sin(st.yaw) + (dz / d) * Math.cos(st.yaw)) * Math.sign(st.speed || 1);
        if (head > 0.35 && Math.abs(st.speed) > 1.2) {
          if (c.tree && world.dropLemon(c.tree, st.x, st.z)) emit('secret', 'tree');
          st.jolt = Math.min(0.9, Math.abs(st.speed) * 0.09);
          st.speed *= -0.22;
        } else st.speed *= 1 - 1.5 * dt;
      }
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
    st.slope = st.airborne ? clamp(-st.vy * 0.03, -0.3, 0.3) : clamp(Math.atan2(f - r, 1.08), -0.5, 0.5);

    // Recovery: water, the edge of the valley, or simply being stuck.
    if (gn.water && st.y < -0.35 && st.lock <= 0) {
      splash.position.set(st.x, -0.46, st.z);
      splashT = 0;
      emit('secret', 'splash');
      respawn('water');
    } else if (Math.hypot(st.x, st.z) > world.bounds) respawn('edge');
    if (throttle > 0.3 && Math.abs(st.speed) < 0.35) {
      st.stuck += dt;
      if (st.stuck > 1.6) respawn('stuck');
    } else st.stuck = 0;

    st.t = st.tTarget = gn.t;

    // What is close enough to open?
    let near = null;
    let best = Infinity;
    for (const p of world.pois) {
      const d = Math.hypot(p.focus.x - st.x, p.focus.z - st.z);
      const d2 = Math.hypot(p.x - st.x, p.z - st.z);
      const dd = Math.min(d, d2);
      if (dd < p.radius && dd < best) {
        best = dd;
        near = p.id;
      }
    }
    setNear(near);

    // Chase camera
    const portrait = camera.aspect < 0.8;
    cam.yaw = dampAngle(cam.yaw, st.yaw + (st.speed < -0.3 ? 0 : 0), 3.2, dt);
    const back = (portrait ? 8.6 : 6.6) + Math.abs(st.speed) * 0.12;
    const up = portrait ? 4.6 : 3;
    want.pos.set(st.x - Math.sin(cam.yaw) * back, st.y + up, st.z - Math.cos(cam.yaw) * back);
    want.look.set(st.x + Math.sin(st.yaw) * 2.4, st.y + 1.15, st.z + Math.cos(st.yaw) * 2.4);
    want.fov = (portrait ? 60 : 50) + (calm ? 0 : clamp(Math.abs(st.speed), 0, 12) * 0.8);
  }

  // ------------------------------------------------------------------ Loop
  let raf = 0;
  let last = 0;
  let running = false;
  const perf = { frames: 0, acc: 0, fps: 0, low: 0, min: Infinity, samples: [], warm: 0 };
  const introFrom = new THREE.Vector3();

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const real = (now - last) / 1000 || 0.016;
    const dt = Math.min(0.05, real);
    last = now;
    st.time += dt;
    st.lock = Math.max(0, st.lock - dt);

    if (st.started && !st.paused) {
      if (st.mode === 'story') updateStory(dt);
      else updateExplore(dt);
    } else {
      storyShot(st.t, want);
      st.speed = damp(st.speed, 0, 6, dt);
      st.pedal = 0;
    }

    bike.root.position.set(st.x, st.y, st.z);
    bike.root.rotation.y = st.yaw;
    bike.update({ speed: st.speed, steer: st.steer, pedalling: st.pedal, slope: st.slope, jolt: st.jolt, dt, time: st.time, airborne: st.airborne, calm });
    st.jolt = 0;

    const evs = world.update({ dt, time: st.time, x: st.x, z: st.z, speed: st.speed, vx: Math.sin(st.yaw) * st.speed, vz: Math.cos(st.yaw) * st.speed, calm, canCollect: st.started && st.mode === 'explore' });
    for (const e of evs) {
      if (e.type === 'lemon') {
        st.lemons++;
        bike.setLemons(st.lemons);
        ding(1960, 0.06, 0.4);
        emit('lemons', st.lemons);
      } else if (e.type === 'pigeons') emit('secret', 'pigeons');
    }

    if (splashT < 1) {
      splashT += dt * 1.4;
      splash.scale.setScalar(1 + splashT * 5);
      splash.material.opacity = Math.max(0, 0.8 * (1 - splashT));
    }

    // Camera: every mode only states what it wants; one spring gets us there.
    if (st.started && st.intro < 1) {
      st.intro = Math.min(1, st.intro + dt / 3.4);
      const e = st.intro < 0.5 ? 4 * st.intro ** 3 : 1 - (-2 * st.intro + 2) ** 3 / 2;
      want.pos.lerpVectors(introFrom, want.pos, e);
      want.fov = lerp(40, want.fov, e);
    } else if (!st.started) {
      want.pos.copy(introFrom);
      want.look.set(st.x + 14, st.y - 2, st.z - 22);
      want.fov = 40;
    }
    if (!cam.ready) {
      cam.pos.copy(want.pos);
      cam.look.copy(want.look);
      cam.fov = want.fov;
      cam.yaw = st.yaw;
      cam.ready = true;
    }
    const lam = st.mode === 'story' ? 3.6 : 6;
    cam.pos.x = damp(cam.pos.x, want.pos.x, lam, dt);
    cam.pos.y = damp(cam.pos.y, want.pos.y, lam, dt);
    cam.pos.z = damp(cam.pos.z, want.pos.z, lam, dt);
    cam.look.x = damp(cam.look.x, want.look.x, lam + 2, dt);
    cam.look.y = damp(cam.look.y, want.look.y, lam + 2, dt);
    cam.look.z = damp(cam.look.z, want.look.z, lam + 2, dt);
    cam.fov = damp(cam.fov, want.fov, 3, dt);
    const floor = world.heightAt(cam.pos.x, cam.pos.z) + 0.7;
    if (cam.pos.y < floor) cam.pos.y = floor;
    if (cam.pos.y < 0.2) cam.pos.y = 0.2;
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
    if (Math.abs(camera.fov - cam.fov) > 0.01) {
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
    }

    sun.position.set(st.x + world.sunDir.x * 70, st.y + world.sunDir.y * 70, st.z + world.sunDir.z * 70);
    sun.target.position.set(st.x, st.y, st.z);

    renderer.render(scene, camera);

    // Honest frame accounting, and a one-way step down when the device struggles.
    perf.frames++;
    perf.acc += real;
    if (perf.acc >= 1.5) {
      perf.fps = perf.frames / perf.acc;
      perf.frames = 0;
      perf.acc = 0;
      perf.warm++;
      if (perf.warm > 1) {
        perf.samples.push(perf.fps);
        if (perf.samples.length > 40) perf.samples.shift();
        perf.min = Math.min(perf.min, perf.fps);
        if (autoQuality && st.started && perf.fps < 40) {
          if (++perf.low >= 2 && quality > 0) {
            quality--;
            perf.low = 0;
            applyQuality();
            emit('quality', quality);
          }
        } else perf.low = 0;
      }
    }
  }

  function run() {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function halt() {
    running = false;
    cancelAnimationFrame(raf);
  }

  // ----------------------------------------------------------------- Input
  const KEY = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  };
  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  function onKey(e) {
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    const down = e.type === 'keydown';
    const k = KEY[e.code];
    if (k && st.started) {
      if (st.paused) return;
      input[k] = down ? 1 : 0;
      e.preventDefault();
      return;
    }
    if (!down || e.repeat || !st.started || st.paused) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (st.mode === 'explore') hop();
      else nextBeat(1);
    } else if (e.code === 'PageDown') nextBeat(1);
    else if (e.code === 'PageUp') nextBeat(-1);
    else if (e.code === 'KeyB') bell();
    else if (e.code === 'KeyR') returnToRoute();
    else if (e.code === 'KeyE') setMode(st.mode === 'story' ? 'explore' : 'story');
  }
  function onWheel(e) {
    if (!st.started || st.paused) return;
    e.preventDefault();
    if (st.mode !== 'story') return;
    const px = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
    input.wheel += clamp(px, -240, 240) * 0.00021;
  }
  let dragY = null;
  function onPointerDown(e) {
    if (st.mode === 'story' && st.started && !st.paused) dragY = e.clientY;
  }
  function onPointerMove(e) {
    if (dragY == null) return;
    input.wheel += (dragY - e.clientY) * 0.0011;
    dragY = e.clientY;
  }
  function onPointerUp() {
    dragY = null;
  }
  function clearInput() {
    input.up = input.down = input.left = input.right = input.joyX = input.joyY = input.adv = 0;
  }
  function onVisibility() {
    if (document.hidden) {
      halt();
      clearInput();
    } else if (!lost) run();
  }
  let lost = false;
  function onLost(e) {
    e.preventDefault();
    lost = true;
    halt();
    emit('context', 'lost');
  }
  function onRestored() {
    lost = false;
    applyQuality();
    run();
    emit('context', 'restored');
  }

  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', clearInput);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  // ------------------------------------------------------------------- API
  function setMode(mode) {
    if (mode === st.mode || !st.started) return;
    st.mode = mode;
    clearInput();
    if (mode === 'story') {
      const n = world.nearest(st.x, st.z);
      st.t = st.tTarget = n.t;
      st.rejoin = 0;
      st.dir = 1;
      st.beat = undefined;
      if (st.cine) emit('cine', (st.cine = false));
    } else {
      if (st.cine) emit('cine', (st.cine = false));
      if (st.dir < 0) st.yaw += 0; // keep whatever way the rider was facing
      st.speed = Math.min(st.speed, 4);
      cam.yaw = st.yaw;
      emit('beat', null);
      st.beat = null;
    }
    emit('mode', mode);
  }

  function nextBeat(dir) {
    if (st.mode !== 'story') return;
    const B = world.beats;
    const ref = st.tTarget;
    let target = dir > 0 ? 1 : 0;
    if (dir > 0) {
      for (const b of B) if (b.t > ref + 0.012) {
        target = b.t;
        break;
      }
    } else {
      for (let i = B.length - 1; i >= 0; i--) if (B[i].t < ref - 0.012) {
        target = B[i].t;
        break;
      }
    }
    st.tTarget = target;
  }

  function returnToRoute() {
    if (st.mode === 'explore') respawn('route');
  }

  /** Fast travel to a story point (by poi or beat id). */
  function travel(id) {
    const b = world.beats.find((q) => q.id === id) || world.pois.find((q) => q.id === id);
    if (!b) return;
    if (st.mode === 'story') {
      if (Math.abs(b.t - st.t) > 0.18 && !calm) {
        emit('fade', 'travel');
        setTimeout(() => {
          st.t = st.tTarget = b.t;
          const p = world.pointAt(b.t, rp);
          st.x = p.x;
          st.z = p.z;
          st.y = p.y + 0.05;
          cam.ready = false;
        }, 260);
      } else st.tTarget = b.t;
    } else respawn('travel', clamp(b.t - 0.012, 0, 1));
  }

  function start() {
    if (st.started) return;
    st.started = true;
    cam.ready = true;
    emit('mode', st.mode);
  }

  function stats() {
    const s = perf.samples;
    const avg = s.length ? s.reduce((a, b) => a + b, 0) / s.length : perf.fps;
    return {
      fps: +perf.fps.toFixed(1), avg: +avg.toFixed(1), min: perf.min === Infinity ? null : +perf.min.toFixed(1),
      calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
      quality, dpr: renderer.getPixelRatio(), shadows: sun.castShadow,
    };
  }

  function dispose() {
    halt();
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    window.removeEventListener('blur', clearInput);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    world.dispose();
    bike.dispose();
    splash.geometry.dispose();
    splash.material.dispose();
    if (sun.shadow.map) sun.shadow.map.dispose();
    renderer.dispose();
    if (ac) ac.close().catch(() => {});
  }

  // First frame: everything is built; compile, place the camera, draw once.
  setTheme(dark);
  applyQuality();
  storyShot(0, want);
  introFrom.set(st.x + 46, st.y + 40, st.z + 30);
  if (reduced) introFrom.copy(want.pos);
  renderer.compile(scene, camera);
  run();
  onProgress(1, 'ready');

  return {
    start, setMode, nextBeat, travel, returnToRoute, hop, bell, setTheme, stats, dispose,
    setPaused(v) {
      st.paused = v;
      if (v) clearInput();
    },
    setJoystick(x, y) {
      input.joyX = x;
      input.joyY = y;
    },
    setAdvance(v) {
      input.adv = v;
    },
    setCalm(v) {
      calm = v;
    },
    setSound(v) {
      sound = v;
    },
    setQuality(q) {
      if (q === 'auto') autoQuality = true;
      else {
        autoQuality = false;
        quality = clamp(q, 0, QUALITY.length - 1);
        applyQuality();
      }
    },
    get state() {
      return st;
    },
    world,
  };
}
