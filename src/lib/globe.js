// Editorial wireframe globe: orthographic projection, graticule, great-circle
// routes and city nodes. Drawn procedurally on a 2D canvas — no textures, no
// WebGL, no map tiles. Shared by the cinematic transition and the worldmap.

import { RAD, clamp } from './motion.js';

/**
 * Places that make up the visual universe. Order matters: routes reveal in
 * this sequence, so Santiago (the present) lands last.
 */
export const ORIGIN = { id: 'murcia', name: 'Murcia', lat: 37.99, lon: -1.13 };

export const PLACES = [
  { id: 'valencia', name: 'Valencia', lat: 39.47, lon: -0.38 },
  { id: 'berlin', name: 'Berlín', lat: 52.52, lon: 13.4 },
  { id: 'helsinki', name: 'Helsinki', lat: 60.17, lon: 24.94 },
  { id: 'seoul', name: 'Seúl', lat: 37.57, lon: 126.98 },
  { id: 'tokyo', name: 'Japón', lat: 35.68, lon: 139.65 },
  { id: 'sanjose', name: 'Costa Rica', lat: 9.93, lon: -84.08 },
  { id: 'santiago', name: 'Santiago', lat: -33.45, lon: -70.67 },
];

/** Unit vector for a lat/lon pair. */
export function toVec(lat, lon) {
  const p = lat * RAD;
  const l = lon * RAD;
  const cp = Math.cos(p);
  return [cp * Math.cos(l), cp * Math.sin(l), Math.sin(p)];
}

/**
 * Rotate a world vector into camera space. After this the camera looks down
 * +x, screen right is +y and screen up is +z, so a point is on the near side
 * of the sphere when x > 0.
 */
export function rotate(v, lon0, lat0) {
  const cl = Math.cos(lon0 * RAD);
  const sl = Math.sin(lon0 * RAD);
  const x1 = v[0] * cl + v[1] * sl;
  const y1 = -v[0] * sl + v[1] * cl;
  const z1 = v[2];
  const cp = Math.cos(lat0 * RAD);
  const sp = Math.sin(lat0 * RAD);
  return [x1 * cp + z1 * sp, y1, -x1 * sp + z1 * cp];
}

/** Project a world vector to screen space for the given camera. */
export function project(v, cam) {
  const r = rotate(v, cam.lon, cam.lat);
  return {
    x: cam.cx + r[1] * cam.r,
    y: cam.cy - r[2] * cam.r,
    z: r[0],
    visible: r[0] > 0,
  };
}

/** Spherical interpolation between two unit vectors. */
export function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  d = clamp(d, -1, 1);
  const o = Math.acos(d);
  if (o < 1e-6) return a.slice();
  const s = Math.sin(o);
  const k1 = Math.sin((1 - t) * o) / s;
  const k2 = Math.sin(t * o) / s;
  return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
}

/** Soft atmospheric halo + globe body. */
export function drawSphere(ctx, cam, opts = {}) {
  const { cx, cy, r } = cam;
  const halo = ctx.createRadialGradient(cx, cy, r * 0.86, cx, cy, r * 1.14);
  halo.addColorStop(0, opts.haloInner || 'rgba(47,107,255,0.20)');
  halo.addColorStop(1, 'rgba(47,107,255,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.14, 0, Math.PI * 2);
  ctx.fill();

  // Body, lit from the upper left so the sphere reads as a solid.
  const body = ctx.createRadialGradient(
    cx - r * 0.36,
    cy - r * 0.4,
    r * 0.05,
    cx,
    cy,
    r * 1.02
  );
  body.addColorStop(0, opts.bodyInner || '#123253');
  body.addColorStop(0.62, opts.bodyMid || '#0e2740');
  body.addColorStop(1, opts.bodyOuter || '#07182a');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = opts.rim || 'rgba(150,190,255,0.35)';
  ctx.lineWidth = Math.max(0.6, r * 0.004);
  ctx.stroke();
}

/** Meridians and parallels — the cartographic texture of the globe. */
export function drawGraticule(ctx, cam, alpha = 1, step = 30, rgb = '158,196,240') {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.lineWidth = Math.max(0.5, cam.r * 0.0022);
  ctx.strokeStyle = `rgba(${rgb},${0.24 * alpha})`;

  for (let lon = -180; lon < 180; lon += step) {
    strokePath(ctx, cam, (t) => toVec(-85 + t * 170, lon), 26);
  }
  for (let lat = -60; lat <= 60; lat += step) {
    strokePath(ctx, cam, (t) => toVec(lat, -180 + t * 360), 60);
  }
  // Equator, slightly stronger.
  ctx.strokeStyle = `rgba(${rgb},${0.4 * alpha})`;
  strokePath(ctx, cam, (t) => toVec(0, -180 + t * 360), 72);
  ctx.restore();
}

/** Stroke a parametric curve, breaking it where it goes behind the globe. */
function strokePath(ctx, cam, at, segments) {
  let drawing = false;
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const p = project(at(i / segments), cam);
    if (!p.visible) {
      drawing = false;
      continue;
    }
    if (drawing) ctx.lineTo(p.x, p.y);
    else {
      ctx.moveTo(p.x, p.y);
      drawing = true;
    }
  }
  ctx.stroke();
}

