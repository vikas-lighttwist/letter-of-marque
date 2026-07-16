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

// The port town: houses, a dock and a banner tower on top of a normal island.
function createPortTown(r) {
  const g = new THREE.Group();
  const wallMats = [toonMat(0xe8dcc0), toonMat(0xd8c8a8), toonMat(0xc9b490)];
  const roofMats = [toonMat(0xb0533a), toonMat(0x8f6b3e), toonMat(0x77604a)];
  // town fans out on the +X side; the hill is pushed to -X to make room
  const houses = 6;
  let shopLocal = null;
  const obstacles = [];
  for (let i = 0; i < houses; i++) {
    const a = -0.75 + (i / (houses - 1)) * 1.5; // sector centered on +X
    const d = r * rand(0.34, 0.62);
    const w = rand(4, 6.5);
    const h = rand(3, 4.5);
    const house = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.8), wallMats[i % 3]);
    walls.position.y = h / 2;
    house.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, h * 0.7, 4), roofMats[i % 3]);
    roof.position.y = h + h * 0.32;
    roof.rotation.y = Math.PI / 4;
    house.add(roof);
    house.position.set(Math.cos(a) * d, 2.2, Math.sin(a) * d);
    house.rotation.y = rand(0, Math.PI * 2);
    g.add(house);
    obstacles.push({ x: house.position.x, z: house.position.z, r: w * 0.8 });

    // the middle house is the market: hanging sign + barrels out front
    if (i === 2) {
      shopLocal = { x: house.position.x, z: house.position.z };
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 1.3, 0.18),
        new THREE.MeshBasicMaterial({ color: 0xf2c14e })
      );
      sign.position.set(house.position.x, 2.2 + h + 1.2, house.position.z);
      g.add(sign);
      const barrelGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.1, 8);
      for (const off of [[2.2, 0.8], [2.8, -0.6]]) {
        const barrel = new THREE.Mesh(barrelGeo, toonMat(0x9a6b35));
        barrel.position.set(house.position.x + off[0], 2.75, house.position.z + off[1]);
        g.add(barrel);
      }
    }
  }
  g.userData.shop = shopLocal;
  g.userData.obstacles = obstacles;

  // watchtower with a gold banner, visible from far out at sea
  const tower = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 16, 8), toonMat(0xcabfa6));
  shaft.position.y = 8;
  tower.add(shaft);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3, 8), toonMat(0xb0533a));
  cap.position.y = 17.4;
  tower.add(cap);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 5), toonMat(0x6b4a2a));
  pole.position.y = 21;
  tower.add(pole);
  const bannerGeo = new THREE.PlaneGeometry(4.4, 2.2);
  bannerGeo.translate(2.2, 0, 0);
  const banner = new THREE.Mesh(
    bannerGeo,
    new THREE.MeshBasicMaterial({ color: 0xf2c14e, side: THREE.DoubleSide })
  );
  banner.position.y = 22.4;
  tower.add(banner);
  tower.position.set(r * 0.12, 2, 0);
  g.add(tower);
  obstacles.push({ x: r * 0.12, z: 0, r: 3 });
  g.userData.banner = banner;

  // dock reaching out past the sand into open water, on the town side
  const dockDir = rand(-0.4, 0.4);
  const dockLen = r * 1.1;
  const dock = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.1, dockLen), toonMat(0x8a6437));
  dock.position.set(Math.cos(dockDir) * (r * 0.75 + dockLen / 2), 1.6, Math.sin(dockDir) * (r * 0.75 + dockLen / 2));
  dock.rotation.y = -dockDir + Math.PI / 2;
  g.add(dock);

  return g;
}

function createIsland(x, z, r, isPort = false) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const sand = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 1.18, 3.2, 18), toonMat(0xe8d29a));
  sand.position.y = 0.4;
  g.add(sand);

  // port islands keep their hill off to one side so the town has flat ground
  const hillR = isPort ? r * 0.42 : r * 0.72;
  const hill = new THREE.Mesh(
    new THREE.SphereGeometry(hillR, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    toonMat(0x4d9e4f)
  );
  hill.scale.y = 0.55;
  hill.position.set(isPort ? -r * 0.45 : 0, 1.8, 0);
  g.add(hill);

  if (r > 40 && !isPort) {
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

  // islands: scattered, none too close to the player spawn at the origin.
  // The first is the port town, placed within easy reach.
  const islands = [];
  const group = new THREE.Group();
  let port = null;
  let guard = 0;
  while (islands.length < 8 && guard++ < 200) {
    const a = rand(0, Math.PI * 2);
    const isPort = islands.length === 0;
    const d = isPort ? rand(240, 400) : rand(180, 780);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const r = isPort ? rand(44, 56) : rand(26, 62);
    if (islands.some((i) => Math.hypot(i.x - x, i.z - z) < i.r + r + 90)) continue;
    islands.push({
      x, z, r: r * 1.12, rRaw: r, port: isPort,
      // walking-surface hill parameters (matches createIsland's meshes)
      hillR: isPort ? r * 0.42 : r * 0.72,
      hillX: isPort ? -r * 0.45 : 0,
    });
    const mesh = createIsland(x, z, r, isPort);
    if (isPort) {
      const town = createPortTown(r);
      mesh.add(town);
      port = {
        x, z, r: r * 1.12, banner: town.userData.banner,
        shop: { x: x + town.userData.shop.x, z: z + town.userData.shop.z },
        obstacles: town.userData.obstacles.map((o) => ({ x: x + o.x, z: z + o.z, r: o.r })),
      };
    }
    group.add(mesh);
  }
  scene.add(group);

  return {
    islands,
    port,
    sunDir: SUN_DIR,
    update(dt, camera, windAngle = 0) {
      sky.position.set(camera.position.x, 0, camera.position.z);
      const wx = Math.sin(windAngle);
      const wz = Math.cos(windAngle);
      for (const cloud of clouds.children) {
        cloud.position.x += wx * cloud.userData.speed * dt;
        cloud.position.z += wz * cloud.userData.speed * dt;
        if (Math.hypot(cloud.position.x, cloud.position.z) > 1080) {
          cloud.position.x -= wx * 2000;
          cloud.position.z -= wz * 2000;
        }
      }
      if (port) port.banner.rotation.y = windAngle + Math.PI / 2 + Math.sin(performance.now() / 400) * 0.15;
    },
  };
}
