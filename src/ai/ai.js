import * as THREE from 'three';

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function nearestEnemy(ship, game) {
  let best = null;
  let bestD = Infinity;
  for (const s of game.ships) {
    if (s.dead || s.sinking || s.faction === ship.faction) continue;
    // the port is a safe harbor — the Spanish won't chase you into it
    if (ship.faction === 'spain' && game.isSafeHarbor(s.pos)) continue;
    const d = ship.pos.distanceTo(s.pos);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return { target: best, dist: bestD };
}

// try to fire whichever broadside bears on the target
export function tryBroadsides(ship, target, game, range = 85) {
  const d = ship.pos.distanceTo(target.pos);
  if (d > range) return;
  const to = new THREE.Vector3().subVectors(target.pos, ship.pos).normalize();
  const portDir = new THREE.Vector3(Math.cos(ship.heading), 0, -Math.sin(ship.heading));
  const dot = portDir.dot(to);
  if (dot > 0.86) game.effects.fireBroadside(ship, 'port');
  else if (dot < -0.86) game.effects.fireBroadside(ship, 'starboard');
}

function steerTo(ship, x, z) {
  ship.steerTarget = ship.steerTarget || new THREE.Vector3();
  ship.steerTarget.set(x, 0, z);
}

function patrol(ship, game) {
  if (!ship.wp || ship.pos.distanceTo(ship.wp) < 40) {
    const a = rand(0, Math.PI * 2);
    const r = rand(120, 640);
    ship.wp = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
  }
  steerTo(ship, ship.wp.x, ship.wp.z);
  ship.sailSetting = 2;
}

function fleeFrom(ship, threat) {
  const away = new THREE.Vector3().subVectors(ship.pos, threat.pos).normalize();
  // don't flee straight into the world border — curve along it
  const r = Math.hypot(ship.pos.x, ship.pos.z);
  if (r > 700) {
    const inward = ship.pos.clone().multiplyScalar(-1 / r);
    away.add(inward).normalize();
  }
  steerTo(ship, ship.pos.x + away.x * 120, ship.pos.z + away.z * 120);
  ship.sailSetting = 3;
}

export function updateSpanishAI(ship, game, dt) {
  if (ship.sinking || ship.boarding) return;
  const { target, dist } = nearestEnemy(ship, game);
  if (!target || game.state !== 'playing') {
    patrol(ship, game);
    return;
  }

  const lowHp = ship.hp / ship.maxHp < 0.3;
  const isGalleon = ship.classKey === 'galleon';
  const isSOL = ship.classKey === 'shipOfTheLine';

  if (isGalleon && dist < 240) {
    fleeFrom(ship, target);
    tryBroadsides(ship, target, game, 60); // parting shots if guns happen to bear
    return;
  }
  if (lowHp && !isSOL) {
    fleeFrom(ship, target);
    return;
  }

  if (dist < 170) {
    // hold the target abeam at fighting range
    ship.sailSetting = dist > 95 ? 3 : 2;
    const bearing = Math.atan2(target.pos.x - ship.pos.x, target.pos.z - ship.pos.z);
    if (dist > 80) {
      steerTo(ship, target.pos.x, target.pos.z);
    } else {
      // pick the perpendicular heading closest to our current one
      const a1 = bearing + Math.PI / 2;
      const a2 = bearing - Math.PI / 2;
      const diff = (a) => {
        let d = a - ship.heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return Math.abs(d);
      };
      const a = diff(a1) < diff(a2) ? a1 : a2;
      steerTo(ship, ship.pos.x + Math.sin(a) * 60, ship.pos.z + Math.cos(a) * 60);
    }
    tryBroadsides(ship, target, game);
  } else {
    patrol(ship, game);
  }
}

export function updateFleetAI(ship, game, dt, index) {
  if (ship.sinking || ship.boarding) return;
  const flag = game.flagship;
  if (!flag || flag === ship) return;

  if (ship.orders === 'hunt') {
    huntAI(ship, game);
    return;
  }

  const fwd = flag.forward;
  const right = new THREE.Vector3(-Math.cos(flag.heading), 0, Math.sin(flag.heading));
  const lateral = index % 2 === 1 ? 15 : -15;
  const back = 24 + 26 * Math.floor((index + 1) / 2);
  const station = new THREE.Vector3()
    .copy(flag.pos)
    .addScaledVector(fwd, -back)
    .addScaledVector(right, lateral);

  const d = ship.pos.distanceTo(station);
  steerTo(ship, station.x, station.z);
  // always keep a speed edge over the flagship until on station
  ship.sailSetting = d > 30 ? 3 : d > 12 ? Math.min(flag.sailSetting + 1, 3) : flag.sailSetting;

  const { target, dist } = nearestEnemy(ship, game);
  if (target && dist < 85) tryBroadsides(ship, target, game);
}

// A ship set loose to hunt: chases the nearest Spanish sail, fights her
// down, and boards her when she's weak enough to take.
function huntAI(ship, game) {
  const { target, dist } = nearestEnemy(ship, game);
  if (!target || dist > 420) {
    patrol(ship, game);
    return;
  }

  const weakEnough = target.hp / target.maxHp < 0.5;
  if (weakEnough && !target.boarding && ship.crew > 4) {
    // run her down and grapple
    steerTo(ship, target.pos.x, target.pos.z);
    ship.sailSetting = 3;
    const grappleD = (ship.def.len + target.def.len) * 0.5 + 6;
    if (dist < grappleD) game.startBoarding(ship, target);
    return;
  }

  // gun duel: hold her abeam at fighting range
  ship.sailSetting = dist > 95 ? 3 : 2;
  const bearing = Math.atan2(target.pos.x - ship.pos.x, target.pos.z - ship.pos.z);
  if (dist > 80) {
    steerTo(ship, target.pos.x, target.pos.z);
  } else {
    const a1 = bearing + Math.PI / 2;
    const a2 = bearing - Math.PI / 2;
    const diff = (a) => {
      let d = a - ship.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return Math.abs(d);
    };
    const a = diff(a1) < diff(a2) ? a1 : a2;
    steerTo(ship, ship.pos.x + Math.sin(a) * 60, ship.pos.z + Math.cos(a) * 60);
  }
  tryBroadsides(ship, target, game);
}
