import * as THREE from 'three';
import { toonMat } from '../core/toon.js';

// little canvas paintings for the walls
function paintingTexture(kind) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const g = c.getContext('2d');
  if (kind === 'ship') {
    const sky = g.createLinearGradient(0, 0, 0, 60);
    sky.addColorStop(0, '#7ec8e8');
    sky.addColorStop(1, '#dff3f9');
    g.fillStyle = sky;
    g.fillRect(0, 0, 128, 60);
    g.fillStyle = '#1b7f9e';
    g.fillRect(0, 60, 128, 36);
    g.fillStyle = '#ffe9a8';
    g.beginPath();
    g.arc(100, 18, 10, 0, 7);
    g.fill();
    g.fillStyle = '#6e4a2c';
    g.beginPath();
    g.moveTo(38, 66); g.lineTo(90, 66); g.lineTo(82, 76); g.lineTo(46, 76);
    g.closePath();
    g.fill();
    g.strokeStyle = '#4a3826';
    g.beginPath(); g.moveTo(64, 66); g.lineTo(64, 30); g.stroke();
    g.fillStyle = '#f4ead2';
    g.beginPath(); g.moveTo(64, 32); g.lineTo(88, 52); g.lineTo(64, 52); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(64, 34); g.lineTo(44, 50); g.lineTo(64, 50); g.closePath(); g.fill();
  } else if (kind === 'island') {
    g.fillStyle = '#a8dcee';
    g.fillRect(0, 0, 128, 58);
    g.fillStyle = '#2fb3c8';
    g.fillRect(0, 58, 128, 38);
    g.fillStyle = '#e8d29a';
    g.beginPath(); g.ellipse(64, 62, 34, 12, 0, 0, 7); g.fill();
    g.strokeStyle = '#8a6437';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(60, 60); g.quadraticCurveTo(64, 40, 74, 34); g.stroke();
    g.fillStyle = '#2f8d3a';
    for (const a of [-0.5, 0.2, 0.9, 1.7]) {
      g.beginPath(); g.ellipse(74 + Math.cos(a) * 12, 34 + Math.sin(a) * 6, 10, 4, a, 0, 7); g.fill();
    }
    g.fillStyle = '#c8332a';
    g.fillRect(88, 44, 3, 10);
  } else if (kind === 'kraken') {
    g.fillStyle = '#0e4a66';
    g.fillRect(0, 0, 128, 96);
    g.fillStyle = '#7a4a8a';
    g.beginPath(); g.ellipse(64, 40, 26, 22, 0, 0, 7); g.fill();
    g.strokeStyle = '#7a4a8a';
    g.lineWidth = 7;
    for (let i = 0; i < 5; i++) {
      const x = 30 + i * 17;
      g.beginPath();
      g.moveTo(x, 55);
      g.quadraticCurveTo(x + (i % 2 ? 12 : -12), 75, x + (i % 2 ? -6 : 6), 92);
      g.stroke();
    }
    g.fillStyle = '#f2efe7';
    g.beginPath(); g.arc(54, 36, 6, 0, 7); g.fill();
    g.beginPath(); g.arc(76, 36, 6, 0, 7); g.fill();
    g.fillStyle = '#14100c';
    g.beginPath(); g.arc(55, 37, 2.5, 0, 7); g.fill();
    g.beginPath(); g.arc(77, 37, 2.5, 0, 7); g.fill();
  } else {
    // stern portrait of the founder
    g.fillStyle = '#c9b490';
    g.fillRect(0, 0, 128, 96);
    g.fillStyle = '#8c2f2f';
    g.beginPath(); g.ellipse(64, 92, 34, 26, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#d8a377';
    g.beginPath(); g.arc(64, 52, 18, 0, 7); g.fill();
    g.fillStyle = '#14100c';
    g.beginPath(); g.ellipse(64, 32, 26, 9, 0, 0, 7); g.fill();
    g.fillRect(52, 16, 24, 14);
    g.beginPath(); g.arc(58, 52, 2.5, 0, 7); g.fill();
    g.beginPath(); g.arc(70, 52, 2.5, 0, 7); g.fill();
    g.strokeStyle = '#14100c';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(58, 62); g.quadraticCurveTo(64, 66, 70, 62); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function jollyRogerTexture() {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#14100c';
  g.fillRect(0, 0, 96, 64);
  g.fillStyle = '#f2efe7';
  g.beginPath(); g.arc(48, 26, 12, 0, 7); g.fill();
  g.fillStyle = '#14100c';
  g.beginPath(); g.arc(43, 24, 3, 0, 7); g.fill();
  g.beginPath(); g.arc(53, 24, 3, 0, 7); g.fill();
  g.fillRect(44, 31, 8, 4);
  g.strokeStyle = '#f2efe7';
  g.lineWidth = 5;
  g.beginPath(); g.moveTo(30, 44); g.lineTo(66, 54); g.moveTo(66, 44); g.lineTo(30, 54); g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// The inside of The Thirsty Parrot: a warm room built far below the sea
// (out of sight of the sailing world) that the captain walks around in.
// Returns world-space anchors for the barkeep, Meg's table, the bounty
// board and the door, plus walking bounds and furniture collision circles.

const ORIGIN = new THREE.Vector3(0, -80, 0);
const W = 26; // room x
const D = 18; // room z

function figure(bodyColor, hatColor, opts = {}) {
  const fig = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.7, 6), toonMat(bodyColor));
  body.position.y = 0.35;
  fig.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 7, 6), toonMat(0xd8a377));
  head.position.y = 0.88;
  fig.add(head);
  if (opts.bandana) {
    const band = new THREE.Mesh(new THREE.SphereGeometry(0.195, 7, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), toonMat(hatColor));
    band.position.y = 0.92;
    fig.add(band);
  } else {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.11, 6), toonMat(hatColor));
    hat.position.y = 1.02;
    fig.add(hat);
  }
  if (opts.eyepatch) {
    const patch = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.03), toonMat(0x14100c));
    patch.position.set(0.06, 0.9, 0.17);
    fig.add(patch);
  }
  if (opts.mug) {
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 6), toonMat(0xb98d5a));
    mug.position.set(0.28, 0.62, 0.14);
    fig.add(mug);
  }
  return fig;
}

