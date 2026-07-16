import * as THREE from 'three';
import { createOcean } from './world/ocean.js';
import { createEnvironment, HORIZON, FOG_NEAR, FOG_FAR } from './world/environment.js';

const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(HORIZON);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 3000);
camera.position.set(0, 18, -38);
camera.lookAt(0, 0, 20);

const env = createEnvironment(scene);
const ocean = createOcean(scene, HORIZON, FOG_NEAR, FOG_FAR);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let last = performance.now();
let elapsed = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  elapsed += dt;

  ocean.update(elapsed, camera.position.x, camera.position.z);
  env.update(dt, camera);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
