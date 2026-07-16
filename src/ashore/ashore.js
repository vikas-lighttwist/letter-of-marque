import * as THREE from 'three';
import { toonMat } from '../core/toon.js';
import { FACTIONS } from '../ships/factory.js';
import { waveHeight } from '../world/waves.js';

const BOAT_SPEED = 8;
const WALK_SPEED = 6;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function makeFigure(bodyColor, hatColor, scale = 1) {
  const fig = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.66, 6), toonMat(bodyColor));
  body.position.y = 0.33;
  fig.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5), toonMat(0xd8a377));
  head.position.y = 0.82;
  fig.add(head);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 6), toonMat(hatColor));
  hat.position.y = 0.95;
  fig.add(hat);
  fig.scale.setScalar(scale);
  return fig;
}

// The captain: red coat, proper tricorn with gold band and feather,
// and a parrot on the shoulder (returns the parrot for click-picking).
function makeCaptain() {
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
  g.add(parrot);

  return { group: g, parrot };
}

function makeRowboat() {
  const g = new THREE.Group();
  const hullGeo = new THREE.BoxGeometry(1.7, 0.75, 4.2, 1, 1, 4);
  const pos = hullGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const u = Math.abs(z) / 2.1;
    pos.setX(i, pos.getX(i) * (1 - u * u * 0.55)); // taper both ends
    if (pos.getY(i) < 0) pos.setY(i, pos.getY(i) * (1 - u * 0.5));
  }
  hullGeo.computeVertexNormals();
  const hull = new THREE.Mesh(hullGeo, toonMat(0x8a5a33));
  hull.position.y = 0.42;
  g.add(hull);
  for (const bz of [-1.0, 0.2]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.4), toonMat(0xb9905c));
    bench.position.set(0, 0.62, bz);
    g.add(bench);
  }
  const oarGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5);
  for (const side of [1, -1]) {
    const oar = new THREE.Mesh(oarGeo, toonMat(0x6b4a2a));
    oar.position.set(side * 0.9, 0.7, 0.2);
    oar.rotation.z = side * 1.15;
    g.add(oar);
    g.userData['oar' + side] = oar;
  }
  const fac = FACTIONS.england;
  for (const bz of [-1.0, 0.2]) {
    const hand = makeFigure(fac.crewBody, fac.crewHat, 0.85);
    hand.position.set(0, 0.6, bz);
    hand.rotation.y = Math.PI;
    g.add(hand);
  }
  return g;
}

// Rowboat cinematic + third-person captain walking on an island.
export class AshoreMode {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.squawkCooldown = 0;

