import * as THREE from 'three';

// Pointer/touch/keyboard → sailing intent. Steering is positional: while a
// pointer is held on the sea, the ship turns toward the point under it.
export class Input {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.seaPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this.pointers = new Map(); // id → {x, y}
    this.steerPoint = null; // Vector3 on the sea, null when not steering
    this.steerScreen = null; // {x, y} css px for the ring
    this.keys = new Set();
    this.zoomDelta = 0;
    this.pinchDist = 0;

    // callbacks wired by main
    this.onFire = () => {};
    this.onBoard = () => {};
    this.onSail = () => {};
    this.onCycle = () => {};

    canvas.addEventListener('pointerdown', (e) => {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // synthetic or already-released pointers can't be captured — steering still works
      }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        this.steerPoint = null;
        this.pinchDist = this.pinchDistance();
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const d = this.pinchDistance();
        this.zoomDelta -= (d - this.pinchDist) * 0.08;
        this.pinchDist = d;
      }
    });
    const release = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) this.steerPoint = null;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    window.addEventListener('wheel', (e) => {
      this.zoomDelta += e.deltaY * 0.02;
    }, { passive: true });

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyQ') this.onFire('port');
      if (e.code === 'KeyE') this.onFire('starboard');
      if (e.code === 'KeyF') this.onBoard();
      if (e.code === 'KeyW') this.onSail(1);
      if (e.code === 'KeyS') this.onSail(-1);
      if (e.code === 'KeyC') this.onCycle();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  pinchDistance() {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  // called once per frame to refresh the steering point from the held pointer
  update() {
    if (this.pointers.size === 1) {
      const [{ x, y }] = [...this.pointers.values()];
      const ndc = new THREE.Vector2(
        (x / window.innerWidth) * 2 - 1,
        -(y / window.innerHeight) * 2 + 1
      );
      this.raycaster.setFromCamera(ndc, this.camera);
      const hit = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.seaPlane, hit)) {
        this.steerPoint = hit;
        this.steerScreen = { x, y };
      }
    } else {
      this.steerPoint = null;
    }
  }

  // keyboard rudder override; +1 turns to port (screen-left), -1 to starboard
  keyRudder() {
    let r = 0;
    if (this.keys.has('KeyA')) r += 1;
    if (this.keys.has('KeyD')) r -= 1;
    return r;
  }

  consumeZoom() {
    let z = this.zoomDelta;
    if (this.keys.has('KeyZ')) z -= 0.6;
    if (this.keys.has('KeyX')) z += 0.6;
    this.zoomDelta = 0;
    return z;
  }
}
