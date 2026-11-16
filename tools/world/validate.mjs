#!/usr/bin/env node
// Asset contract validator — the gate every .glb passes before the game may
// load it. Zero dependencies: it reads the GLB container directly.
//
//   node tools/world/validate.mjs                 validate every asset in the manifest
//   node tools/world/validate.mjs murcia/lemon_tree
//   node tools/world/validate.mjs --file some.glb --class batched --id crate
//   node tools/world/validate.mjs --json          machine-readable report
//
// Exit code 0 = every asset passes (warnings allowed), 1 = at least one error.
// The rules are docs/world/ASSET_CONTRACT.md, section "Acceptance criteria".

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ASSET_DIR = path.join(REPO, 'public', 'world', 'assets');
const MANIFEST = path.join(ASSET_DIR, 'manifest.json');

export const CONTRACT = 1;
export const SURFACES = ['stone', 'plaster', 'terracotta', 'wood', 'earth', 'foliage', 'metal', 'paint', 'rubber', 'cloth', 'skin', 'window', 'glow', 'glass'];
export const LIMITS = {
  batched: { triangles: 8000, bytes: 450 * 1024, textures: 0, textureSize: 0 },
  hero: { triangles: 20000, bytes: 1536 * 1024, textures: 4, textureSize: 1024 },
};
const ALLOWED_EXT = ['KHR_materials_emissive_strength', 'KHR_mesh_quantization', 'KHR_texture_transform'];
const ID = /^[a-z][a-z0-9_]{1,39}$/;
const COMPONENTS = { VEC2: 2, VEC3: 3, VEC4: 4, SCALAR: 1, MAT4: 16 };

export function readGlb(buf) {
  if (buf.length < 20 || buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB file (bad magic)');
  if (buf.readUInt32LE(4) !== 2) throw new Error('GLB container version must be 2');
  const jsonLen = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error('first GLB chunk is not JSON');
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  let bin = null;
  const off = 20 + jsonLen;
  if (off + 8 <= buf.length && buf.readUInt32LE(off + 4) === 0x004e4942) bin = buf.subarray(off + 8, off + 8 + buf.readUInt32LE(off));
  return { json, bin };
}

function imageSize(bytes, mime) {
  if (mime === 'image/png') return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  if (mime === 'image/jpeg') {
    let i = 2;
    while (i < bytes.length) {
      const m = bytes[i + 1];
      const len = bytes.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [bytes.readUInt16BE(i + 7), bytes.readUInt16BE(i + 5)];
      i += 2 + len;
    }
  }
  if (mime === 'image/webp') {
    const tag = bytes.toString('ascii', 12, 16);
    if (tag === 'VP8X') return [1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3)];
    if (tag === 'VP8 ') return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
    if (tag === 'VP8L') {
      const b = bytes.readUInt32LE(21);
      return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)];
    }
  }
  return null;
}

/**
 * Validate one GLB against the contract.
 * @returns { errors: string[], warnings: string[], info: object }
 */
