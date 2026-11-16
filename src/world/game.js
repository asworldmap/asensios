// Pedal the World — engine.
//
// The engine owns the loop, the camera spring, input, the two modes and the
// loading and unloading of chapters. It knows nothing about Murcia or about
// bicycles:
//
//   a CHAPTER (chapters/*.js) supplies the place — height field, route,
//   colliders, points of interest, camera shots, ambient life, light;
//   a VEHICLE (vehicles/*.js) supplies how you move through it — model,
//   animation, free-movement physics and its own chase camera.
//
// STORY    the vehicle follows the route; scroll / keys / drag move it along
//          and the camera is directed shot by shot. No skill needed.
// EXPLORE  the same vehicle in the same place, driven by its own physics.

import * as THREE from 'three';
import { createAssets } from './assets.js';
import { createShared } from './shading.js';
import { createJourneyAudio } from './audio.js';
import { findHandoff, matchShot, playShot } from './handoff.js';
import { CHAPTERS, JOURNEY } from './chapters/index.js';
import { getVehicle } from './vehicles/index.js';
import { clamp, lerp, smooth, damp, dampAngle } from './kit.js';

const QUALITY = [
  { dpr: 1.25, shadow: 0 },
  { dpr: 1.5, shadow: 0 },
  { dpr: 1.75, shadow: 1024 },
  { dpr: 2, shadow: 2048 },
];
const PROGRESS_KEY = 'asensios.world.progress';