    // tap the parrot → "Pieces of eight!"
    window.addEventListener('pointerdown', (e) => {
      if (!this.active || !this.parrot || this.squawkCooldown > 0) return;
      const ndc = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );
      this.raycaster.setFromCamera(ndc, this.game.camera);
      if (this.raycaster.intersectObject(this.parrot, true).length > 0) {
        this.squawkCooldown = 1.2;
        this.game.sound.squawk();
        const p = new THREE.Vector3();
        this.parrot.getWorldPosition(p);
        p.y += 0.6;
        this.game.hud.floaterAt(p, '🦜 Pieces of eight!', 'speech');
      }
    });
  }

  begin(island) {
    const g = this.game;
    const f = g.flagship;
    if (!f || this.active) return;
    this.island = island;
    this.active = true;
    this.phase = 'row-in';
    g.state = 'ashore';

    const toShip = Math.atan2(f.pos.x - island.x, f.pos.z - island.z);
    this.landAngle = toShip;
    this.beachPoint = new THREE.Vector3(
      island.x + Math.sin(toShip) * island.rRaw * 1.05,
      0,
      island.z + Math.cos(toShip) * island.rRaw * 1.05
    );
    this.captain = {
      pos: new THREE.Vector3(
        island.x + Math.sin(toShip) * island.rRaw * 0.85,
        2.05,
        island.z + Math.cos(toShip) * island.rRaw * 0.85
      ),
      yaw: toShip + Math.PI, // face inland
    };

    const cap = makeCaptain();
    this.captainMesh = cap.group;
    this.parrot = cap.parrot;

    this.boat = makeRowboat();
    this.captainMesh.position.set(0, 0.55, 1.35); // standing proud at the bow
    this.captainMesh.rotation.y = 0;
    this.boat.add(this.captainMesh);
    const dir = new THREE.Vector3().subVectors(this.beachPoint, f.pos).setY(0).normalize();
    this.boat.position.copy(f.pos).addScaledVector(dir, f.def.wid * 0.5 + 3);
    g.scene.add(this.boat);

    this.camPos.copy(g.camera.position);
    this.camLook.copy(f.pos);
  }

  // ----- phases ------------------------------------------------------

  update(dt, t) {
    if (!this.active) return;
    const g = this.game;
    this.squawkCooldown = Math.max(0, this.squawkCooldown - dt);

    if (this.phase === 'row-in' || this.phase === 'row-out') {
      const target = this.phase === 'row-in' ? this.beachPoint : this.shipSide();
      const d = new THREE.Vector3().subVectors(target, this.boat.position);
      d.y = 0;
      const dist = d.length();
      if (dist < 2.2) {
        if (this.phase === 'row-in') this.arrive(t);
        else this.finish();
        return;
      }
      d.normalize();
      this.boat.position.addScaledVector(d, Math.min(BOAT_SPEED * dt, dist));
      this.boat.position.y = waveHeight(this.boat.position.x, this.boat.position.z, t) * 0.9;
      this.boat.rotation.y = Math.atan2(d.x, d.z);
      this.boat.rotation.z = Math.sin(t * 5) * 0.05;
      const stroke = Math.sin(t * 5) * 0.5;
      if (this.boat.userData.oar1) {
        this.boat.userData.oar1.rotation.x = stroke;
        this.boat.userData['oar-1'].rotation.x = stroke;
      }

      // chase camera on the little boat
      const wantPos = this.boat.position.clone().addScaledVector(d, -11).add(new THREE.Vector3(0, 5.5, 0));
      const k = 1 - Math.exp(-dt * 2.8);
      this.camPos.lerp(wantPos, k);
      this.camLook.lerp(this.boat.position, k);
      g.camera.position.copy(this.camPos);
      g.camera.lookAt(this.camLook);
      return;
    }

    // ----- walking, third person -----------------------------------
    const c = this.captain;
    const isl = this.island;

    // pointer: walk toward the held point; keys: A/D turn, W/S walk
    let moving = false;
    let moveX = 0;
    let moveZ = 0;
    const sp = g.input.steerPoint;
    if (g.input.pointers.size === 1 && sp) {
      const dx = sp.x - c.pos.x;
      const dz = sp.z - c.pos.z;
      const dd = Math.hypot(dx, dz);
      if (dd > 1.4) {
        const wantYaw = Math.atan2(dx, dz);
        c.yaw += angleDiff(wantYaw, c.yaw) * Math.min(1, dt * 5);
        moveX = Math.sin(c.yaw);
        moveZ = Math.cos(c.yaw);
        moving = true;
      }
    } else {
      const keys = g.input.keys;
      const turn = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
      c.yaw += turn * 2.4 * dt;
      const fwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 0.6 : 0);
      if (fwd !== 0) {
        moveX = Math.sin(c.yaw) * fwd;
        moveZ = Math.cos(c.yaw) * fwd;
        moving = true;
      }
    }
    c.pos.x += moveX * WALK_SPEED * dt;
    c.pos.z += moveZ * WALK_SPEED * dt;

    // stay on the island
    const dx = c.pos.x - isl.x;
    const dz = c.pos.z - isl.z;
    const dr = Math.hypot(dx, dz);
    const maxR = isl.rRaw * 1.02;
    if (dr > maxR) {
      c.pos.x = isl.x + (dx / dr) * maxR;
      c.pos.z = isl.z + (dz / dr) * maxR;
    }

    // don't walk through the town buildings
    if (isl.port && g.env.port?.obstacles) {
      for (const o of g.env.port.obstacles) {
        const ox = c.pos.x - o.x;
        const oz = c.pos.z - o.z;
        const od = Math.hypot(ox, oz);
        const minD = o.r + 0.6;
        if (od < minD && od > 0.001) {
          c.pos.x = o.x + (ox / od) * minD;
          c.pos.z = o.z + (oz / od) * minD;
        }
      }
    }
    c.pos.y = this.groundY(c.pos.x, c.pos.z);

    // captain mesh: position, facing, and a jaunty walk bob
    const m = this.captainMesh;
    m.position.copy(c.pos);
    m.rotation.set(0, c.yaw, 0);
    if (moving) {
      m.position.y += Math.abs(Math.sin(t * 8)) * 0.07;
      m.rotation.z = Math.sin(t * 8) * 0.05;
    }
    // the parrot bobs along
    this.parrot.rotation.z = Math.sin(t * 3.1) * 0.08;

    // third-person camera, over the shoulder
    const back = new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw));
    const wantPos = c.pos.clone().addScaledVector(back, -5.2).add(new THREE.Vector3(0, 3.0, 0));
    const wantLook = c.pos.clone().addScaledVector(back, 2.5).add(new THREE.Vector3(0, 1.3, 0));
    const k = 1 - Math.exp(-dt * 6);
    this.camPos.lerp(wantPos, k);
    this.camLook.lerp(wantLook, k);
    g.camera.position.copy(this.camPos);
    g.camera.lookAt(this.camLook);
  }

  arrive(t) {
    this.phase = 'walk';
    // beach the boat and step out
    this.boat.position.y = 0.35;
    this.boat.rotation.z = 0.06;
    this.boat.remove(this.captainMesh);
    this.game.scene.add(this.captainMesh);
    this.captainMesh.position.copy(this.captain.pos);
    this.game.hud.banner('🚶 Ashore — hold the pointer to walk. Try tapping the parrot!');
  }

  shipSide() {
    const f = this.game.flagship;
    return f ? f.pos : this.beachPoint;
  }

  requestReturn() {
    if (this.phase !== 'walk') return;
    this.phase = 'row-out';
    // back into the boat
    this.game.scene.remove(this.captainMesh);
    this.captainMesh.position.set(0, 0.55, 1.35);
    this.captainMesh.rotation.set(0, 0, 0);
    this.boat.add(this.captainMesh);
  }

  finish() {
    if (this.boat) this.game.scene.remove(this.boat);
    if (this.captainMesh?.parent === this.game.scene) this.game.scene.remove(this.captainMesh);
    this.boat = null;
    this.captainMesh = null;
    this.parrot = null;
    this.active = false;
    if (this.game.state === 'ashore') this.game.state = 'playing';
  }

  nearShop() {
    const shop = this.game.env.port?.shop;
    if (!shop || !this.island?.port || this.phase !== 'walk') return false;
    return Math.hypot(this.captain.pos.x - shop.x, this.captain.pos.z - shop.z) < 9;
  }

  // walking surface height: flat sand, hemisphere hill, sloping beach
  groundY(x, z) {
    const isl = this.island;
    const d = Math.hypot(x - isl.x, z - isl.z);
    let y;
    const sandEdge = isl.rRaw * 0.9;
    if (d < sandEdge) y = 2.05;
    else y = Math.max(0.6, 2.05 - ((d - sandEdge) / (isl.rRaw * 0.25)) * 1.6);

    const hd = Math.hypot(x - (isl.x + isl.hillX), z - isl.z);
    if (hd < isl.hillR) {
      y = Math.max(y, 1.8 + 0.55 * Math.sqrt(isl.hillR * isl.hillR - hd * hd));
    }
    return y;
  }
}
