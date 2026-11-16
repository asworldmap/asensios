// The look of the world, in one place.
//
// Everything static is vertex-painted Lambert. On top of that this module adds
// three cheap things that take it from "flat low-poly" to hand-finished:
//
//   breakup      a world-space noise multiply, so plaster, stone and earth are
//                never one flat colour (no UVs, no per-asset textures)
//   wind         per-vertex sway for foliage (weight comes from the asset)
//   see-through  screen-door cut-away of anything between the camera and the
//                rider, so trees never hide the vehicle in Explore
//
// plus the water and sky shaders. All of it runs on WebGL1-class hardware.

import * as THREE from 'three';

/** Tiling value-noise texture (two octaves in R and G), built once. */
function noiseTexture(size = 128) {
  const data = new Uint8Array(size * size * 4);
  const grid = (cells, seed) => {
    const g = new Float32Array(cells * cells);
    let a = seed;
    for (let i = 0; i < g.length; i++) {
      a = (a * 1664525 + 1013904223) >>> 0;
      g[i] = a / 4294967296;
    }
    return (u, v) => {
      const x = u * cells;
      const y = v * cells;
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const fx = x - ix;
      const fy = y - iy;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const at = (i, j) => g[((j + cells) % cells) * cells + ((i + cells) % cells)];
      return (at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy;
    };
  };
  const a8 = grid(8, 11);
  const a16 = grid(16, 23);
  const a32 = grid(32, 37);
  const b24 = grid(24, 51);
  const b48 = grid(48, 77);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const i = (y * size + x) * 4;
      data[i] = 255 * (a8(u, v) * 0.5 + a16(u, v) * 0.3 + a32(u, v) * 0.2);
      data[i + 1] = 255 * (b24(u, v) * 0.6 + b48(u, v) * 0.4);
      data[i + 2] = 255 * a32(u, v);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** Uniforms shared by every enhanced material; the engine updates them once a frame. */
export function createShared() {
  return {
    uTime: { value: 0 },
    uNoise: { value: noiseTexture() },
    uFocus: { value: new THREE.Vector3() }, // the rider
    uSee: { value: 0 }, // 0 = off (Story), 1 = on (Explore)
    dispose() {
      this.uNoise.value.dispose();
    },
  };
}

const SEE = `
  if (uSee > 0.001) {
    vec3 toF = uFocus - cameraPosition;
    float lf = length(toF);
    vec3 dir = toF / lf;
    vec3 rel = vWp - cameraPosition;
    float along = dot(rel, dir);
    if (along > 0.4 && along < lf - 0.9) {
      float perp = length(rel - dir * along);
      float rad = 0.5 + 1.7 * (along / lf);
      float k = (1.0 - smoothstep(rad * 0.5, rad, perp)) * uSee;
      float d = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      if (d < k * 0.94) discard;
    }
  }
`;

/**
 * Add breakup / wind / see-through / furrows to a built-in material.
 * @param opts { sway, see, breakup (0..1), furrows }
 */
export function enhance(mat, shared, { sway = false, see = false, breakup = 0.22, furrows = false } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.uTime;
    sh.uniforms.uNoise = shared.uNoise;
    sh.uniforms.uFocus = shared.uFocus;
    sh.uniforms.uSee = shared.uSee;
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWp;
         uniform float uTime;
         ${sway ? 'attribute float sway;' : ''}
         ${furrows ? 'attribute float zone; varying float vZone;' : ''}`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         ${
           sway
             ? `float ph = uTime * 1.4 + position.x * 0.31 + position.z * 0.27;
                transformed.x += sin(ph) * 0.085 * sway;
                transformed.z += cos(ph * 0.83) * 0.06 * sway;
                transformed.y += sin(ph * 1.7) * 0.02 * sway;`
             : ''
         }
         ${furrows ? 'vZone = zone;' : ''}
         vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWp;
         uniform sampler2D uNoise;
         uniform vec3 uFocus;
         uniform float uSee;
         ${furrows ? 'varying float vZone;' : ''}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         ${see ? SEE : ''}
         {
           vec2 q = vWp.xz + vWp.y * vec2(0.37, 0.61);
           float n = texture2D(uNoise, q * 0.045).r * 0.6 + texture2D(uNoise, q * 0.31).g * 0.4;
           diffuseColor.rgb *= 1.0 + (n - 0.5) * ${(breakup * 2).toFixed(3)};
           ${
             furrows
               ? `// Ploughed rows between the orchard lines, only where the land is huerta.
                  float row = sin((vWp.x * 0.94 + vWp.z * 0.34) * 2.6);
                  float soil = smoothstep(0.35, 0.95, row) * vZone;
                  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.86, 0.8, 0.7), soil * 0.55);`
               : ''
           }
         }`
      );
  };
  mat.customProgramCacheKey = () => `ptw-${sway}-${see}-${breakup}-${furrows}`;
  return mat;
}

