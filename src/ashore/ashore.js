import * as THREE from 'three';
import { toonMat } from '../core/toon.js';
import { FACTIONS } from '../ships/factory.js';
import { makeCaptain } from '../ships/captain.js';
import { waveHeight } from '../world/waves.js';

const BOAT_SPEED = 8;
const WALK_SPEED = 6;

// walking surface height: flat sand, hemisphere hill, sloping beach
export function islandGroundY(isl, x, z) {
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
  }

  begin(island) {
    const g = this.game;
    const f = g.flagship;
    if (!f || this.active) return;
    this.island = island;
    this.active = true;
    this.phase = 'row-in';
    this.room = 'island';
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
    // tap targets while ashore (the game's shared click system)
    this._clickables = [
      { obj: this.parrot, fn: () => g.parrotTapped(this.parrot) },
      { obj: this.captainMesh, fn: () => g.captainTapped(this.captainMesh) },
    ];
    g.clickables.push(...this._clickables);

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

    if (this.room === 'tavern') {
      // stay inside the room, off the furniture
      const inn = g.tavernInterior;
      c.pos.x = Math.min(inn.bounds.x1, Math.max(inn.bounds.x0, c.pos.x));
      c.pos.z = Math.min(inn.bounds.z1, Math.max(inn.bounds.z0, c.pos.z));
      for (const o of inn.obstacles) {
        const ox = c.pos.x - o.x;
        const oz = c.pos.z - o.z;
        const od = Math.hypot(ox, oz);
        const minD = o.r + 0.5;
        if (od < minD && od > 0.001) {
          c.pos.x = o.x + (ox / od) * minD;
          c.pos.z = o.z + (oz / od) * minD;
        }
      }
      c.pos.y = inn.floorY;

      // the regulars sway over their mugs
      for (let i = 0; i < inn.patrons.length; i++) {
        inn.patrons[i].rotation.z = Math.sin(t * 1.6 + i * 1.3) * 0.05;
      }
    } else {
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
    }

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

    // third-person camera, over the shoulder (tighter indoors)
    const inside = this.room === 'tavern';
    const back = new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw));
    const wantPos = c.pos
      .clone()
      .addScaledVector(back, inside ? -3.8 : -5.2)
      .add(new THREE.Vector3(0, inside ? 2.2 : 3.0, 0));
    const wantLook = c.pos.clone().addScaledVector(back, 2.5).add(new THREE.Vector3(0, 1.3, 0));
    const k = 1 - Math.exp(-dt * 6);
    this.camPos.lerp(wantPos, k);
    this.camLook.lerp(wantLook, k);
    if (inside) {
      // keep the camera inside the room walls
      const b = g.tavernInterior.bounds;
      this.camPos.x = Math.min(b.x1, Math.max(b.x0, this.camPos.x));
      this.camPos.z = Math.min(b.z1, Math.max(b.z0, this.camPos.z));
      this.camPos.y = Math.min(g.tavernInterior.floorY + 5, this.camPos.y);
    }
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

  // step through the tavern door into the interior room
  enterTavern() {
    const inn = this.game.tavernInterior;
    if (!inn || this.room === 'tavern' || this.phase !== 'walk') return;
    this.savedIslandPos = this.captain.pos.clone();
    this.savedIslandYaw = this.captain.yaw;
    this.captain.pos.copy(inn.spawn);
    this.captain.yaw = Math.PI; // face into the room (-z)
    this.room = 'tavern';
    this.game.input.seaPlane.constant = -inn.floorY; // pointer-walk on the tavern floor
    this.game.sound.startShanty();
    // snap the camera behind him so we don't lerp through the sea floor
    const back = new THREE.Vector3(Math.sin(this.captain.yaw), 0, Math.cos(this.captain.yaw));
    this.camPos.copy(this.captain.pos).addScaledVector(back, -4).add(new THREE.Vector3(0, 2.4, 0));
    this.camLook.copy(this.captain.pos).add(new THREE.Vector3(0, 1.2, 0));
    this.game.hud.banner('🍺 The Thirsty Parrot — talk to the barkeep, Meg, or the board');
  }

  exitTavern() {
    if (this.room !== 'tavern') return;
    this.room = 'island';
    this.game.input.seaPlane.constant = 0;
    this.game.sound.stopShanty();
    this.captain.pos.copy(this.savedIslandPos);
    this.captain.yaw = this.savedIslandYaw + Math.PI; // walk back out facing away
    const back = new THREE.Vector3(Math.sin(this.captain.yaw), 0, Math.cos(this.captain.yaw));
    this.camPos.copy(this.captain.pos).addScaledVector(back, -5).add(new THREE.Vector3(0, 3, 0));
    this.camLook.copy(this.captain.pos).add(new THREE.Vector3(0, 1.3, 0));
  }

  requestReturn() {
    if (this.phase !== 'walk') return;
    if (this.room === 'tavern') this.exitTavern();
    this.phase = 'row-out';
    // back into the boat
    this.game.scene.remove(this.captainMesh);
    this.captainMesh.position.set(0, 0.55, 1.35);
    this.captainMesh.rotation.set(0, 0, 0);
    this.boat.add(this.captainMesh);
  }

  finish() {
    this.room = 'island';
    this.game.input.seaPlane.constant = 0;
    this.game.sound.stopShanty();
    if (this.boat) this.game.scene.remove(this.boat);
    if (this.captainMesh?.parent === this.game.scene) this.game.scene.remove(this.captainMesh);
    if (this._clickables) {
      this.game.clickables = this.game.clickables.filter((c) => !this._clickables.includes(c));
      this._clickables = null;
    }
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

  groundY(x, z) {
    return islandGroundY(this.island, x, z);
  }
}
