import * as THREE from 'three';
import { toonMat } from '../core/toon.js';

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
  const barkeep = figure(0xe8e0cc, 0x8a6437, { bandana: true });
  barkeep.position.set(-5, 0, -D / 2 + 1.3);
  barkeep.rotation.y = 0; // facing the room (+z)
  g.add(barkeep);

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
      const meg = figure(0x5a3a6e, 0x14100c, { eyepatch: true, mug: true });
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
  };
}
