// The validator must reject what the contract forbids. No browser, no Blender.
//   node tests/world/validate.test.mjs
import fs from 'node:fs';
import { validateGlb, readGlb } from '../../tools/world/validate.mjs';

const src = fs.readFileSync(new URL('../../public/world/assets/maritime/cargo_crate.glb', import.meta.url));

/** Rebuild a GLB with an edited JSON chunk. */
function mutate(edit) {
  const { json, bin } = readGlb(src);
  edit(json);
  let j = Buffer.from(JSON.stringify(json));
  j = Buffer.concat([j, Buffer.alloc((4 - (j.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + j.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(j.length, 0);
  jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(bin.length, 0);
  bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, jh, j, bh, bin]);
}

const opts = { id: 'cargo_crate', pack: 'maritime', assetClass: 'batched' };
const cases = [
  ['the untouched asset passes', (g) => g, 0],
  ['a material outside the surface library', (g) => (g.materials[0].name = 'Material.001'), 'surface library'],
  ['a batched asset without vertex colours', (g) => g.meshes.forEach((m) => m.primitives.forEach((p) => delete p.attributes.COLOR_0)), 'COLOR_0 missing'],
  ['a scaled node', (g) => (g.nodes.find((n) => n.mesh != null).scale = [2, 2, 2]), 'apply scale'],
  ['a root that is not the asset id', (g) => (g.nodes[g.scenes[0].nodes[0]].name = 'Cube'), 'root node is named'],
  ['a collider without a radius', (g) => delete g.nodes.find((n) => n.name.startsWith('COL_')).extras.ptw_radius, 'ptw_radius'],
  ['an animated part in a batched asset', (g) => g.nodes.push({ name: 'PART_door' }), 'only meaningful in hero'],
  ['a wrong contract version', (g) => (g.nodes[g.scenes[0].nodes[0]].extras.ptw_contract = 9), 'ptw_contract'],
  ['a blended material', (g) => (g.materials[0].alphaMode = 'BLEND'), 'alphaMode'],
];

let failed = 0;
for (const [name, edit, expect] of cases) {
  const r = validateGlb(mutate(edit), opts);
  const good = expect === 0 ? r.errors.length === 0 : r.errors.some((e) => e.includes(expect));
  if (!good) failed++;
  console.log(`${good ? 'PASS' : 'FAIL'}  validator: ${name}${good ? '' : ` -> ${JSON.stringify(r.errors)}`}`);
}
process.exit(failed ? 1 : 0);
