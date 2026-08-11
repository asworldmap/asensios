// Asensio Worldmap — a scroll-linked constellation behind the story.
//
// Editorial rather than cartographic: a thin wireframe planet on the page's
// own cream, with routes that draw themselves as you read and retreat as you
// scroll back up. The globe turns east through Europe and Asia, then west
// across the Pacific into South America, so Santiago — the present — is the
// last node to arrive.
//
// The loop is demand-driven: it renders on scroll/resize and while fading,
// then parks itself. A globe sitting still costs nothing.

import { clamp, deviceTier, easeOut, fitCanvas, lerp, range } from './motion.js';
import { ORIGIN, PLACES, drawGraticule, drawNode, drawRoute, makeLabelSpace } from './globe.js';
import { createCinema, drawCover } from './cinema.js';

const INK = '14,39,64';

// Optional atmosphere for the Santiago arrival — the Pacific crossing that
// closes the route sequence. Requested once, when the worldmap section
// comes on desktop; a no-op until public/cinematic/pacific-andes.* exists.
const { primeCinema, cinemaFrame } = createCinema();

export function initWorldmap(sectionSelector = '.story') {
  const section = document.querySelector(sectionSelector);
  if (!section) return;

  const tier = deviceTier();
  if (tier === 'desktop') primeCinema('pacific-andes');
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

  const dpr = tier === 'mobile' ? 1.5 : 2;
  let size = fitCanvas(canvas, ctx, dpr);
  let visible = false;
  let queued = false;
  let force = true;
  let progress = 0;
  let shown = 0;

  const maxOpacity = tier === 'mobile' ? 0.3 : tier === 'tablet' ? 0.4 : 0.5;
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

    // Fade in at the start of the section and out at the very end.
    const envelope = Math.min(range(progress, 0.02, 0.18), 1 - range(progress, 0.9, 1));
    const alpha = maxOpacity * envelope * shown;
    if (alpha <= 0.01) return;

    ctx.save();
    ctx.globalAlpha = alpha;

    const cam = {
      cx: w * (tier === 'mobile' ? 0.5 : 0.72),
      cy: h * 0.52,
      r: min * (tier === 'mobile' ? 0.42 : 0.36),
      // East through Europe and Asia, then west across the Pacific.
      lon:
        progress < 0.45
          ? lerp(10, 95, easeOut(range(progress, 0, 0.45)))
          : lerp(95, -70, easeOut(range(progress, 0.45, 1))),
      lat: lerp(40, -18, range(progress, 0.1, 1)),
    };
    const space = makeLabelSpace(w, h);

    // Optional atmosphere for the Santiago arrival: Pacific crossing into
    // the Andes, clipped to the globe circle and painted BELOW the
    // graticule, routes and nodes so they always read on top of it.
    if (tier === 'desktop') {
      const arrive = range(progress, 0.74, 0.84) * (1 - range(progress, 0.93, 0.99));
      if (arrive > 0.01) {
        const av = cinemaFrame('pacific-andes');
        if (av) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cam.cx, cam.cy, cam.r, 0, Math.PI * 2);
          ctx.clip();
          ctx.globalAlpha = alpha * arrive * 0.85;
          drawCover(ctx, av, cam.cx - cam.r, cam.cy - cam.r, cam.r * 2, cam.r * 2);
          ctx.restore();
        }
      }
    }

    ctx.strokeStyle = `rgba(${INK},0.16)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cam.cx, cam.cy, cam.r, 0, Math.PI * 2);
    ctx.stroke();

    drawGraticule(ctx, cam, 1, step, INK);

    drawNode(ctx, cam, ORIGIN, 1, {
      color: '#f2b13c',
      radius: 3.6,
      labelColor: `rgba(${INK},0.75)`,
      labelSize: 10,
      space,
    });

    // Routes reveal across the reading of the story; Santiago lands last.
    PLACES.forEach((place, i) => {
      const start = 0.12 + (i / PLACES.length) * 0.72;
      const t = easeOut(range(progress, start, start + 0.16));
      if (t <= 0) return;
      drawRoute(ctx, cam, ORIGIN, place, t, `rgba(239,111,83,${0.7 * t})`, 1.3);
      drawNode(ctx, cam, place, range(progress, start + 0.06, start + 0.16), {
        color: '#ef6f53',
        radius: 2.6,
        labelColor: `rgba(${INK},0.7)`,
        labelSize: 10,
        space,
      });
    });

    // Quiet signature so the piece is named.
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = `rgba(${INK},0.9)`;
    ctx.font = '600 9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ASENSIO WORLDMAP', cam.cx, cam.cy + cam.r + 26);

    ctx.restore();
  }
}