export function validateGlb(buf, { id, pack, assetClass, triBudget } = {}) {
  const errors = [];
  const warnings = [];
  const info = {};
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);

  let glb;
  try {
    glb = readGlb(buf);
  } catch (e) {
    return { errors: [e.message], warnings, info };
  }
  const g = glb.json;
  const nodes = g.nodes || [];

  if (id && !ID.test(id)) err(`id "${id}" must be lower_snake_case, 2–40 chars, starting with a letter`);
  if (pack && !ID.test(pack)) err(`pack "${pack}" must be lower_snake_case`);
  if (g.asset?.version !== '2.0') err('glTF version must be 2.0');
  if ((g.scenes || []).length !== 1) err(`exactly one scene is required (found ${(g.scenes || []).length})`);
  if (g.cameras?.length) err('cameras must not be exported');
  if (g.extensions?.KHR_lights_punctual || (g.extensionsUsed || []).includes('KHR_lights_punctual')) err('lights must not be exported (use ANCHOR_light_* empties)');
  if (g.skins?.length) err('skinned meshes are not part of contract v1 (animate PART_* nodes instead)');
  for (const e of g.extensionsRequired || []) if (!ALLOWED_EXT.includes(e)) err(`required extension ${e} is not allowed`);
  for (const e of g.extensionsUsed || []) if (!ALLOWED_EXT.includes(e)) warn(`extension ${e} is not in the allowed list and will be ignored by the engine`);
  for (const b of g.buffers || []) if (b.uri) err('external buffers are not allowed: export a single self-contained .glb');
  for (const im of g.images || []) if (im.uri && !im.uri.startsWith('data:')) err(`external image "${im.uri}" is not allowed: textures must be embedded`);

  // --- Root ------------------------------------------------------------
  const roots = g.scenes?.[0]?.nodes || [];
  const root = roots.length === 1 ? nodes[roots[0]] : null;
  if (!root) err(`the scene must have exactly one root node (found ${roots.length})`);
  let cls = assetClass;
  if (root) {
    const x = root.extras || {};
    if (id && root.name !== id) err(`root node is named "${root.name}", expected "${id}"`);
    if (x.ptw_id !== (id ?? x.ptw_id) || !x.ptw_id) err(`root extras.ptw_id must be "${id ?? '<asset id>'}" (found ${JSON.stringify(x.ptw_id)})`);
    if (x.ptw_contract !== CONTRACT) err(`root extras.ptw_contract must be ${CONTRACT} (found ${JSON.stringify(x.ptw_contract)})`);
    if (!LIMITS[x.ptw_class]) err(`root extras.ptw_class must be "batched" or "hero" (found ${JSON.stringify(x.ptw_class)})`);
    if (cls && x.ptw_class && cls !== x.ptw_class) err(`class mismatch: manifest says ${cls}, file says ${x.ptw_class}`);
    cls = cls || x.ptw_class;
    if (root.translation?.some((v) => Math.abs(v) > 1e-5) || root.rotation?.slice(0, 3).some((v) => Math.abs(v) > 1e-5) || root.scale?.some((v) => Math.abs(v - 1) > 1e-5) || root.matrix)
      err('root node must have an identity transform (apply transforms before export)');
  }
  const limit = LIMITS[cls] || LIMITS.batched;
  info.class = cls;

  // --- Nodes -----------------------------------------------------------
  const world = new Map();
  const walk = (i, parentScale, parentPos) => {
    const n = nodes[i];
    const s = n.scale || [1, 1, 1];
    const t = n.translation || [0, 0, 0];
    const pos = [parentPos[0] + t[0], parentPos[1] + t[1], parentPos[2] + t[2]];
    world.set(i, pos);
    if (n.matrix) err(`node "${n.name}" uses a matrix; export translation/rotation/scale`);
    if (s.some((v) => Math.abs(v - 1) > 1e-4)) err(`node "${n.name}" has scale ${JSON.stringify(s)}; apply scale before export`);
    for (const c of n.children || []) walk(c, s, pos);
  };
  if (roots.length === 1) walk(roots[0], [1, 1, 1], [0, 0, 0]);

  info.colliders = 0;
  info.anchors = [];
  info.parts = [];
  for (const n of nodes) {
    const name = n.name || '';
    const x = n.extras || {};
    if (name.startsWith('COL_')) {
      info.colliders++;
      if (n.mesh != null) err(`collider "${name}" must be an empty, not a mesh`);
      if (!['circle', 'segment'].includes(x.ptw_collider)) err(`collider "${name}": extras.ptw_collider must be "circle" or "segment"`);
      if (!(x.ptw_radius > 0 && x.ptw_radius <= 12)) err(`collider "${name}": extras.ptw_radius must be in (0, 12] metres`);
      if (x.ptw_collider === 'segment' && !(Array.isArray(x.ptw_a) && Array.isArray(x.ptw_b) && x.ptw_a.length === 2 && x.ptw_b.length === 2))
        err(`collider "${name}": a segment needs extras.ptw_a and ptw_b as [x, y] in Blender asset space`);
    } else if (name.startsWith('ANCHOR_')) {
      if (!/^ANCHOR_[a-z][a-z0-9_]*$/.test(name)) err(`anchor "${name}" must match ANCHOR_lower_snake_case`);
      if (n.mesh != null) err(`anchor "${name}" must be an empty, not a mesh`);
      info.anchors.push(name.slice(7));
    } else if (name.startsWith('PART_') && n.mesh == null) {
      if (!/^PART_[a-z][a-z0-9_]*$/.test(name)) err(`part "${name}" must match PART_lower_snake_case`);
      if (cls === 'batched') err(`"${name}": PART_ nodes are only meaningful in hero assets (batched assets are merged into one mesh)`);
      if (!x.ptw_role) warn(`part "${name}" has no ptw_role; integrators rely on it`);
      info.parts.push(name.slice(5));
    }
  }

  // --- Materials ---------------------------------------------------------
  info.materials = (g.materials || []).map((m) => m.name);
  for (const m of g.materials || []) {
    const s = (m.name || '').replace(/^M_/, '');
    if (!m.name?.startsWith('M_') || !SURFACES.includes(s)) err(`material "${m.name}" is not in the surface library (M_${SURFACES.join(', M_')})`);
    if (m.alphaMode && m.alphaMode !== 'OPAQUE' && !(s === 'glass' && cls === 'hero' && m.alphaMode === 'BLEND')) err(`material "${m.name}": alphaMode ${m.alphaMode} is not allowed (only M_glass in hero assets may blend)`);
    if (s === 'glass' && cls !== 'hero') err('M_glass is only allowed in hero assets');
    if (m.doubleSided) warn(`material "${m.name}" is double-sided; enable backface culling unless the mesh is a single open sheet`);
    if (cls === 'batched') {
      const p = m.pbrMetallicRoughness || {};
      if (p.baseColorTexture || p.metallicRoughnessTexture || m.normalTexture || m.occlusionTexture || m.emissiveTexture) err(`material "${m.name}": batched assets carry colour in COLOR_0 and may not use textures`);
      if (p.baseColorFactor && p.baseColorFactor.slice(0, 3).some((v) => Math.abs(v - 1) > 0.02)) warn(`material "${m.name}": baseColorFactor is ignored for batched assets; paint COLOR_0 instead`);
    }
  }

  // --- Textures ----------------------------------------------------------
  info.textures = (g.images || []).length;
  if (info.textures > limit.textures) err(`${info.textures} textures, limit for ${cls} is ${limit.textures}`);
  for (const [i, im] of (g.images || []).entries()) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(im.mimeType)) err(`image ${i}: type ${im.mimeType} not allowed (png, jpeg, webp)`);
    if (im.bufferView != null && glb.bin) {
      const bv = g.bufferViews[im.bufferView];
      const size = imageSize(glb.bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength), im.mimeType);
      if (!size) warn(`image ${i}: could not read dimensions`);
      else {
        if (Math.max(...size) > limit.textureSize) err(`image ${i} is ${size[0]}×${size[1]}, limit is ${limit.textureSize}²`);
        if (size.some((v) => v & (v - 1))) warn(`image ${i} is ${size[0]}×${size[1]}; use power-of-two sizes`);
      }
    }
  }

  // --- Geometry ----------------------------------------------------------
  let tris = 0;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  const meshNodes = nodes.map((n, i) => [n, i]).filter(([n]) => n.mesh != null);
  if (!meshNodes.length) err('the asset contains no mesh');
  for (const [n, ni] of meshNodes) {
    const mesh = g.meshes[n.mesh];
    const base = world.get(ni) || [0, 0, 0];
    for (const [pi, p] of mesh.primitives.entries()) {
      const where = `mesh "${mesh.name}" primitive ${pi}`;
      if ((p.mode ?? 4) !== 4) err(`${where}: only triangle lists are allowed`);
      const a = p.attributes || {};
      if (a.POSITION == null) {
        err(`${where}: POSITION missing`);
        continue;
      }
      if (a.NORMAL == null) err(`${where}: NORMAL missing`);
      if (p.material == null) err(`${where}: no material assigned`);
      if (p.targets) err(`${where}: morph targets are not part of contract v1`);
      if (cls === 'batched') {
        if (a.COLOR_0 == null) err(`${where}: COLOR_0 missing — batched assets must be vertex-painted (attribute "Col")`);
        else if (!['VEC3', 'VEC4'].includes(g.accessors[a.COLOR_0].type)) err(`${where}: COLOR_0 must be VEC3 or VEC4`);
        const matName = g.materials?.[p.material]?.name;
        if (matName === 'M_foliage' && a.COLOR_0 != null && g.accessors[a.COLOR_0].type !== 'VEC4') warn(`${where}: foliage without alpha in COLOR_0 will not sway`);
      }
      const pos = g.accessors[a.POSITION];
      const count = p.indices != null ? g.accessors[p.indices].count : pos.count;
      if (count % 3) err(`${where}: index/vertex count is not a multiple of 3`);
      tris += count / 3;
      if (pos.min && pos.max) {
        for (let k = 0; k < 3; k++) {
          lo[k] = Math.min(lo[k], pos.min[k] + base[k]);
          hi[k] = Math.max(hi[k], pos.max[k] + base[k]);
        }
      } else err(`${where}: POSITION accessor has no min/max`);
      void COMPONENTS;
    }
  }
  info.triangles = tris;
  info.bounds = [lo.map((v) => +v.toFixed(3)), hi.map((v) => +v.toFixed(3))];
  info.bytes = buf.length;
  const budget = Math.min(triBudget || limit.triangles, limit.triangles);
  if (tris > budget) err(`${tris} triangles exceeds the budget of ${budget}`);
  if (buf.length > limit.bytes) err(`${(buf.length / 1024).toFixed(0)} kB exceeds the ${cls} file limit of ${limit.bytes / 1024} kB`);
  if (meshNodes.length) {
    const size = hi.map((v, k) => v - lo[k]);
    if (Math.max(...size) > 80) err(`asset is ${Math.max(...size).toFixed(1)} m across; 1 unit must be 1 metre and assets stay under 80 m`);
    if (Math.max(...size) < 0.05) err('asset is smaller than 5 cm; check the unit scale');
    if (Math.max(Math.abs(lo[0] + hi[0]), Math.abs(lo[2] + hi[2])) / 2 > Math.max(size[0], size[2]) * 0.5 + 0.5) warn('the asset sits far from its origin; the origin should be the placement point');
  }
  if (g.animations?.length) {
    if (cls === 'batched') err('batched assets may not contain animations');
    for (const an of g.animations) if (!/^[a-z][a-z0-9_]*$/.test(an.name || '')) err(`animation "${an.name}" must be lower_snake_case`);
  }
  return { errors, warnings, info };
}

