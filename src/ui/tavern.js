import { SHIP_CLASSES } from '../ships/factory.js';

const $ = (id) => document.getElementById(id);
const DIE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MENU = [
  { id: 'fizz', icon: '🥥', name: 'Coconut Fizz', cost: 30, desc: 'A round for the crew — the fleet sails 15% faster for 90 seconds.' },
  { id: 'stew', icon: '🍲', name: 'Hot Fish Stew', cost: 40, desc: 'Hearty bellies mend hulls — repairs run 3× faster for 90 seconds.' },
  { id: 'duff', icon: '🍮', name: 'Plum Duff for All', cost: 60, desc: 'Word spreads of a generous captain — 3 hands join your flagship.' },
  { id: 'map', icon: '🗺', name: 'Weathered Treasure Map', cost: 150, desc: 'An old salt swears by it. An ✕ appears somewhere on your chart…' },
];

const MEG_WINS = ['"Har! The sea giveth, an\' Meg taketh away!"', '"Better luck next tide, sprout!"'];
const MEG_LOSES = ['"Blast an\' barnacles! Take it, then."', '"Ye\'ve the devil\'s own luck, Captain!"'];
const MEG_PUSH = '"A draw? Bah. The dice be sleepin\'."';

// One round of Ship, Captain & Crew per player: 3 rolls of 5 dice, lock a
// 6 (ship), then 5 (captain), then 4 (crew); the last two dice are cargo.
function newTurn() {
  return { need: [6, 5, 4], locked: [], dice: [], cargo: null, rolls: 3, kept: false };
}

function doRoll(t) {
  t.rolls--;
  let dice = Array.from({ length: 5 - t.locked.length }, () => 1 + Math.floor(Math.random() * 6));
  let changed = true;
  while (changed && t.need.length) {
    changed = false;
    const idx = dice.indexOf(t.need[0]);
    if (idx >= 0) {
      t.locked.push(t.need.shift());
      dice.splice(idx, 1);
      changed = true;
    }
  }
  t.dice = dice;
  if (!t.need.length) t.cargo = dice;
}

function rerollCargo(t) {
  t.rolls--;
  t.cargo = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
  t.dice = t.cargo;
}

function cargoSum(t) {
  return t.cargo ? t.cargo[0] + t.cargo[1] : 0;
}

function score(t) {
  return t.need.length ? 0 : cargoSum(t);
}

function turnOver(t) {
  return t.kept || t.rolls === 0;
}

export class Tavern {
  constructor(game) {
    this.game = game;
  }

  show(section = 'galley') {
    this.section = section;
    $('overlay').classList.remove('hidden');
    if (section === 'galley') this.renderGalley();
    else if (section === 'dice') this.renderDiceLobby();
    else this.renderBoard();
  }

  close() {
    $('overlay').classList.add('hidden');
  }

  closeBtn(label = '🚪 Step Away') {
    return `<button class="big-btn" id="tav-close">${label}</button>`;
  }

  wireClose() {
    $('tav-close')?.addEventListener('click', () => this.close());
  }

  // ------------------------------------------------------------ the barkeep

