// combat.js — hitscan gunfire for everyone in Bahía Noche. One fireAt()
// renders the shot (locked Bahia FX recipe via effects.js) and resolves
// the hit; hostiles think in cover, advance and volley states.

import { G, currentWeapon, addRespect } from './state.js';
import { clamp, rand, dist2d, angleTo, angleLerp } from './util.js';
import { makePerson, poseAim, poseCrouch, poseDown, animatePerson } from './people.js';
import { fireFx, burst } from './effects.js';
import { sfxShot } from './audio.js';
import { peds, woundPed } from './pedestrians.js';
import { officers, hurtOfficer } from './officers.js';
import { collideWorld } from './player.js';

export const hostiles = [];
let hostileSeq = 1;

export function gunPosOf(person) {
  const p = person.group.position;
  return { x: p.x + Math.sin(person.group.rotation.y) * 0.4, y: 1.32, z: p.z + Math.cos(person.group.rotation.y) * 0.4 };
}

// Render + resolve one shot. hit: null | {kind:'player'|'hostile'|'ped'|'car', ref, point}
export function fireAt(shooter, from, to, opts = {}) {
  const spread = opts.spread ?? 0.02;
  const hx = to.x + (Math.random() - 0.5) * 2 * spread * 30;
  const hy = Math.max(0.15, to.y + (Math.random() - 0.5) * spread * 22);
  const hz = to.z + (Math.random() - 0.5) * 2 * spread * 30;
  fireFx(from.x, from.y, from.z, hx, hy, hz, !!opts.hitSomething);
  if (opts.onHit) opts.onHit({ x: hx, y: hy, z: hz });
  return { x: hx, y: hy, z: hz };
}

export function hurtPlayer(damage) {
  if (G.over || G.shotMode) return;
  let d = damage;
  if (G.armor > 0) {
    const absorbed = Math.min(G.armor, d * 0.6);
    G.armor -= absorbed;
    d -= absorbed;
  }
  G.health -= d;
  G.lastHurtT = G.t;
  if (G.health <= 0) {
    G.health = 0;
    G.over = true;
    if (G.player) poseDown(G.player.person);
  }
}

export function hurtPed(ped, damage, shooter) {
  woundPed(ped, damage, shooter);
}

export function spawnHostile(x, z, opts = {}) {
  const person = makePerson({
    shirt: opts.shirt ?? 0xd84a30, pants: 0x23262e,
    gun: opts.gun ?? 'pistol', pattern: 'plain',
    cap: opts.cap,
  });
  person.group.position.set(x, 0, z);
  G.scene.add(person.group);
  const h = {
    id: hostileSeq++, person, group: person.group,
    health: opts.health ?? 55, dead: false,
    state: 'advance', fireCd: rand(0.4, 1.4),
    coverT: 0, coverX: x, coverZ: z, homeX: x, homeZ: z,
    damage: opts.damage ?? 7, range: opts.range ?? 34,
    ally: !!opts.ally, name: opts.name || 'hostile',
  };
  poseAim(person);
  hostiles.push(h);
  return h;
}

export function clearHostiles() {
  for (const h of hostiles) G.scene.remove(h.group);
  hostiles.length = 0;
}

function hurtHostile(h, dmg) {
  if (h.dead) return;
  h.health -= dmg;
  burst(h.group.position.x, 1.2, h.group.position.z, 0xd84040, 4, 1.4, { life: 0.5 });
  if (h.health <= 0) {
    h.dead = true;
    poseDown(h.person);
    if (!h.ally) { G.kills++; addRespect(6); }
  }
}

