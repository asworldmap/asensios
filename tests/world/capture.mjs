// Equivalent-camera captures for before/after comparison.
//   node tests/world/capture.mjs <output-prefix>
// Same viewport, same quality tier, same route positions every time, so two
// runs on two builds can be laid side by side.
import fs from 'node:fs';
import { open } from './lib.mjs';

const out = process.argv[2];
const report = {};

{
  const { b, p, wait } = await open({});
  await wait(3);
  await p.screenshot({ path: `${out}-start.png` });
  const stops = { divulgalo: 0.145, orchard: 0.24, beemoney: 0.335, bridge: 0.53, plaza: 0.66, office: 0.815, mirador: 1 };
  for (const [name, t] of Object.entries(stops)) {
    await p.evaluate((t) => {
      const s = window.__pw.game.state;
      s.tTarget = t;
      s.t = Math.max(0, t - 0.012);
    }, t);
    await wait(4.5);
    await p.screenshot({ path: `${out}-${name}.png` });
  }
  // Explore: a fixed pose inside the orchard, where trees used to hide the bike.
  await p.keyboard.press('KeyE');
  await p.evaluate(() => {
    const g = window.__pw.game;
    const s = g.state;
    const c = g.world.pointAt(0.3);
    s.x = c.x + c.tz * 9;
    s.z = c.z - c.tx * 9;
    s.y = g.world.groundAt(s.x, s.z).y;
    s.yaw = Math.atan2(c.tx, c.tz) + 0.5;
    s.speed = 0;
  });
  await wait(3);
  await p.screenshot({ path: `${out}-explore-orchard.png` });
  report.desktop = await p.evaluate(() => ({ stats: window.__pw.game.stats(), heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, loadMs: window.__pw.loadMs }));
  await b.close();
}
{
  const { b, p, wait } = await open({ theme: 'dark' });
  for (const [name, t] of Object.entries({ bridge: 0.53, plaza: 0.66 })) {
    await p.evaluate((t) => {
      const s = window.__pw.game.state;
      s.tTarget = t;
      s.t = t - 0.012;
    }, t);
    await wait(4.5);
    await p.screenshot({ path: `${out}-night-${name}.png` });
  }
  await b.close();
}
{
  const { b, p, wait } = await open({ device: 'iPhone 13', quality: 1 });
  await p.evaluate(() => {
    const s = window.__pw.game.state;
    s.tTarget = 0.335;
    s.t = 0.323;
  });
  await wait(4.5);
  await p.screenshot({ path: `${out}-mobile-story.png` });
  report.mobile = await p.evaluate(() => window.__pw.game.stats());
  await b.close();
}
fs.writeFileSync(`${out}-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