/**
 * Great-circle route from `a` to `b`, revealed 0→1 by `progress`.
 * Lifted slightly off the surface so it reads as a flight path.
 */
export function drawRoute(ctx, cam, a, b, progress, color, width = 1.6) {
  if (progress <= 0) return;
  const va = toVec(a.lat, a.lon);
  const vb = toVec(b.lat, b.lon);
  const steps = 48;
  const end = Math.max(1, Math.round(steps * clamp(progress)));

  ctx.save();
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  let drawing = false;
  ctx.beginPath();
  for (let i = 0; i <= end; i++) {
    const t = i / steps;
    const v = slerp(va, vb, t);
    // Arc height: peaks mid-route.
    const lift = 1 + 0.075 * Math.sin(Math.PI * t);
    const p = project([v[0] * lift, v[1] * lift, v[2] * lift], cam);
    if (!p.visible) {
      drawing = false;
      continue;
    }
    if (drawing) ctx.lineTo(p.x, p.y);
    else {
      ctx.moveTo(p.x, p.y);
      drawing = true;
    }
  }
  ctx.stroke();

  // Travelling head.
  if (progress < 1) {
    const v = slerp(va, vb, clamp(progress));
    const lift = 1 + 0.075 * Math.sin(Math.PI * progress);
    const p = project([v[0] * lift, v[1] * lift, v[2] * lift], cam);
    if (p.visible) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, width * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Per-frame label bookkeeping. Cities sit close together at planet scale
 * (Murcia/Valencia are 8 px apart, Seúl/Japón 21 px), so labels are claimed
 * first-come-first-served and a colliding one is simply dropped.
 */
export function makeLabelSpace(w, h) {
  return { w, h, rects: [] };
}

function claimLabel(space, x, y, tw, th) {
  const r = { x1: x, y1: y - th / 2, x2: x + tw, y2: y + th / 2 };
  if (!space) return r;
  for (const o of space.rects) {
    if (r.x1 < o.x2 && r.x2 > o.x1 && r.y1 < o.y2 && r.y2 > o.y1) return null;
  }
  space.rects.push(r);
  return r;
}

/** City node with optional label. `t` fades the whole thing in. */
export function drawNode(ctx, cam, place, t, opts = {}) {
  if (t <= 0.01) return;
  const p = project(toVec(place.lat, place.lon), cam);
  if (!p.visible) return;
  const a = clamp(t);
  const color = opts.color || '#ef6f53';
  const rad = (opts.radius || 3.2) * (0.6 + 0.4 * a);

  ctx.save();
  ctx.globalAlpha = a;
  // Pulse ring — opt-in, since it forces a repaint every frame.
  if (opts.ring) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = a * 0.35;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad * (2.2 + 0.6 * Math.sin(Date.now() / 520 + place.lat)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = a;
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
  ctx.fill();

  if (opts.label !== false) {
    const size = opts.labelSize || 11;
    ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
    const text = place.name.toUpperCase();
    const tw = ctx.measureText(text).width;
    const space = opts.space;
    const limit = space ? space.w : Infinity;

    // Flip to the left when the label would run past the canvas edge.
    let lx = p.x + rad + 7;
    if (lx + tw > limit - 8) lx = p.x - rad - 7 - tw;
    if (lx < 6) lx = 6;

    // Nudge vertically before giving up: Seúl and Japón land 21 px apart at
    // planet scale and both deserve to be named.
    const th = size + 6;
    let ly = null;
    for (const dy of [0, -(th + 2), th + 2, -2 * (th + 2), 2 * (th + 2)]) {
      if (claimLabel(space, lx, p.y + dy, tw, th)) {
        ly = p.y + dy;
        break;
      }
    }

    if (ly !== null) {
      ctx.globalAlpha = a * 0.92;
      ctx.fillStyle = opts.labelColor || 'rgba(251,247,240,0.92)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, lx, ly);
    }
  }
  ctx.restore();
}
