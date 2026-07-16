import * as THREE from 'three';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.dist = 34;
    this.pos = new THREE.Vector3(0, 20, -40);
    this.look = new THREE.Vector3();
  }

  zoom(delta) {
    this.dist = THREE.MathUtils.clamp(this.dist + delta, 16, 72);
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
    this.camera.lookAt(this.look);
  }
}
