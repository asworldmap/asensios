// Timeline rail for the trajectory.
//
// The route reads backwards — Santiago (now) at the top, Murcia (the origin)
// at the bottom — which is a strong idea and an easy one to get lost inside.
// The rail exists to answer two questions at any scroll position: which
// chapter am I in, and how much descent is left.
//
// It reads the same `.moment` elements the reveal system already uses, so
// there is no second source of truth about how many chapters exist.

/**
 * Wire the rail to the chapters. No-ops cleanly when either is missing, so a
 * page without a rail (or a rail without chapters) simply does nothing.
 */
export function initTimeline(railSelector = '[data-rail]', momentSelector = '.moment') {
  const rail = document.querySelector(railSelector);
  const moments = Array.from(document.querySelectorAll(momentSelector));
  if (!rail || !moments.length) return;

  const fill = rail.querySelector('[data-rail-fill]');
  const stepOut = rail.querySelector('[data-rail-step]');
  const total = moments.length;
  const pad = (n) => String(n).padStart(2, '0');

  let active = -1;
  let ticking = false;

  const setActive = (i) => {
    if (i === active) return;
    active = i;
    if (stepOut) stepOut.textContent = pad(i + 1);
    moments.forEach((m, n) => m.classList.toggle('is-current', n === i));
  };

  function update() {
    ticking = false;
    const vh = window.innerHeight || document.documentElement.clientHeight;

    // The chapter whose body is closest to the middle of the viewport wins —
    // steadier than "first one intersecting", which flickers between two
    // chapters whenever both are partly on screen.
    let best = 0;
    let bestDist = Infinity;
    moments.forEach((m, i) => {
      const r = m.getBoundingClientRect();
      const dist = Math.abs(r.top + r.height / 2 - vh / 2);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setActive(best);

    // Fill tracks continuous scroll through the route rather than snapping to
    // the active chapter, so the rail keeps moving between chapters.
    const first = moments[0].getBoundingClientRect();
    const last = moments[total - 1].getBoundingClientRect();
    const span = last.bottom - first.top;
    const done = span > 0 ? (vh * 0.5 - first.top) / span : 0;
    const p = Math.max(0, Math.min(1, done));
    if (fill) fill.style.transform = `scaleY(${p.toFixed(4)})`;
    rail.classList.toggle('is-live', p > 0.001 && p < 0.999);
  }

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
}
