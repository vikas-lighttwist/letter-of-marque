import * as THREE from 'three';
import { toonMat, addOutline } from '../core/toon.js';

// Ship classes. Forward is local +Z (bow), port is +X, starboard is -X.
export const SHIP_CLASSES = {
  sloop: {
    key: 'sloop', label: 'Sloop',
    len: 14, wid: 4.2, hullH: 2.6, masts: 1, gunsPerSide: 2, castles: 0,
    hp: 60, maxSpeed: 15.5, turnRate: 0.8, crew: 8, gold: [20, 60],
  },
  brigantine: {
    key: 'brigantine', label: 'Brigantine',
    len: 18, wid: 5.2, hullH: 3.0, masts: 2, gunsPerSide: 4, castles: 1,
    hp: 100, maxSpeed: 13.5, turnRate: 0.63, crew: 14, gold: [50, 120],
  },
  frigate: {
    key: 'frigate', label: 'Frigate',
    len: 24, wid: 6.4, hullH: 3.6, masts: 3, gunsPerSide: 7, castles: 1,
    hp: 160, maxSpeed: 12.0, turnRate: 0.48, crew: 24, gold: [100, 250],
  },
  galleon: {
    key: 'galleon', label: 'Galleon',
    len: 28, wid: 8.2, hullH: 4.8, masts: 3, gunsPerSide: 5, castles: 2,
    hp: 220, maxSpeed: 9.0, turnRate: 0.37, crew: 20, gold: [400, 800],
  },
  shipOfTheLine: {
    key: 'shipOfTheLine', label: 'Ship of the Line',
    len: 34, wid: 9.2, hullH: 5.8, masts: 3, gunsPerSide: 12, castles: 2,
    hp: 340, maxSpeed: 10.5, turnRate: 0.31, crew: 40, gold: [200, 450],
  },
};

export const FACTIONS = {
  england: {
    key: 'england',
    hull: 0x7c4a26, castle: 0x8d5a30, deck: 0xb9905c, trim: 0xf0e6d2,
    sail: 0xf4ead2, crewBody: 0x3e5a7a, crewHat: 0xe8e0cc,
  },
  spain: {
    key: 'spain',
    hull: 0x5e3a20, castle: 0x6b4426, deck: 0xa8845a, trim: 0xd9a94a,
    sail: 0xe9d9ae, crewBody: 0x8a2f26, crewHat: 0x3a2c1c,
  },
};

const EN_NAMES = ['Fortune', 'Resolution', 'Adventure', 'Sea Wolf', 'Falcon', 'Griffin', 'Vigilant', 'Tempest', 'Royal Oak', 'Dauntless'];
const ES_NAMES = ['San Felipe', 'Santa Ana', 'Nuestra Señora', 'El Dorado', 'Santiago', 'La Concepción', 'San Miguel', 'Trinidad', 'Espíritu Santo', 'Santa Catalina', 'San Rafael', 'La Perla'];

let nameCounter = { england: 0, spain: 0 };
export function shipName(factionKey) {
  const list = factionKey === 'england' ? EN_NAMES : ES_NAMES;
  const i = nameCounter[factionKey]++;
  const base = list[i % list.length];
  return i >= list.length ? `${base} II` : base;
}

// --- flags -------------------------------------------------------------

