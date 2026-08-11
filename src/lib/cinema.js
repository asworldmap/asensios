// Optional cinematic layer: two atmospheric clips that enrich the orbit
// departure and the worldmap IF they exist in public/cinematic/. Neither is
// a requirement — if the file is missing, the codec is unsupported, or the
// visitor asked for reduced motion, the procedural canvas stays the only
// source of image and nothing references a missing file.
//
// Videos are requested with primeCinema(), never on page load: they start
// downloading only once the visitor is actually headed towards the scene
// that uses them. Zero bytes for everyone else.

import { prefersReducedMotion } from './motion.js';

/**
 * Creates an isolated cinema registry. Each page that wants video-backed
 * atmosphere makes its own — cinematic.js and worldmap.js never need to
 * share state, and tests get a fresh one with an injected DOM/reduced-motion
 * check instead of touching the real browser.
 */
export function createCinema({ doc = document, reduced = prefersReducedMotion } = {}) {
  const CINEMA = {};

  function cinema(name) {
    if (CINEMA[name]) return CINEMA[name];
    const st = (CINEMA[name] = { el: null, ready: false, dead: false, primed: false });
    if (reduced()) {
      st.dead = true;
      return st;
    }

    let v;
    try {
      v = doc.createElement('video');
    } catch {
      st.dead = true;
      return st;
    }
    if (!v.canPlayType) {
      st.dead = true;
      return st;
    }
    const webmOk = !!v.canPlayType('video/webm; codecs="vp9"');
    const mp4Ok = !!v.canPlayType('video/mp4; codecs="avc1.42E01E"');
    if (!webmOk && !mp4Ok) {
      st.dead = true;
      return st;
    }

    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;
    v.playsInline = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.setAttribute('aria-hidden', 'true');
    v.preload = 'none';

    // The error fires on the <source> elements and doesn't bubble by
    // default, so it's captured here instead.
    v.addEventListener(
      'error',
      () => {
        st.dead = true;
        st.ready = false;
      },
      true
    );
    v.addEventListener('canplay', () => {
      st.ready = true;
    });
    v.addEventListener('stalled', () => {
      st.ready = false;
    });

    const addSource = (ext, type) => {
      const s = doc.createElement('source');
      s.src = `/cinematic/${name}.${ext}`;
      s.type = type;
      v.appendChild(s);
    };
    if (webmOk) addSource('webm', 'video/webm');
    if (mp4Ok) addSource('mp4', 'video/mp4');

    st.el = v;
    return st;
  }

  /** Starts the download. Idempotent and cheap: safe on every pointerenter. */
  function primeCinema(name) {
    const st = cinema(name);
    if (st.dead || st.primed || !st.el) return;
    st.primed = true;
    try {
      st.el.preload = 'auto';
      st.el.load();
    } catch {
      st.dead = true;
    }
  }

  /** Returns the video element only if it has a paintable frame right now. */
  function cinemaFrame(name) {
    const st = CINEMA[name];
    if (!st || st.dead || !st.ready || !st.el) return null;
    const v = st.el;
    if (v.readyState < 2 || !v.videoWidth) return null;
    if (v.paused) {
      try {
        const q = v.play();
        if (q && q.catch) q.catch(() => {});
      } catch {
        return null;
      }
    }
    return v;
  }

  return { cinema, primeCinema, cinemaFrame, CINEMA };
}

/** Draws a video covering a rectangle, like CSS object-fit: cover. */
export function drawCover(ctx, v, x, y, w, h) {
  const vw = v.videoWidth;
  const vh = v.videoHeight;
  if (!vw || !vh) return;
  const scale = Math.max(w / vw, h / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  ctx.drawImage(v, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
