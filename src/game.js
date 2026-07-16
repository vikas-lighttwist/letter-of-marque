import * as THREE from 'three';
import { Ship } from './ships/ship.js';
import { FACTIONS, SHIP_CLASSES } from './ships/factory.js';
import { Effects } from './combat/effects.js';
import { updateSpanishAI, updateFleetAI } from './ai/ai.js';
import { CameraRig } from './core/cameraRig.js';
import { HUD } from './ui/hud.js';
import { Labels } from './ui/labels.js';
import { Minimap } from './ui/minimap.js';
import { AshoreMode, islandGroundY } from './ashore/ashore.js';
import { buildTavernInterior } from './ashore/tavernInterior.js';
import { makeCaptain } from './ships/captain.js';
import { waveHeight } from './world/waves.js';
import { toonMat } from './core/toon.js';

const BARREL_GEO = new THREE.CylinderGeometry(0.9, 0.9, 1.6, 8);
const BARREL_BAND_GEO = new THREE.CylinderGeometry(0.95, 0.95, 0.18, 8);

export const SHOP_ITEMS = [
  {
    id: 'carronades', name: 'Carronades', icon: '💥', cost: 800, once: true,
    desc: 'Short smashers — every broadside hits +40% harder.',
  },
  {
    id: 'longnines', name: 'Long Nines', icon: '🎯', cost: 600, once: true,
    desc: 'Long-barrelled chasers — shot flies 25% faster and farther.',
  },
  {
    id: 'doubleshot', name: 'Double-Shot Racks', icon: '🔗', cost: 1200, once: true,
    desc: 'Two balls in every barrel. Twice the iron per volley.',
  },
  {
    id: 'oak', name: 'Live Oak Hulls', icon: '🛡', cost: 700, once: true,
    desc: 'Refit the whole fleet: +30% hull strength (future prizes too).',
  },
  {
    id: 'crew', name: 'Hire Hands', icon: '⚓', cost: 150, once: false,
    desc: '+10 crew for your flagship. Stronger boarding parties.',
  },
  {
    id: 'repair', name: 'Careen & Repair', icon: '🔨', cost: 100, once: false,
    desc: 'Shipwrights patch the whole fleet to full health.',
  },
];

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

    this.wind = { angle: rand(0, Math.PI * 2), seed: rand(0, 10) };
    this.upgrades = { dmg: 1, range: 1, double: false, oak: false, owned: new Set() };
    this.buffs = { speedUntil: 0, repairUntil: 0 };

    // shared tap targets (captain, parrot, …)
    this.clickables = [];
    this.tapCooldown = 0;
    this._ray = new THREE.Raycaster();
    window.addEventListener('pointerdown', (e) => this.handleTap(e));

    // ambience pacing
    this.gullT = 4;
    this.creakT = 6;
    this.hunterT = 240;
    this.dolphinT = 35;

    this.ships = [];
    this.fleet = [];
    this.loot = [];
    this.boardings = [];
    this.treasure = null;
    this.bounty = null; // active Governor's bounty
    this.bountyOffer = null; // posted at the tavern
    this.shore = null; // {island, figures} while anchored
    this.anchorT = 0;
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
    this.minimap = new Minimap(this);
    this.ashore = new AshoreMode(this);
    this.tavernInterior = buildTavernInterior(scene);

    // the tavern folk have things to say (only reachable when you're inside)
    const inn = this.tavernInterior;
    this.clickables.push(
      { obj: inn.innParrot, fn: () => this.parrotTapped(inn.innParrot) },
      { obj: inn.megFig, fn: () => this.pirateTapped(inn.megFig, 'meg') },
      { obj: inn.barkeepFig, fn: () => this.pirateTapped(inn.barkeepFig, 'barkeep') }
    );
    for (const p of inn.patrons) {
      if (p === inn.megFig) continue;
      this.clickables.push({ obj: p, fn: () => this.pirateTapped(p, 'patron') });
    }

    // the captain stands the quarterdeck of whatever ship you command
    this.deckCap = makeCaptain();
    this.clickables.push(
      { obj: this.deckCap.parrot, fn: () => this.parrotTapped(this.deckCap.parrot) },
      { obj: this.deckCap.group, fn: () => this.captainTapped(this.deckCap.group) }
    );
  }

  // ------------------------------------------------------------ taps

  handleTap(e) {
    if (this.tapCooldown > 0 || !this.clickables.length) return;
    const ndc = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    this._ray.setFromCamera(ndc, this.camera);
    let best = null;
    for (const c of this.clickables) {
      const hits = this._ray.intersectObject(c.obj, true);
      if (hits.length && (!best || hits[0].distance < best.d)) {
        best = { c, d: hits[0].distance };
      }
    }
    if (best) {
      this.tapCooldown = 1.4;
      best.c.fn();
    }
  }

  parrotTapped(parrotObj) {
    this.sound.parrotClip();
  }

  captainTapped(capObj) {
    const LINES = [
      'Steady as she goes!',
      'All hands on deck!',
      'Fair winds today, mate.',
      'The Main is ours for the taking!',
      'Keep a weather eye on the horizon.',
      'A fine day for plunder!',
      "Mind the gulls — they'll have yer biscuit.",
    ];
    const line = LINES[Math.floor(Math.random() * LINES.length)];
    const p = new THREE.Vector3();
    capObj.getWorldPosition(p);
    p.y += 2.2;
    this.hud.floaterAt(p, line, 'speech');
    if (this.sound.ready()) this.sound.blip(240, 0, 0.12, 0.2, 'triangle');
  }

  // tavern folk, seasoned with a little Treasure Island
  pirateTapped(fig, kind) {
    const POOLS = {
      patron: [
        '"Fifteen men on a dead man\'s chest — yo ho ho!"',
        '"Keep a weather eye out for a one-legged seafaring man."',
        '"I sailed with Flint once. Or a fella called Flint. Or his parrot."',
        '"X marks the spot, they say. They say a lot o\' things."',
        '"Black spots? Bah. Superstition… mostly."',
        '"Sixteen years ashore an\' the floor still rolls."',
        '"Never bet yer ship against Meg. …I had three."',
        '"They buried it, I tell ye! Doubloons deep as yer knee!"',
        '"I knew a sea-cook once. Tall fellow. Made a fine stew."',
      ],
      meg: [
        '"Sit down or shove off, Captain."',
        '"The dice be honest. Me? Mostly."',
        '"I won me first sloop off a man twice yer size."',
        '"Flint himself feared two things: the gallows, an\' my cargo rolls."',
      ],
      barkeep: [
        '"Stew\'s hot, fizz is cold, floor\'s mostly clean."',
        '"No brawlin\'. The last fella who brawled swabs me pots now."',
        '"Ginger grog — strong enough to curl yer beard, honest enough for a bosun."',
        '"That parrot o\' yours eats more biscuit than my whole taproom."',
      ],
    };
    const pool = POOLS[kind];
    let line;
    do {
      line = pool[Math.floor(Math.random() * pool.length)];
    } while (line === this._lastPirateLine && pool.length > 1);
    this._lastPirateLine = line;
    const p = new THREE.Vector3();
    fig.getWorldPosition(p);
    p.y += 1.8;
    this.hud.floaterAt(p, line, 'speech');
    if (this.sound.ready()) {
      this.sound.blip(150 + Math.random() * 80, 0, 0.16, 0.18, 'triangle'); // a low "harr"
    }
  }

  updateDeckCaptain(dt, t) {
    const f = this.flagship;
    const cap = this.deckCap.group;
    const show = f && !f.sinking && !this.ashore.active;
    if (!show) {
      if (cap.parent) cap.parent.remove(cap);
      return;
    }
    const host = f.mesh.group;
    if (cap.parent !== host) {
      host.add(cap);
      // he commands from atop the sterncastle where you can see him;
      // on castle-less sloops he stands the open stern deck
      const def = f.def;
      if (def.castles >= 1) {
        cap.position.set(0, f.mesh.deckY + def.hullH * 0.52 + 0.02, -def.len * 0.335);
      } else {
        cap.position.set(0, f.mesh.deckY + 0.1, -def.len * 0.3);
      }
      cap.rotation.set(0, 0, 0);
      cap.scale.setScalar(1.35);
    }
    cap.rotation.z = Math.sin(t * 1.7) * 0.03; // sea legs
    this.deckCap.parrot.rotation.z = Math.sin(t * 3.1) * 0.08;
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
    this.sound.startAmbience();
  }

  // ------------------------------------------------------------ actions

  // one button, two broadsides — iron in every direction
  fire() {
    if (this.state !== 'playing' || !this.flagship || this.flagship.sinking) return;
    this.effects.fireBroadside(this.flagship, 'port');
    this.effects.fireBroadside(this.flagship, 'starboard');
  }

  setSail(delta) {
    if (this.state !== 'playing' || !this.flagship) return;
    if (this.flagship.anchored && delta > 0) this.weighAnchor();
    this.flagship.setSail(delta);
  }

  setFlagship(ship) {
    if (!ship || ship === this.flagship || ship.sinking || ship.dead) return;
    if (ship.faction !== 'england') return;
    if (this.flagship?.anchored) this.weighAnchor();
    this.flagship = ship;
    ship.orders = 'follow';
    if (ship.sailSetting === 0) ship.sailSetting = 2;
    this.hud.banner(`You command ${ship.name}`);
  }

  cycleFlagship() {
    if (this.fleet.length < 2 || !this.flagship) return;
    const i = this.fleet.indexOf(this.flagship);
    this.setFlagship(this.fleet[(i + 1) % this.fleet.length]);
  }

  setOrders(ship, orders) {
    if (ship === this.flagship || ship.faction !== 'england') return;
    ship.orders = orders;
  }

  callAllToFollow() {
    for (const s of this.fleet) if (s !== this.flagship) s.orders = 'follow';
    this.hud.banner('⚑ The fleet forms on your flag');
  }

  // ------------------------------------------------------------ boarding

  playerBoarding() {
    return this.boardings.find((b) => b.attacker === this.flagship) || null;
  }

  boardableTarget() {
    const f = this.flagship;
    if (!f || f.sinking || f.boarding || f.crew <= 4) return null;
    return this.findBoardable(f);
  }

  findBoardable(attacker) {
    for (const s of this.ships) {
      if (s.faction !== 'spain' || s.dead || s.sinking || s.boarding) continue;
      if (s.hp / s.maxHp >= 0.5) continue;
      const maxD = (attacker.def.len + s.def.len) * 0.5 + 8;
      if (attacker.pos.distanceTo(s.pos) < maxD) return s;
    }
    return null;
  }

  toggleBoard() {
    if (this.state !== 'playing') return;
    const mine = this.playerBoarding();
    if (mine) {
      this.cancelBoarding(mine);
      return;
    }
    const target = this.boardableTarget();
    if (target) this.startBoarding(this.flagship, target);
  }

  startBoarding(attacker, defender) {
    if (attacker.boarding || defender.boarding || attacker.sinking || defender.sinking) return;
    if (attacker.anchored) this.weighAnchor();
    const local = attacker.mesh.group.worldToLocal(defender.pos.clone());
    const localB = defender.mesh.group.worldToLocal(attacker.pos.clone());
    attacker.boarding = { side: Math.sign(local.x) || 1, partner: defender };
    attacker.steerTarget = null;
    defender.boarding = { side: Math.sign(localB.x) || 1, partner: attacker };
    defender.steerTarget = null;
    const bd = { attacker, defender, progress: 0, casualtyT: 0, attackerLossT: 0, ropes: [] };
    const mat = new THREE.LineBasicMaterial({ color: 0x3a2c18 });
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(geo, mat);
      line.userData.za = rand(-attacker.def.len * 0.25, attacker.def.len * 0.25);
      line.userData.zb = rand(-defender.def.len * 0.25, defender.def.len * 0.25);
      this.scene.add(line);
      bd.ropes.push(line);
    }
    this.boardings.push(bd);
  }

  cancelBoarding(bd) {
    if (!bd) return;
    bd.attacker.boarding = null;
    bd.defender.boarding = null;
    for (const r of bd.ropes) this.scene.remove(r);
    const i = this.boardings.indexOf(bd);
    if (i >= 0) this.boardings.splice(i, 1);
  }

  updateBoardings(dt) {
    for (let i = this.boardings.length - 1; i >= 0; i--) {
      const bd = this.boardings[i];
      const { attacker: a, defender: d } = bd;
      if (a.sinking || d.sinking || a.dead || d.dead) {
        this.cancelBoarding(bd);
        continue;
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
      const align = Math.abs(hd) < Math.PI / 2 ? hd : hd - Math.sign(hd) * Math.PI;
      d.heading += align * Math.min(1, dt * 1.2);

      // nearby friendly ships lend half their crews to the melee
      let assist = 0;
      for (const s of this.fleet) {
        if (s === a || s.sinking) continue;
        if (s.pos.distanceTo(d.pos) < 45) assist += s.crew * 0.5;
      }
      const atk = a.crew + assist;
      const ratio = atk / (atk + 1.2 * d.crew);
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

      for (const rope of bd.ropes) {
        const pa = a.localToWorld(0, a.mesh.deckY + 0.6, rope.userData.za);
        const pb = d.localToWorld(0, d.mesh.deckY + 0.6, rope.userData.zb);
        rope.geometry.setFromPoints([pa, pb]);
      }

      // the ring of steel on steel
      bd.clankT = (bd.clankT ?? 0.4) - dt;
      if (bd.clankT <= 0) {
        bd.clankT = 0.45 + Math.random() * 0.5;
        this.sound.clank(d.pos);
      }

      if (bd.progress >= 1) this.completeCapture(bd);
    }
  }

  completeCapture(bd) {
    const { defender: d, attacker: a } = bd;
    this.cancelBoarding(bd);

    this.addGold(d.gold, d.pos.clone().add(new THREE.Vector3(0, 14, 0)));
    d.gold = 0;
    d.crew = Math.max(4, Math.round(d.crew * 0.3));
    d.faction = 'england';
    d.orders = a === this.flagship ? 'follow' : a.orders;
    d.wp = null;
    d.reloadTime = 3.5;
    if (this.upgrades.oak && !d.oakFitted) {
      d.maxHp = Math.round(d.maxHp * 1.3);
      d.oakFitted = true;
    }
    d.hp = Math.max(d.hp, d.maxHp * 0.55);
    d.buildMesh();
    d.buildCrew();
    this.fleet.push(d);
    this.captures++;
    this.bountyProgress('capture', d.classKey);
    this.sound.fanfare();
    const by = a === this.flagship ? '' : ` by ${a.name}`;
    this.hud.banner(`⚑ ${d.name} taken${by} — she sails for England!`);
    a.crew += 2;
  }

  // ------------------------------------------------------------ islands & port

  nearIsland() {
    const f = this.flagship;
    if (!f) return null;
    for (const isl of this.env.islands) {
      if (Math.hypot(f.pos.x - isl.x, f.pos.z - isl.z) < isl.r + 28) return isl;
    }
    return null;
  }

  canAnchor() {
    const f = this.flagship;
    if (!f || f.sinking || f.boarding || f.anchored || this.state !== 'playing') return null;
    if (f.speed > 4) return null;
    return this.nearIsland();
  }

  nearPort() {
    const p = this.env.port;
    const f = this.flagship;
    if (!p || !f) return false;
    return Math.hypot(f.pos.x - p.x, f.pos.z - p.z) < p.r + 34;
  }

  isSafeHarbor(pos) {
    const p = this.env.port;
    return p && Math.hypot(pos.x - p.x, pos.z - p.z) < p.r + 50;
  }

  dropAnchor() {
    const isl = this.canAnchor();
    if (!isl) return;
    const f = this.flagship;
    f.anchored = true;
    f.sailSetting = 0;
    this.anchorT = 0;

    // shore party rows in to stretch their legs
    const figures = [];
    const toShip = Math.atan2(f.pos.x - isl.x, f.pos.z - isl.z);
    const fac = FACTIONS.england;
    for (let i = 0; i < 5; i++) {
      const fig = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.66, 6), toonMat(fac.crewBody));
      body.position.y = 0.33;
      fig.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5), toonMat(0xd8a377));
      head.position.y = 0.82;
      fig.add(head);
      const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 6), toonMat(fac.crewHat));
      hat.position.y = 0.95;
      fig.add(hat);
      const a = toShip + rand(-0.7, 0.7);
      const r = isl.r * rand(0.62, 0.85);
      fig.position.set(isl.x + Math.sin(a) * r, 2.1, isl.z + Math.cos(a) * r);
      this.scene.add(fig);
      figures.push({
        fig,
        target: null,
        wait: rand(0.5, 2),
        baseAngle: toShip,
      });
    }
    this.shore = { island: isl, figures };
    this.hud.banner('⚓ Anchored — the crew heads ashore');
  }

  weighAnchor() {
    const f = this.flagship;
    if (f) f.anchored = false;
    if (this.ashore?.active) this.ashore.finish();
    if (this.shore) {
      for (const s of this.shore.figures) this.scene.remove(s.fig);
      this.shore = null;
    }
  }

  toggleAnchor() {
    if (this.flagship?.anchored) {
      this.weighAnchor();
      if (this.flagship.sailSetting === 0) this.flagship.sailSetting = 2;
    } else {
      this.dropAnchor();
    }
  }

  updateShore(dt, t) {
    const f = this.flagship;
    if (!f?.anchored) return;
    // repairs and recruits come easier at anchor
    this.anchorT += dt;
    if (f.hp < f.maxHp) f.hp = Math.min(f.maxHp, f.hp + 2.5 * dt);
    if (this.anchorT > 6) {
      this.anchorT = 0;
      if (f.crew < f.def.crew) f.crew++;
    }
    if (!this.shore) return;
    const isl = this.shore.island;
    for (const s of this.shore.figures) {
      if (s.wait > 0) {
        s.wait -= dt;
        continue;
      }
      if (!s.target) {
        const a = s.baseAngle + rand(-0.9, 0.9);
        const r = isl.r * rand(0.55, 0.88);
        s.target = new THREE.Vector2(isl.x + Math.sin(a) * r, isl.z + Math.cos(a) * r);
      }
      const dx = s.target.x - s.fig.position.x;
      const dz = s.target.y - s.fig.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.4) {
        s.target = null;
        s.wait = rand(1, 4);
      } else {
        const sp = 1.4 * dt;
        s.fig.position.x += (dx / d) * sp;
        s.fig.position.z += (dz / d) * sp;
        s.fig.position.y = 2.1 + Math.abs(Math.sin(t * 9 + s.fig.id)) * 0.07;
        s.fig.rotation.y = Math.atan2(dx, dz);
      }
    }
  }

  // ------------------------------------------------------------ ashore & market

  goAshore() {
    const isl = this.nearIsland();
    if (this.state !== 'playing' || !this.flagship?.anchored || !isl || this.ashore.active) return;
    this.ashore.begin(isl);
  }

  // the anchor-slot button: weigh/drop anchor at sea, return-to-ship when
  // ashore, and "leave the tavern" while inside it
  anchorAction() {
    if (this.ashore.active) {
      if (this.ashore.room === 'tavern') this.ashore.exitTavern();
      else this.ashore.requestReturn();
    } else {
      this.toggleAnchor();
    }
  }

  nearTavern() {
    const tv = this.env.port?.tavern;
    if (!tv || !this.ashore.active || this.ashore.phase !== 'walk' || !this.ashore.island?.port) return false;
    const c = this.ashore.captain.pos;
    return Math.hypot(c.x - tv.x, c.z - tv.z) < 11;
  }

  // who's within chatting range inside the tavern?
  tavernPOI() {
    if (this.ashore.room !== 'tavern') return null;
    const inn = this.tavernInterior;
    const c = this.ashore.captain.pos;
    const near = (p, r) => Math.hypot(c.x - p.x, c.z - p.z) < r;
    if (near(inn.meg, 5)) return 'dice';
    if (near(inn.barkeep, 5)) return 'galley';
    if (near(inn.board, 4.5)) return 'board';
    return null;
  }

  // the point-of-interest button: go ashore when anchored; ashore it becomes
  // dig / tavern door / merchant, and inside the tavern: barkeep / Meg / board
  poiAction() {
    if (!this.ashore.active) {
      this.goAshore();
      return;
    }
    if (this.ashore.room === 'tavern') {
      const poi = this.tavernPOI();
      if (poi === 'galley') this.hud.showGalley();
      else if (poi === 'dice') this.hud.showDice();
      else if (poi === 'board') this.hud.showBounty();
      return;
    }
    if (this.nearDigSpot()) this.digTreasure();
    else if (this.nearTavern()) this.ashore.enterTavern();
    else if (this.ashore.nearShop()) this.hud.showMarket();
  }

  closeMarket() {
    // the market is just an overlay now — nothing to unpause
  }

  // ------------------------------------------------------------ tavern fare & wagers

  tavernBuy(id) {
    const costs = { fizz: 30, stew: 40, duff: 60, map: 150 };
    const cost = costs[id];
    if (cost === undefined || this.gold < cost) return false;
    if (id === 'map' && this.treasure) return false;
    this.gold -= cost;
    switch (id) {
      case 'fizz':
        this.buffs.speedUntil = this.elapsed + 90;
        this.hud.banner('🥥 The crew cheers — full speed ahead! (90s)');
        break;
      case 'stew':
        this.buffs.repairUntil = this.elapsed + 90;
        this.hud.banner('🍲 Hearty bellies mend hulls — fast repairs! (90s)');
        break;
      case 'duff':
        if (this.flagship) this.flagship.crew += 3;
        this.hud.banner('🍮 Word spreads of a generous captain — 3 hands sign on!');
        break;
      case 'map':
        this.createTreasure();
        break;
    }
    this.sound.coin();
    return true;
  }

  createTreasure() {
    const isls = this.env.islands.filter((i) => !i.port);
    const isl = isls[Math.floor(Math.random() * isls.length)];
    const a = rand(0, Math.PI * 2);
    const rr = isl.rRaw * rand(0.3, 0.65);
    const x = isl.x + Math.sin(a) * rr;
    const z = isl.z + Math.cos(a) * rr;
    const marker = new THREE.Group();
    for (const rot of [Math.PI / 4, -Math.PI / 4]) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.45), toonMat(0x4a3826));
      plank.rotation.y = rot;
      marker.add(plank);
    }
    marker.position.set(x, islandGroundY(isl, x, z) + 0.08, z);
    this.scene.add(marker);
    this.treasure = { island: isl, x, z, marker };
    this.hud.banner('🗺 The map marks an island on your chart — seek the ✕!');
  }

  nearDigSpot() {
    const tr = this.treasure;
    if (!tr || !this.ashore.active || this.ashore.phase !== 'walk') return false;
    if (this.ashore.island !== tr.island) return false;
    const c = this.ashore.captain.pos;
    return Math.hypot(c.x - tr.x, c.z - tr.z) < 5;
  }

  digTreasure() {
    if (!this.nearDigSpot()) return;
    const tr = this.treasure;
    this.treasure = null;
    this.scene.remove(tr.marker);
    this.sound.dig();
    setTimeout(() => this.sound.dig(), 350);

    const y = islandGroundY(tr.island, tr.x, tr.z);
    const chest = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.85), toonMat(0x7a4a26));
    body.position.y = 0.35;
    chest.add(body);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.85), toonMat(0x8a5a33));
    lid.position.set(0, 0.78, -0.36);
    lid.rotation.x = -1.0;
    chest.add(lid);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.87), toonMat(0xd9a94a));
    strap.position.y = 0.35;
    chest.add(strap);
    const pile = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), toonMat(0xf2c14e));
    pile.position.y = 0.62;
    chest.add(pile);
    chest.position.set(tr.x, y, tr.z);
    chest.rotation.y = rand(0, Math.PI * 2);
    this.scene.add(chest);

    const amount = 400 + Math.round(Math.random() * 500);
    this.hud.banner('⛏ The spades bite wood — a chest!');
    setTimeout(() => {
      this.addGold(amount, new THREE.Vector3(tr.x, y + 2.5, tr.z));
      this.sound.fanfare();
    }, 600);
    this.bountyProgress('dig');
  }

  // ---------------------------------------------------------- bounties

  generateBountyOffer() {
    if (this.bountyOffer) return this.bountyOffer;
    if (Math.random() < 0.15) {
      this.bountyOffer = { type: 'dig', desc: 'Dig up a buried treasure', need: 1, have: 0, reward: 250 };
      return this.bountyOffer;
    }
    const pool = this.gold < 500 ? ['sloop', 'brigantine']
      : this.gold < 2000 ? ['brigantine', 'frigate']
      : ['frigate', 'galleon'];
    const classKey = pool[Math.floor(Math.random() * pool.length)];
    const type = Math.random() < 0.55 ? 'sink' : 'capture';
    const need = type === 'sink' ? 2 : 1;
    const base = { sloop: 60, brigantine: 110, frigate: 200, galleon: 340 }[classKey];
    const reward = Math.round(base * need * (type === 'capture' ? 1.8 : 1));
    const label = SHIP_CLASSES[classKey].label;
    this.bountyOffer = {
      type, classKey, need, have: 0, reward,
      desc: `${type === 'sink' ? 'Sink' : 'Capture'} ${need} Spanish ${label}${need > 1 ? 's' : ''}`,
    };
    return this.bountyOffer;
  }

  acceptBounty() {
    if (!this.bountyOffer || this.bounty) return;
    this.bounty = this.bountyOffer;
    this.bountyOffer = null;
    this.hud.banner(`☠ Bounty taken: ${this.bounty.desc}`);
  }

  bountyProgress(type, classKey) {
    const b = this.bounty;
    if (!b || b.type !== type) return;
    if (b.classKey && b.classKey !== classKey) return;
    b.have++;
    if (b.have >= b.need) {
      this.bounty = null;
      this.hud.banner(`☑ Bounty complete — the Governor pays ${b.reward} ⛁!`, 5000);
      this.sound.fanfare();
      if (this.flagship) {
        this.addGold(b.reward, this.flagship.pos.clone().add(new THREE.Vector3(0, 14, 0)));
      } else {
        this.gold += b.reward;
      }
    }
  }

  megShipClass() {
    const r = Math.random();
    return r < 0.5 ? 'sloop' : r < 0.8 ? 'brigantine' : 'frigate';
  }

  winShipFromBet(classKey) {
    const p = this.env.port;
    const a = rand(0, Math.PI * 2);
    const s = this.addShip(
      classKey, 'england',
      p.x + Math.sin(a) * (p.r + 40), p.z + Math.cos(a) * (p.r + 40),
      rand(0, Math.PI * 2)
    );
    if (this.upgrades.oak) {
      s.maxHp = Math.round(s.maxHp * 1.3);
      s.hp = s.maxHp;
      s.oakFitted = true;
    }
    s.reloadTime = 2.2;
    s.orders = 'follow';
    this.fleet.push(s);
    this.hud.banner(`⚑ You won ${s.name} — she anchors off the port!`);
    return s;
  }

  loseShipToBet(ship) {
    const i = this.fleet.indexOf(ship);
    if (i < 0 || ship === this.flagship) return;
    this.fleet.splice(i, 1);
    ship.faction = 'spain';
    ship.orders = 'follow';
    ship.wp = null;
    ship.buildMesh();
    ship.buildCrew();
    this.hud.banner(`${ship.name} hoists Meg's colors and slips away…`);
  }

  buy(id) {
    const item = SHOP_ITEMS.find((s) => s.id === id);
    if (!item || this.gold < item.cost) return false;
    if (item.once && this.upgrades.owned.has(id)) return false;
    this.gold -= item.cost;
    this.upgrades.owned.add(id);
    switch (id) {
      case 'carronades':
        this.upgrades.dmg = 1.4;
        break;
      case 'longnines':
        this.upgrades.range = 1.25;
        break;
      case 'doubleshot':
        this.upgrades.double = true;
        break;
      case 'oak':
        this.upgrades.oak = true;
        for (const s of this.fleet) {
          if (!s.oakFitted) {
            s.maxHp = Math.round(s.maxHp * 1.3);
            s.hp = Math.min(s.maxHp, s.hp * 1.3);
            s.oakFitted = true;
          }
        }
        break;
      case 'crew':
        if (this.flagship) this.flagship.crew += 10;
        break;
      case 'repair':
        for (const s of this.fleet) s.hp = s.maxHp;
        break;
    }
    this.sound.coin();
    return true;
  }

  // ------------------------------------------------------------ events

  onShipSunk(ship) {
    this.sound.knell();
    for (const bd of [...this.boardings]) {
      if (bd.attacker === ship || bd.defender === ship) this.cancelBoarding(bd);
    }
    if (ship.faction === 'spain') {
      this.sinkings++;
      if (ship.gold > 0) this.spawnLoot(ship);
      this.bountyProgress('sink', ship.classKey);
    } else {
      const i = this.fleet.indexOf(ship);
      if (i >= 0) this.fleet.splice(i, 1);
      if (ship === this.flagship) {
        this.weighAnchor();
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
    for (const bd of [...this.boardings]) this.cancelBoarding(bd);
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

    // the wind slowly veers around the compass
    this.wind.angle += (Math.sin(t * 0.017 + this.wind.seed) * 0.02 + 0.006) * dt;

    // player helm
    if (this.state === 'playing' && f && !f.sinking) {
      const keyR = this.input.keyRudder();
      if (f.boarding || f.anchored) {
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
    this.updateBoardings(dt);
    this.updateShore(dt, t);
    this.updateLoot(dt, t);
    this.updateWakes(dt);
    this.effects.update(dt, t);
    this.updateSpawning(dt);
    this.updateHunters(dt);
    this.updateAmbientSounds(dt);
    this.updateDeckCaptain(dt, t);
    this.tapCooldown = Math.max(0, this.tapCooldown - dt);

    this.rig.zoom(this.input.consumeZoom());

    // camera + audio focus: the ashore mode drives its own camera
    if (this.ashore.active) {
      this.ashore.update(dt, t);
      this.sound.listener = this.ashore.captain?.pos ?? f?.pos;
    } else if (f) {
      this.rig.update(f, dt);
      this.sound.listener = f.pos;
    }
    this.ocean.update(t, this.camera.position.x, this.camera.position.z);
    this.env.update(dt, this.camera, this.wind.angle, t);

    this.hud.update(dt);
    this.labels.update();
    this.minimap.update();

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

  // seagull cries near land, rigging creaks under way
  updateAmbientSounds(dt) {
    const f = this.flagship;
    if (!f || this.state === 'intro') return;
    this.gullT -= dt;
    if (this.gullT <= 0) {
      this.gullT = 6 + Math.random() * 9;
      const isl = this.env.islands.find(
        (i) => Math.hypot(f.pos.x - i.x, f.pos.z - i.z) < i.r + 130
      );
      if (isl) this.sound.gull(new THREE.Vector3(isl.x, 20, isl.z));
    }
    this.creakT -= dt;
    if (this.creakT <= 0) {
      this.creakT = 4 + Math.random() * 6;
      if (f.speed > 3 && !this.ashore.active) this.sound.creak(f.pos);
    }
    this.dolphinT -= dt;
    if (this.dolphinT <= 0) {
      this.dolphinT = 50 + Math.random() * 60;
      if (f.speed > 3.5 && !this.ashore.active) this.effects.spawnDolphinPod(f);
    }
  }

  // once you're rich, Spain sends hunters
  updateHunters(dt) {
    if (this.state !== 'playing' || this.gold < 800 || !this.flagship) return;
    this.hunterT -= dt;
    if (this.hunterT > 0) return;
    this.hunterT = 300;
    const alive = this.ships.filter((s) => s.faction === 'spain' && !s.dead).length;
    if (alive > 13) return;
    const bearing = rand(0, Math.PI * 2);
    for (const off of [-0.25, 0.25]) {
      let x = this.flagship.pos.x + Math.sin(bearing + off) * 500;
      let z = this.flagship.pos.z + Math.cos(bearing + off) * 500;
      const r = Math.hypot(x, z);
      if (r > 800) {
        x *= 780 / r;
        z *= 780 / r;
      }
      const h = this.addShip('frigate', 'spain', x, z, bearing + Math.PI);
      h.gold = Math.round(h.gold * 1.5); // hunters carry the King's pay chest
    }
    this.hud.banner('⚠ Spanish hunters are on your trail!');
    this.sound.knell();
  }

  // a ship crossed the world edge and reappeared on the far side —
  // shift the camera with the flagship so the jump is invisible
  onShipWrapped(ship, dx, dz) {
    if (ship !== this.flagship) return;
    this.rig.pos.x += dx;
    this.rig.pos.z += dz;
    this.rig.look.x += dx;
    this.rig.look.z += dz;
  }

  resolveCollisions(dt) {
    for (let i = 0; i < this.ships.length; i++) {
      for (let j = i + 1; j < this.ships.length; j++) {
        const a = this.ships[i];
        const b = this.ships[j];
        if (a.sinking || b.sinking) continue;
        if (a.boarding?.partner === b) continue;
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
