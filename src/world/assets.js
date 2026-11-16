// Asset library — the only place the engine touches .glb files.
//
// Assets are authored in Blender against docs/world/ASSET_CONTRACT.md and
// listed in /world/assets/manifest.json. Two classes exist:
//
//   batched  vertex-painted, no textures. The engine merges ("stamps") them
//            into the chapter's static batches, so a hundred trees cost the
//            same number of draw calls as one. Colour, baked ambient
//            occlusion and wind weight all arrive in COLOR_0.
//   hero     kept as its own scene graph with named PART_* nodes the engine
//            animates (vehicles, characters).
//
// Chapters never parse glTF themselves: they ask for an asset by id and get
// geometry, colliders and anchors already converted to game space.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = '/world/assets/';

/** Which chapter batch a surface is merged into. */
export const SURFACE_BATCH = { foliage: 'veg', window: 'window', glow: 'glow' };

export function createAssets() {
  const loader = new GLTFLoader();
  const cache = new Map();
  let manifest = null;
  let bytes = 0;

  async function ready() {
    if (manifest) return manifest;
    const res = await fetch(`${BASE}manifest.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`asset manifest: HTTP ${res.status}`);
    manifest = await res.json();
    return manifest;
  }

  function prepare(key, entry, gltf) {
    const root = gltf.scene.children.length === 1 ? gltf.scene.children[0] : gltf.scene;
    gltf.scene.updateMatrixWorld(true);
    const tpl = { key, entry, cls: entry.class, parts: [], colliders: [], anchors: [], scene: null, nodes: {} };

    gltf.scene.traverse((o) => {
      const name = o.name || '';
      const x = o.userData || {};
      if (name.startsWith('COL_')) {
        // Collider props are written in Blender asset space: game (x, z) = (x, -y).
        if (x.ptw_collider === 'segment') tpl.colliders.push({ type: 'segment', ax: x.ptw_a[0], az: -x.ptw_a[1], bx: x.ptw_b[0], bz: -x.ptw_b[1], r: x.ptw_radius });
        else {
          const p = o.getWorldPosition(new THREE.Vector3());
          tpl.colliders.push({ type: 'circle', x: p.x, z: p.z, r: x.ptw_radius });
        }
      } else if (name.startsWith('ANCHOR_')) {
        const p = o.getWorldPosition(new THREE.Vector3());
        tpl.anchors.push({ name: name.slice(7), x: p.x, y: p.y, z: p.z, kind: x.ptw_kind || null });
      } else if (name.startsWith('PART_')) tpl.nodes[name.slice(5)] = o;
    });

    if (entry.class === 'batched') {
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
        const surface = (o.material.name || 'M_stone').replace(/^M_/, '').replace(/\.\d+$/, '');
        tpl.parts.push({ geometry: g, surface });
        o.geometry.dispose();
        o.material.dispose();
      });
    } else {
      tpl.scene = root;
      root.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        const m = o.material;
        const surface = (m.name || '').replace(/^M_/, '').replace(/\.\d+$/, '');
        // One lighting model for the whole world: Lambert, like the batches.
        const lm =
          surface === 'glow'
            ? new THREE.MeshBasicMaterial({ color: m.emissive?.getHex() ? m.emissive : m.color, name: m.name })
            : new THREE.MeshLambertMaterial({ color: m.color, map: m.map || null, vertexColors: !!o.geometry.attributes.color, name: m.name });
        o.material = lm;
        m.dispose();
        o.userData.surface = surface;
      });
    }
    return tpl;
  }

  /** Load a set of assets ("pack/id"). Resolves when all are ready to stamp. */
  async function load(keys, onProgress) {
    const man = await ready();
    let done = 0;
    await Promise.all(
      keys.map(async (key) => {
        if (!cache.has(key)) {
          const entry = man.assets[key];
          if (!entry) throw new Error(`asset "${key}" is not in the manifest`);
          cache.set(
            key,
            loader.loadAsync(BASE + entry.file).then((gltf) => {
              bytes += entry.bytes;
              return prepare(key, entry, gltf);
            })
          );
        }
        const t = await cache.get(key);
        cache.set(key, t);
        onProgress?.(++done / keys.length);
      })
    );
  }

  function get(key) {
    const t = cache.get(key);
    if (!t || typeof t.then === 'function') throw new Error(`asset "${key}" was not loaded before use`);
    return t;
  }

  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();

  /**
   * Merge a batched asset into a chapter's batches at a transform.
   * @param batches { static, veg, window, glow } — Batch instances
   * @returns { colliders, anchors } in world space
   */
  function stamp(key, batches, matrix, { tint } = {}) {
    const t = get(key);
    for (const p of t.parts) {
      const b = batches[SURFACE_BATCH[p.surface] || 'static'];
      b.addGeometry(p.geometry, matrix, tint);
    }
    const sx = _a.setFromMatrixColumn(matrix, 0).length();
    const colliders = t.colliders.map((c) => {
      if (c.type === 'segment') {
        _a.set(c.ax, 0, c.az).applyMatrix4(matrix);
        _b.set(c.bx, 0, c.bz).applyMatrix4(matrix);
        return { type: 'segment', ax: _a.x, az: _a.z, bx: _b.x, bz: _b.z, r: c.r * sx, x: (_a.x + _b.x) / 2, z: (_a.z + _b.z) / 2 };
      }
      _a.set(c.x, 0, c.z).applyMatrix4(matrix);
      return { type: 'circle', x: _a.x, z: _a.z, r: c.r * sx };
    });
    const anchors = t.anchors.map((a) => {
      _a.set(a.x, a.y, a.z).applyMatrix4(matrix);
      return { name: a.name, kind: a.kind, x: _a.x, y: _a.y, z: _a.z };
    });
    return { colliders, anchors };
  }

  /** A fresh instance of a hero asset: { scene, nodes } with its own node refs. */
  function instance(key) {
    const t = get(key);
    const scene = t.scene.clone(true);
    const nodes = {};
    scene.traverse((o) => {
      if (o.name.startsWith('PART_')) nodes[o.name.slice(5)] = o;
    });
    return { scene, nodes, entry: t.entry };
  }

  function dispose() {
    for (const t of cache.values()) {
      if (!t || typeof t.then === 'function') continue;
      t.parts.forEach((p) => p.geometry.dispose());
      t.scene?.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          o.material.map?.dispose();
          o.material.dispose();
        }
      });
    }
    cache.clear();
  }

  return {
    ready, load, get, stamp, instance, dispose,
    get bytes() {
      return bytes;
    },
    get loaded() {
      return [...cache.keys()];
    },
  };
}
