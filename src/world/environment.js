import * as THREE from 'three';
import { toonMat, rawColor } from '../core/toon.js';

export const HORIZON = '#cfeef7';
export const FOG_NEAR = 260;
export const FOG_FAR = 640;

const SUN_DIR = new THREE.Vector3(0.45, 0.62, 0.4).normalize();

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function createSky(scene) {
  const geo = new THREE.SphereGeometry(1500, 24, 14);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: rawColor('#47a8dc') },
      uHorizon: { value: rawColor(HORIZON) },
      uSunDir: { value: SUN_DIR.clone() },
      uSunColor: { value: rawColor('#fff3cf') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith, uHorizon, uSunDir, uSunColor;
      varying vec3 vDir;
      void main() {
        float up = pow(max(vDir.y, 0.0), 0.6);
        vec3 col = mix(uHorizon, uZenith, up);
        float sun = dot(normalize(vDir), uSunDir);
        col = mix(col, uSunColor, smoothstep(0.9985, 0.9993, sun));       // disc
        col += uSunColor * smoothstep(0.955, 0.9985, sun) * 0.25;        // halo
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}

function createClouds(scene) {
  const group = new THREE.Group();
  const mat = toonMat(0xffffff);
  const geo = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Group();
    const blobs = 3 + Math.floor(Math.random() * 3);
    for (let b = 0; b < blobs; b++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(rand(-14, 14), rand(-2, 2), rand(-6, 6));
      m.scale.set(rand(8, 16), rand(3, 5), rand(6, 10));
      m.rotation.y = rand(0, Math.PI);
      cloud.add(m);
    }
    const a = rand(0, Math.PI * 2);
    cloud.position.set(Math.cos(a) * rand(150, 950), rand(80, 150), Math.sin(a) * rand(150, 950));
    cloud.userData.speed = rand(1.2, 2.6);
    group.add(cloud);
  }
  scene.add(group);
  return group;
}

function createIsland(x, z, r) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const sand = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 1.18, 3.2, 18), toonMat(0xe8d29a));
  sand.position.y = 0.4;
  g.add(sand);

  const hill = new THREE.Mesh(
    new THREE.SphereGeometry(r * 0.72, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    toonMat(0x4d9e4f)
  );
  hill.scale.y = 0.55;
  hill.position.y = 1.8;
  g.add(hill);

  if (r > 40) {
    const peak = new THREE.Mesh(new THREE.ConeGeometry(r * 0.32, r * 0.5, 9), toonMat(0x7a8577));
    peak.position.y = r * 0.36;
    g.add(peak);
  }

  const trunkMat = toonMat(0x8a6437);
  const leafMat = toonMat(0x2f8d3a);
  const palms = 2 + Math.floor(Math.random() * 3);
  for (let p = 0; p < palms; p++) {
    const a = rand(0, Math.PI * 2);
    const d = r * rand(0.72, 0.92);
    const palm = new THREE.Group();
    const h = rand(6, 10);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, h, 6), trunkMat);
    trunk.position.y = h / 2;
    trunk.rotation.z = rand(-0.18, 0.18);
    palm.add(trunk);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2.0, 6), leafMat);
    canopy.position.set(trunk.rotation.z * -h * 0.5, h + 0.6, 0);
    canopy.scale.y = 0.7;
    palm.add(canopy);
    palm.position.set(Math.cos(a) * d, 1.6, Math.sin(a) * d);
    g.add(palm);
  }
  return g;
}

export function createEnvironment(scene) {
  scene.fog = new THREE.Fog(new THREE.Color(HORIZON), FOG_NEAR, FOG_FAR);

  const sun = new THREE.DirectionalLight(0xfff2d0, 2.4);
  sun.position.copy(SUN_DIR).multiplyScalar(400);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xcdeef8, 0x1b6e8a, 1.1));

  const sky = createSky(scene);
  const clouds = createClouds(scene);

  // islands: scattered, none too close to the player spawn at the origin
  const islands = [];
  const group = new THREE.Group();
  let guard = 0;
  while (islands.length < 8 && guard++ < 200) {
    const a = rand(0, Math.PI * 2);
    const d = rand(180, 780);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const r = rand(26, 62);
    if (islands.some((i) => Math.hypot(i.x - x, i.z - z) < i.r + r + 90)) continue;
    islands.push({ x, z, r: r * 1.12 });
    group.add(createIsland(x, z, r));
  }
  scene.add(group);

  return {
    islands,
    sunDir: SUN_DIR,
    update(dt, camera) {
      sky.position.set(camera.position.x, 0, camera.position.z);
      for (const cloud of clouds.children) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > 1000) cloud.position.x = -1000;
      }
    },
  };
}
