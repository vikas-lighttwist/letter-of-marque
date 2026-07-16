import * as THREE from 'three';
import { SHIP_CLASSES } from '../ships/factory.js';

const CLASS_INITIAL = {
  sloop: 'S', brigantine: 'B', frigate: 'F', galleon: 'G', shipOfTheLine: 'L',
};

// Projected HTML labels above ships, tags on flotsam, and screen-edge arrows
// pointing at off-screen Spanish sails.
export class Labels {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('labels');
    this.arrowRoot = document.getElementById('arrows');
    this.entries = new Map(); // ship.id → {el, refs}
    this.lootTags = new Map();
    this.arrows = [];
    this.v = new THREE.Vector3();
  }

  shipEl(ship) {
    let e = this.entries.get(ship.id);
    const facClass = ship.faction === 'spain' ? 'spanish' : 'english';
    if (e && e.facClass !== facClass) {
      e.el.remove();
      this.entries.delete(ship.id);
      e = null;
    }
    if (!e) {
      const el = document.createElement('div');
      el.className = `ship-label ${facClass}`;
      const goldRow = ship.faction === 'spain'
        ? `<div class="lgold">⛁ <span class="gnum"></span></div><div class="bar gold-bar"><div class="fill gfill"></div></div>`
        : '';
      el.innerHTML = `
        <div class="lname"></div>
        <div class="lclass"></div>
        <div class="bar hp"><div class="fill hfill"></div></div>
        ${goldRow}
        <div class="cap-row"><div class="bar capture"><div class="fill cfill"></div></div></div>`;
      this.root.appendChild(el);
      e = {
        el,
        facClass,
        name: el.querySelector('.lname'),
        cls: el.querySelector('.lclass'),
        hp: el.querySelector('.hfill'),
        gnum: el.querySelector('.gnum'),
        gfill: el.querySelector('.gfill'),
        cfill: el.querySelector('.cfill'),
      };
      this.entries.set(ship.id, e);
    }
    return e;
  }

  update() {
    const { game } = this;
    const cam = game.camera;
    const seen = new Set();
    const needArrows = [];

    for (const ship of game.ships) {
      if (ship.dead) continue;
      const anchor = ship.labelAnchor();
      this.v.copy(anchor).project(cam);
      const behind = this.v.z > 1;
      const dist = cam.position.distanceTo(ship.pos);
      const onScreen = !behind && Math.abs(this.v.x) < 1.02 && Math.abs(this.v.y) < 1.02;

      if (ship.faction === 'spain' && !onScreen && !ship.sinking && dist < 700) {
        needArrows.push(ship);
      }
      if (!onScreen || dist > 300 || ship === game.flagship) continue;

      seen.add(ship.id);
      const e = this.shipEl(ship);
      const x = ((this.v.x + 1) / 2) * window.innerWidth;
      const y = ((1 - this.v.y) / 2) * window.innerHeight;
      e.el.style.transform = `translate(${x - 75}px, ${y}px) translateY(-100%)`;
      e.el.style.opacity = ship.sinking ? 0.4 : Math.min(1, (320 - dist) / 60);

      e.name.textContent = ship.name;
      e.cls.textContent = ship.sinking ? 'Going down…' : SHIP_CLASSES[ship.classKey].label;
      e.hp.style.width = `${(ship.hp / ship.maxHp) * 100}%`;
      if (e.gnum) {
        e.gnum.textContent = ship.gold;
        const maxGold = SHIP_CLASSES[ship.classKey].gold[1];
        e.gfill.style.width = `${Math.min(100, (ship.gold / maxGold) * 100)}%`;
      }
      const capturing = game.boardings.find((b) => b.defender === ship);
      e.el.classList.toggle('capturing', !!capturing);
      if (capturing) e.cfill.style.width = `${capturing.progress * 100}%`;
    }

    // remove stale labels
    for (const [id, e] of this.entries) {
      if (!seen.has(id)) {
        e.el.remove();
        this.entries.delete(id);
      }
    }

    this.updateLootTags(cam);
    this.updateArrows(needArrows, cam);
  }

  updateLootTags(cam) {
    const seen = new Set();
    for (const l of this.game.loot) {
      this.v.copy(l.mesh.position).project(cam);
      if (this.v.z > 1 || Math.abs(this.v.x) > 1 || Math.abs(this.v.y) > 1) continue;
      const dist = cam.position.distanceTo(l.mesh.position);
      if (dist > 160) continue;
      seen.add(l);
      let el = this.lootTags.get(l);
      if (!el) {
        el = document.createElement('div');
        el.className = 'ship-label spanish';
        el.style.width = 'auto';
        el.innerHTML = `<div class="lgold">⛁ ${l.gold}</div>`;
        this.root.appendChild(el);
        this.lootTags.set(l, el);
      }
      const x = ((this.v.x + 1) / 2) * window.innerWidth;
      const y = ((1 - this.v.y) / 2) * window.innerHeight;
      el.style.transform = `translate(${x - 20}px, ${y - 34}px)`;
    }
    for (const [l, el] of this.lootTags) {
      if (!seen.has(l)) {
        el.remove();
        this.lootTags.delete(l);
      }
    }
  }

  updateArrows(ships, cam) {
    ships.sort((a, b) => cam.position.distanceTo(a.pos) - cam.position.distanceTo(b.pos));
    ships = ships.slice(0, 6);
    while (this.arrows.length < ships.length) {
      const el = document.createElement('div');
      el.className = 'edge-arrow';
      this.arrowRoot.appendChild(el);
      this.arrows.push(el);
    }
    while (this.arrows.length > ships.length) {
      this.arrows.pop().remove();
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const flag = this.game.flagship;
    for (let i = 0; i < ships.length; i++) {
      const s = ships[i];
      const el = this.arrows[i];
      this.v.copy(s.pos).project(cam);
      let x = this.v.x;
      let y = this.v.y;
      if (this.v.z > 1) {
        x = -x;
        y = -1;
      }
      const m = Math.max(Math.abs(x), Math.abs(y), 0.0001);
      x = (x / m) * 0.92;
      y = (y / m) * 0.92;
      const px = ((x + 1) / 2) * w;
      const py = ((1 - y) / 2) * h;
      const rot = (Math.atan2(x, y) * 180) / Math.PI;
      el.style.transform = `translate(${px - 17}px, ${py - 17}px)`;
      el.style.setProperty('--rot', `${rot}deg`);
      el.textContent = CLASS_INITIAL[s.classKey];
      el.style.opacity = flag && flag.pos.distanceTo(s.pos) < 250 ? 1 : 0.55;
    }
  }
}
