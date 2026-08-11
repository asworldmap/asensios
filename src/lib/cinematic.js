// "A life in motion" — cinematic page transitions.
//
// Two modes:
//   orbit — Home → Mi trayectoria. The interface recedes, we pull back from
//           Murcia to Spain, Europe, the planet and open space, the routes of
//           an international life draw themselves, then we land on /business/.
//   warp  — Home → Playroom. A short star-tunnel so the games belong to the
//           same universe.
//
// Everything is drawn procedurally on one 2D canvas: no video, no image
// sequence, no WebGL, no textures. That keeps the whole effect at a few kB,
// makes it resolution independent and — crucially — scrubbable, which a
// pre-rendered clip could never be.

import {
  clamp,
  deviceTier,
  easeIn,
  easeInOut,
  easeOut,
  fitCanvas,
  range,
} from './motion.js';
import {
  ORIGIN,
  PLACES,
  drawGraticule,
  drawNode,
  drawRoute,
  drawSphere,
  makeLabelSpace,
} from './globe.js';
import { createCinema, drawCover } from './cinema.js';

const CREAM = '#fbf7f0';
const CORAL = '#ef6f53';
const HONEY = '#f2b13c';
const DEEP_SPACE = '#050d18';

// Optional atmosphere for the Earth-limb moment of the departure. Requested
// on pointerenter/focus of the trajectory link, same as this whole module.
const { primeCinema, cinemaFrame } = createCinema();

// Destinations shown during the departure, ordered so they rotate into view.
const DEPARTURE_IDS = ['berlin', 'helsinki', 'seoul', 'tokyo'];

const SCALE_LABELS = [
  { text: 'Murcia', sub: '37.99° N · 1.13° O', from: 0.04, to: 0.3 },
  { text: 'España', sub: null, from: 0.28, to: 0.45 },
  { text: 'Europa', sub: null, from: 0.43, to: 0.6 },
  { text: 'Tierra', sub: null, from: 0.58, to: 0.74 },
];

let running = false;

/**
 * Play a transition and then navigate. Always resolves to a navigation, even
 * if something goes wrong mid-flight.
 */