export function playerShoot(targetPoint) {
  const p = G.player;
  if (!p || p.dead) return;
  const w = currentWeapon();
  const pos = p.group.position;
  if (w.id !== 'fists' && G.ammo[w.id] !== undefined) {
    if (G.ammo[w.id] <= 0) return;
    G.ammo[w.id]--;
  }
  sfxShot(w.id === 'muelle' ? 'shotgun' : 'pistol');
  const from = gunPosOf(p.person);
  if (w.id === 'fists') {
    // A swing: anything hostile within arm's reach regrets it.
    for (const h of hostiles) {
      if (!h.dead && dist2d(pos.x, pos.z, h.group.position.x, h.group.position.z) < w.range) {
        hurtHostile(h, w.damage);
      }
    }
    return;
  }
  if (!targetPoint) return;
  for (let pellet = 0; pellet < w.pellets; pellet++) {
    // Find what the pellet actually meets: nearest hostile / ped / officer
    // within a metre-and-a-half of the aim line's end.
    let bestH = null, bestD = 2.2;
    for (const h of hostiles) {
      if (h.dead) continue;
      const hp = h.group.position;
      const d = dist2d(targetPoint.x, targetPoint.z, hp.x, hp.z);
      const rangeOk = dist2d(pos.x, pos.z, hp.x, hp.z) <= w.range;
      if (rangeOk && d < bestD) { bestD = d; bestH = h; }
    }
    let bestPed = null; bestD = 2.2;
    for (const ped of peds) {
      if (ped.dead || ped.wounded) continue;
      const pp = ped.group.position;
      const d = dist2d(targetPoint.x, targetPoint.z, pp.x, pp.z);
      if (dist2d(pos.x, pos.z, pp.x, pp.z) <= w.range && d < bestD) { bestD = d; bestPed = ped; }
    }
    let bestOff = null; bestD = 2.2;
    for (const o of officers) {
      if (o.dead) continue;
      const op = o.group.position;
      const d = dist2d(targetPoint.x, targetPoint.z, op.x, op.z);
      if (dist2d(pos.x, pos.z, op.x, op.z) <= w.range && d < bestD) { bestD = d; bestOff = o; }
    }
    const to = bestH ? { x: bestH.group.position.x, y: 1.15, z: bestH.group.position.z }
      : bestOff ? { x: bestOff.group.position.x, y: 1.15, z: bestOff.group.position.z }
      : bestPed ? { x: bestPed.group.position.x, y: 1.15, z: bestPed.group.position.z }
      : targetPoint;
    fireAt('player', from, to, {
      spread: w.spread, hitSomething: !!(bestH || bestPed || bestOff),
      onHit: () => {
        if (bestH) hurtHostile(bestH, w.damage);
        else if (bestOff) { hurtOfficer(bestOff, w.damage); G.wanted = Math.min(5, G.wanted + 0.5); }
        else if (bestPed) { hurtPed(bestPed, w.damage, 'player'); G.wanted = Math.min(5, G.wanted + 0.6); }
      },
    });
  }
  if (!G.shotMode) G.wanted = Math.min(5, G.wanted + 0.12);
}

// Hostile fire control: volleys at the player (or at the player's ally
// line) with distance-based accuracy. Damage lands probabilistically so a
// staged crossfire reads as lethal without being a guaranteed kill.
export function hostileFire(h, dt, targetPos) {
  h.fireCd -= dt;
  if (h.fireCd > 0) return;
  const hp = h.group.position;
  const d = dist2d(hp.x, hp.z, targetPos.x, targetPos.z);
  if (d > h.range) return;
  h.fireCd = rand(0.55, 1.15);
  const from = gunPosOf(h.person);
  const hitChance = clamp(0.62 - d * 0.011, 0.12, 0.55);
  const willHit = Math.random() < hitChance;
  sfxShot('pistol');
  fireAt('hostile', from, { x: targetPos.x, y: 1.2, z: targetPos.z }, {
    spread: willHit ? 0.004 : 0.05, hitSomething: true,
    onHit: () => { if (willHit && !h.ally) hurtPlayer(h.damage); },
  });
}

export function updateHostileCover(dt) {
  // Hostiles shuffle between cover points near their home when the player
  // is close and they are not advancing.
  for (const h of hostiles) {
    if (h.dead) continue;
    h.coverT -= dt;
    if (h.coverT <= 0) {
      h.coverT = rand(2.2, 4.5);
      const a = Math.random() * Math.PI * 2;
      const r = rand(1.5, 5);
      h.coverX = h.homeX + Math.cos(a) * r;
      h.coverZ = h.homeZ + Math.sin(a) * r;
      h.state = Math.random() < 0.45 ? 'cover' : 'advance';
    }
  }
}

export function updateHostiles(dt) {
  updateHostileCover(dt);
  const p = G.player;
  if (!p) return;
  const targetPos = G.playerCar ? G.playerCar.group.position : p.group.position;
  for (const h of hostiles) {
    if (h.dead) { continue; }
    const hp = h.group.position;
    const d = dist2d(hp.x, hp.z, targetPos.x, targetPos.z);
    h.group.rotation.y = angleLerp(h.group.rotation.y, angleTo(hp.x, hp.z, targetPos.x, targetPos.z), Math.min(1, dt * 6));
    let mvx = 0, mvz = 0;
    if (h.state === 'advance' && d > 11) {
      mvx = Math.sin(h.group.rotation.y) * 2.6;
      mvz = Math.cos(h.group.rotation.y) * 2.6;
    } else if (h.state === 'cover') {
      const cd = dist2d(hp.x, hp.z, h.coverX, h.coverZ);
      if (cd > 0.7) {
        const ca = angleTo(hp.x, hp.z, h.coverX, h.coverZ);
        mvx = Math.sin(ca) * 2.2; mvz = Math.cos(ca) * 2.2;
      }
    }
    if (mvx || mvz) {
      hp.x += mvx * dt; hp.z += mvz * dt;
      collideWorld(hp, 0.42);
      poseAim(h.person);
      animatePerson(h.person, dt, 2.4);
    } else {
      if (d < 13) poseCrouch(h.person); else poseAim(h.person);
      animatePerson(h.person, dt, 0);
    }
    if (!h.ally) hostileFire(h, dt, targetPos);
  }
}
