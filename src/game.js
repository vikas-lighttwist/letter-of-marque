import * as THREE from 'three';
import { Ship } from './ships/ship.js';
import { Effects } from './combat/effects.js';
import { updateSpanishAI, updateFleetAI } from './ai/ai.js';
import { CameraRig } from './core/cameraRig.js';
import { HUD } from './ui/hud.js';
import { Labels } from './ui/labels.js';
import { waveHeight } from './world/waves.js';
import { toonMat } from './core/toon.js';

const BARREL_GEO = new THREE.CylinderGeometry(0.9, 0.9, 1.6, 8);
const BARREL_BAND_GEO = new THREE.CylinderGeometry(0.95, 0.95, 0.18, 8);

function rand(a, b) {
  return a + Math.random() * (b - a);
}

export class Game {
  constructor({ scene, camera, env, ocean, input, sound }) {
    this.scene = scene;
    this.camera = camera;
    this.env = env;
    this.ocean = ocean;
    this.input = input;
    this.sound = sound;

    this.rig = new CameraRig(camera);
    this.effects = new Effects(scene, this);

    this.state = 'intro';
    this.elapsed = 0;
    this.gold = 0;
    this.captures = 0;
    this.sinkings = 0;
    this.victoryShown = false;

    this.ships = [];
    this.fleet = [];
    this.loot = [];
    this.boarding = null;
    this.ropes = [];
    this.spawnTimer = 10;

    // player flagship
    this.flagship = this.addShip('brigantine', 'england', 0, 0, 0);
    this.flagship.name = 'Fortune';
    this.flagship.sailSetting = 0;
    this.fleet.push(this.flagship);

    // opening world population
    const spawns = [
      ['sloop', 160, 0.5], ['sloop', 230, 2.1], ['brigantine', 260, 3.5],
      ['brigantine', 330, 4.9], ['frigate', 430, 1.6], ['galleon', 390, 5.8],
      ['shipOfTheLine', 580, 3.1],
    ];
    for (const [cls, d, a] of spawns) {
      this.addShip(cls, 'spain', Math.cos(a) * d, Math.sin(a) * d, rand(0, Math.PI * 2));
    }

    this.hud = new HUD(this);
    this.labels = new Labels(this);
  }

  addShip(classKey, faction, x, z, heading) {
    const s = new Ship(this, classKey, faction, x, z, heading);
    this.ships.push(s);
    return s;
  }

  start() {
    this.state = 'playing';
    this.startTime = this.elapsed;
    this.flagship.sailSetting = 2;
    this.sound.init();
  }

  // ------------------------------------------------------------ actions

  fire(side) {
    if (this.state !== 'playing' || !this.flagship || this.flagship.sinking) return;
    this.effects.fireBroadside(this.flagship, side);
  }

  setSail(delta) {
    if (this.state !== 'playing') return;
    this.flagship?.setSail(delta);
  }

  boardableTarget() {
    const f = this.flagship;
    if (!f || f.sinking || f.crew <= 4) return null;
    for (const s of this.ships) {
      if (s.faction !== 'spain' || s.dead || s.sinking) continue;
      if (s.hp / s.maxHp >= 0.5) continue;
      const maxD = (f.def.len + s.def.len) * 0.5 + 8;
      if (f.pos.distanceTo(s.pos) < maxD) return s;
    }
    return null;
  }

  toggleBoard() {
    if (this.state !== 'playing') return;
    if (this.boarding) {
      this.cancelBoarding();
      return;
    }
    const target = this.boardableTarget();
    if (!target) return;
    const f = this.flagship;
    const local = f.mesh.group.worldToLocal(target.pos.clone());
    const side = Math.sign(local.x) || 1;
    const localB = target.mesh.group.worldToLocal(f.pos.clone());
    f.boarding = { side };
    f.steerTarget = null;
    target.boarding = { side: Math.sign(localB.x) || 1 };
    target.steerTarget = null;
    this.boarding = { attacker: f, defender: target, progress: 0, casualtyT: 0, attackerLossT: 0 };
    this.makeRopes(f, target);
  }

