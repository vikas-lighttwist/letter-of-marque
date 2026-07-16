import * as THREE from 'three';
import { SHIP_CLASSES } from '../ships/factory.js';
import { SHOP_ITEMS } from '../game.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(game) {
    this.game = game;
    this.v = new THREE.Vector3();
    this.fleetSig = '';
    this.fleetFills = [];

    $('fire-btn').addEventListener('click', () => game.fire());
    $('sail-up').addEventListener('click', () => game.setSail(1));
    $('sail-down').addEventListener('click', () => game.setSail(-1));
    $('board-btn').addEventListener('click', () => game.toggleBoard());
    $('anchor-btn').addEventListener('click', () => game.anchorAction());
    $('market-btn').addEventListener('click', () => game.marketAction());
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
        <tr><td>Wind</td><td>watch the dial — run with the wind for a burst of speed</td></tr>
        <tr><td>Fire</td><td>the 🔥 FIRE button lets fly both broadsides &nbsp;(or Space) — it glows when guns bear</td></tr>
        <tr><td>Board</td><td>green BOARD button when a weakened enemy is alongside &nbsp;(or F)</td></tr>
        <tr><td>Fleet</td><td>tap a ship in the fleet panel to command her (or C) — set the rest to ⚑ follow or ⚔ hunt</td></tr>
        <tr><td>Islands</td><td>slow down near shore, ⚓ anchor, then 🚶 go ashore and explore on foot</td></tr>
        <tr><td>Port</td><td>row into the ⚓ gold island and walk to the market for cannon and crew</td></tr>
        <tr><td>The edge</td><td>sail off the edge of the chart and you'll appear on the far side</td></tr>
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

  showMarket() {
    const card = $('overlay-card');
    const rows = SHOP_ITEMS.map((item) => {
      return `<div class="shop-item" data-id="${item.id}">
        <div class="shop-icon">${item.icon}</div>
        <div class="shop-info">
          <div class="shop-name">${item.name}</div>
          <div class="shop-desc">${item.desc}</div>
        </div>
        <button class="shop-buy" data-id="${item.id}">${item.cost} ⛁</button>
      </div>`;
    }).join('');
    card.innerHTML = `
      <h1>Port Royal Market</h1>
      <h2>Chandlers, gunsmiths and shipwrights — plunder welcome. &nbsp;⛁ <b id="shop-gold">${this.game.gold}</b></h2>
      <div id="shop-list">${rows}</div>
      <button class="big-btn" id="close-market">⚓ Back to Sea</button>`;
    $('overlay').classList.remove('hidden');
    this.refreshMarket();
    card.querySelectorAll('.shop-buy').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.game.buy(btn.dataset.id)) {
          $('shop-gold').textContent = this.game.gold;
          this.refreshMarket();
        }
      });
    });
    $('close-market').addEventListener('click', () => {
      $('overlay').classList.add('hidden');
      this.game.closeMarket();
    });
  }

  refreshMarket() {
    const g = this.game;
    for (const item of SHOP_ITEMS) {
      const btn = document.querySelector(`.shop-buy[data-id="${item.id}"]`);
      if (!btn) continue;
      const owned = item.once && g.upgrades.owned.has(item.id);
      btn.disabled = owned || g.gold < item.cost;
      btn.textContent = owned ? '✓ Fitted' : `${item.cost} ⛁`;
      btn.classList.toggle('owned', owned);
    }
  }

  banner(html, ms = 3500) {
    const b = $('banner');
    b.innerHTML = html;
    b.classList.remove('hidden');
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => b.classList.add('hidden'), ms);
  }

  floaterAt(worldPos, text, cls = '') {
    this.v.copy(worldPos).project(this.game.camera);
    if (this.v.z > 1) return;
    const el = document.createElement('div');
    el.className = `floater ${cls}`;
    el.textContent = text;
    el.style.left = `${((this.v.x + 1) / 2) * window.innerWidth}px`;
    el.style.top = `${((1 - this.v.y) / 2) * window.innerHeight}px`;
    $('floaters').appendChild(el);
    setTimeout(() => el.remove(), cls === 'speech' ? 2000 : 1300);
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
    $('pp-sails').textContent = f.anchored ? '⚓' : '▮'.repeat(f.sailSetting) || '—';

    const pips = document.querySelectorAll('#sail-pips i');
    pips.forEach((pip, i) => pip.classList.toggle('on', i < f.sailSetting));

    // wind dial: arrow shows where the wind blows, relative to our heading
    const arrow = $('wind-arrow');
    const rel = f.heading - g.wind.angle;
    arrow.style.transform = `rotate(${rel - Math.PI / 2}rad)`; // ➤ glyph points right at 0

    const along = Math.cos(rel);
    arrow.classList.toggle('fair', along > 0.4);
    arrow.classList.toggle('foul', along < -0.4);

    const ashore = g.ashore?.active;
    $('controls-bar').classList.toggle('hidden', !!ashore);

    const fireBtn = $('fire-btn');
    const portReady = f.reload.port <= 0;
    const stbdReady = f.reload.starboard <= 0;
    fireBtn.classList.toggle('reloading', !portReady && !stbdReady);
    fireBtn.classList.toggle(
      'ready',
      (portReady && this.inArc('port')) || (stbdReady && this.inArc('starboard'))
    );

    // contextual buttons
    const bb = $('board-btn');
    const mine = g.playerBoarding();
    if (!ashore && mine) {
      bb.classList.remove('hidden');
      bb.classList.add('boarding');
      bb.textContent = `✂ Cut Ropes — ${Math.floor(mine.progress * 100)}%`;
    } else if (!ashore && g.state === 'playing' && g.boardableTarget()) {
      bb.classList.remove('hidden', 'boarding');
      bb.textContent = '⚔ BOARD';
    } else {
      bb.classList.add('hidden');
    }

    const ab = $('anchor-btn');
    const mb = $('market-btn');
    if (ashore) {
      // ashore: anchor slot = return to ship, market slot = shop door
      if (g.ashore.phase === 'walk') {
        ab.classList.remove('hidden');
        ab.textContent = '⛵ Return to Ship';
        mb.classList.toggle('hidden', !g.ashore.nearShop());
        mb.textContent = '🛒 Enter the Market';
      } else {
        ab.classList.add('hidden');
        mb.classList.add('hidden');
      }
    } else {
      if (f.anchored) {
        ab.classList.remove('hidden');
        ab.textContent = '⚓ Weigh Anchor';
      } else if (g.canAnchor()) {
        ab.classList.remove('hidden');
        ab.textContent = '⚓ Drop Anchor';
      } else {
        ab.classList.add('hidden');
      }
      mb.classList.toggle('hidden', !(g.state === 'playing' && f.anchored));
      mb.textContent = '🚶 Go Ashore';
    }

    // fleet panel — rebuilt when composition/flagship/orders change
    const sig = g.fleet.map((s) => `${s.id}${s === f ? '*' : ''}${s.orders}`).join(',');
    if (sig !== this.fleetSig) {
      this.fleetSig = sig;
      const list = $('fleet-list');
      list.innerHTML = '';
      this.fleetFills = [];
      for (const s of g.fleet) {
        const item = document.createElement('div');
        item.className = 'fleet-item' + (s === f ? ' flagship' : '');
        const orderBtn = s === f
          ? ''
          : `<button class="order-btn ${s.orders}" title="${s.orders === 'follow' ? 'Following you — tap to send her hunting' : 'Hunting alone — tap to call her back'}">${s.orders === 'follow' ? '⚑' : '⚔'}</button>`;
        item.innerHTML = `<div class="fleet-main" title="${s === f ? 'Your flagship' : 'Tap to take command'}">
            <span class="fname">${s.name}</span> <span class="dim">· ${SHIP_CLASSES[s.classKey].label}</span>
            <div class="bar hp"><div class="fill"></div></div>
          </div>${orderBtn}`;
        list.appendChild(item);
        this.fleetFills.push([s, item.querySelector('.fill')]);
        item.querySelector('.fleet-main').addEventListener('click', () => g.setFlagship(s));
        const ob = item.querySelector('.order-btn');
        if (ob) {
          ob.addEventListener('click', (e) => {
            e.stopPropagation();
            g.setOrders(s, s.orders === 'follow' ? 'hunt' : 'follow');
          });
        }
      }
      const call = document.createElement('button');
      call.id = 'call-all';
      call.textContent = '📣 All follow me';
      call.addEventListener('click', () => g.callAllToFollow());
      if (g.fleet.length > 1) list.appendChild(call);
    }
    for (const [s, fill] of this.fleetFills) {
      fill.style.width = `${(s.hp / s.maxHp) * 100}%`;
    }

    // steering / walking ring
    const ring = $('steer-ring');
    const sp = g.input.steerScreen;
    const steering = g.state === 'playing' && !f.boarding;
    const walking = ashore && g.ashore.phase === 'walk';
    if ((steering || walking) && g.input.pointers.size === 1 && sp) {
      ring.classList.remove('hidden');
      ring.style.left = `${sp.x}px`;
      ring.style.top = `${sp.y}px`;
    } else {
      ring.classList.add('hidden');
    }
  }
}