export function buildTavernInterior(scene) {
  const g = new THREE.Group();
  g.position.copy(ORIGIN);

  const wood = toonMat(0x6e4a2c);
  const wall = toonMat(0xd8c8a8);
  const darkWood = toonMat(0x4a3826);

  // shell
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.4, D), toonMat(0x7a5533));
  floor.position.y = -0.2;
  g.add(floor);
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(W, 0.4, D), darkWood);
  ceiling.position.y = 5.8;
  g.add(ceiling);
  const mkWall = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  mkWall(W, 6, 0.5, 0, 2.9, -D / 2); // back
  mkWall(0.5, 6, D, -W / 2, 2.9, 0); // left
  mkWall(0.5, 6, D, W / 2, 2.9, 0); // right
  // front wall with a doorway gap
  mkWall(W / 2 - 2, 6, 0.5, -(W / 4 + 1), 2.9, D / 2);
  mkWall(W / 2 - 2, 6, 0.5, W / 4 + 1, 2.9, D / 2);
  mkWall(4, 2.4, 0.5, 0, 4.7, D / 2); // lintel above the door

  // wood panelling: wainscot with a top rail on every wall, corner posts,
  // and heavy beams across the ceiling
  const panel = toonMat(0x5d3f24);
  const rail = toonMat(0x4a3220);
  const wainscot = (w, x, z, rotY = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.5, 0.14), panel);
    m.position.set(x, 0.75, z);
    m.rotation.y = rotY;
    g.add(m);
    const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.2), rail);
    r.position.set(x, 1.56, z);
    r.rotation.y = rotY;
    g.add(r);
  };
  wainscot(W - 1, 0, -D / 2 + 0.35);
  wainscot(D - 1, -W / 2 + 0.35, 0, Math.PI / 2);
  wainscot(D - 1, W / 2 - 0.35, 0, Math.PI / 2);
  wainscot(W / 2 - 2.4, -(W / 4 + 1), D / 2 - 0.35);
  wainscot(W / 2 - 2.4, W / 4 + 1, D / 2 - 0.35);
  for (const [cx, cz] of [[-W / 2 + 0.5, -D / 2 + 0.5], [W / 2 - 0.5, -D / 2 + 0.5], [-W / 2 + 0.5, D / 2 - 0.5], [W / 2 - 0.5, D / 2 - 0.5]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.8, 0.35), rail);
    post.position.set(cx, 2.9, cz);
    g.add(post);
  }
  for (const bx of [-8, 0, 8]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, D), rail);
    beam.position.set(bx, 5.45, 0);
    g.add(beam);
  }

  // paintings in dark frames
  const hangPainting = (kind, x, z, rotY, w = 2.6, h = 1.9) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), rail);
    frame.position.set(x, 3.4, z);
    frame.rotation.y = rotY;
    g.add(frame);
    const art = new THREE.Mesh(
      new THREE.PlaneGeometry(w - 0.3, h - 0.3),
      new THREE.MeshBasicMaterial({ map: paintingTexture(kind) })
    );
    art.position.set(x + Math.sin(rotY) * 0.08, 3.4, z + Math.cos(rotY) * 0.08);
    art.rotation.y = rotY;
    g.add(art);
  };
  hangPainting('ship', 3.5, -D / 2 + 0.3, 0);
  hangPainting('portrait', 9.5, -D / 2 + 0.3, 0, 2.0, 2.4);
  hangPainting('island', -W / 2 + 0.3, -2.5, Math.PI / 2);
  hangPainting('kraken', W / 2 - 0.3, -2.5, -Math.PI / 2);

  // the Jolly Roger, respectfully framed in rope
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 1.5),
    new THREE.MeshBasicMaterial({ map: jollyRogerTexture() })
  );
  flag.position.set(-(W / 4 + 1), 3.7, D / 2 - 0.28);
  flag.rotation.y = Math.PI;
  g.add(flag);

  // ship's wheel over the bar
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.09, 6, 14), wood);
  wheel.add(rim);
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.1, 5), wood);
    spoke.rotation.z = (i / 4) * Math.PI;
    wheel.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 6), rail);
  wheel.add(hub);
  wheel.position.set(-5, 4.1, -D / 2 + 0.35);
  g.add(wheel);

  // crossed cutlasses on the right wall
  const swords = new THREE.Group();
  for (const s of [1, -1]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.03), toonMat(0xc8ccd2));
    blade.rotation.z = s * 0.7;
    swords.add(blade);
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.08), toonMat(0xd9a94a));
    hilt.position.set(s * -0.75 * Math.cos(0.7), -0.75 * Math.sin(0.7), 0);
    swords.add(hilt);
  }
  swords.position.set(W / 2 - 0.32, 3.6, -6.5);
  swords.rotation.y = -Math.PI / 2;
  g.add(swords);

  // the prize swordfish, mounted above the hearth
  const fish = new THREE.Group();
  const fbody = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), toonMat(0x64798a));
  fbody.scale.set(1.7, 0.55, 0.5);
  fish.add(fbody);
  const bill = new THREE.Mesh(new THREE.ConeGeometry(0.07, 1.1, 5), toonMat(0x4a5a68));
  bill.rotation.z = -Math.PI / 2;
  bill.position.x = 1.3;
  fish.add(bill);
  const ffin = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 4), toonMat(0x4a5a68));
  ffin.position.set(-0.1, 0.35, 0);
  fish.add(ffin);
  fish.position.set(W / 2 - 0.6, 3.9, 3.5);
  fish.rotation.y = -Math.PI / 2;
  g.add(fish);

  // props: a round rug, rope coil, spare barrels
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.06, 16), toonMat(0x8a3a2e));
  rug.position.set(0, 0.03, 1.5);
  g.add(rug);
  const rope = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.16, 6, 10), toonMat(0xb98d5a));
  rope.rotation.x = Math.PI / 2;
  rope.position.set(9.5, 0.12, 6.5);
  g.add(rope);
  for (const [bx, bz] of [[-11, 5.5], [-11.3, 4.2]]) {
    const keg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 8), toonMat(0x9a6b35));
    keg.position.set(bx, 0.5, bz);
    g.add(keg);
  }

  // the house parrot on a perch by the bar
  const perch = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.9, 6), rail);
  pole.position.y = 0.95;
  perch.add(pole);
  const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 5), rail);
  cross.rotation.z = Math.PI / 2;
  cross.position.y = 1.9;
  perch.add(cross);
  const innParrot = new THREE.Group();
  const ipBody = new THREE.Mesh(new THREE.SphereGeometry(0.14, 7, 6), toonMat(0x2fae4a));
  ipBody.scale.set(1, 1.3, 1);
  innParrot.add(ipBody);
  const ipHead = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 6), toonMat(0xd9342b));
  ipHead.position.set(0, 0.22, 0.04);
  innParrot.add(ipHead);
  const ipBeak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 5), toonMat(0xf2a33c));
  ipBeak.position.set(0, 0.21, 0.14);
  ipBeak.rotation.x = Math.PI / 2;
  innParrot.add(ipBeak);
  const ipHit = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 8, 6),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  innParrot.add(ipHit);
  innParrot.position.y = 2.1;
  perch.add(innParrot);
  perch.position.set(1.5, 0, -D / 2 + 1.3);
  g.add(perch);

  // warm light
  const warm = new THREE.PointLight(0xffb066, 90, 40);
  warm.position.set(0, 4.4, 0);
  g.add(warm);
  const warm2 = new THREE.PointLight(0xffc98a, 45, 25);
  warm2.position.set(-8, 3.6, -5);
  g.add(warm2);
  for (const [lx, lz] of [[-W / 2 + 1, -3], [W / 2 - 1, -3], [3, D / 2 - 1]]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 7, 6), new THREE.MeshBasicMaterial({ color: 0xffd98a }));
    lamp.position.set(lx, 3.6, lz);
    g.add(lamp);
  }

  // fireplace on the right wall
  const hearth = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 1), toonMat(0x8a8577));
  hearth.position.set(W / 2 - 0.9, 1.3, 3.5);
  g.add(hearth);
  const fire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: 0xff8c3a }));
  fire.position.set(W / 2 - 1.2, 0.7, 3.5);
  g.add(fire);

  // the bar along the back wall, barkeep behind it
  const bar = new THREE.Mesh(new THREE.BoxGeometry(10, 1.5, 1.6), wood);
  bar.position.set(-5, 0.75, -D / 2 + 2.6);
  g.add(bar);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(9, 0.18, 0.8), darkWood);
  shelf.position.set(-5, 3.1, -D / 2 + 0.7);
  g.add(shelf);
  const bottleColors = [0x58c968, 0xf2c14e, 0xd9342b, 0x3a8fd9, 0xe8813a, 0x9a6bd9];
  bottleColors.forEach((c, i) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.5, 6), new THREE.MeshBasicMaterial({ color: c }));
    b.position.set(-9 + i * 1.6, 3.45, -D / 2 + 0.7);
    g.add(b);
  });
  const barkeepFig = figure(0xe8e0cc, 0x8a6437, { bandana: true });
  barkeepFig.position.set(-5, 0, -D / 2 + 1.3);
  barkeepFig.rotation.y = 0; // facing the room (+z)
  g.add(barkeepFig);

  // tables with pirate patrons
  const patrons = [];
  const obstacles = [];
  const tableSpots = [
    { x: 3, z: -2.5 },
    { x: -3.5, z: 3 },
    { x: 8.5, z: -4.5, meg: true },
  ];
  let megLocal = null;
  for (const spot of tableSpots) {
    const table = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.2, 0.95, 8), wood);
    table.position.set(spot.x, 0.48, spot.z);
    g.add(table);
    obstacles.push({ x: spot.x, z: spot.z, r: 1.9 });
    const seats = spot.meg ? 1 : 2;
    for (let s = 0; s < seats; s++) {
      const a = (s / seats) * Math.PI * 2 + spot.x;
      const px = spot.x + Math.sin(a) * 2.1;
      const pz = spot.z + Math.cos(a) * 2.1;
      const colors = [
        [0x3e5a7a, 0xd9342b], [0x6e8a3a, 0xe8e0cc], [0x8a3a5e, 0x2b2015], [0xb0533a, 0x3a6e8a],
      ];
      const [bc, hc] = colors[(patrons.length + s) % colors.length];
      const p = figure(bc, hc, { bandana: s % 2 === 0, mug: true });
      p.position.set(px, 0, pz);
      p.rotation.y = Math.atan2(spot.x - px, spot.z - pz);
      g.add(p);
      patrons.push(p);
    }
    if (spot.meg) {
      // One-Eyed Meg herself: purple coat, wide black hat, the patch
      var megFig = figure(0x5a3a6e, 0x14100c, { eyepatch: true, mug: true });
      const meg = megFig;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.05, 10), toonMat(0x14100c));
      brim.position.y = 1.0;
      meg.add(brim);
      meg.position.set(spot.x + 1.9, 0, spot.z - 1.2);
      meg.rotation.y = Math.atan2(spot.x - meg.position.x, spot.z - meg.position.z);
      g.add(meg);
      patrons.push(meg);
      megLocal = { x: spot.x, z: spot.z };
      // dice on her table
      for (const [dx, dz] of [[-0.3, 0.2], [0.25, -0.15]]) {
        const die = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), toonMat(0xf0e6d2));
        die.position.set(spot.x + dx, 1.06, spot.z + dz);
        die.rotation.y = dx * 3;
        g.add(die);
      }
    }
  }
  obstacles.push({ x: -5, z: -D / 2 + 2.6, r: 2.2 }); // the bar
  obstacles.push({ x: W / 2 - 0.9, z: 3.5, r: 2 }); // hearth

  // bounty board on the left wall
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 3), wood);
  board.position.set(-W / 2 + 0.35, 2.4, 2.5);
  g.add(board);
  for (let i = 0; i < 3; i++) {
    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(0.75, 0.9),
      new THREE.MeshBasicMaterial({ color: 0xe8dcc0 })
    );
    sheet.position.set(-W / 2 + 0.46, 2.5 + (i % 2) * 0.2 - 0.1, 1.6 + i * 0.9);
    sheet.rotation.y = Math.PI / 2;
    sheet.rotation.z = (i - 1) * 0.08;
    g.add(sheet);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), toonMat(0x2b2015));
    skull.position.set(-W / 2 + 0.5, 2.72 + (i % 2) * 0.2 - 0.1, 1.6 + i * 0.9);
    g.add(skull);
  }

  scene.add(g);

  const toWorld = (x, z) => new THREE.Vector3(ORIGIN.x + x, ORIGIN.y, ORIGIN.z + z);
  return {
    group: g,
    floorY: ORIGIN.y,
    spawn: toWorld(0, D / 2 - 2),
    door: toWorld(0, D / 2 - 1),
    barkeep: toWorld(-5, -D / 2 + 2.6),
    meg: toWorld(megLocal.x, megLocal.z),
    board: toWorld(-W / 2 + 1, 2.5),
    bounds: {
      x0: ORIGIN.x - W / 2 + 1,
      x1: ORIGIN.x + W / 2 - 1,
      z0: ORIGIN.z - D / 2 + 1,
      z1: ORIGIN.z + D / 2 - 0.6,
    },
    obstacles: obstacles.map((o) => ({ x: ORIGIN.x + o.x, z: ORIGIN.z + o.z, r: o.r })),
    patrons,
    barkeepFig,
    megFig,
    innParrot,
  };
}
