import { open } from './lib.mjs';
const out = process.argv[2];
const R = []; const ok = (n, c, x = '') => R.push(`${c ? 'PASS' : 'FAIL'}  ${n} ${x}`);
// ---- mobile
{
  const { b, p, errs, wait, st } = await open({ device: 'iPhone 13', quality: null, reduced: true });
  await wait(1.5);
  if (out) await p.screenshot({ path: `${out}-m-story.png` });
  // drag up to advance
  const s0 = await st();
  await p.evaluate(() => { const c = document.querySelector('[data-canvas]'); const ev = (t, y) => c.dispatchEvent(new PointerEvent(t, { clientX: 150, clientY: y, pointerId: 1, bubbles: true })); ev('pointerdown', 600); for (let y = 600; y > 300; y -= 20) window.dispatchEvent(new PointerEvent('pointermove', { clientX: 150, clientY: y, pointerId: 1 })); window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 })); });
  await wait(3);
  const s1 = await st();
  ok('mobile story: drag up advances', s1.t > s0.t + 0.05, `${s0.t} -> ${s1.t}`);
  // Start the next step from a known place: how far one drag travels depends on the route length.
  await p.evaluate(() => { const s = window.__pw.game.state; s.t = s.tTarget = 0.3; });
  await wait(0.5);
  await p.tap('[data-next]'); await wait(5);
  if (out) await p.screenshot({ path: `${out}-m-beat.png` });
  await p.tap('[data-open]'); await p.waitForTimeout(700);
  ok('mobile: card opens by tap', await p.isVisible('.pw-card'));
  if (out) await p.screenshot({ path: `${out}-m-card.png` });
  await p.tap('.pw-card .pw-x'); await p.waitForTimeout(400);
  await p.tap('[data-mode="explore"]'); await wait(0.5);
  ok('mobile: joystick + pad visible in explore', (await p.isVisible('[data-joy]')) && (await p.isVisible('[data-pad]')));
  const box = await p.locator('[data-joy]').boundingBox();
  const a = await st();
  await p.evaluate(({ x, y }) => { const j = document.querySelector('[data-joy]'); j.setPointerCapture = () => {}; j.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y - 40, pointerId: 5, bubbles: true })); }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  await wait(2.5);
  const m = await st();
  ok('mobile explore: joystick up accelerates', m.speed > 2.5, `speed ${m.speed}`);
  if (out) await p.screenshot({ path: `${out}-m-explore.png` });
  await p.evaluate(() => document.querySelector('[data-joy]').dispatchEvent(new PointerEvent('pointerup', { pointerId: 5, bubbles: true })));
  await p.tap('[data-hop]'); await wait(0.15);
  ok('mobile explore: hop button', (await st()).air === true);
  const sx = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok('mobile: no horizontal overflow', sx <= 0, `overflow ${sx}`);
  console.log('mobile stats', JSON.stringify(await p.evaluate(() => window.__pw.game.stats())));
  ok('mobile: no errors', errs.length === 0, errs.join('|'));
  await b.close();
}
// ---- night
{
  const { b, p, wait } = await open({ theme: 'dark' });
  for (const t of [0.53, 0.66]) {
    await p.evaluate((t) => { const s = window.__pw.game.state; s.tTarget = t; s.t = t - 0.012; }, t);
    await wait(4);
    if (out) await p.screenshot({ path: `${out}-night-${String(t).replace('.', '')}.png` });
  }
  await b.close();
}
// ---- reduced motion
{
  const { b, p, wait } = await open({ reduced: true, quality: 1 });
  const r = await p.evaluate(() => ({ calm: document.documentElement.classList.contains('is-calm'), checked: document.querySelector('[data-set-motion]').checked, intro: window.__pw.game.state.intro }));
  ok('reduced motion: honoured from the OS setting (no intro swoop, calm on)', r.calm && r.checked && r.intro === 1, JSON.stringify(r));
  await b.close();
}
// ---- no WebGL fallback + plain
for (const q of ['?nowebgl', '?plain']) {
  const { b, p, errs } = await open({ query: q, start: false });
  await p.waitForTimeout(1200);
  const r = await p.evaluate(() => ({ plain: document.documentElement.classList.contains('is-plain'), entries: document.querySelectorAll('.pw-entry').length, err: !document.querySelector('[data-error]').hidden, canvas: getComputedStyle(document.querySelector('[data-canvas]')).display, three: performance.getEntriesByType('resource').some((e) => /game-/.test(e.name)) }));
  ok(`fallback ${q}: plain index with 4 entries, canvas hidden, engine not downloaded`, r.plain && r.entries === 4 && r.canvas === 'none' && !r.three && (q === '?nowebgl') === r.err, JSON.stringify(r));
  if (out) await p.screenshot({ path: `${out}-fallback${q.replace('?', '-')}.png`, fullPage: false });
  ok(`fallback ${q}: no errors`, errs.length === 0, errs.join('|'));
  await b.close();
}
console.log(R.join('\n'));
if (R.some((result) => result.startsWith('FAIL'))) process.exitCode = 1;
