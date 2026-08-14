// Asensio Worldmap — a scroll-linked route behind the trajectory.
//
// Editorial rather than cartographic: a thin wireframe planet on the page's
// own surface, with routes that draw themselves as you read and retreat as you
// scroll back up. The story runs from the present backwards, so the planet
// opens over Santiago, crosses the Pacific into Asia and carries west through
// Europe until Murcia — the origin — closes it.
//
// The loop is demand-driven: it renders on scroll/resize and while fading,
// then parks itself. A globe sitting still costs nothing, which also means
// nothing here may depend on a clock — no pulsing, no idle animation.

import { clamp, deviceTier, easeOut, fitCanvas, lerp, range } from './motion.js';
import { ORIGIN, PLACES, drawGraticule, drawNode, drawRoute, makeLabelSpace } from './globe.js';
import { createCinema, drawCover } from './cinema.js';

// Optional atmosphere for Santiago — the Pacific crossing that now opens the
// route sequence. Requested once, on desktop, when the section comes into
// view; a no-op until public/cinematic/pacific-andes.* exists.
const { primeCinema, cinemaFrame } = createCinema();

/**
 * Theme colours, read from the design tokens rather than duplicated here, so
 * the globe follows light/dark without a second source of truth. Cached until
 * the caller invalidates it on a theme change.
 */
function makePalette() {
  let cache = null;

  const read = () => {
    const cs = getComputedStyle(document.documentElement);
    const get = (name, fallback) => (cs.getPropertyValue(name) || fallback).trim();
    return {
      ink: get('--ink-rgb', '74, 53, 39').replace(/\s/g, ''),
      signal: get('--signal', '#3fbf16'),
      bamboo: get('--bamboo', '#a9884f'),
      // Footage carries much better on the night surface than on paper, so the
      // Pacific crossing is allowed to be stronger in dark mode.
      footage: get('--is-dark', '0') === '1' ? 0.62 : 0.42,
    };
  };

  return {
    get: () => (cache = cache || read()),
    invalidate: () => {
      cache = null;
    },
  };
}

