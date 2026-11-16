// Light and air for a chapter: sky, sun or moon, hemisphere fill, fog, and the
// day ↔ night blend. A chapter passes two palettes; everything in between is
// interpolated here, so a theme change is a two-second dusk, not a switch.

import * as THREE from 'three';
import { damp } from './kit.js';
import { createSky } from './shading.js';

export const DEFAULT_PALETTE = {
  day: {
    skyTop: '#86b6c2', skyMid: '#d6dccb', skyHorizon: '#e5d6bb', fog: '#e3d5bc', glow: '#fff0c8', glowPower: 0.62,
    sun: '#ffe9c4', sunI: 2.55, hemiSky: '#e9eee6', hemiGround: '#a98f63', hemiI: 1.18,
    sunDir: [-0.52, 0.56, 0.64], fogNear: 48, fogFar: 150, orb: '#fff6dc', orbSize: 1,
  },
  night: {
    skyTop: '#050908', skyMid: '#0d1a16', skyHorizon: '#16261e', fog: '#0c130f', glow: '#9fc4c0', glowPower: 0.3,
    sun: '#9ab9d6', sunI: 0.82, hemiSky: '#38565f', hemiGround: '#0f150f', hemiI: 0.9,
    sunDir: [0.46, 0.66, -0.6], fogNear: 34, fogFar: 135, orb: '#e9f2e4', orbSize: 0.55,
  },
};

const COLOR_KEYS = ['skyTop', 'skyMid', 'skyHorizon', 'fog', 'glow', 'sun', 'hemiSky', 'hemiGround', 'orb'];
const NUM_KEYS = ['glowPower', 'sunI', 'hemiI', 'fogNear', 'fogFar', 'orbSize'];

export function createAtmosphere(scene, palette = DEFAULT_PALETTE) {
  const group = new THREE.Group();
  scene.add(group);
  const sky = createSky();
  group.add(sky.mesh);

  const hemi = new THREE.HemisphereLight('#ffffff', '#888888', 1);
  const sun = new THREE.DirectionalLight('#ffffff', 2);
  group.add(hemi, sun, sun.target);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -30;
  sun.shadow.camera.right = sun.shadow.camera.top = 30;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 170;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  sun.shadow.radius = 2.2;

  const fog = new THREE.Fog('#ffffff', 50, 150);
  scene.fog = fog;
  scene.background = new THREE.Color();

  const orbMat = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false });
  const orb = new THREE.Mesh(new THREE.CircleGeometry(9, 28), orbMat);
  group.add(orb);

  const parsed = {};
  for (const mode of ['day', 'night']) {
    parsed[mode] = {};
    for (const k of COLOR_KEYS) parsed[mode][k] = new THREE.Color(palette[mode][k]);
    parsed[mode].sunDir = new THREE.Vector3(...palette[mode].sunDir).normalize();
  }
  const now = {};
  for (const k of COLOR_KEYS) now[k] = new THREE.Color();
  const sunDir = new THREE.Vector3();
  const listeners = [];
  let target = 0;
  let k = -1;

  function apply(v) {
    k = v;
    // Dusk dips through a dimmer, warmer middle instead of a straight cross-fade.
    const dip = 1 - Math.sin(v * Math.PI) * 0.22;
    for (const key of COLOR_KEYS) now[key].lerpColors(parsed.day[key], parsed.night[key], v);
    const num = (key) => palette.day[key] + (palette.night[key] - palette.day[key]) * v;
    sky.uniforms.top.value.copy(now.skyTop);
    sky.uniforms.mid.value.copy(now.skyMid);
    sky.uniforms.horizon.value.copy(now.skyHorizon);
    sky.uniforms.glow.value.copy(now.glow);
    sky.uniforms.glowPower.value = num('glowPower');
    fog.color.copy(now.fog);
    fog.near = num('fogNear');
    fog.far = num('fogFar');
    scene.background.copy(now.fog);
    sun.color.copy(now.sun);
    sun.intensity = num('sunI') * dip;
    hemi.color.copy(now.hemiSky);
    hemi.groundColor.copy(now.hemiGround);
    hemi.intensity = num('hemiI') * dip;
    // The light source sets below one horizon and rises on the other.
    sunDir.copy(v < 0.5 ? parsed.day.sunDir : parsed.night.sunDir);
    const lift = v < 0.5 ? 1 - v * 2 : v * 2 - 1;
    sunDir.y *= 0.25 + 0.75 * lift;
    sunDir.normalize();
    sky.uniforms.sunDir.value.copy(sunDir);
    orbMat.color.copy(now.orb);
    orb.scale.setScalar(num('orbSize'));
    void NUM_KEYS;
    listeners.forEach((fn) => fn(v));
  }

  return {
    group, sun, hemi, fog, sunDir,
    /** Register chapter materials that follow the blend: fn(k) with k 0 = day, 1 = night. */
    onBlend(fn) {
      listeners.push(fn);
      if (k >= 0) fn(k);
    },
    setTheme(dark, instant = false) {
      target = dark ? 1 : 0;
      if (instant || k < 0) apply(target);
    },
    get dark() {
      return target === 1;
    },
    get blend() {
      return k;
    },
    update(dt, focus, calm) {
      if (k !== target) {
        const v = calm ? target : damp(k, target, 1.9, dt);
        apply(Math.abs(v - target) < 0.004 ? target : v);
      }
      sky.mesh.position.set(focus.x, 0, focus.z);
      orb.position.set(focus.x + sunDir.x * 380, Math.max(18, sunDir.y * 380), focus.z + sunDir.z * 380);
      orb.lookAt(focus.x, 0, focus.z);
      sun.position.set(focus.x + sunDir.x * 70, focus.y + sunDir.y * 70, focus.z + sunDir.z * 70);
      sun.target.position.set(focus.x, focus.y, focus.z);
    },
    dispose() {
      scene.remove(group);
      scene.fog = null;
      sky.mesh.geometry.dispose();
      sky.mesh.material.dispose();
      orb.geometry.dispose();
      orbMat.dispose();
      if (sun.shadow.map) sun.shadow.map.dispose();
    },
  };
}
