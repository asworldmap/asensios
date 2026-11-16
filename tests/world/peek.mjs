// Quick look at a few route positions while iterating on the art.
//   node tests/world/peek.mjs <prefix> [theme] [t,t,...] [query]
import { open } from './lib.mjs';

const out = process.argv[2];
const theme = process.argv[3] || 'light';
const ts = (process.argv[4] || '0,0.53,0.66').split(',').map(Number);
const { b, p, errs, wait } = await open({ theme, query: process.argv[5] || '' });
for (const t of ts) {
  await p.evaluate((t) => {
    const s = window.__pw.game.state;
    s.tTarget = t;
    s.t = Math.max(0, t - 0.012);
  }, t);
  await wait(4.5);
  await p.screenshot({ path: `${out}-t${String(t).replace('.', '')}.png` });
}
console.log(JSON.stringify(await p.evaluate(() => window.__pw.game.stats())), errs.join('\n'));
await b.close();