  renderGalley() {
    const g = this.game;
    const card = $('overlay-card');
    const galley = MENU.map(
      (m) => `<div class="shop-item">
        <div class="shop-icon">${m.icon}</div>
        <div class="shop-info">
          <div class="shop-name">${m.name}</div>
          <div class="shop-desc">${m.desc}</div>
        </div>
        <button class="shop-buy" data-id="${m.id}">${m.cost} ⛁</button>
      </div>`
    ).join('');

    card.innerHTML = `
      <h1>🍗 The Galley</h1>
      <h2>"What'll it be, Captain?" &nbsp;⛁ <b id="tav-gold">${g.gold}</b></h2>
      <div id="shop-list">${galley}</div>
      ${this.closeBtn()}`;

    card.querySelectorAll('.shop-buy').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (g.tavernBuy(btn.dataset.id)) {
          $('tav-gold').textContent = g.gold;
          this.refreshGalley();
        }
      });
    });
    this.wireClose();
    this.refreshGalley();
  }

  // ------------------------------------------------------------ the bounty board

  renderBoard() {
    const g = this.game;
    const card = $('overlay-card');
    let bountyHTML;
    if (g.bounty) {
      bountyHTML = `<div class="bounty-line">Current bounty: <b>${g.bounty.desc}</b> — ${g.bounty.have}/${g.bounty.need}</div>
        <p class="dice-rules">Finish the job before taking another.</p>`;
    } else {
      const offer = g.generateBountyOffer();
      bountyHTML = `<div class="bounty-line"><b>${offer.desc}</b> — pays <b>${offer.reward} ⛁</b>
        <button id="take-bounty">Take it</button></div>`;
    }
    card.innerHTML = `
      <h1>☠ Governor's Bounty Board</h1>
      <h2>Parchment and nails — the Crown's dirty work, fairly paid.</h2>
      ${bountyHTML}
      ${this.closeBtn()}`;
    $('take-bounty')?.addEventListener('click', () => {
      this.game.acceptBounty();
      this.renderBoard();
    });
    this.wireClose();
  }

  // ------------------------------------------------------------ Meg's table

  renderDiceLobby() {
    const g = this.game;
    const card = $('overlay-card');
    card.innerHTML = `
      <h1>🎲 One-Eyed Meg</h1>
      <h2>"Sit down, Captain. Dice don't bite — much." &nbsp;⛁ <b id="tav-gold">${g.gold}</b></h2>
      <p class="dice-rules">Ship, Captain &amp; Crew: three rolls to find a ⚅ ship, ⚄ captain and ⚃ crew,
      in that order. The two dice left over are your cargo — highest cargo takes the pot.</p>
      <div class="stake-row">
        <button class="stake" data-stake="25">25 ⛁</button>
        <button class="stake" data-stake="100">100 ⛁</button>
        <button class="stake" data-stake="500">500 ⛁</button>
        <button id="ship-bet">⛵ Bet a Ship</button>
      </div>
      ${this.closeBtn('🚪 Not Today, Meg')}`;

    card.querySelectorAll('.stake').forEach((btn) => {
      btn.addEventListener('click', () => {
        const stake = Number(btn.dataset.stake);
        if (g.gold < stake) return;
        g.gold -= stake;
        this.stake = stake;
        this.shipBet = null;
        this.beginMatch();
      });
    });
    $('ship-bet').addEventListener('click', () => this.renderShipPick());
    const shipBet = $('ship-bet');
    if (shipBet) shipBet.disabled = g.fleet.length < 2;
    this.wireClose();
  }

  refreshGalley() {
    const g = this.game;
    for (const m of MENU) {
      const btn = document.querySelector(`.shop-buy[data-id="${m.id}"]`);
      if (!btn) continue;
      const blocked = g.gold < m.cost || (m.id === 'map' && g.treasure);
      btn.disabled = blocked;
      btn.textContent = m.id === 'map' && g.treasure ? 'Bought' : `${m.cost} ⛁`;
    }
    const shipBet = $('ship-bet');
    if (shipBet) shipBet.disabled = g.fleet.length < 2;
  }

  renderShipPick() {
    const g = this.game;
    if (g.fleet.length < 2) return;
    const card = $('overlay-card');
    const rows = g.fleet
      .filter((s) => s !== g.flagship)
      .map(
        (s, i) => `<button class="ship-pick" data-i="${i}">
          ${s.name} · ${SHIP_CLASSES[s.classKey].label}</button>`
      )
      .join('');
    card.innerHTML = `
      <h1>⛵ Stake a Ship</h1>
      <h2>Meg eyes your fleet. "Put up a hull, an' I'll match it with one o' mine."</h2>
      <div class="stake-col">${rows}</div>
      <button class="big-btn" id="pick-back">Back</button>`;
    const others = g.fleet.filter((s) => s !== g.flagship);
    card.querySelectorAll('.ship-pick').forEach((btn) => {
      btn.addEventListener('click', () => {
        const yours = others[Number(btn.dataset.i)];
        const theirs = g.megShipClass();
        this.stake = 0;
        this.shipBet = { yours, theirs };
        this.beginMatch();
      });
    });
    $('pick-back').addEventListener('click', () => this.renderDiceLobby());
  }

  // ------------------------------------------------------------ the match

  beginMatch() {
    this.you = newTurn();
    this.meg = newTurn();
    this.done = false;
    this.status = this.shipBet
      ? `You stake ${this.shipBet.yours.name} — Meg stakes a ${SHIP_CLASSES[this.shipBet.theirs].label}!`
      : `${this.stake} ⛁ each in the pot. Roll!`;
    this.renderTable();
  }

  diceRow(label, t) {
    const lockGlyphs = [6, 5, 4]
      .map((v, i) => {
        const got = t.locked.length > i;
        return `<span class="die ${got ? 'locked' : 'empty'}">${DIE[v - 1]}</span>`;
      })
      .join('');
    let free = '';
    if (t.cargo) {
      free = t.cargo.map((v) => `<span class="die cargo">${DIE[v - 1]}</span>`).join('');
    } else if (t.dice.length) {
      free = t.dice.map((v) => `<span class="die">${DIE[v - 1]}</span>`).join('');
    } else {
      free = '<span class="die empty">?</span>'.repeat(Math.max(0, 5 - t.locked.length - 3) + 2);
    }
    const sc = t.cargo ? `<span class="cargo-sum">${cargoSum(t)}</span>` : '';
    return `<div class="dice-row"><span class="dname">${label}</span>${lockGlyphs}<span class="dice-gap"></span>${free}${sc}</div>`;
  }

  renderTable() {
    const card = $('overlay-card');
    const you = this.you;
    const betLine = this.shipBet
      ? `${this.shipBet.yours.name} vs. a ${SHIP_CLASSES[this.shipBet.theirs].label}`
      : `${this.stake * 2} ⛁ pot`;

    let controls = '';
    if (!this.done) {
      if (!turnOver(you)) {
        if (you.cargo && you.rolls > 0) {
          controls = `<button id="keep-btn">Keep Cargo (${cargoSum(you)})</button>
            <button id="reroll-btn">Re-roll Cargo — ${you.rolls} left</button>`;
        } else if (you.rolls > 0) {
          controls = `<button id="roll-btn">🎲 Roll — ${you.rolls} left</button>`;
        }
      }
    } else {
      controls = `<button id="again-btn">Play Again</button><button id="room-btn">Back to the Tavern</button>`;
    }

    card.innerHTML = `
      <h1>🎲 Ship, Captain &amp; Crew</h1>
      <h2>${betLine}</h2>
      <div id="dice-table">
        ${this.diceRow('You', this.you)}
        ${this.diceRow('Meg', this.meg)}
      </div>
      <div class="dice-status">${this.status ?? ''}</div>
      <div class="dice-controls">${controls}</div>
      ${this.megLine ? `<div class="meg-line">${this.megLine}</div>` : ''}`;

    $('roll-btn')?.addEventListener('click', () => this.playerRoll());
    $('reroll-btn')?.addEventListener('click', () => this.playerReroll());
    $('keep-btn')?.addEventListener('click', () => this.playerKeep());
    $('again-btn')?.addEventListener('click', () => this.playAgain());
    $('room-btn')?.addEventListener('click', () => {
      this.megLine = null;
      this.renderDiceLobby();
    });
  }

  playerRoll() {
    doRoll(this.you);
    const y = this.you;
    this.status = y.need.length
      ? `Still hunting a ${['ship ⚅', 'captain ⚄', 'crew ⚃'][3 - y.need.length]}…`
      : `Cargo ${cargoSum(y)}! ${y.rolls > 0 ? 'Keep it or press your luck?' : ''}`;
    if (turnOver(y)) this.megTurn();
    else this.renderTable();
  }

  playerReroll() {
    rerollCargo(this.you);
    this.status = `Cargo ${cargoSum(this.you)}${this.you.rolls > 0 ? ' — keep or roll again?' : ''}`;
    if (turnOver(this.you)) this.megTurn();
    else this.renderTable();
  }

  playerKeep() {
    this.you.kept = true;
    this.megTurn();
  }

  async megTurn() {
    this.status = score(this.you) === 0 && this.you.rolls === 0 && this.you.need.length
      ? 'No ship, no captain, no crew — cargo 0. Meg grins…'
      : "Meg spits on her palms an' rolls…";
    this.renderTable();
    await sleep(700);
    const m = this.meg;
    while (m.rolls > 0) {
      if (m.need.length) doRoll(m);
      else if (cargoSum(m) < 8) rerollCargo(m);
      else break;
      this.renderTable();
      await sleep(650);
    }
    this.finish();
  }

  finish() {
    const g = this.game;
    const ys = score(this.you);
    const ms = score(this.meg);
    this.done = true;

    if (ys > ms) {
      if (this.shipBet) {
        g.winShipFromBet(this.shipBet.theirs);
        this.status = `You win! ${ys} beats ${ms} — a ${SHIP_CLASSES[this.shipBet.theirs].label} joins your fleet!`;
      } else {
        g.gold += this.stake * 2;
        this.status = `You win! ${ys} beats ${ms} — you take ${this.stake * 2} ⛁!`;
        g.sound.coin();
      }
      this.megLine = MEG_LOSES[Math.floor(Math.random() * MEG_LOSES.length)];
      g.sound.fanfare();
    } else if (ms > ys) {
      if (this.shipBet) {
        g.loseShipToBet(this.shipBet.yours);
        this.status = `Meg wins, ${ms} to ${ys} — ${this.shipBet.yours.name} is hers.`;
      } else {
        this.status = `Meg wins, ${ms} to ${ys} — the pot slides across the table.`;
      }
      this.megLine = MEG_WINS[Math.floor(Math.random() * MEG_WINS.length)];
      g.sound.knell();
    } else {
      if (!this.shipBet) g.gold += this.stake; // stakes back
      this.status = `A tie at ${ys} — stakes returned.`;
      this.megLine = MEG_PUSH;
    }
    this.renderTable();
  }

  playAgain() {
    const g = this.game;
    this.megLine = null;
    if (this.shipBet) {
      this.renderShipPick();
      return;
    }
    if (g.gold < this.stake) {
      this.renderDiceLobby();
      return;
    }
    g.gold -= this.stake;
    this.beginMatch();
  }
}
