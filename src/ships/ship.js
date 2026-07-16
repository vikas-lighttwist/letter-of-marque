import * as THREE from 'three';
import { SHIP_CLASSES, FACTIONS, buildShipMesh, shipName } from './factory.js';
import { toonMat } from '../core/toon.js';
import { waveHeight } from '../world/waves.js';

let nextId = 1;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

export class Ship {
  constructor(game, classKey, factionKey, x, z, heading = 0) {
    this.id = nextId++;
    this.game = game;
    this.def = SHIP_CLASSES[classKey];
    this.classKey = classKey;
    this.faction = factionKey;
    this.name = shipName(factionKey);

    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.rudder = 0; // -1..1, set each frame by input/AI
    this.sailSetting = 2; // 0..3
    this.steerTarget = null; // Vector3 the helm is aiming for

    this.hp = this.def.hp;
    this.maxHp = this.def.hp;
    this.crew = this.def.crew;
    this.gold = Math.round(rand(this.def.gold[0], this.def.gold[1]));

    this.reload = { port: 0, starboard: 0 };
    this.reloadTime = factionKey === 'england' ? 2.2 : 4.5 + Math.random() * 1.2;

    this.sinking = false;
    this.sinkT = 0;
    this.dead = false; // fully removed
    this.boarding = null; // set by game while grappled: {side, partner}
    this.anchored = false;
    this.orders = 'follow'; // fleet ships: 'follow' | 'hunt'
    this.lastDamageT = -100;
    this.smokeTimer = 0;

    this.ai = null; // attached by game for Spanish ships

    // rendering
    this.pitch = 0;
    this.roll = 0;
    this.bobY = 0;
    this.sailVisual = this.sailSetting / 3;

    this.buildMesh();
    this.buildCrew();
  }

  buildMesh() {
    const old = this.mesh?.group;
    if (old) this.game.scene.remove(old);
    this.mesh = buildShipMesh(this.classKey, this.faction);
    this.mesh.group.rotation.order = 'YXZ';
    this.game.scene.add(this.mesh.group);
  }

