// pedestrians.js — the crowd: wanderers, stall browsers, chat pairs and
// their panic when the shooting starts. Density is a feature here.

import { G } from './state.js';
import { rand, dist2d, angleTo, angleLerp } from './util.js';
import { makePerson, poseStand, poseChat, poseSurrender, poseDown, animatePerson } from './people.js';
import { nearestRoadPoint } from './city.js';
import { collideWorld } from './player.js';

export const peds = [];
let pedSeq = 1;

export function spawnPedestrian(x, z, opts = {}) {
  const person = makePerson(opts);
  person.group.position.set(x, 0, z);
  person.group.rotation.y = opts.heading ?? rand(0, Math.PI * 2);
  G.scene.add(person.group);
  const ped = {
    id: pedSeq++, person, group: person.group,
    mode: opts.mode || 'wander',
    homeX: x, homeZ: z,
    targetX: x, targetZ: z, waitT: rand(0, 3),
    speed: rand(1.1, 1.9), health: 30,
    dead: false, wounded: false, fleeT: 0, chatPartner: null,
  };
  if (ped.mode === 'chat') poseChat(person, Math.random());
  if (ped.mode === 'browse') poseStand(person);
  peds.push(ped);
  return ped;
}

export function crowd(x, z, n, r = 8) {
  const made = [];
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const d = rand(1, r);
    made.push(spawnPedestrian(x + Math.cos(a) * d, z + Math.sin(a) * d,
      { mode: Math.random() < 0.4 ? 'chat' : 'wander' }));
  }
  return made;
}

export function chatPair(x, z, angle, optsA = {}, optsB = {}) {
  const dx = Math.sin(angle) * 0.85, dz = Math.cos(angle) * 0.85;
  const a = spawnPedestrian(x - dx / 2, z - dz / 2, { ...optsA, mode: 'chat', heading: angle });
  const b = spawnPedestrian(x + dx / 2, z + dz / 2, { ...optsB, mode: 'chat', heading: angle + Math.PI });
  a.chatPartner = b; b.chatPartner = a;
  poseChat(a.person, 0.4); poseChat(b.person, 0.75);
  return [a, b];
}

export function woundPed(ped, damage, shooter) {
  if (ped.dead) return;
  ped.health -= damage;
  if (ped.health <= 0) {
    ped.dead = true;
    poseDown(ped.person);
    if (shooter === 'player') G.wanted = Math.min(5, G.wanted + 0.8);
  } else {
    ped.wounded = true;
    ped.fleeT = 4;
  }
}

export function clearPeds() {
  for (const p of peds) G.scene.remove(p.group);
  peds.length = 0;
}

export function updatePedestrians(dt) {
  const pp = G.player ? G.player.group.position : null;
  for (const ped of peds) {
    if (ped.dead) continue;
    const pos = ped.group.position;
    // Panic: gunfire nearby or a fresh wound sends everyone running.
    if (pp && !ped.wounded) {
      const d = dist2d(pos.x, pos.z, pp.x, pp.z);
      if (d < 9 && G.t - (G.lastHurtT || -99) < 2.5) ped.fleeT = Math.max(ped.fleeT, 2);
      if (d < 6 && G.wanted >= 2.5 && Math.random() < 0.01) poseSurrender(ped.person);
    }
    if (ped.fleeT > 0) {
      ped.fleeT -= dt;
      if (pp) {
        const away = angleTo(pp.x, pp.z, pos.x, pos.z);
        ped.group.rotation.y = angleLerp(ped.group.rotation.y, away, Math.min(1, dt * 8));
        pos.x += Math.sin(away) * 5.4 * dt;
        pos.z += Math.cos(away) * 5.4 * dt;
        collideWorld(pos, 0.4);
        animatePerson(ped.person, dt, 5.4);
      }
      continue;
    }
    if (ped.mode === 'chat') {
      if (ped.chatPartner && !ped.chatPartner.dead) {
        const cp = ped.chatPartner.group.position;
        ped.group.rotation.y = angleLerp(ped.group.rotation.y,
          angleTo(pos.x, pos.z, cp.x, cp.z), Math.min(1, dt * 4));
      }
      animatePerson(ped.person, dt, 0);
      continue;
    }
    if (ped.mode === 'browse') {
      ped.waitT -= dt;
      if (ped.waitT <= 0) {
        ped.waitT = rand(2, 6);
        ped.group.rotation.y += rand(-0.8, 0.8);
      }
      animatePerson(ped.person, dt, 0);
      continue;
    }
    // Wander: stroll between nearby road points, pausing to look around.
    ped.waitT -= dt;
    if (ped.waitT > 0) { animatePerson(ped.person, dt, 0); continue; }
    const d = dist2d(pos.x, pos.z, ped.targetX, ped.targetZ);
    if (d < 0.8) {
      const near = nearestRoadPoint(ped.homeX + rand(-26, 26), ped.homeZ + rand(-26, 26));
      ped.targetX = near.x + rand(-3, 3);
      ped.targetZ = near.z + rand(-3, 3);
      ped.waitT = rand(0, 3.5);
      continue;
    }
    const a = angleTo(pos.x, pos.z, ped.targetX, ped.targetZ);
    ped.group.rotation.y = angleLerp(ped.group.rotation.y, a, Math.min(1, dt * 5));
    pos.x += Math.sin(ped.group.rotation.y) * ped.speed * dt;
    pos.z += Math.cos(ped.group.rotation.y) * ped.speed * dt;
    collideWorld(pos, 0.4);
    animatePerson(ped.person, dt, ped.speed);
  }
}