function validateEntry(key, entry) {
  const file = path.join(ASSET_DIR, entry.file || '');
  const out = { key, errors: [], warnings: [], info: {} };
  const [pack, id] = key.split('/');
  if (entry.id !== id || entry.pack !== pack) out.errors.push(`manifest key ${key} does not match id/pack ${entry.pack}/${entry.id}`);
  if (entry.file !== `${pack}/${id}.glb`) out.errors.push(`file must be "${pack}/${id}.glb"`);
  if (entry.contract !== CONTRACT) out.errors.push(`manifest contract must be ${CONTRACT}`);
  if (!fs.existsSync(file)) {
    out.errors.push(`missing file public/world/assets/${entry.file}`);
    return out;
  }
  const buf = fs.readFileSync(file);
  const r = validateGlb(buf, { id, pack, assetClass: entry.class, triBudget: entry.tri_budget });
  out.errors.push(...r.errors);
  out.warnings.push(...r.warnings);
  out.info = r.info;
  if (entry.bytes !== buf.length) out.errors.push(`manifest bytes ${entry.bytes} ≠ file size ${buf.length} (rebuild the asset)`);
  if (entry.sha256 !== crypto.createHash('sha256').update(buf).digest('hex')) out.errors.push('manifest sha256 does not match the file (rebuild, never hand-edit the .glb)');
  if (!entry.license) out.errors.push('manifest entry needs a license');
  if (!entry.author || entry.author === 'unknown') out.warnings.push('manifest entry has no author');
  for (const k of ['script', 'blend']) {
    const p = entry.source?.[k];
    if (!p) out.errors.push(`manifest source.${k} missing`);
    else if (!fs.existsSync(path.join(REPO, p))) out.errors.push(`source ${k} not found in the repository: ${p}`);
  }
  if (r.info.triangles != null && entry.triangles !== r.info.triangles) out.warnings.push(`manifest says ${entry.triangles} triangles, file has ${r.info.triangles}`);
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const results = [];
  const fi = argv.indexOf('--file');
  if (fi >= 0) {
    const get = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
    const r = validateGlb(fs.readFileSync(argv[fi + 1]), { id: get('--id'), assetClass: get('--class') });
    results.push({ key: argv[fi + 1], ...r });
  } else {
    if (!fs.existsSync(MANIFEST)) {
      console.error('No manifest at public/world/assets/manifest.json');
      process.exit(1);
    }
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    const want = argv.filter((a) => !a.startsWith('--'));
    for (const [key, entry] of Object.entries(manifest.assets || {})) if (!want.length || want.includes(key)) results.push(validateEntry(key, entry));
    for (const w of want) if (!manifest.assets?.[w]) results.push({ key: w, errors: ['not in the manifest (build it first)'], warnings: [], info: {} });
    // Orphans: a .glb on disk that the manifest does not know about.
    for (const pack of fs.readdirSync(ASSET_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      for (const f of fs.readdirSync(path.join(ASSET_DIR, pack.name))) {
        const key = `${pack.name}/${f.replace(/\.glb$/, '')}`;
        if (f.endsWith('.glb') && !manifest.assets?.[key] && !want.length) results.push({ key, errors: ['file exists but is not in the manifest'], warnings: [], info: {} });
      }
    }
  }
  const failed = results.filter((r) => r.errors.length).length;
  if (json) console.log(JSON.stringify({ ok: !failed, results }, null, 2));
  else {
    for (const r of results) {
      const i = r.info;
      console.log(`${r.errors.length ? 'FAIL' : 'PASS'}  ${r.key}${i.triangles != null ? `  ${i.class} · ${i.triangles} tris · ${(i.bytes / 1024).toFixed(1)} kB · ${i.colliders} colliders · ${i.anchors.length} anchors` : ''}`);
      r.errors.forEach((e) => console.log(`      error: ${e}`));
      r.warnings.forEach((e) => console.log(`      warn:  ${e}`));
    }
    console.log(`\n${results.length - failed}/${results.length} assets pass the contract (v${CONTRACT}).`);
  }
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