export async function createGame({ canvas, tier, reduced, dark, onProgress, emit, chapter: firstChapter = 'murcia' }) {
  // ------------------------------------------------------------ Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'mobile', powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.3, 900);
  const shared = createShared();
  const assets = createAssets();

  let quality = tier === 'mobile' ? 1 : tier === 'tablet' ? 2 : 3;
  let autoQuality = true;
  let world = null;
  let vehicle = null;
  let chapterId = null;
  let loading = false;
  let transitioning = false;
  let retained = [];
  let storyBookmark = null;
  let storyWait = 0;
  let transfer = null;
  let transferAge = 0;
  let stayHere = false;
  let introSeconds = 3.4;
  let handoff = null;
  let handoffCamera = null;
  let isDark = dark;
  let calm = reduced;
  const audio = createJourneyAudio();
  const tone = audio.tone;

  // ---------------------------------------------------------------- State
  const st = {
    mode: 'story', started: false, paused: false,
    x: 0, y: 0, z: 0, yaw: 0, speed: 0, vy: 0, airborne: false,
    steer: 0, slope: 0, jolt: 0, pedal: 0,
    t: 0, tTarget: 0, dir: 1, rejoin: 1,
    intro: reduced ? 1 : 0,
    near: null, beat: null, cine: false,
    lemons: 0, stuck: 0, lock: 0, time: 0,
  };
  const input = { up: 0, down: 0, left: 0, right: 0, joyX: 0, joyY: 0, adv: 0, wheel: 0 };
  const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 46, yaw: 0, ready: false };
  const want = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 46 };
  const introFrom = new THREE.Vector3();
  const focus = new THREE.Vector3();
  const cameraRay = new THREE.Ray();
  const cameraHit = new THREE.Vector3();
  const rp = {};
  const g0 = {};

  function applyQuality() {
    const q = QUALITY[quality];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.dpr));
    if (world) {
      const sun = world.atmosphere.sun;
      const on = q.shadow > 0;
      if (on && sun.shadow.mapSize.x !== q.shadow) {
        sun.shadow.mapSize.set(q.shadow, q.shadow);
        if (sun.shadow.map) {
          sun.shadow.map.dispose();
          sun.shadow.map = null;
        }
      }
      sun.castShadow = on;
      vehicle.setShadowBlob(!on);
    }
    resize();
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function setTheme(v, instant = false) {
    isDark = v;
    if (!world) return;
    world.atmosphere.setTheme(v, instant || calm);
    vehicle.setTheme(v);
  }

  // Services a vehicle or chapter may ask the engine for.
  const fx = {
    respawn,
    feedback(id) { emit('secret', id); },
    snapCamera() { cam.ready = false; },
    splash(x, z) {
      splash.position.set(x, world.waterY + 0.04, z);
      splashT = 0;
      emit('secret', 'splash');
    },
    bump(c, s) {
      const what = world.bump?.(c, s);
      if (what) emit('secret', what);
    },
    sound(kind) {
      if (!st.started) return;
      if (kind === 'bell') {
        tone(980, 0.045, 0.45, 'sine', [1, 1.51]);
      } else if (kind === 'horn') {
        const pitch = chapterId === 'japan' ? 114 : chapterId === 'europe' ? 178 : 311;
        tone(pitch, 0.044, 0.72, 'sine', [1, 1.25]);
      }
      const reply = world.heard?.(kind, st);
      if (reply) {
        if (reply.tone) setTimeout(() => tone(...reply.tone), reply.delay || 0);
        if (reply.secret) emit('secret', reply.secret);
      }
    },
  };

  // ----------------------------------------------------------------- Story
  function storyShot(t, out) {
    const S = world.shots;
    let i = 0;
    while (i < S.length - 2 && t > S[i + 1].t) i++;
    const a = S[i];
    const b = S[i + 1];
    const f = smooth(a.t, b.t, t);
    const p = world.pointAt(t, rp);
    const portrait = camera.aspect < 0.8 ? 1 : 0;
    const k = (1 + portrait * 0.28) * vehicle.storyScale;
    const back = lerp(a.back, b.back, f) * k;
    const side = lerp(a.side, b.side, f) * k;
    const up = lerp(a.up, b.up, f) * k;
    const ahead = lerp(a.ahead, b.ahead, f);
    const ls = lerp(a.lookSide || 0, b.lookSide || 0, f);
    out.pos.set(p.x - p.tx * back + p.tz * side, p.y + up, p.z - p.tz * back - p.tx * side);
    out.look.set(p.x + p.tx * ahead + p.tz * ls, p.y + lerp(a.lift, b.lift, f), p.z + p.tz * ahead - p.tx * ls);
    out.fov = lerp(a.fov, b.fov, f) + portrait * 12;
  }

  function updateStory(dt, elapsed) {
    const hold = input.up - input.down + input.adv + (Math.abs(input.joyY) > 0.2 ? input.joyY : 0);
    const seconds = CHAPTERS[chapterId].storySeconds;
    const end = transfer?.t ?? 1;
    const nudge = (hold * 0.06 * dt * 230 * (world.storyRate || 1)) / world.route.length + input.wheel;
    if (nudge) storyWait = 4.5;
    else if (Math.abs(st.t - st.tTarget) < 0.002) storyWait = Math.max(0, storyWait - (calm ? dt : elapsed));
    const autoplay = seconds && !calm && !stayHere && !storyWait;
    const pace = autoplay ? elapsed : dt;
    st.tTarget = clamp(st.tTarget + nudge + (autoplay ? end * elapsed / seconds : 0), 0, end);
    input.wheel = 0;
    const prev = st.t;
    const progress = damp(st.t, st.tTarget, 3.4, pace) - st.t;
    const step = world.storySpeed ? world.storySpeed * pace / world.route.length : Infinity;
    st.t += clamp(progress, -step, step);
    if (Math.abs(st.tTarget - st.t) < 1e-5) st.t = st.tTarget;
    const delta = st.t - prev;
    if (delta > 2e-5) st.dir = 1;
    else if (delta < -2e-5) st.dir = -1;

    const p = world.pointAt(st.t, rp);
    // A bicycle turns round to ride back; a train simply reverses.
    const routeYaw = Math.atan2(p.tx, p.tz) + (st.dir < 0 && !vehicle.onRails ? Math.PI : 0);
    const k = (st.rejoin = Math.min(1, st.rejoin + dt * 1.6));
    const e = k * k * (3 - 2 * k);
    st.x = lerp(st.x, p.x, e);
    st.z = lerp(st.z, p.z, e);
    st.y = lerp(st.y, p.y + world.rideHeight, e);
    const prevYaw = st.yaw;
    st.yaw = dampAngle(st.yaw, routeYaw, 7, dt);
    st.speed = ((Math.abs(delta) * world.route.length) / Math.max(pace, 1e-4)) * (vehicle.onRails ? st.dir : 1);
    st.steer = clamp(((st.yaw - prevYaw) / Math.max(dt, 1e-4)) * 0.55, -1, 1);
    st.pedal = Math.abs(st.speed) > 0.25 ? 1 : 0;
    st.airborne = world.landing != null && p.y > 1;

    const p2 = world.pointAt(st.t + 0.004 * st.dir, g0);
    st.slope = Math.atan2(p2.y - p.y, Math.hypot(p2.x - p.x, p2.z - p.z) || 1);

    storyShot(st.t, want);

    let beat = null;
    for (const b of world.beats) {
      if (b.optional && b.id !== storyBookmark) continue;
      const edge = b.t === 0 || b.t === end;
      // Short chapters still keep each line on screen long enough to read it.
      const readable = seconds && !calm ? end * (edge ? 4 : 1.85) / seconds : 0;
      const radius = Math.max(b.cine ? 0.03 : 0.04, readable);
      if (Math.abs(st.t - b.t) < radius) beat = b;
    }
    if (beat !== st.beat) {
      st.beat = beat;
      emit('beat', beat ? beat.id : null);
      setNear(beat && beat.poi ? beat.poi : null);
    }
    let cine = false;
    for (const [a, b] of world.cine || []) if (st.t > a && st.t < b) cine = true;
    if (cine !== st.cine) emit('cine', (st.cine = cine));

    if (!transfer) return;
    const ready = Math.abs(st.t - transfer.t) < 0.006 && Math.abs(st.tTarget - transfer.t) < 0.002;
    if (!ready) {
      transferAge = 0;
      if (st.tTarget < transfer.t - 0.06 && st.t < transfer.t - 0.06) stayHere = false;
    } else if (!stayHere && (transferAge += elapsed) >= (calm ? 1.9 : 0.65)) {
      stayHere = true;
      emit('advance', transfer.id);
    }
  }

  function setNear(id) {
    if (id === st.near) return;
    st.near = id;
    emit('near', id);
  }

  // --------------------------------------------------------------- Explore
  function placeOnRoute(t) {
    vehicle.reset?.();
    const p = world.pointAt(t, rp);
    st.x = p.x;
    st.z = p.z;
    st.y = p.y + world.rideHeight;
    st.yaw = Math.atan2(p.tx, p.tz);
    st.speed = 0;
    st.vy = 0;
    st.airborne = false;
    st.t = st.tTarget = t;
    st.stuck = 0;
    cam.ready = false;
  }

  /** Fade, then put the vehicle back on the route — at t, or at the nearest safe point. */
  function respawn(reason, t) {
    if (st.lock > 0 || transitioning) return;
    const active = world;
    st.lock = 0.7;
    emit('fade', reason || '');
    setTimeout(() => {
      if (world !== active || transitioning) return;
      placeOnRoute(t != null ? t : world.safeT ? world.safeT(st.x, st.z) : world.nearest(st.x, st.z).t);
    }, 260);
  }

  const splash = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.62, 28),
    new THREE.MeshBasicMaterial({ color: '#f6efdf', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
  );
  splash.rotation.x = -Math.PI / 2;
  scene.add(splash);
  let splashT = 1;

  function updateExplore(dt) {
    vehicle.drive(dt, input, world, st, fx);

    let near = null;
    let best = Infinity;
    for (const p of world.pois) {
      const dd = Math.min(Math.hypot(p.focus.x - st.x, p.focus.z - st.z), Math.hypot(p.x - st.x, p.z - st.z));
      if (dd < p.radius && dd < best) {
        best = dd;
        near = p.id;
      }
    }
    setNear(near);
    vehicle.chase(st, cam, want, { portrait: camera.aspect < 0.8, calm, dt });
  }

  function clearCamera(pos) {
    if (st.mode !== 'explore' || !world.cameraBlockers?.length) return;
    cameraRay.origin.copy(focus);
    cameraRay.direction.subVectors(pos, focus);
    const length = cameraRay.direction.length();
    if (length < 0.01) return;
    cameraRay.direction.divideScalar(length);
    let distance = length;
    for (const box of world.cameraBlockers) {
      if (box.containsPoint(focus)) continue;
      if (cameraRay.intersectBox(box, cameraHit)) {
        const hit = focus.distanceTo(cameraHit);
        if (hit < distance) distance = Math.max(0.85, hit - 0.36);
      }
    }
    if (distance < length) cameraRay.at(distance, pos);
  }

  // ------------------------------------------------------------------ Loop
  let raf = 0;
  let last = 0;
  let running = false;
  let saveT = 0;
  const perf = { frames: 0, acc: 0, fps: 0, low: 0, min: Infinity, samples: [], warm: 0 };

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const real = (now - last) / 1000 || 0.016;
    const dt = Math.min(0.05, real);
    // Story uses wall time. Physics still runs on its bounded gameplay step.
    const storyElapsed = Math.min(4, real);
    last = now;
    if (!world || loading) return;
    st.time += dt;
    st.lock = Math.max(0, st.lock - dt);

    if (st.started && !st.paused) {
      if (st.mode === 'story') updateStory(dt, storyElapsed);
      else updateExplore(dt);
    } else {
      storyShot(st.t, want);
      st.speed = damp(st.speed, 0, 6, dt);
      st.pedal = 0;
    }

    vehicle.place(st, world);
    vehicle.animate({ dt, time: st.time, st, calm });
    audio.update(st.speed, st.airborne, vehicle.walking, st.t);
    st.jolt = 0;

    focus.set(st.x, st.y + vehicle.focusHeight, st.z);
    if (!calm) shared.uTime.value = st.time;
    shared.uFocus.value.copy(focus);
    shared.uSee.value = damp(shared.uSee.value, st.started && st.mode === 'explore' && !vehicle.onRails && !vehicle.walking ? 1 : 0, 5, dt);

    const evs = world.update({ dt, time: st.time, x: st.x, z: st.z, speed: st.speed, vx: Math.sin(st.yaw) * st.speed, vz: Math.cos(st.yaw) * st.speed, calm, canCollect: st.started && st.mode === 'explore' });
    for (const e of evs) {
      if (e.type === 'lemon') {
        st.lemons++;
        vehicle.setCargo(st.lemons);
        emit('lemons', st.lemons);
      } else if (e.type === 'secret') emit('secret', e.id);
    }
    world.atmosphere.update(dt, focus, calm);

    if (splashT < 1) {
      splashT += dt * 1.4;
      splash.scale.setScalar(1 + splashT * 5);
      splash.material.opacity = Math.max(0, 0.8 * (1 - splashT));
    }

    // Camera: every mode only states what it wants; one spring gets us there.
    if (handoffCamera) {
      want.pos.copy(handoffCamera.pos);
      want.look.copy(handoffCamera.look);
      want.fov = handoffCamera.fov;
      cam.ready = false;
    } else if (st.started && st.intro < 1) {
      st.intro = Math.min(1, st.intro + (st.mode === 'story' ? storyElapsed : dt) / introSeconds);
      const e = st.intro < 0.5 ? 4 * st.intro ** 3 : 1 - (-2 * st.intro + 2) ** 3 / 2;
      want.pos.lerpVectors(introFrom, want.pos, e);
      want.fov = lerp(40, want.fov, e);
    } else if (!st.started) {
      want.pos.copy(introFrom);
      if (world.establishing) want.look.set(...world.establishing.look);
      want.fov = 40;
    }
    clearCamera(want.pos);
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
    clearCamera(cam.pos);
    if (!handoffCamera) {
      const floor = Math.max(world.heightAt(cam.pos.x, cam.pos.z), world.waterY) + 0.7;
      if (cam.pos.y < floor) cam.pos.y = floor;
    }
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
    if (Math.abs(camera.fov - cam.fov) > 0.01) {
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);

    // Checkpoint: where to come back to if the page is reloaded mid-ride.
    saveT += real;
    if (saveT > 2 && st.started) {
      saveT = 0;
      try {
        sessionStorage.setItem(PROGRESS_KEY, JSON.stringify({ chapter: chapterId, t: +st.t.toFixed(4) }));
      } catch {
        /* storage unavailable — progress simply is not kept */
      }
    }

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
    if (!down || e.repeat || !st.started || st.paused || loading) return;
    if (e.code === 'Space') {
      if (e.target.closest('button, a[href]')) return;
      e.preventDefault();
      if (st.mode === 'explore') action('a');
      else nextBeat(1);
    } else if (e.code === 'PageDown') nextBeat(1);
    else if (e.code === 'PageUp') nextBeat(-1);
    else if (e.code === 'KeyB') action('b');
    else if (e.code === 'KeyR') returnToRoute();
    else if (e.code === 'KeyE') setMode(st.mode === 'story' ? 'explore' : 'story');
  }
  function onWheel(e) {
    if (!st.started || st.paused) return;
    e.preventDefault();
    if (st.mode !== 'story' || !world || transitioning) return;
    const px = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
    input.wheel += (clamp(px, -240, 240) * 0.00021 * 230) / world.route.length;
  }
  let dragY = null;
  function onPointerDown(e) {
    if (st.mode === 'story' && st.started && !st.paused) dragY = e.clientY;
  }
  function onPointerMove(e) {
    if (dragY == null || !world) return;
    input.wheel += ((dragY - e.clientY) * 0.0011 * 230) / world.route.length;
    dragY = e.clientY;
  }
  function onPointerUp() {
    dragY = null;
  }
  function clearInput() {
    input.up = input.down = input.left = input.right = input.joyX = input.joyY = input.adv = input.wheel = 0;
    dragY = null;
  }
  let lost = false;
  function onVisibility() {
    audio.setQuiet(document.hidden || st.paused);
    if (document.hidden) {
      halt();
      clearInput();
    } else if (!lost) run();
  }
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

  // -------------------------------------------------------------- Chapters
  function unloadChapter() {
    if (!world) return;
    scene.remove(vehicle.object);
    vehicle.dispose();
    world.dispose();
    world = null;
    vehicle = null;
  }

  /**
   * Load a chapter and its vehicle, disposing whatever was there before.
   * Used for the first load and for every chapter transition.
   */
  async function loadChapter(id, { t = null, progress = () => {}, fromStory = false, directed = false } = {}) {
    const def = CHAPTERS[id];
    if (!def) throw new Error(`unknown chapter "${id}"`);
    const vdef = getVehicle(def.vehicle);
    const keys = [...def.assets, ...vdef.assets];
    const previousObjects = new Set(scene.children);
    const previousFog = scene.fog;
    const previousBackground = scene.background;
    loading = true;
    let nextWorld;
    let nextVehicle;
    try {
      await assets.load(keys, (f) => progress(0.08 + f * 0.22, 'assets'));
      const mod = await def.load();
      const step = (label, f) => {
        progress(0.3 + f * 0.66, label);
        // While the splice covers the scene, there is no progress frame to paint.
        return directed ? Promise.resolve() : new Promise(requestAnimationFrame);
      };
      nextWorld = await mod.build({ scene, tier, step, assets, shared });
      nextVehicle = vdef.create({ assets, tier });
    } catch (error) {
      nextVehicle?.dispose();
      nextWorld?.dispose();
      for (const child of [...scene.children]) {
        if (!previousObjects.has(child)) scene.remove(child);
      }
      scene.fog = previousFog;
      scene.background = previousBackground;
      assets.retain(retained);
      loading = false;
      throw error;
    }

    unloadChapter();
    renderer.renderLists.dispose();
    assets.retain(keys);
    retained = keys;
    world = nextWorld;
    vehicle = nextVehicle;
    scene.fog = world.atmosphere.fog;
    scene.add(vehicle.object);
    const lastChapter = chapterId;
    chapterId = id;
    audio.change(id);
    const index = JOURNEY.findIndex((chapter) => chapter.id === id);
    const next = index >= 0 && JOURNEY[index + 1];
    const end = world.beats.at(-1);
    transfer = next && end?.next ? { id: next.id, t: end.t } : null;
    storyBookmark = null;
    storyWait = id === 'murcia' ? 1.4 : 0;
    transferAge = 0;
    stayHere = false;
    introSeconds = fromStory ? (lastChapter === 'japan' ? 1.55 : 1.15) : 3.4;

    Object.assign(st, { mode: 'story', speed: 0, vy: 0, airborne: false, steer: 0, slope: 0, dir: 1, rejoin: 1, near: null, beat: undefined, cine: false, lemons: 0, stuck: 0, lock: 0 });
    placeOnRoute(t ?? 0);
    cam.yaw = st.yaw;
    shared.uSee.value = 0;
    setTheme(isDark, true);
    applyQuality();
    storyShot(st.t, want);
    const est = world.establishing || { from: [st.x + 40, st.y + 36, st.z + 30], look: [st.x, st.y, st.z] };
    introFrom.set(...est.from);
    if (calm || t) introFrom.copy(want.pos);
    st.intro = calm || t || directed ? 1 : 0;
    splashT = 1;
    splash.material.opacity = 0;
    if (!directed) emit('cine', false);
    cam.ready = false;
    renderer.compile(scene, camera);
    loading = false;
    emit('chapter', { id, vehicle: vdef.id, actions: vdef.actions, onRails: vdef.onRails });
    if (st.started) emit('mode', st.mode);
    progress(1, 'ready');
  }

  function skipTransition() {
    if (handoff) handoff.skip = true;
  }

  async function directedHandoff(sequence, id) {
    const skipped = () => handoff.skip;
    const set = (shot) => { handoffCamera = shot; };
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const type = sequence.splice.type;
    const getShot = (incoming) => matchShot(sequence, incoming, { world, vehicle, state: st });
    const def = CHAPTERS[id];
    handoff = { skip: false };
    const preload = assets.load([...def.assets, ...getVehicle(def.vehicle).assets]).catch(() => {});
    emit('cine', !calm);
    emit('handoff', { id: sequence.id, phase: 'out', skippable: !calm });
    vehicle.object.updateWorldMatrix(true, true);
    const out = getShot(false);
    if (!calm && out) await playShot(cam, out, type === 'white_out' ? 0.78 : 0.88, set, skipped);
    emit('splice', type);
    if (!calm && !skipped()) await delay(type === 'horizon_hold' ? 280 : 220);
    await preload;
    await loadChapter(id, { fromStory: true, directed: true });
    vehicle.place(st, world);
    vehicle.object.updateWorldMatrix(true, true);
    const next = getShot(true);
    storyShot(st.t, want);
    const normal = { pos: want.pos.clone(), look: want.look.clone(), fov: want.fov };
    handoffCamera = !calm && !skipped() ? next : null;
    if (handoffCamera) await new Promise(requestAnimationFrame);
    emit('splice', null);
    emit('handoff', { id: sequence.id, phase: 'in', skippable: !calm });
    if (!calm && next) await playShot(next, normal, type === 'white_out' ? 1.20 : 0.91, set, skipped);
  }

  async function travelToChapter(id, { fromStory = false } = {}) {
    if (loading || transitioning || id === chapterId || !Object.hasOwn(CHAPTERS, id)) return false;
    transitioning = true;
    const wasPaused = st.paused;
    st.paused = true;
    clearInput();
    try {
      const sequence = fromStory && await findHandoff(chapterId, id);
      emit('loading', { active: true, fromStory, directed: !!sequence });
      if (sequence) await directedHandoff(sequence, id);
      else {
        if (!calm) await new Promise((r) => setTimeout(r, fromStory ? 330 : 280));
        await loadChapter(id, { fromStory });
      }
      return true;
    } catch (error) {
      console.warn('[pedal-the-world] chapter could not be loaded', error);
      emit('chapterError', id);
      return false;
    } finally {
      if (handoff) {
        handoff = null;
        handoffCamera = null;
        emit('splice', null);
        emit('handoff', null);
        emit('cine', false);
      }
      transitioning = false;
      st.paused = wasPaused;
      emit('loading', { active: false, fromStory });
    }
  }

  // ------------------------------------------------------------------- API
  function setMode(mode) {
    if (mode === st.mode || !st.started || loading || transitioning) return;
    st.mode = mode;
    vehicle.reset?.();
    clearInput();
    if (st.cine) emit('cine', (st.cine = false));
    if (mode === 'story') {
      transferAge = 0;
      storyWait = 2;
      st.t = st.tTarget = vehicle.onRails ? st.t : world.nearest(st.x, st.z).t;
      stayHere = !!transfer && st.t >= transfer.t - 0.035;
      st.rejoin = vehicle.onRails ? 1 : 0;
      st.dir = 1;
      st.beat = undefined;
    } else {
      st.speed = Math.min(st.speed, 4);
      cam.yaw = st.yaw;
      emit('beat', null);
      st.beat = null;
    }
    emit('mode', mode);
  }

  function nextBeat(dir) {
    if (st.mode !== 'story' || !world || transitioning) return;
    const B = world.beats.filter((beat) => !beat.optional);
    storyBookmark = null;
    storyWait = 4.5;
    const ref = st.tTarget;
    let target = dir > 0 ? (transfer?.t ?? 1) : 0;
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
    if (st.mode === 'explore' && !vehicle.onRails) respawn('route');
  }

  /** Fast travel to a story point (by poi or beat id). */
  function travel(id) {
    if (!world || transitioning) return;
    const b = world.beats.find((q) => q.id === id) || world.pois.find((q) => q.id === id);
    if (!b) return;
    if (st.mode === 'story') {
      storyBookmark = b.id;
      storyWait = 4.5;
      if (b.next) stayHere = true;
      if (Math.abs(b.t - st.t) > 0.18 && !calm) {
        emit('fade', 'travel');
        const active = world;
        setTimeout(() => {
          if (world !== active || transitioning) return;
          if (b.next) stayHere = true;
          placeOnRoute(b.t);
        }, 260);
      } else if (calm && world.storySpeed) placeOnRoute(b.t);
      else st.tTarget = b.t;
    } else respawn('travel', clamp(b.t - (vehicle.onRails ? 0 : 0.012), 0, 1));
  }

  function action(slot) {
    if (!st.started || st.paused || loading) return;
    const id = getVehicle(CHAPTERS[chapterId].vehicle).actions[slot];
    if (id) vehicle.action(id, st, fx);
  }

  function start() {
    if (st.started) return;
    st.started = true;
    audio.unlock();
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
      quality, dpr: renderer.getPixelRatio(), shadows: !!world?.atmosphere.sun.castShadow,
      chapter: chapterId, assets: assets.loaded.length, assetBytes: assets.bytes,
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
    unloadChapter();
    assets.dispose();
    shared.dispose();
    splash.geometry.dispose();
    splash.material.dispose();
    renderer.dispose();
    audio.dispose();
  }

  // First chapter. A reload mid-ride resumes where the rider was.
  let resume = null;
  try {
    const saved = JSON.parse(sessionStorage.getItem(PROGRESS_KEY) || 'null');
    if (saved && saved.chapter === firstChapter && saved.t > 0.03 && saved.t < 0.995) resume = saved.t;
  } catch {
    /* no saved progress */
  }
  try {
    await loadChapter(firstChapter, { t: resume, progress: onProgress });
  } catch (error) {
    dispose();
    throw error;
  }
  if (resume) st.intro = 1;
  run();

  return {
    start, setMode, nextBeat, travel, returnToRoute, action, setTheme, stats, dispose, skipTransition,
    loadChapter: travelToChapter,
    setPaused(v) {
      st.paused = v;
      audio.setQuiet(v || document.hidden);
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
      audio.setEnabled(v);
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
    get world() {
      return world;
    },
    get vehicle() {
      return vehicle;
    },
    get chapter() {
      return chapterId;
    },
    assets,
    resumed: !!resume,
  };
}
