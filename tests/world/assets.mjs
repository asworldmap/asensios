// Engine-side asset check: every asset in the manifest must load through the
// real asset library (GLTFLoader + contract handling), hero assets must expose
// the parts their manifest promises, and a second chapter must load and unload
// without leaking GPU objects.
//   node tests/world/assets.mjs
import { open } from './lib.mjs';

const R = [];
const ok = (n, c, x = '') => R.push(`${c ? 'PASS' : 'FAIL'}  ${n} ${x}`);
const { b, p, errs, wait } = await open({ quality: 1 });

const res = await p.evaluate(async () => {
  const g = window.__pw.game;
  const man = await g.assets.ready();
  const keys = Object.keys(man.assets);
  const out = { total: keys.length, failed: [], parts: [] };
  for (const k of keys) {
    try {
      await g.assets.load([k]);
      const t = g.assets.get(k);
      const e = man.assets[k];
      if (e.class === 'hero') {
        const inst = g.assets.instance(k);
        const missing = e.rig.map((r) => r.name.replace('PART_', '')).filter((n) => !inst.nodes[n]);
        let meshes = 0;
        inst.scene.traverse((o) => (meshes += o.isMesh ? 1 : 0));
        if (missing.length || !meshes) out.parts.push(`${k}: missing ${missing.join(',')} meshes ${meshes}`);
      } else if (!t.parts.length || t.parts.some((q) => !q.geometry.attributes.color)) out.failed.push(`${k}: no painted geometry`);
      if (t.colliders.length !== e.colliders) out.failed.push(`${k}: ${t.colliders.length} colliders, manifest says ${e.colliders}`);
    } catch (err) {
      out.failed.push(`${k}: ${err.message}`);
    }
  }
  return out;
});
ok(`all ${res.total} assets load through the engine's asset library`, res.failed.length === 0, res.failed.join(' | '));
ok('hero assets expose every PART_ node listed in their manifest rig', res.parts.length === 0, res.parts.join(' | '));

// Chapter swap: Murcia -> rail lab -> Murcia, watching GPU object counts.
const before = await p.evaluate(() => window.__pw.game.stats());
await p.evaluate(() => window.__pw.game.loadChapter('lab-rail'));
await p.waitForFunction(() => window.__pw.game.chapter === 'lab-rail' && window.__pw.game.world, null, { timeout: 120000 });
await wait(2);
const lab = await p.evaluate(() => ({ s: window.__pw.game.stats(), v: window.__pw.game.vehicle.id, rails: window.__pw.game.vehicle.onRails }));
ok('second chapter loads with a different vehicle (train, on rails)', lab.v === 'train' && lab.rails === true, JSON.stringify(lab.s));
await p.keyboard.press('KeyE');
await p.keyboard.down('KeyW');
await wait(3);
await p.keyboard.up('KeyW');
const run = await p.evaluate(() => ({ speed: window.__pw.game.state.speed, d: window.__pw.game.world.nearest(window.__pw.game.state.x, window.__pw.game.state.z).d }));
ok('train accelerates and stays on its route', run.speed > 2 && run.d < 0.05, JSON.stringify(run));
if (process.argv[2]) await p.screenshot({ path: `${process.argv[2]}-lab.png` });
await p.evaluate(() => window.__pw.game.loadChapter('murcia'));
await p.waitForFunction(() => window.__pw.game.chapter === 'murcia' && window.__pw.game.world, null, { timeout: 120000 });
await wait(2);
const after = await p.evaluate(() => window.__pw.game.stats());
ok('returning to Murcia does not leak geometries or textures', after.geometries <= before.geometries + 2 && after.textures <= before.textures + 2, `geometries ${before.geometries} -> ${after.geometries}, textures ${before.textures} -> ${after.textures}`);
ok('no console or page errors', errs.length === 0, errs.join(' | '));
console.log(R.join('\n'));
await b.close();
if (R.some((result) => result.startsWith('FAIL'))) process.exitCode = 1;