export function initWorldmap(sectionSelector = '.tj-route') {
  const section = document.querySelector(sectionSelector);
  if (!section) return;

  const tier = deviceTier();

  // Everything except mobile gets the Pacific crossing. Gating it on the
  // 'desktop' tier alone would drop it on any four-core laptop, which is a lot
  // of real machines; the bandwidth argument only genuinely applies to phones.
  const wantsFootage = tier !== 'mobile';
  if (wantsFootage) primeCinema('pacific-andes');

  const host = document.createElement('div');
  host.className = 'worldmap';
  host.setAttribute('aria-hidden', 'true');
  host.innerHTML = '<canvas></canvas>';
  document.body.appendChild(host);

  const canvas = host.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    host.remove();
    return;
  }

  const palette = makePalette();
  const dpr = tier === 'mobile' ? 1.5 : 2;
  let size = fitCanvas(canvas, ctx, dpr);
  let visible = false;
  let queued = false;
  let force = true;
  let progress = 0;
  let shown = 0;

  // Atmosphere, not illustration: it must never compete with the type.
  const maxOpacity = tier === 'mobile' ? 0.26 : tier === 'tablet' ? 0.34 : 0.42;
  const step = tier === 'mobile' ? 45 : 30;

  const request = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  };

  new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      request();
    },
    { rootMargin: '10% 0px' }
  ).observe(section);

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener(
    'resize',
    () => {
      size = fitCanvas(canvas, ctx, dpr);
      force = true;
      request();
    },
    { passive: true }
  );

  // Repaint when the theme flips, otherwise the globe keeps the old ink until
  // the next scroll event.
  const onTheme = () => {
    palette.invalidate();
    force = true;
    request();
  };
  new MutationObserver(onTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onTheme);

  /** Single layout read per frame, never interleaved with writes. */
  function measure() {
    const r = section.getBoundingClientRect();
    const vh = window.innerHeight;
    return clamp((vh - r.top) / (r.height + vh));
  }

  function frame() {
    queued = false;
    const target = visible ? 1 : 0;
    const prevShown = shown;
    const prevProgress = progress;

    shown = lerp(shown, target, 0.12);
    if (Math.abs(shown - target) < 0.004) shown = target;
    if (visible) progress = measure();

    const moved =
      force || Math.abs(shown - prevShown) > 0.0005 || Math.abs(progress - prevProgress) > 0.0004;
    force = false;
    if (moved) draw();
    if (shown !== target) request();
  }

  function draw() {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    const min = Math.min(w, h);

    // Fade in at the start of the section, out at the very end, and stay
    // deliberately faint through the middle: while the photographs are doing
    // the work the globe is only atmosphere. Reversed with the narrative, the
    // strong beat is now the opening — Santiago, the present — and it settles
    // back once the descent into the past is under way.
    const envelope = Math.min(range(progress, 0.01, 0.1), 1 - range(progress, 0.9, 1));
    const emphasis = 1 - 0.42 * range(progress, 0.16, 0.42);
    const alpha = maxOpacity * envelope * emphasis * shown;
    if (alpha <= 0.01) return;

    const { ink, signal, bamboo, footage } = palette.get();

    ctx.save();
    ctx.globalAlpha = alpha;

    const cam = {
      cx: w * (tier === 'mobile' ? 0.5 : 0.72),
      cy: h * 0.52,
      r: min * (tier === 'mobile' ? 0.42 : 0.36),
      // The reading runs backwards, so the planet does too: we open over
      // Santiago, cross the Pacific east into Asia, then carry west across
      // Asia and Europe until Murcia — the origin — is under the camera.
      lon:
        progress < 0.5
          ? lerp(-70, 95, easeOut(range(progress, 0, 0.5)))
          : lerp(95, 10, easeOut(range(progress, 0.5, 1))),
      lat: lerp(-18, 40, range(progress, 0.05, 0.95)),
    };
    const space = makeLabelSpace(w, h);

    // Optional atmosphere for the Santiago arrival: the Pacific crossing into
    // the Andes, clipped to the globe circle and painted BELOW the graticule,
    // routes and nodes so the information always reads on top of it.
    // Timed so the footage is at full strength exactly while the Santiago node
    // and its route land. Santiago now opens the route rather than closing it,
    // so the Pacific crossing belongs at the top of the descent.
    if (wantsFootage) {
      const arrive = range(progress, 0.04, 0.12) * (1 - range(progress, 0.24, 0.38));
      if (arrive > 0.01) {
        const av = cinemaFrame('pacific-andes');
        if (av) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cam.cx, cam.cy, cam.r, 0, Math.PI * 2);
          ctx.clip();

          // Set absolutely, not multiplied by the wireframe's alpha: the
          // footage is the atmosphere and needs to actually register.
          ctx.globalAlpha = footage * arrive * shown;
          drawCover(ctx, av, cam.cx - cam.r, cam.cy - cam.r, cam.r * 2, cam.r * 2);

          // Feather the rim away so it reads as a planet dissolving into the
          // page, not as a video clipped to a circle.
          ctx.globalCompositeOperation = 'destination-out';
          ctx.globalAlpha = 1;
          const fade = ctx.createRadialGradient(
            cam.cx,
            cam.cy,
            cam.r * 0.45,
            cam.cx,
            cam.cy,
            cam.r
          );
          fade.addColorStop(0, 'rgba(0,0,0,0)');
          fade.addColorStop(1, 'rgba(0,0,0,1)');
          ctx.fillStyle = fade;
          ctx.fillRect(cam.cx - cam.r, cam.cy - cam.r, cam.r * 2, cam.r * 2);
          ctx.restore();
        }
      }
    }

    ctx.strokeStyle = `rgba(${ink},0.16)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cam.cx, cam.cy, cam.r, 0, Math.PI * 2);
    ctx.stroke();

    drawGraticule(ctx, cam, 1, step, ink);

    drawNode(ctx, cam, ORIGIN, 1, {
      color: bamboo,
      radius: 3.4,
      labelColor: `rgba(${ink},0.72)`,
      labelSize: 10,
      space,
    });

    // Routes reveal across the reading of the story. Reversed with the
    // narrative: Santiago is the first to land — it is the present, and the
    // only node allowed to be slightly larger — and Europe the last.
    [...PLACES].reverse().forEach((place, i) => {
      const start = 0.12 + (i / PLACES.length) * 0.72;
      const t = easeOut(range(progress, start, start + 0.16));
      if (t <= 0) return;
      const here = place.id === 'santiago';

      drawRoute(ctx, cam, ORIGIN, place, t, hexToRgba(signal, 0.62 * t), here ? 1.5 : 1.2);
      drawNode(ctx, cam, place, range(progress, start + 0.06, start + 0.16), {
        color: signal,
        radius: here ? 3.8 : 2.4,
        labelColor: `rgba(${ink},${here ? 0.85 : 0.66})`,
        labelSize: 10,
        space,
      });
    });

    ctx.restore();
  }
}

/** #rrggbb → rgba(). The tokens are hex; canvas strokes need alpha. */
function hexToRgba(hex, a) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(63,191,22,${a})`;
  const [r, g, b] = [m[1], m[2], m[3]].map((p) => parseInt(p, 16));
  return `rgba(${r},${g},${b},${a})`;
}
