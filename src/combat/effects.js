import * as THREE from 'three';
import { waveHeight } from '../world/waves.js';
import { toonMat } from '../core/toon.js';

const BALL_GEO = new THREE.SphereGeometry(0.28, 6, 5);
const BALL_MAT = new THREE.MeshBasicMaterial({ color: 0x241f1a });
const PUFF_GEO = new THREE.IcosahedronGeometry(1, 0);
const RING_GEO = new THREE.RingGeometry(0.7, 1, 18);

export class Effects {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.balls = [];
    this.puffs = [];
    this.rings = [];
    this.dolphins = [];
  }

  makeDolphin() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), toonMat(0x7d93a3));
    body.scale.set(0.42, 0.42, 1);
    g.add(body);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 5), toonMat(0x64798a));
    fin.position.set(0, 0.36, 0.05);
    fin.rotation.x = -0.35;
    g.add(fin);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.24), toonMat(0x64798a));
    tail.position.set(0, 0.05, -0.82);
    g.add(tail);
    return g;
  }

  // a pod leaps across your course ahead of the bow
  spawnDolphinPod(ship) {
    const fwd = ship.forward;
    const right = new THREE.Vector3(-Math.cos(ship.heading), 0, Math.sin(ship.heading));
    const side = Math.random() < 0.5 ? 1 : -1;
    const base = ship.pos.clone().addScaledVector(fwd, 34);
    for (let i = 0; i < 3; i++) {
      const start = base
        .clone()
        .addScaledVector(right, side * (-16 - i * 4))
        .addScaledVector(fwd, i * 3 - 3);
      this.dolphins.push({
        mesh: this.makeDolphin(),
        pos: start,
        dir: right.clone().multiplyScalar(side),
        delay: i * 0.45,
        u: 0,
        jumpsLeft: 3,
        inScene: false,
      });
    }
    this.game.sound.dolphin?.();
  }

  updateDolphins(dt, t) {
    for (let i = this.dolphins.length - 1; i >= 0; i--) {
      const d = this.dolphins[i];
      if (d.delay > 0) {
        d.delay -= dt;
        continue;
      }
      if (!d.inScene) {
        this.scene.add(d.mesh);
        d.inScene = true;
        this.spawnSplash(d.pos.clone());
      }
      d.u += dt / 1.35;
      if (d.u >= 1) {
        this.spawnSplash(d.mesh.position.clone());
        d.jumpsLeft--;
        if (d.jumpsLeft <= 0) {
          this.scene.remove(d.mesh);
          this.dolphins.splice(i, 1);
          continue;
        }
        d.pos.addScaledVector(d.dir, 11);
        d.u = 0;
        continue;
      }
      const u = d.u;
      d.mesh.position
        .copy(d.pos)
        .addScaledVector(d.dir, u * 11);
      d.mesh.position.y = Math.sin(u * Math.PI) * 2.7 - 0.7;
      d.mesh.rotation.y = Math.atan2(d.dir.x, d.dir.z);
      d.mesh.rotation.x = -Math.cos(u * Math.PI) * 0.85;
    }
  }

  fireBroadside(ship, side) {
    if (!ship.canFire(side)) return false;
    ship.reload[side] = ship.reloadTime;
    const q = ship.mesh.group.quaternion;
    const sideLocal = side === 'port' ? 1 : -1;
    const shipVel = ship.velocity;

    // port-town upgrades apply to the whole English fleet
    const up = ship.faction === 'england' ? this.game.upgrades : null;
    const ballSpeed = 38 * (up?.range ?? 1);
    const dmgMult = up?.dmg ?? 1;
    const perGun = up?.double ? 2 : 1;

    for (const local of ship.mesh.cannonsLocal[side]) {
      const pos = ship.localToWorld(local.x, local.y, local.z);
      const dir = new THREE.Vector3(sideLocal, 0, 0).applyQuaternion(q);
      for (let shot = 0; shot < perGun; shot++) {
        const spread = (Math.random() - 0.5) * (0.09 + shot * 0.04);
        const yaw = Math.atan2(dir.x, dir.z) + spread;
        const vel = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
          .multiplyScalar(ballSpeed)
          .add(new THREE.Vector3(0, 6.2 + Math.random() * 1.2, 0))
          .addScaledVector(shipVel, 0.5);
        this.spawnBall(pos, vel, ship, dmgMult);
      }
      this.spawnPuff(pos, 0xffb347, 0.7, 0.16, dir.clone().multiplyScalar(6));
      this.spawnPuff(pos.clone().addScaledVector(dir, 0.8), 0xdedede, 1.1, 0.9, dir.clone().multiplyScalar(3));
    }
    this.game.sound.boom(ship.pos);
    return true;
  }

  spawnBall(pos, vel, shooter, dmgMult = 1) {
    const mesh = new THREE.Mesh(BALL_GEO, BALL_MAT);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.balls.push({ mesh, vel, shooter, dmgMult, life: 5 });
  }

  spawnPuff(pos, color, scale, life, drift = null) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(PUFF_GEO, mat);
    mesh.position.copy(pos);
    mesh.scale.setScalar(scale);
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    this.scene.add(mesh);
    this.puffs.push({
      mesh,
      mat,
      life,
      maxLife: life,
      grow: 1.6 / Math.max(life, 0.1),
      drift: drift || new THREE.Vector3(0, 2.2, 0),
    });
  }

  spawnSmoke(pos, burning) {
    this.spawnPuff(pos, burning ? 0xff7733 : 0x555555, 0.8 + Math.random() * 0.7, 1.4);
  }

  spawnSplash(pos) {
    this.spawnRing(pos, 0xeafbff, 1, 3.5, 0.8);
    this.spawnPuff(pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xeafbff, 0.7, 0.35);
    this.game.sound.splash(pos);
  }

  spawnBurst(pos) {
    this.spawnPuff(pos, 0xffa040, 1.0, 0.15);
    this.spawnPuff(pos, 0x6e5335, 1.2, 0.8);
    this.spawnPuff(pos.clone().add(new THREE.Vector3(0, 1, 0)), 0x777777, 1.0, 1.1);
  }

  spawnRing(pos, color, startScale, endScale, life) {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(RING_GEO, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, Math.max(pos.y, 0.15), pos.z);
    mesh.scale.setScalar(startScale);
    this.scene.add(mesh);
    this.rings.push({ mesh, mat, life, maxLife: life, startScale, endScale });
  }

  spawnWake(ship) {
    const stern = ship.localToWorld(0, 0.1, -ship.def.len * 0.45);
    stern.y = 0.15;
    this.spawnRing(stern, 0xffffff, ship.def.wid * 0.22, ship.def.wid * 0.6, 1.4);
  }

  update(dt, t) {
    this.updateDolphins(dt, t);

    // cannonballs
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.vel.y -= 22 * dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      b.life -= dt;
      const p = b.mesh.position;

      let remove = b.life <= 0;
      if (!remove && p.y < waveHeight(p.x, p.z, t)) {
        this.spawnSplash(p);
        remove = true;
      }
      if (!remove) {
        for (const s of this.game.ships) {
          if (s === b.shooter || s.dead || s.faction === b.shooter.faction) continue;
          if (s.containsPoint(p)) {
            if (!s.sinking) s.applyDamage((5.5 + Math.random() * 3.5) * b.dmgMult, b.shooter);
            this.spawnBurst(p);
            this.game.sound.thud(p);
            remove = true;
            break;
          }
        }
      }
      if (remove) {
        this.scene.remove(b.mesh);
        this.balls.splice(i, 1);
      }
    }

    // puffs
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const f = this.puffs[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.scene.remove(f.mesh);
        this.puffs.splice(i, 1);
        continue;
      }
      const a = f.life / f.maxLife;
      f.mat.opacity = a * 0.85;
      f.mesh.scale.multiplyScalar(1 + f.grow * dt);
      f.mesh.position.addScaledVector(f.drift, dt);
    }

    // rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.scene.remove(r.mesh);
        this.rings.splice(i, 1);
        continue;
      }
      const a = 1 - r.life / r.maxLife;
      r.mat.opacity = 0.75 * (1 - a);
      r.mesh.scale.setScalar(r.startScale + (r.endScale - r.startScale) * a);
    }
  }
}
