import * as THREE from 'three';
import { toonMat } from '../core/toon.js';

// The captain: red coat, proper tricorn with gold band and feather,
// and a parrot on the shoulder (returned separately for click-picking).
export function makeCaptain() {
  const g = new THREE.Group();
  const black = toonMat(0x1d1a16);

  const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.78, 7), toonMat(0x8c2f2f));
  coat.position.y = 0.39;
  g.add(coat);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.09, 7), black);
  belt.position.y = 0.42;
  g.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.03), toonMat(0xd9a94a));
  buckle.position.set(0, 0.42, 0.27);
  g.add(buckle);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), toonMat(0xd8a377));
  head.position.y = 0.95;
  g.add(head);

  // tricorn hat
  const hat = new THREE.Group();
  hat.position.y = 1.1;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.045, 12), black);
  hat.add(brim);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), black);
  crown.scale.y = 0.85;
  crown.position.y = 0.02;
  hat.add(crown);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.225, 0.06, 12), toonMat(0xd9a94a));
  band.position.y = 0.05;
  hat.add(band);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const holder = new THREE.Group();
    holder.rotation.y = a;
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.04, 0.16), black);
    flap.position.set(0.3, 0.1, 0);
    flap.rotation.z = 0.6;
    holder.add(flap);
    hat.add(holder);
  }
  const feather = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.34, 5), toonMat(0xe8e0cc));
  feather.position.set(0.28, 0.22, 0.12);
  feather.rotation.z = -0.7;
  hat.add(feather);
  g.add(hat);

  // the parrot, on the right shoulder
  const parrot = new THREE.Group();
  parrot.position.set(-0.3, 0.82, 0.04);
  const pBody = new THREE.Mesh(new THREE.SphereGeometry(0.11, 7, 6), toonMat(0x2fae4a));
  pBody.scale.set(1, 1.3, 1);
  parrot.add(pBody);
  const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.08, 7, 6), toonMat(0xd9342b));
  pHead.position.set(0, 0.18, 0.03);
  parrot.add(pHead);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 5), toonMat(0xf2a33c));
  beak.position.set(0, 0.17, 0.12);
  beak.rotation.x = Math.PI / 2;
  parrot.add(beak);
  const wing = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), toonMat(0x1f8f3a));
  wing.scale.set(0.5, 1.1, 1);
  wing.position.set(-0.09, 0, 0);
  parrot.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), toonMat(0x1f7fae));
  tail.position.set(0, -0.16, -0.09);
  tail.rotation.x = 0.55;
  parrot.add(tail);

  // generous invisible tap target — the bird itself is a tiny mark to hit
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 8, 6),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hit.position.y = 0.08;
  parrot.add(hit);
  g.add(parrot);

  return { group: g, parrot };
}
