import * as THREE from 'three';
import { SHIP_CLASSES } from '../ships/factory.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(game) {
    this.game = game;
    this.v = new THREE.Vector3();
    this.fleetSig = '';
    this.fleetFills = [];

    $('fire-port').addEventListener('click', () => game.fire('port'));
    $('fire-starboard').addEventListener('click', () => game.fire('starboard'));
    $('sail-up').addEventListener('click', () => game.setSail(1));
    $('sail-down').addEventListener('click', () => game.setSail(-1));
    $('board-btn').addEventListener('click', () => game.toggleBoard());
    $('mute-btn').addEventListener('click', () => {
      game.sound.muted = !game.sound.muted;
      $('mute-btn').textContent = game.sound.muted ? '🔇' : '🔊';
    });
  }

  // ---------------------------------------------------------- overlays

  showIntro(onStart) {
    const card = $('overlay-card');
    card.innerHTML = `
      <h1>Letters of Marque</h1>
      <h2>The Caribbean, 1670 — you carry the Crown's letter of marque.<br>
      Every Spanish sail is a prize. Weaken them, board them, take them whole.</h2>
      <table>
        <tr><td>Steer</td><td>hold / drag on the sea — the ship follows the ring</td></tr>
        <tr><td>Sails</td><td>− / + buttons &nbsp;(or W / S)</td></tr>
        <tr><td>Broadsides</td><td>PORT / STARBOARD buttons &nbsp;(or Q / E) — they glow when guns bear</td></tr>
        <tr><td>Board</td><td>green BOARD button when a weakened enemy is alongside &nbsp;(or F)</td></tr>
        <tr><td>Zoom</td><td>scroll or pinch</td></tr>
      </table>
      <p>Sink a ship and half her gold drowns with her. <b>Board her instead</b> — take all
      the gold, part of the crew, and the ship herself joins your fleet. Grow strong enough
      to take a <b>Ship of the Line</b> and amass 10,000 gold.</p>
      <button class="big-btn" id="start-btn">⚓ Set Sail</button>`;
    $('overlay').classList.remove('hidden');
    $('start-btn').addEventListener('click', () => {
      $('overlay').classList.add('hidden');
      $('hud').classList.remove('hidden');
      onStart();
    });
  }

  showGameOver({ gold, captures, sinkings, minutes }) {
    const card = $('overlay-card');
    card.innerHTML = `
      <h1>Lost With All Hands</h1>
      <h2>Your last ship has gone to the bottom of the Spanish Main.</h2>
      <p class="stats">
        ⛁ <b>${gold}</b> gold plundered<br>
        ⚑ <b>${captures}</b> prizes taken &nbsp;·&nbsp; ☠ <b>${sinkings}</b> ships sunk<br>
        ⌛ <b>${minutes}</b> minute${minutes === 1 ? '' : 's'} at sea
      </p>
      <button class="big-btn" id="restart-btn">⚓ Sail Again</button>`;
    $('overlay').classList.remove('hidden');
    $('hud').classList.add('hidden');
    $('restart-btn').addEventListener('click', () => location.reload());
  }

  banner(html, ms = 3500) {
    const b = $('banner');
    b.innerHTML = html;
    b.classList.remove('hidden');
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => b.classList.add('hidden'), ms);
  }

  floaterAt(worldPos, text) {
    this.v.copy(worldPos).project(this.game.camera);
    if (this.v.z > 1) return;
    const el = document.createElement('div');
    el.className = 'floater';
    el.textContent = text;
    el.style.left = `${((this.v.x + 1) / 2) * window.innerWidth}px`;
    el.style.top = `${((1 - this.v.y) / 2) * window.innerHeight}px`;
    $('floaters').appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  // ---------------------------------------------------------- per-frame

  inArc(side) {
    const f = this.game.flagship;
    if (!f) return false;
    const sideSign = side === 'port' ? 1 : -1;
    const dirX = Math.cos(f.heading) * sideSign;
    const dirZ = -Math.sin(f.heading) * sideSign;
    for (const s of this.game.ships) {
      if (s.faction !== 'spain' || s.dead || s.sinking) continue;
      const dx = s.pos.x - f.pos.x;
      const dz = s.pos.z - f.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 90 || d < 0.001) continue;
      if ((dx / d) * dirX + (dz / d) * dirZ > 0.82) return true;
    }
    return false;
  }

  update(dt) {
    const g = this.game;
    const f = g.flagship;
    if (!f) return;

    $('pp-name').textContent = f.name;
    $('pp-class').textContent = SHIP_CLASSES[f.classKey].label;
    $('pp-hp').style.width = `${(f.hp / f.maxHp) * 100}%`;
    $('pp-crew').textContent = f.crew;
    $('pp-gold').textContent = g.gold;
    $('pp-sails').textContent = '▮'.repeat(f.sailSetting) || '—';

    const pips = document.querySelectorAll('#sail-pips i');
    pips.forEach((pip, i) => pip.classList.toggle('on', i < f.sailSetting));

    for (const side of ['port', 'starboard']) {
      const btn = $(side === 'port' ? 'fire-port' : 'fire-starboard');
      const reloading = f.reload[side] > 0;
      btn.classList.toggle('reloading', reloading);
      btn.classList.toggle('ready', !reloading && this.inArc(side));
    }

    // board button
    const bb = $('board-btn');
    if (g.boarding) {
      bb.classList.remove('hidden');
      bb.classList.add('boarding');
      bb.textContent = `✂ Cut Ropes — ${Math.floor(g.boarding.progress * 100)}%`;
    } else if (g.state === 'playing' && g.boardableTarget()) {
      bb.classList.remove('hidden', 'boarding');
      bb.textContent = '⚔ BOARD';
    } else {
      bb.classList.add('hidden');
    }

    // fleet panel
    const sig = g.fleet.map((s) => s.id).join(',');
    if (sig !== this.fleetSig) {
      this.fleetSig = sig;
      const list = $('fleet-list');
      list.innerHTML = '';
      this.fleetFills = [];
      for (const s of g.fleet) {
        const item = document.createElement('div');
        item.className = 'fleet-item' + (s === f ? ' flagship' : '');
        item.innerHTML = `<span class="fname">${s.name}</span> <span class="dim">· ${SHIP_CLASSES[s.classKey].label}</span>
          <div class="bar hp"><div class="fill"></div></div>`;
        list.appendChild(item);
        this.fleetFills.push([s, item.querySelector('.fill')]);
      }
    }
    for (const [s, fill] of this.fleetFills) {
      fill.style.width = `${(s.hp / s.maxHp) * 100}%`;
    }

    // steering ring
    const ring = $('steer-ring');
    const sp = g.input.steerScreen;
    if (g.state === 'playing' && g.input.pointers.size === 1 && sp && !f.boarding) {
      ring.classList.remove('hidden');
      ring.style.left = `${sp.x}px`;
      ring.style.top = `${sp.y}px`;
    } else {
      ring.classList.add('hidden');
    }
  }
}
