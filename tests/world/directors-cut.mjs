/* global document, window, performance, console, MutationObserver */
import assert from 'node:assert/strict';
import { open } from './lib.mjs';

const { b, p, errs } = await open({
  quality: 0,
  init: () => {
    const cut = window.directorCut = { started: 0, stages: [], cuts: [] };
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-start]')) cut.started = performance.now();
    }, { capture: true });
    let entered;
    new MutationObserver(() => {
      const root = document.documentElement;
      const now = performance.now();
      const id = window.__pw?.game.chapter;
      if (id && cut.stages.at(-1)?.id !== id) cut.stages.push({ id, at: now - cut.started });
      if (root.dataset.handoff && !entered) entered = now;
      else if (!root.dataset.handoff && entered) {
        cut.cuts.push(now - entered);
        entered = undefined;
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-handoff', 'data-handoff-phase'] });
  },
});

try {
  await p.waitForFunction(() => {
    const { state, chapter } = window.__pw.game;
    return chapter === 'chile' && state.t > 0.995 && !document.querySelector('[data-cap-link]').hidden;
  }, null, { timeout: 255000, polling: 250 });
  const timing = await p.evaluate(() => ({ ...window.directorCut, duration: performance.now() - window.directorCut.started }));
  assert.deepEqual(timing.stages.map(({ id }) => id), ['murcia', 'europe', 'europe-bus', 'japan', 'flight', 'chile']);
  assert.ok(timing.duration >= 180000 && timing.duration <= 240000, JSON.stringify(timing));
  assert.equal(timing.cuts.length, 5);
  assert.ok(timing.cuts.every((ms) => ms <= 4200), JSON.stringify(timing.cuts));
  assert.equal(await p.getAttribute('[data-cap-link]', 'href'), '/trajectory/');
  assert.deepEqual(errs, []);
  console.log('PASS full hands-free Story in ' + Math.round(timing.duration / 1000) + ' seconds');
  console.log('Transition times (ms): ' + timing.cuts.map(Math.round).join(', '));
} finally {
  await b.close();
}