  makeRopes(a, b) {
    const mat = new THREE.LineBasicMaterial({ color: 0x3a2c18 });
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(geo, mat);
      line.userData.za = rand(-a.def.len * 0.25, a.def.len * 0.25);
      line.userData.zb = rand(-b.def.len * 0.25, b.def.len * 0.25);
      this.scene.add(line);
      this.ropes.push(line);
    }
  }

  clearRopes() {
    for (const r of this.ropes) this.scene.remove(r);
    this.ropes = [];
  }

  cancelBoarding() {
    if (!this.boarding) return;
    this.boarding.attacker.boarding = null;
    this.boarding.defender.boarding = null;
    this.boarding = null;
    this.clearRopes();
  }

  // ------------------------------------------------------------ events

  onShipSunk(ship) {
    this.sound.knell();
    if (this.boarding && (this.boarding.attacker === ship || this.boarding.defender === ship)) {
      this.cancelBoarding();
    }
    if (ship.faction === 'spain') {
      this.sinkings++;
      if (ship.gold > 0) this.spawnLoot(ship);
    } else {
      const i = this.fleet.indexOf(ship);
      if (i >= 0) this.fleet.splice(i, 1);
      if (ship === this.flagship) {
        if (this.fleet.length > 0) {
          this.flagship = this.fleet[0];
          this.hud.banner(`The flag passes to ${this.flagship.name}`);
        } else {
          this.flagship = null;
          this.gameOver();
        }
      }
    }
  }

  spawnLoot(ship) {
    const total = Math.round(ship.gold * 0.5);
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const barrel = new THREE.Mesh(BARREL_GEO, toonMat(0x9a6b35));
      barrel.rotation.z = Math.PI / 2;
      g.add(barrel);
      const band = new THREE.Mesh(BARREL_BAND_GEO, toonMat(0x4a3826));
      band.rotation.z = Math.PI / 2;
      g.add(band);
      g.position.set(ship.pos.x + rand(-8, 8), 0, ship.pos.z + rand(-8, 8));
      g.rotation.y = rand(0, Math.PI * 2);
      this.scene.add(g);
      this.loot.push({ mesh: g, gold: Math.max(5, Math.round(total / n)), age: 0 });
    }
  }

  addGold(amount, worldPos) {
    this.gold += amount;
    this.hud.floaterAt(worldPos, `+${amount} ⛁`);
    this.sound.coin();
  }

  gameOver() {
    if (this.state === 'over') return;
    this.state = 'over';
    this.cancelBoarding();
    this.hud.showGameOver({
      gold: this.gold,
      captures: this.captures,
      sinkings: this.sinkings,
      minutes: Math.max(1, Math.round((this.elapsed - (this.startTime || 0)) / 60)),
    });
  }

  // ------------------------------------------------------------ spawning

  pickSpawnClass() {
    const g = this.gold;
    let weights;
    if (g < 500) weights = { sloop: 45, brigantine: 40, frigate: 10, galleon: 5 };
    else if (g < 1500) weights = { sloop: 25, brigantine: 35, frigate: 25, galleon: 15 };
    else if (g < 3000) weights = { sloop: 15, brigantine: 25, frigate: 30, galleon: 20, shipOfTheLine: 10 };
    else weights = { sloop: 10, brigantine: 20, frigate: 30, galleon: 25, shipOfTheLine: 15 };

    if (g >= 400 && !this.ships.some((s) => s.classKey === 'galleon' && s.faction === 'spain' && !s.dead && !s.sinking)) {
      return 'galleon';
    }
    let total = 0;
    for (const k in weights) total += weights[k];
    let roll = Math.random() * total;
    for (const k in weights) {
      roll -= weights[k];
      if (roll <= 0) return k;
    }
    return 'sloop';
  }

  updateSpawning(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = 9;
    const alive = this.ships.filter((s) => s.faction === 'spain' && !s.dead && !s.sinking).length;
    const target = 5 + Math.max(0, this.fleet.length - 1);
    if (alive >= target || !this.flagship) return;
    const a = rand(0, Math.PI * 2);
    const d = rand(460, 620);
    let x = this.flagship.pos.x + Math.cos(a) * d;
    let z = this.flagship.pos.z + Math.sin(a) * d;
    const r = Math.hypot(x, z);
    if (r > 800) {
      x *= 780 / r;
      z *= 780 / r;
    }
    this.addShip(this.pickSpawnClass(), 'spain', x, z, rand(0, Math.PI * 2));
  }

  // ------------------------------------------------------------ update

  update(dt, t) {
    this.elapsed = t;
    const f = this.flagship;

    // player helm
    if (this.state === 'playing' && f && !f.sinking) {
      const keyR = this.input.keyRudder();
      if (f.boarding) {
        f.steerTarget = null;
      } else if (keyR !== 0) {
        f.steerTarget = null;
        f.rudder = keyR;
      } else if (this.input.steerPoint) {
        f.steerTarget = this.input.steerPoint.clone();
      } else {
        f.steerTarget = null;
        f.rudder *= Math.max(0, 1 - dt * 4);
      }
    }

    this.rig.zoom(this.input.consumeZoom());

    // AI
    let fleetIdx = 0;
    for (const s of this.ships) {
      if (s.dead || s.sinking) continue;
      if (s.faction === 'spain') {
        updateSpanishAI(s, this, dt);
      } else if (s !== this.flagship) {
        updateFleetAI(s, this, dt, fleetIdx++);
      } else {
        fleetIdx++;
      }
    }

    // simulate
    for (const s of this.ships) s.update(dt, t);
    for (let i = this.ships.length - 1; i >= 0; i--) {
      if (this.ships[i].dead) this.ships.splice(i, 1);
    }

    this.resolveCollisions(dt);
    this.updateBoarding(dt);
    this.updateLoot(dt, t);
    this.updateWakes(dt);
    this.effects.update(dt, t);
    this.updateSpawning(dt);

    // camera + audio focus
    if (f) {
      this.rig.update(f, dt);
      this.sound.listener = f.pos;
    }
    this.ocean.update(t, this.camera.position.x, this.camera.position.z);
    this.env.update(dt, this.camera);

    this.hud.update(dt);
    this.labels.update();

    // victory
    if (
      this.state === 'playing' && !this.victoryShown && this.gold >= 10000 &&
      this.fleet.some((s) => s.classKey === 'shipOfTheLine')
    ) {
      this.victoryShown = true;
      this.sound.fanfare();
      this.hud.banner('⚑ TERROR OF THE SPANISH MAIN ⚑<br><small>10,000 gold and a ship of the line — the Crown salutes you</small>', 8000);
    }
  }

  resolveCollisions(dt) {
    for (let i = 0; i < this.ships.length; i++) {
      for (let j = i + 1; j < this.ships.length; j++) {
        const a = this.ships[i];
        const b = this.ships[j];
        if (a.sinking || b.sinking) continue;
        if (this.boarding && ((this.boarding.attacker === a && this.boarding.defender === b) ||
          (this.boarding.attacker === b && this.boarding.defender === a))) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const minD = a.hitRadius + b.hitRadius;
        if (d < minD && d > 0.001) {
          const push = (minD - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          a.pos.x -= nx * push;
          a.pos.z -= nz * push;
          b.pos.x += nx * push;
          b.pos.z += nz * push;
          a.speed *= 1 - dt * 1.5;
          b.speed *= 1 - dt * 1.5;
        }
      }
    }
  }

  updateBoarding(dt) {
    const bd = this.boarding;
    if (!bd) return;
    const { attacker: a, defender: d } = bd;
    if (a.sinking || d.sinking || a.dead || d.dead) {
      this.cancelBoarding();
      return;
    }

    // winch the hulls together and keep them parallel
    const gap = a.pos.distanceTo(d.pos);
    const targetGap = (a.def.wid + d.def.wid) * 0.5 + 2;
    if (gap > targetGap) {
      const dir = new THREE.Vector3().subVectors(d.pos, a.pos).normalize();
      const pull = Math.min(2.6 * dt, gap - targetGap);
      a.pos.addScaledVector(dir, pull / 2);
      d.pos.addScaledVector(dir, -pull / 2);
    }
    let hd = a.heading - d.heading;
    while (hd > Math.PI) hd -= Math.PI * 2;
    while (hd < -Math.PI) hd += Math.PI * 2;
    // align to parallel (same or opposite heading, whichever is closer)
    const align = Math.abs(hd) < Math.PI / 2 ? hd : hd - Math.sign(hd) * Math.PI;
    d.heading += align * Math.min(1, dt * 1.2);

    // melee: capture progress + casualties
    const ratio = a.crew / (a.crew + 1.2 * d.crew);
    bd.progress += 0.11 * ratio * dt * (d.crew <= 3 ? 2 : 1);
    bd.casualtyT += dt;
    bd.attackerLossT += dt;
    if (bd.casualtyT > 2.2) {
      bd.casualtyT = 0;
      d.crew = Math.max(1, d.crew - 1);
    }
    if (bd.attackerLossT > 4.5) {
      bd.attackerLossT = 0;
      a.crew = Math.max(4, a.crew - 1);
    }

    // ropes follow the hulls
    for (const rope of this.ropes) {
      const pa = a.localToWorld(0, a.mesh.deckY + 0.6, rope.userData.za);
      const pb = d.localToWorld(0, d.mesh.deckY + 0.6, rope.userData.zb);
      rope.geometry.setFromPoints([pa, pb]);
    }

    if (bd.progress >= 1) this.completeCapture();
  }

  completeCapture() {
    const { defender: d, attacker: a } = this.boarding;
    this.cancelBoarding();

    this.addGold(d.gold, d.pos.clone().add(new THREE.Vector3(0, 14, 0)));
    d.gold = 0;
    d.crew = Math.max(4, Math.round(d.crew * 0.3));
    d.faction = 'england';
    d.ai = null;
    d.wp = null;
    d.reloadTime = 3.5;
    d.hp = Math.max(d.hp, d.maxHp * 0.55);
    d.buildMesh();
    d.buildCrew();
    this.fleet.push(d);
    this.captures++;
    this.sound.fanfare();
    this.hud.banner(`⚑ ${d.name} taken — she sails for England!`);
    a.crew += 2; // survivors freed from her brig join you
  }

  updateLoot(dt, t) {
    for (let i = this.loot.length - 1; i >= 0; i--) {
      const l = this.loot[i];
      l.age += dt;
      const p = l.mesh.position;
      p.y = waveHeight(p.x, p.z, t) * 0.8;
      l.mesh.rotation.x = Math.sin(t * 1.3 + i) * 0.15;

      let remove = l.age > 60;
      if (!remove && this.flagship && this.state === 'playing' &&
        this.flagship.pos.distanceTo(p) < this.flagship.def.wid * 0.5 + 7) {
        this.addGold(l.gold, p);
        remove = true;
      }
      if (remove) {
        this.scene.remove(l.mesh);
        this.loot.splice(i, 1);
      }
    }
  }

  updateWakes(dt) {
    for (const s of this.ships) {
      if (s.sinking || s.speed < 2.5) continue;
      s.wakeT = (s.wakeT ?? 0) - dt;
      if (s.wakeT <= 0) {
        s.wakeT = 2.4 / s.speed;
        this.effects.spawnWake(s);
      }
    }
  }
}