/** River surface: two drifting noise layers, shallow tint and foam at the banks. */
export function createWaterMaterial(shared) {
  const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.93 });
  const colors = { uDeep: { value: new THREE.Color('#3f8f88') }, uShallow: { value: new THREE.Color('#86c3b4') }, uFoam: { value: new THREE.Color('#f3efe0') }, uFlow: { value: 1 } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, colors, { uTime: shared.uTime, uNoise: shared.uNoise });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float shore;\nvarying float vShore;\nvarying vec3 vWp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShore = shore;\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vShore;\nvarying vec3 vWp;\nuniform sampler2D uNoise;\nuniform float uTime;\nuniform float uFlow;\nuniform vec3 uDeep;\nuniform vec3 uShallow;\nuniform vec3 uFoam;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float t = uTime * uFlow;
         float a = texture2D(uNoise, vWp.xz * vec2(0.035, 0.09) + vec2(-t * 0.02, t * 0.004)).r;
         float b = texture2D(uNoise, vWp.xz * vec2(0.11, 0.21) + vec2(-t * 0.035, -t * 0.006)).g;
         float w = a * 0.6 + b * 0.4;
         vec3 c = mix(uDeep, uShallow, clamp(vShore * 0.85 + (w - 0.5) * 0.5, 0.0, 1.0));
         c += uFoam * smoothstep(0.66, 0.72, w) * 0.1;
         float foam = smoothstep(0.62, 0.95, vShore + (b - 0.5) * 0.35 + sin(t * 1.3 + vWp.x * 0.6) * 0.03);
         c = mix(c, uFoam, foam * 0.62);
         diffuseColor.rgb = c;
         diffuseColor.a = mix(0.9, 1.0, foam);`
      );
  };
  mat.userData.colors = colors;
  return mat;
}

/** Sky dome: three-stop gradient with a soft glow around the sun or moon. */
export function createSky() {
  const uniforms = {
    top: { value: new THREE.Color('#8fbcc4') },
    mid: { value: new THREE.Color('#d9dcc6') },
    horizon: { value: new THREE.Color('#e5d6bb') },
    glow: { value: new THREE.Color('#fff1cf') },
    sunDir: { value: new THREE.Vector3(0, 0.3, 1) },
    glowPower: { value: 0.5 },
  };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(400, 24, 14),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 glow; uniform vec3 sunDir; uniform float glowPower;
        varying vec3 vDir;
        void main(){
          float h = vDir.y;
          vec3 c = mix(horizon, mid, smoothstep(0.0, 0.16, h));
          c = mix(c, top, smoothstep(0.1, 0.62, h));
          float s = max(0.0, dot(normalize(vDir), normalize(sunDir)));
          c += glow * (pow(s, 6.0) * 0.28 + pow(s, 90.0) * 0.5) * glowPower * smoothstep(-0.05, 0.12, h);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    })
  );
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}
