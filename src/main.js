import * as THREE from 'three';
import { createOcean } from './world/ocean.js';
import { createEnvironment, HORIZON, FOG_NEAR, FOG_FAR } from './world/environment.js';
import { Input } from './core/input.js';
import { Sound } from './audio/sound.js';
import { Game } from './game.js';

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
const input = new Input(renderer.domElement, camera);
const sound = new Sound();

const game = new Game({ scene, camera, env, ocean, input, sound });
window.game = game; // debug/console access
window.__render = () => renderer.render(scene, camera);

input.onFire = () => game.fire();
input.onBoard = () => game.toggleBoard();
input.onSail = (d) => game.setSail(d);
input.onCycle = () => game.cycleFlagship();

game.hud.showIntro(() => game.start());

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

  input.update();
  game.update(dt, elapsed);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