const flagTexCache = {};
function flagTexture(factionKey) {
  if (flagTexCache[factionKey]) return flagTexCache[factionKey];
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 40;
  const g = c.getContext('2d');
  if (factionKey === 'england') {
    g.fillStyle = '#f2efe4';
    g.fillRect(0, 0, 64, 40);
    g.fillStyle = '#c8332a';
    g.fillRect(26, 0, 12, 40);
    g.fillRect(0, 14, 64, 12);
  } else {
    // stylized Cross of Burgundy
    g.fillStyle = '#e8c33c';
    g.fillRect(0, 0, 64, 40);
    g.strokeStyle = '#b02a20';
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(2, 2); g.lineTo(62, 38);
    g.moveTo(62, 2); g.lineTo(2, 38);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  flagTexCache[factionKey] = tex;
  return tex;
}

// --- hull --------------------------------------------------------------

function makeHullGeometry(len, wid, hullH) {
  const geo = new THREE.BoxGeometry(wid, hullH, len, 1, 2, 16);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    const z = pos.getZ(i);
    const u = z / len + 0.5; // 0 stern → 1 bow
    const vn = y / hullH + 0.5; // 0 keel → 1 rail

    let w = 1;
    if (u > 0.62) {
      const t = (u - 0.62) / 0.38;
      w *= 1 - t * t * 0.97;
    }
    if (u < 0.14) {
      const t = 1 - u / 0.14;
      w *= 1 - t * 0.26;
    }
    w *= 0.55 + 0.45 * vn; // V-shaped cross-section
    x *= w;

    if (u > 0.62) {
      const t = (u - 0.62) / 0.38;
      y += t * t * hullH * 0.5; // bow sheer
    }
    if (u < 0.14) {
      const t = 1 - u / 0.14;
      y += t * t * hullH * 0.32; // stern sheer
    }
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

// --- sails -------------------------------------------------------------

function makeSailGeometry(w, h) {
  const geo = new THREE.PlaneGeometry(w, h, 6, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const bulge = 1 - Math.pow((2 * x) / w, 2);
    pos.setZ(i, bulge * w * 0.14);
  }
  // hang from the yard: put the top edge at y=0 so furling scales downward
  geo.translate(0, -h / 2, 0);
  geo.computeVertexNormals();
  return geo;
}

// --- ship assembly -----------------------------------------------------

export function buildShipMesh(classKey, factionKey) {
  const def = SHIP_CLASSES[classKey];
  const fac = FACTIONS[factionKey];
  const { len, wid, hullH } = def;

  const group = new THREE.Group();
  const sails = [];
  const cannonsLocal = { port: [], starboard: [] };

  // hull sits with its waterline at group y=0
  const hullY = hullH * 0.12;
  const hull = new THREE.Mesh(makeHullGeometry(len, wid, hullH), toonMat(fac.hull));
  hull.position.y = hullY;
  addOutline(hull);
  group.add(hull);

  const deckY = hullY + hullH * 0.5 - 0.42;
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(wid * 0.8, 0.24, len * 0.8),
    toonMat(fac.deck)
  );
  deck.position.y = deckY;
  group.add(deck);

  // faction trim stripe along each side
  const stripeGeo = new THREE.BoxGeometry(0.16, 0.55, len * 0.55);
  for (const side of [1, -1]) {
    const stripe = new THREE.Mesh(stripeGeo, toonMat(fac.trim));
    stripe.position.set(side * wid * 0.44, hullY + hullH * 0.18, -len * 0.02);
    group.add(stripe);
  }

  // castles
  if (def.castles >= 1) {
    const stern = new THREE.Mesh(
      new THREE.BoxGeometry(wid * 0.86, hullH * 0.52, len * 0.17),
      toonMat(fac.castle)
    );
    stern.position.set(0, deckY + hullH * 0.26, -len * 0.335);
    addOutline(stern);
    group.add(stern);
  }
  if (def.castles >= 2) {
    const fore = new THREE.Mesh(
      new THREE.BoxGeometry(wid * 0.68, hullH * 0.34, len * 0.13),
      toonMat(fac.castle)
    );
    fore.position.set(0, deckY + hullH * 0.17, len * 0.3);
    addOutline(fore);
    group.add(fore);

    const poop = new THREE.Mesh(
      new THREE.BoxGeometry(wid * 0.7, hullH * 0.3, len * 0.1),
      toonMat(fac.castle)
    );
    poop.position.set(0, deckY + hullH * 0.62, -len * 0.36);
    group.add(poop);

    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd977 })
    );
    lantern.position.set(0, deckY + hullH * 0.92, -len * 0.44);
    group.add(lantern);
  }

  // masts + sails
  const mastMat = toonMat(0x6b4a2a);
  const sailMat = toonMat(fac.sail, { side: THREE.DoubleSide });
  const layouts = {
    1: [[0.02, 1]],
    2: [[-0.22, 0.92], [0.18, 1]],
    3: [[-0.3, 0.82], [0, 1], [0.28, 0.9]],
  };
  const mastR = 0.14 + len * 0.007;
  let mainMastTop = new THREE.Vector3(0, 10, 0);
  for (const [zf, hf] of layouts[def.masts]) {
    const mastH = len * 0.78 * hf;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(mastR * 0.7, mastR, mastH, 6), mastMat);
    mast.position.set(0, deckY + mastH / 2, zf * len);
    group.add(mast);

    const topY = deckY + mastH;
    if (hf === 1) mainMastTop = new THREE.Vector3(0, topY + 1.2, zf * len);

    // two square sails per mast, hanging from their yards
    const sailSpecs = [
      { w: wid * 2.05, h: mastH * 0.34, y: topY * 0.62 },
      { w: wid * 1.55, h: mastH * 0.26, y: topY * 0.88 },
    ];
    for (const s of sailSpecs) {
      const yard = new THREE.Mesh(
        new THREE.CylinderGeometry(mastR * 0.5, mastR * 0.5, s.w * 1.06, 5),
        mastMat
      );
      yard.rotation.z = Math.PI / 2;
      yard.position.set(0, s.y, zf * len + mastR + 0.05);
      group.add(yard);

      const sail = new THREE.Mesh(makeSailGeometry(s.w, s.h), sailMat);
      sail.position.set(0, s.y - 0.15, zf * len + mastR + 0.3);
      group.add(sail);
      sails.push(sail);
    }
  }

  // bowsprit
  const spritLen = len * 0.26;
  const sprit = new THREE.Mesh(new THREE.CylinderGeometry(mastR * 0.5, mastR * 0.8, spritLen, 5), mastMat);
  sprit.rotation.x = Math.PI / 2 - 0.35;
  sprit.position.set(0, deckY + hullH * 0.3, len * 0.5 + spritLen * 0.4);
  group.add(sprit);

  // cannons
  const gunMat = toonMat(0x24211e);
  const gunGeo = new THREE.CylinderGeometry(0.2, 0.24, 1.5, 6);
  const gunY = hullY + hullH * 0.16;
  const n = def.gunsPerSide;
  const span = len * 0.58;
  for (let i = 0; i < n; i++) {
    const z = n === 1 ? 0 : -span / 2 + (span * i) / (n - 1);
    for (const side of [1, -1]) {
      const gun = new THREE.Mesh(gunGeo, gunMat);
      gun.rotation.z = Math.PI / 2;
      gun.position.set(side * wid * 0.48, gunY, z);
      group.add(gun);
      const list = side === 1 ? cannonsLocal.port : cannonsLocal.starboard;
      list.push(new THREE.Vector3(side * (wid * 0.5 + 0.8), gunY + 0.15, z));
    }
  }

  // flag
  const flagGeo = new THREE.PlaneGeometry(2.6, 1.5);
  flagGeo.translate(1.3, 0, 0);
  const flag = new THREE.Mesh(
    flagGeo,
    new THREE.MeshBasicMaterial({ map: flagTexture(factionKey), side: THREE.DoubleSide })
  );
  flag.position.copy(mainMastTop);
  group.add(flag);

  return {
    group,
    sails,
    flag,
    cannonsLocal,
    mastTop: mainMastTop.clone().add(new THREE.Vector3(0, 1.6, 0)),
    deckRect: { w: wid * 0.66, l: len * 0.62, y: deckY + 0.15 },
    deckY,
  };
}
