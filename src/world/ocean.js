import * as THREE from 'three';
import { wavesGLSL, AMP_TOTAL } from './waves.js';
import { rawColor } from '../core/toon.js';

const SIZE = 2200;
const SEGMENTS = 220;
const GRID = SIZE / SEGMENTS;

export function createOcean(scene, fogColor, fogNear, fogFar) {
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAmp: { value: AMP_TOTAL },
      uDeep: { value: rawColor('#0f6b8e') },
      uMid: { value: rawColor('#1fa0bd') },
      uLight: { value: rawColor('#40cfd8') },
      uFoam: { value: rawColor('#eafcff') },
      uFogColor: { value: rawColor(fogColor) },
      uFogNear: { value: fogNear },
      uFogFar: { value: fogFar },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying float vH;
      varying vec2 vWorld;
      varying float vViewZ;
      ${wavesGLSL()}
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float h = waveH(wp.xz, uTime);
        wp.y += h;
        vH = h;
        vWorld = wp.xz;
        vec4 mv = viewMatrix * wp;
        vViewZ = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAmp;
      uniform float uTime;
      uniform vec3 uDeep, uMid, uLight, uFoam, uFogColor;
      uniform float uFogNear, uFogFar;
      varying float vH;
      varying vec2 vWorld;
      varying float vViewZ;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        float hn = clamp(vH / uAmp * 0.5 + 0.5, 0.0, 1.0);

        // flat cel bands by swell height
        vec3 col = uDeep;
        col = mix(col, uMid, step(0.42, hn));
        col = mix(col, uLight, step(0.66, hn));

        // whitecaps on the highest crests
        col = mix(col, uFoam, step(0.88, hn) * 0.85);

        // drifting sparkle flecks
        vec2 cell = floor(vWorld * 0.7 + vec2(uTime * 0.6, uTime * 0.22));
        float r = hash(cell);
        if (r > 0.965 && hn > 0.55) col = mix(col, uFoam, 0.75);

        // fade to horizon
        float f = smoothstep(uFogNear, uFogFar, vViewZ);
        col = mix(col, uFogColor, f);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);

  return {
    mesh,
    update(t, centerX, centerZ) {
      mat.uniforms.uTime.value = t;
      // keep the sheet under the camera, snapped to the vertex grid so the
      // surface doesn't swim as it re-centers
      mesh.position.x = Math.round(centerX / GRID) * GRID;
      mesh.position.z = Math.round(centerZ / GRID) * GRID;
    },
  };
}