  buildCrew() {
    const fac = FACTIONS[this.faction];
    if (this.crewGroup) this.mesh.group.remove(this.crewGroup);
    this.crewGroup = new THREE.Group();
    this.mesh.group.add(this.crewGroup);
    this.crewFigures = [];
    const visible = Math.min(6, Math.max(2, Math.round(this.crew / 6)));
    const { w, l, y } = this.mesh.deckRect;
    const bodyMat = toonMat(fac.crewBody);
    const hatMat = toonMat(fac.crewHat);
    const skinMat = toonMat(0xd8a377);
    for (let i = 0; i < visible; i++) {
      const fig = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.62, 6), bodyMat);
      body.position.y = 0.31;
      fig.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 6, 5), skinMat);
      head.position.y = 0.76;
      fig.add(head);
      const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.09, 6), hatMat);
      hat.position.y = 0.88;
      fig.add(hat);
      fig.position.set(rand(-w / 2, w / 2), y, rand(-l / 2, l / 2));
      this.crewGroup.add(fig);
      this.crewFigures.push({
        fig,
        target: new THREE.Vector2(rand(-w / 2, w / 2), rand(-l / 2, l / 2)),
        wait: rand(0, 2),
        phase: Math.random() * 10,
      });
    }
  }

  get forward() {
    return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  get velocity() {
    return this.forward.multiplyScalar(this.speed);
  }

  get hitRadius() {
    return this.def.len * 0.32;
  }

  canFire(side) {
    return !this.sinking && !this.boarding && this.reload[side] <= 0;
  }

  setSail(delta) {
    this.sailSetting = Math.max(0, Math.min(3, this.sailSetting + delta));
  }

  applyDamage(amount, attacker) {
    if (this.sinking) return;
    this.hp -= amount;
    this.lastDamageT = this.game.elapsed;
    if (this === this.game.flagship) this.game.rig.shake(0.35);
    if (attacker) this.lastAttacker = attacker;
    if (this.hp <= 0) {
      this.hp = 0;
      this.startSinking();
    }
  }

  startSinking() {
    if (this.sinking) return;
    this.sinking = true;
    this.sinkT = 0;
    this.game.onShipSunk(this);
  }

  update(dt, t) {
    if (this.dead) return;

    if (this.sinking) {
      this.sinkT += dt;
      const s = this.sinkT / 5;
      this.pos.y = this.bobY - s * s * (this.def.hullH * 2.2);
      this.pitch += dt * 0.12;
      this.roll += dt * 0.09;
      this.speed = Math.max(0, this.speed - dt * 3);
      this.pos.addScaledVector(this.forward, this.speed * dt);
      this.syncMesh(t);
      if (this.sinkT > 5) {
        this.dead = true;
        this.game.scene.remove(this.mesh.group);
      }
      return;
    }

    // --- helm ---
    if (this.boarding) {
      this.rudder = 0;
    } else if (this.steerTarget) {
      const desired = Math.atan2(this.steerTarget.x - this.pos.x, this.steerTarget.z - this.pos.z);
      const d = angleDiff(desired, this.heading);
      this.rudder = THREE.MathUtils.clamp(d / 0.4, -1, 1);
    }

    // --- propulsion ---
    // sailing with the wind is a third faster, against it a third slower
    const wind = this.game.wind;
    const windFactor = wind ? 1 + 0.35 * Math.cos(this.heading - wind.angle) : 1;
    const lock = this.boarding || this.anchored ? 0 : 1;
    let targetSpeed = this.def.maxSpeed * (this.sailSetting / 3) * windFactor * lock;
    // battered hulls wallow
    if (this.hp / this.maxHp < 0.4) targetSpeed *= 0.75;
    // a round of coconut fizz puts wind in English sails
    if (this.faction === 'england' && this.game.elapsed < this.game.buffs?.speedUntil) {
      targetSpeed *= 1.15;
    }
    const accel = targetSpeed > this.speed ? 0.35 : 0.9;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * accel);

    const speedFactor = 0.35 + 0.65 * (this.speed / this.def.maxSpeed);
    this.heading += this.rudder * this.def.turnRate * speedFactor * dt;
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;

    // --- world edge: sail off one side, reappear on the opposite one ---
    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > 860 && !this.boarding) {
      const oldX = this.pos.x;
      const oldZ = this.pos.z;
      const scale = -(2 * 852 - r) / r; // antipode, just inside the rim
      this.pos.x *= scale;
      this.pos.z *= scale;
      this.game.onShipWrapped?.(this, this.pos.x - oldX, this.pos.z - oldZ);
    }

    // --- island collision ---
    for (const isl of this.game.env.islands) {
      const dx = this.pos.x - isl.x;
      const dz = this.pos.z - isl.z;
      const d = Math.hypot(dx, dz);
      const minD = isl.r + this.def.wid * 0.5;
      if (d < minD && d > 0.001) {
        this.pos.x = isl.x + (dx / d) * minD;
        this.pos.z = isl.z + (dz / d) * minD;
        this.speed *= 1 - dt * 2;
      }
    }

    // --- buoyancy ---
    const hl = this.def.len * 0.38;
    const hw = this.def.wid * 0.5;
    const sinH = Math.sin(this.heading);
    const cosH = Math.cos(this.heading);
    const hBow = waveHeight(this.pos.x + sinH * hl, this.pos.z + cosH * hl, t);
    const hStern = waveHeight(this.pos.x - sinH * hl, this.pos.z - cosH * hl, t);
    const hPort = waveHeight(this.pos.x + cosH * hw, this.pos.z - sinH * hw, t);
    const hStar = waveHeight(this.pos.x - cosH * hw, this.pos.z + sinH * hw, t);
    const k = Math.min(1, dt * 3);
    this.bobY += ((hBow + hStern + hPort + hStar) / 4 - this.bobY) * k;
    this.pitch += (Math.atan2(hStern - hBow, hl * 2) - this.pitch) * k;
    this.roll += (Math.atan2(hPort - hStar, hw * 2) * 0.7 - this.roll) * k;
    // lean into turns
    this.roll += this.rudder * this.speed * 0.0012;
    this.pos.y = this.bobY;

    // --- reload ---
    this.reload.port = Math.max(0, this.reload.port - dt);
    this.reload.starboard = Math.max(0, this.reload.starboard - dt);

    // --- out-of-combat repair (faster while the stew buff lasts) ---
    if (this.game.elapsed - this.lastDamageT > 10 && this.hp < this.maxHp) {
      const rate = this.faction === 'england' && this.game.elapsed < this.game.buffs?.repairUntil ? 3 : 1;
      this.hp = Math.min(this.maxHp, this.hp + rate * dt);
    }

    // --- damage smoke ---
    if (this.hp / this.maxHp < 0.55) {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = 0.35 + (this.hp / this.maxHp);
        const p = this.localToWorld(rand(-1, 1), this.mesh.deckY + 1, rand(-this.def.len * 0.2, this.def.len * 0.2));
        this.game.effects.spawnSmoke(p, this.hp / this.maxHp < 0.25);
      }
    }

    this.updateCrew(dt, t);
    this.syncMesh(t);
  }

  updateCrew(dt, t) {
    const { w, l } = this.mesh.deckRect;
    for (const c of this.crewFigures) {
      const p = c.fig.position;
      if (c.wait > 0) {
        c.wait -= dt;
        c.fig.position.y = this.mesh.deckRect.y;
      } else {
        const dx = c.target.x - p.x;
        const dz = c.target.y - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.3) {
          c.wait = rand(0.8, 3.5);
          if (this.boarding) {
            // rush to the grappled rail
            const side = this.boarding.side ?? 1;
            c.target.set(side * w * 0.5, rand(-l / 2, l / 2));
          } else {
            c.target.set(rand(-w / 2, w / 2), rand(-l / 2, l / 2));
          }
        } else {
          const sp = 1.3 * dt;
          p.x += (dx / d) * sp;
          p.z += (dz / d) * sp;
          p.y = this.mesh.deckRect.y + Math.abs(Math.sin(t * 9 + c.phase)) * 0.08;
          c.fig.rotation.y = Math.atan2(dx, dz);
        }
      }
    }
  }

  syncMesh(t) {
    const g = this.mesh.group;
    g.position.copy(this.pos);
    g.rotation.set(this.pitch, this.heading, this.roll);

    // sails follow the sail setting
    const target = this.sinking ? 0.1 : 0.2 + 0.8 * (this.sailSetting / 3);
    this.sailVisual += (target - this.sailVisual) * 0.05;
    for (const s of this.mesh.sails) s.scale.y = this.sailVisual;

    // flag flutter — streams aft but angled out so the chase camera sees it
    this.mesh.flag.rotation.y = Math.PI / 2 - 0.55 + Math.sin(t * 2.4 + this.id) * 0.25;

    g.updateMatrixWorld();
  }

  localToWorld(x, y, z) {
    return this.mesh.group.localToWorld(new THREE.Vector3(x, y, z));
  }

  // world position of the label anchor above the mast
  labelAnchor() {
    return this.localToWorld(this.mesh.mastTop.x, this.mesh.mastTop.y, this.mesh.mastTop.z);
  }

  // is `worldPos` inside this ship's hull volume (for cannonball hits)?
  containsPoint(worldPos) {
    const p = this.mesh.group.worldToLocal(worldPos.clone());
    return (
      Math.abs(p.x) < this.def.wid * 0.72 &&
      Math.abs(p.z) < this.def.len * 0.55 &&
      p.y > -this.def.hullH && p.y < this.def.hullH * 2.2
    );
  }
}
