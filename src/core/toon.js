import * as THREE from 'three';

let ramp = null;

// 4-step lighting ramp shared by every toon material.
export function toonRamp() {
  if (!ramp) {
    const data = new Uint8Array([70, 135, 205, 255]);
    ramp = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
    ramp.minFilter = THREE.NearestFilter;
    ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;
  }
  return ramp;
}

// For raw ShaderMaterials (no colorspace_fragment chunk): keep the hex values
// untouched instead of letting ColorManagement convert them to linear.
export function rawColor(hex) {
  return new THREE.Color().setHex(
    typeof hex === 'string' ? parseInt(hex.replace('#', ''), 16) : hex,
    THREE.LinearSRGBColorSpace
  );
}

const matCache = new Map();

export function toonMat(color, opts = {}) {
  const key = typeof color === 'number' && Object.keys(opts).length === 0 ? color : null;
  if (key !== null && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonRamp(), ...opts });
  if (key !== null) matCache.set(key, m);
  return m;
}

// Shared inverted-hull outline material: pushes vertices out along their
// normals so the silhouette reads as an ink line.
const outlineMat = new THREE.ShaderMaterial({
  uniforms: { uWidth: { value: 0.07 } },
  vertexShader: /* glsl */ `
    uniform float uWidth;
    void main() {
      vec3 p = position + normal * uWidth;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    void main() { gl_FragColor = vec4(0.09, 0.055, 0.03, 1.0); }
  `,
  side: THREE.BackSide,
});

export function addOutline(mesh) {
  const o = new THREE.Mesh(mesh.geometry, outlineMat);
  o.raycast = () => {};
  mesh.add(o);
  return o;
}
