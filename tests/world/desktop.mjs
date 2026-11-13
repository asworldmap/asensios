import { open } from './lib.mjs';
const out = process.argv[2];
const R = [];
const ok = (name, cond, extra = '') => { R.push(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
const { b, p, errs, wait, st } = await open({ quality: 1 });
// --- story: wheel advances
let s0 = await st();
await p.mouse.move(640, 360);
for (let i = 0; i < 12; i++) await p.mouse.wheel(0, 120);
await wait(2.5);
let s1 = await st();
ok('story: wheel advances along route', s1.t > s0.t + 0.03, `t ${s0.t} -> ${s1.t}`);
// keys
await p.keyboard.down('ArrowDown'); await wait(1); await p.keyboard.up('ArrowDown'); await wait(1);
let s2 = await st();
ok('story: ArrowDown key goes back', s2.t < s1.t, `t ${s1.t} -> ${s2.t}`);
// next beat
await p.click('[data-next]'); await wait(5);
let s3 = await st();
ok('story: next-beat button reaches BeeMoney', Math.abs(s3.t - 0.335) < 0.01 && s3.near === 'beemoney', JSON.stringify(s3));
ok('story: caption shows verified title', (await p.textContent('[data-cap-title]')).includes('Si algo es complejo'));
// card
await p.keyboard.press('Enter'); await p.waitForTimeout(600);
ok('card: opens with Enter', await p.isVisible('.pw-card'));
ok('card: has photo + title', (await p.getAttribute('[data-card-img]', 'src')) === '/media/beemoney-byg-stage.webp');
await p.screenshot({ path: `${out}-card.png` });
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
ok('card: closes with Escape', !(await p.isVisible('.pw-card')));
// --- explore
await p.keyboard.press('KeyE'); await wait(0.3);
ok('mode: E switches to explore', (await st()).mode === 'explore');
const a = await st();
await p.keyboard.down('KeyW'); await wait(2.5);
const m = await st();
ok('explore: W accelerates', m.speed > 3, `speed ${m.speed}`);
await p.keyboard.down('KeyA'); await wait(1.2); await p.keyboard.up('KeyA');
const m2 = await st();
ok('explore: A steers left (yaw increases)', m2.yaw > m.yaw + 0.3, `yaw ${m.yaw} -> ${m2.yaw}`);
await p.screenshot({ path: `${out}-explore.png` });
await p.keyboard.press('Space'); await wait(0.2);
ok('explore: Space hops', (await st()).air === true);
await p.keyboard.up('KeyW'); await wait(1);
// collision: aim at a lemon tree
const hit = await p.evaluate(() => {
  const g = window.__pw.game, s = g.state, w = g.world;
  const c = w.colliders.find((c) => c.tree && Math.hypot(c.x - s.x, c.z - s.z) < 40 && w.nearest(c.x, c.z).d > 6);
  s.x = c.x - 6; s.z = c.z; s.y = w.groundAt(s.x, s.z).y; s.yaw = Math.PI / 2; s.speed = 0; s.airborne = false;
  return { x: c.x, z: c.z, r: c.r };
});
await p.keyboard.down('KeyW'); await wait(2.2); await p.keyboard.up('KeyW');
const h = await st();
ok('collision: bike stops at tree, not inside it', Math.hypot(h.x - hit.x, h.z - hit.z) >= hit.r + 0.4, `dist ${Math.hypot(h.x - hit.x, h.z - hit.z).toFixed(2)} r ${hit.r}`);
// lemon collect: wait for it to fall, then ride over
await wait(1.5);
const lem = await p.evaluate(() => { const g = window.__pw.game; const s = g.state; let found = null; g.world.group.traverse((o) => { if (o.visible && o.isMesh && o.geometry.parameters && o.geometry.parameters.radius === 0.16 && !found) found = [o.position.x, o.position.z]; }); if (found) { s.x = found[0] - 2; s.z = found[1]; s.yaw = Math.PI / 2; s.speed = 0; } return found; });
ok('secret: bumping a lemon tree drops a lemon', !!lem);
if (lem) { await p.keyboard.down('KeyW'); await wait(1.6); await p.keyboard.up('KeyW'); ok('secret: lemon collected into basket', (await st()).lemons >= 1, `lemons ${(await st()).lemons}`); }
await p.screenshot({ path: `${out}-lemon.png` });
// water -> respawn
await p.evaluate(() => { const g = window.__pw.game, s = g.state; s.x = 30; s.z = g.world.river(30) + 9; s.yaw = Math.PI; s.speed = 0; s.y = g.world.groundAt(s.x, s.z).y; });
await p.keyboard.down('KeyW'); await wait(4); await p.keyboard.up('KeyW'); await wait(1.5);
const wtr = await st();
const onRoad = await p.evaluate(() => { const g = window.__pw.game; return g.world.nearest(g.state.x, g.state.z).d; });
ok('recovery: riding into the river respawns on the road', onRoad < 2.5, `routeD ${onRoad.toFixed(2)} at ${JSON.stringify(wtr)}`);
// POI proximity in explore + playroom
await p.evaluate(() => window.__pw.game.travel('mwy')); await wait(2);
const nr = await st();
ok('explore: fast travel + proximity prompt near MWY', nr.near === 'mwy' || nr.near === 'playroom', JSON.stringify(nr));
await p.screenshot({ path: `${out}-plaza.png` });
// menu
await p.keyboard.press('KeyM'); await p.waitForTimeout(700);
ok('menu: opens with M', await p.isVisible('.pw-menu'));
await p.screenshot({ path: `${out}-menu.png` });
await p.click('.pw-travel li:nth-child(6) button'); await wait(2);
ok('menu: fast travel to EU office', Math.abs((await st()).t - 0.8) < 0.03, JSON.stringify(await st()));
// return to route + back to story
await p.keyboard.press('KeyE'); await wait(2);
ok('mode: back to story from explore', (await st()).mode === 'story');
// language
await p.click('[data-lang-toggle]'); await p.waitForTimeout(300);
ok('i18n: HUD switches to English', (await p.textContent('[data-mode="story"]')).includes('Story'));
await p.click('[data-lang-toggle]');
ok('no console/page errors', errs.length === 0, errs.join(' | '));
console.log(R.join('\n'));
await b.close();
