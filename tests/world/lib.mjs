// Browser checks for Pedal the World. Not part of `npm test` (no Playwright
// dependency in this repo). To run: `npm run build && npm run preview`, then
// with Playwright available: `node tests/world/desktop.mjs <screenshot-prefix>`.
// Waits are measured in game time, so slow software rendering does not flake.
import { chromium, devices } from 'playwright';
export { devices };
export async function open({ viewport = { width: 1280, height: 720 }, theme = 'light', query = '', device = null, reduced = false, quality = 3, start = true } = {}) {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext(device ? { ...devices[device], colorScheme: theme, reducedMotion: reduced ? 'reduce' : 'no-preference' } : { viewport, deviceScaleFactor: 1, colorScheme: theme, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await p.goto('http://localhost:4173/world/' + query, { waitUntil: 'load' });
  if (start) {
    await p.waitForFunction(() => window.__pw, null, { timeout: 90000 });
    if (quality != null) await p.evaluate((q) => window.__pw.game.setQuality(q), quality);
    await p.click('[data-start]');
    await p.waitForFunction(() => window.__pw.game.state.intro >= 1, null, { timeout: 180000 });
  }
  const wait = async (sec) => {
    const t0 = await p.evaluate(() => window.__pw.game.state.time);
    await p.waitForFunction((t) => window.__pw.game.state.time >= t, t0 + sec, { timeout: 300000, polling: 200 });
  };
  const st = () => p.evaluate(() => { const s = window.__pw.game.state; return { mode: s.mode, t: +s.t.toFixed(3), x: +s.x.toFixed(2), y: +s.y.toFixed(2), z: +s.z.toFixed(2), speed: +s.speed.toFixed(2), near: s.near, lemons: s.lemons, air: s.airborne, yaw: +s.yaw.toFixed(2) }; });
  return { b, p, errs, wait, st };
}