export function playTransition(href, mode = 'orbit') {
  if (running) return;
  running = true;
  if (mode === 'orbit') primeCinema('earth-limb');

  const tier = deviceTier();
  const duration =
    mode === 'warp'
      ? tier === 'mobile'
        ? 620
        : 820
      : tier === 'mobile'
        ? 1500
        : tier === 'tablet'
          ? 1950
          : 2350;

  const root = document.documentElement;
  const overlay = document.createElement('div');
  overlay.className = 'cine';
  overlay.setAttribute('role', 'presentation');
  overlay.innerHTML =
    '<canvas class="cine-canvas"></canvas>' +
    '<button class="cine-skip" type="button">Saltar <span aria-hidden="true">↵</span></button>';
  document.body.appendChild(overlay);

  const canvas = overlay.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const skipBtn = overlay.querySelector('.cine-skip');

  // No canvas → just navigate. Never trap the user.
  if (!ctx) {
    cleanup();
    location.assign(href);
    return;
  }

  root.classList.add('cine-active', 'cine-depart');
  let size = fitCanvas(canvas, ctx, tier === 'mobile' ? 1.5 : 2);

  const stars = makeStars(tier === 'mobile' ? 90 : tier === 'tablet' ? 150 : 220);
  const places = DEPARTURE_IDS.map((id) => PLACES.find((p) => p.id === id)).filter(Boolean);

  let progress = 0;
  let last = performance.now();
  let raf = 0;
  let done = false;
  // Safety net: whatever happens, we leave within a bounded time.
  const bail = setTimeout(finish, duration + 2600);

  function onResize() {
    size = fitCanvas(canvas, ctx, tier === 'mobile' ? 1.5 : 2);
  }

  // Scroll scrubbing: down advances, up rewinds. Also stops the page moving.
  function onWheel(e) {
    e.preventDefault();
    progress = clamp(progress + e.deltaY * 0.00055, 0, 1);
  }
  function onKey(e) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish();
  }

  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);
  overlay.addEventListener('click', (e) => {
    if (e.target !== skipBtn) finish();
  });
  skipBtn.addEventListener('click', finish);

  function cleanup() {
    cancelAnimationFrame(raf);
    clearTimeout(bail);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('keydown', onKey);
    // The overlay itself stays put: removing it here would flash the old page
    // during the navigation. initArrival() clears it on a bfcache restore.
    root.classList.remove('cine-active', 'cine-depart');
    root.style.removeProperty('--cine-scale');
    root.style.removeProperty('--cine-blur');
    root.style.removeProperty('--cine-fade');
    running = false;
  }

  function finish() {
    if (done) return;
    done = true;
    cleanup();
    try {
      sessionStorage.setItem('asensios.arrival', mode);
    } catch {
      /* private mode — the arrival flourish is optional */
    }
    location.assign(href);
  }

  function frame(now) {
    const dt = Math.min(48, now - last);
    last = now;
    if (!done) progress = clamp(progress + dt / duration, 0, 1);

    try {
      if (mode === 'warp') drawWarp(ctx, size, progress, stars);
      else drawOrbit(ctx, size, progress, stars, places, tier);
    } catch {
      finish();
      return;
    }

    // The page behind recedes as we leave it.
    const out = easeInOut(range(progress, 0, 0.34));
    root.style.setProperty('--cine-scale', String(1 - 0.07 * out));
    root.style.setProperty('--cine-blur', `${8 * out}px`);
    root.style.setProperty('--cine-fade', String(1 - out));

    if (progress >= 1) {
      finish();
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ orbit */

function drawOrbit(ctx, size, p, stars, places, tier) {
  const { w, h } = size;
  const min = Math.min(w, h);
  const cx = w / 2;
  const cy = h * 0.5;

  // Deep space, warming towards cream as we land.
  const land = easeIn(range(p, 0.88, 1));
  ctx.fillStyle = '#050d18';
  ctx.fillRect(0, 0, w, h);

  // Exponential zoom keeps the perceived rate of scale constant.
  const zoom = easeInOut(range(p, 0.02, 0.74));
  let r = min * 16 * Math.pow(0.34 / 16, zoom);
  r *= 1 + 0.5 * easeIn(range(p, 0.88, 1)); // final push back in

  const cam = {
    cx,
    cy,
    r,
    lat: ORIGIN.lat - 18 * easeInOut(range(p, 0.45, 1)),
    lon: ORIGIN.lon + 58 * easeInOut(range(p, 0.5, 1)),
  };

  const space = makeLabelSpace(w, h);

  const starA = range(p, 0.4, 0.68);
  if (starA > 0.01) drawStars(ctx, size, stars, starA * 0.9, p);

  // Optional atmosphere: gives the "Tierra" moment matter and depth. Sits
  // BELOW the procedural sphere, so the real footage's framing can never
  // desync the graticule, routes or labels drawn on top of it. A no-op
  // until public/cinematic/earth-limb.* exists.
  const limb = range(p, 0.4, 0.58) * (1 - range(p, 0.76, 0.88));
  if (limb > 0.01) {
    const lv = cinemaFrame('earth-limb');
    if (lv) {
      ctx.save();
      ctx.globalAlpha = limb * 0.45;
      drawCover(ctx, lv, 0, 0, w, h);
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = limb * 0.2;
      ctx.fillStyle = DEEP_SPACE;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  drawSphere(ctx, cam);
  drawGraticule(ctx, cam, range(p, 0.1, 0.55), tier === 'mobile' ? 45 : 30);

  // Origin marker is present from the first frame — Murcia is where it starts.
  drawNode(ctx, cam, ORIGIN, range(p, 0.06, 0.2), {
    color: HONEY,
    radius: 4,
    ring: true,
    label: p > 0.3,
    labelSize: 11,
    space,
  });

  // Routes stagger outwards once the planet is readable.
  places.forEach((place, i) => {
    const start = 0.62 + i * 0.055;
    const t = easeOut(range(p, start, start + 0.17));
    if (t <= 0) return;
    drawRoute(ctx, cam, ORIGIN, place, t, `rgba(239,111,83,${0.85 * t})`, 1.5);
    drawNode(ctx, cam, place, range(p, start + 0.1, start + 0.2), {
      color: CORAL,
      radius: 3,
      labelSize: tier === 'mobile' ? 9 : 11,
      space,
    });
  });

  drawScaleLabels(ctx, size, p);

  // Signature line, once the constellation exists.
  const sig = range(p, 0.7, 0.84) * (1 - range(p, 0.93, 1));
  if (sig > 0.01) {
    ctx.save();
    ctx.globalAlpha = sig * 0.85;
    ctx.fillStyle = 'rgba(251,247,240,0.9)';
    ctx.font = `600 ${Math.max(9, min * 0.014)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.letterSpacing = '0.28em';
    ctx.fillText('A LIFE IN MOTION', cx, h - Math.max(34, h * 0.08));
    ctx.restore();
  }

  if (land > 0.01) {
    ctx.fillStyle = `rgba(251,247,240,${land})`;
    ctx.fillRect(0, 0, w, h);
  }
}

/** Crossfading scale typography: Murcia → España → Europa → Tierra. */
function drawScaleLabels(ctx, size, p) {
  const { w, h } = size;
  const min = Math.min(w, h);
  ctx.save();
  ctx.textAlign = 'center';
  for (const l of SCALE_LABELS) {
    const mid = (l.from + l.to) / 2;
    const a = p < mid ? range(p, l.from, mid) : 1 - range(p, mid, l.to);
    if (a <= 0.01) continue;
    const y = h * 0.5 + min * 0.02 * (1 - a);
    ctx.globalAlpha = a;
    ctx.fillStyle = CREAM;
    ctx.font = `500 ${Math.max(30, min * 0.11)}px Fraunces, Georgia, serif`;
    ctx.fillText(l.text, w / 2, y);
    if (l.sub) {
      ctx.globalAlpha = a * 0.6;
      ctx.font = `500 ${Math.max(9, min * 0.016)}px Inter, system-ui, sans-serif`;
      ctx.fillText(l.sub, w / 2, y + min * 0.055);
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------------- warp */

function drawWarp(ctx, size, p, stars) {
  const { w, h } = size;
  const cx = w / 2;
  const cy = h / 2;
  ctx.fillStyle = '#050d18';
  ctx.fillRect(0, 0, w, h);

  const speed = easeIn(range(p, 0, 0.72));
  const fade = easeIn(range(p, 0.72, 1));
  const max = Math.hypot(w, h) / 2;

  ctx.save();
  ctx.lineCap = 'round';
  for (const s of stars) {
    const d = (s.d + speed * 1.5) % 1;
    const dist = d * max;
    const len = 4 + speed * 150 * s.z;
    const x1 = cx + Math.cos(s.a) * dist;
    const y1 = cy + Math.sin(s.a) * dist;
    const x2 = cx + Math.cos(s.a) * (dist + len);
    const y2 = cy + Math.sin(s.a) * (dist + len);
    ctx.strokeStyle = `rgba(${s.warm ? '242,177,60' : '190,215,255'},${0.25 + 0.6 * s.z})`;
    ctx.lineWidth = 0.6 + s.z * 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();

  if (fade > 0.01) {
    ctx.fillStyle = `rgba(251,247,240,${fade})`;
    ctx.fillRect(0, 0, w, h);
  }
}

/* ------------------------------------------------------------------ stars */

function makeStars(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      a: Math.random() * Math.PI * 2,
      d: Math.random(),
      z: Math.random(),
      warm: Math.random() < 0.12,
      x: Math.random(),
      y: Math.random(),
    });
  }
  return out;
}

function drawStars(ctx, size, stars, alpha, p) {
  const { w, h } = size;
  const drift = p * 18;
  ctx.save();
  for (const s of stars) {
    const x = (s.x * w + drift) % w;
    const y = s.y * h;
    ctx.globalAlpha = alpha * (0.25 + 0.75 * s.z);
    ctx.fillStyle = s.warm ? HONEY : '#dce9ff';
    const r = 0.5 + s.z * 1.3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
