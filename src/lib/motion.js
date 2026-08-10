// Shared motion utilities. No dependencies.
// Kept tiny on purpose: the whole site ships ~10 kB of JS and a
// scroll/animation library (GSAP + ScrollTrigger ≈ 70 kB gz) would be
// several times the entire payload for effects this file covers in ~1 kB.

export const RAD = Math.PI / 180;

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Normalised progress of `t` inside the [a, b] window. */
export const range = (t, a, b) => clamp((t - a) / (b - a));

export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t) => t * t * t;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Coarse capability tier used for progressive enhancement:
 * desktop = full experience, tablet = simplified, mobile = light + fast.
 */
export function deviceTier() {
  const w = window.innerWidth;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  if (w < 700 || (coarse && w < 900)) return 'mobile';
  if (w < 1180 || cores <= 4) return 'tablet';
  return 'desktop';
}

/**
 * Arrival handling on every page load.
 *
 * 1. Undoes transition state when a page comes back from the bfcache — the
 *    departure overlay is deliberately left in the DOM so the old page never
 *    flashes while the browser navigates, which means a Back button press can
 *    restore a page still wearing it.
 * 2. Plays the landing veil when we actually flew here.
 */
export function initArrival() {
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    document.querySelectorAll('.cine, .cine-arrive').forEach((n) => n.remove());
    const root = document.documentElement;
    root.classList.remove('cine-active', 'cine-depart', 'cine-arriving');
    root.style.removeProperty('--cine-scale');
    root.style.removeProperty('--cine-blur');
    root.style.removeProperty('--cine-fade');
  });

  if (prefersReducedMotion()) return;
  let mode = null;
  try {
    mode = sessionStorage.getItem('asensios.arrival');
    sessionStorage.removeItem('asensios.arrival');
  } catch {
    return;
  }
  if (!mode) return;

  const veil = document.createElement('div');
  veil.className = 'cine-arrive';
  veil.setAttribute('aria-hidden', 'true');
  document.body.appendChild(veil);
  document.documentElement.classList.add('cine-arriving');

  requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.add('is-out')));
  setTimeout(() => {
    veil.remove();
    document.documentElement.classList.remove('cine-arriving');
  }, 900);
}

/**
 * Intercept in-site links and play a cinematic departure. The animation code
 * is a lazy chunk fetched on intent (hover/focus/touch), so it never touches
 * the initial payload. Modified clicks, reduced motion and any load failure
 * fall through to a completely normal navigation.
 */
export function wireCinematicLinks(map) {
  if (prefersReducedMotion()) return;
  const selectors = Object.keys(map);
  const nodes = document.querySelectorAll(selectors.join(','));
  if (!nodes.length) return;

  let pending = null;
  const load = () => (pending = pending || import('./cinematic.js'));

  nodes.forEach((el) => {
    const sel = selectors.find((s) => el.matches(s));
    if (!sel) return;
    const kind = map[sel];

    ['pointerenter', 'focus', 'touchstart'].forEach((ev) =>
      el.addEventListener(ev, load, { once: true, passive: true })
    );

    el.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const href = el.getAttribute('href');
      if (!href) return;
      e.preventDefault();
      load()
        .then((m) => m.playTransition(href, kind))
        .catch(() => location.assign(href));
    });
  });
}

/** Size a canvas to its CSS box, capping DPR so fill-rate stays sane. */
export function fitCanvas(canvas, ctx, maxDpr = 2) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}
