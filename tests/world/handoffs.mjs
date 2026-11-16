/* global document, window, console, MutationObserver */
import assert from 'node:assert/strict';
import { open } from './lib.mjs';

const handoffs = [
  ['t01_bicycle_to_train', 'europe', 'match_cut_held_frame'],
  ['t02_train_to_bus', 'europe-bus', 'dark_doorway'],
  ['t03_bus_to_ship', 'japan', 'horizon_hold'],
  ['t04_ship_to_plane', 'flight', 'light_flash_match'],
  ['t05_plane_to_chile', 'chile', 'white_out'],
];

const { b, p, errs } = await open({ quality: 0 });
try {
  p.setDefaultTimeout(90000);
  await p.evaluate(() => {
    window.seenSplices = [];
    const fade = document.querySelector('[data-fade]');
    new MutationObserver(() => {
      if (fade.classList.contains('is-splice')) window.seenSplices.push(fade.dataset.splice);
    }).observe(fade, { attributes: true, attributeFilter: ['class'] });
  });
  for (const [id, stage, splice] of handoffs) {
    await p.click('[data-menu-open]');
    await p.locator('[data-travel] button').last().click();
    await p.click('[data-chapter-next]');
    await p.waitForFunction((key) => document.documentElement.dataset.handoff === key, id);
    if (stage === 'europe') await p.click('[data-skip-handoff]');
    await p.waitForFunction((type) => window.seenSplices.includes(type), splice);
    await p.waitForFunction((name) => window.__pw.game.chapter === name && !document.documentElement.dataset.handoff, stage);
    assert.equal(await p.locator('[data-skip-handoff]').isVisible(), false);
    if (stage === 'flight') {
      const keys = await p.evaluate(() => window.__pw.game.assets.loaded);
      assert.ok(keys.includes('journey/cloud_bank') && keys.includes('journey/cloud_sea'));
    }
    console.log('PASS ' + id + ' · ' + splice);
  }
  await p.click('[data-menu-open]');
  await p.locator('[data-travel] button').last().click();
  await p.waitForFunction(() => document.querySelector('[data-cap-text]').textContent.includes('Mi portfolio'));
  assert.equal(await p.getAttribute('[data-cap-link]', 'href'), '/trajectory/');
  await p.click('[data-lang-toggle]');
  await p.waitForFunction(() => document.querySelector('[data-cap-text]').textContent.includes('My portfolio'));
  assert.deepEqual(errs, []);
  console.log('PASS bilingual Chile epilogue');
} finally {
  await b.close();
}
