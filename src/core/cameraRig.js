import * as THREE from 'three';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.dist = 34;
    this.pos = new THREE.Vector3(0, 20, -40);
    this.look = new THREE.Vector3();
    this.shakeT = 0;
  }

  shake(amount) {
    this.shakeT = Math.min(1, this.shakeT + amount);
  }

  zoom(delta) {
    this.dist = THREE.MathUtils.clamp(this.dist + delta, 9, 72);
  }

  update(ship, dt) {
    const fwd = ship.forward;
    const height = this.dist * 0.52;
    const desired = new THREE.Vector3()
      .copy(ship.pos)
      .addScaledVector(fwd, -this.dist)
      .add(new THREE.Vector3(0, height, 0));
    const desiredLook = new THREE.Vector3()
      .copy(ship.pos)
      .addScaledVector(fwd, 10)
      .add(new THREE.Vector3(0, 3, 0));

    const k = 1 - Math.exp(-dt * 3.2);
    this.pos.lerp(desired, k);
    this.look.lerp(desiredLook, k);

    this.camera.position.copy(this.pos);
    if (this.shakeT > 0) {
      const s = this.shakeT * 0.55;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.position.z += (Math.random() - 0.5) * s;
      this.shakeT = Math.max(0, this.shakeT - dt * 2.4);
    }
    this.camera.lookAt(this.look);
  }
}
