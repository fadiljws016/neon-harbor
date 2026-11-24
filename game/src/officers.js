// officers.js — PDP foot officers: the blue line that pours out of the
// cruisers. FOOT-### ids join the same dispatch board as the cars.

import { G } from './state.js';
import { clamp, rand, dist2d, angleTo, angleLerp } from './util.js';
import { makePerson, poseAim, poseCrouch, poseDown, animatePerson } from './people.js';
import { fireAt, gunPosOf, hurtPlayer } from './combat.js';
import { sfxShot } from './audio.js';
import { dispatch } from './police.js';
import { collideWorld } from './player.js';

export const officers = [];
let footUnitSeq = 30; // FOOT-30 upward

export function nextFootUnit() { return 'FOOT-' + (footUnitSeq++); }

export function spawnOfficer(x, z, opts = {}) {
  const person = makePerson({
    shirt: 0x2a4a8c, pants: 0x1f2a38, gun: opts.gun || 'pistol',
    uniform: true, cap: 0x1c2f52, pattern: 'plain',
  });
  person.group.position.set(x, 0, z);
  person.group.rotation.y = opts.heading ?? 0;
  G.scene.add(person.group);
  const officer = {
    unit: opts.unit || nextFootUnit(),
    person, group: person.group,
    health: opts.health ?? 45, dead: false,
    fireCd: rand(0.5, 1.6), role: opts.role || 'engage',
    postX: x, postZ: z, damage: opts.damage ?? 6,
  };
  poseAim(person);
  officers.push(officer);
  dispatch.push({ id: officer.unit, kind: 'foot', ref: officer, status: 'ENGAGING' });
  return officer;
}

export function hurtOfficer(officer, dmg) {
  if (officer.dead) return;
  officer.health -= dmg;
  if (officer.health <= 0) {
    officer.dead = true;
    poseDown(officer.person);
    const entry = dispatch.find((d) => d.ref === officer);
    if (entry) entry.status = 'DOWN';
  }
}

export function clearOfficers() {
  for (const o of officers) {
    G.scene.remove(o.group);
    const i = dispatch.findIndex((d) => d.ref === o);
    if (i >= 0) dispatch.splice(i, 1);
  }
  officers.length = 0;
}

export function updateOfficers(dt) {
  const target = G.playerCar ? G.playerCar.group.position
    : (G.player ? G.player.group.position : null);
  if (!target) return;
  for (const o of officers) {
    if (o.dead) continue;
    const pos = o.group.position;
    const d = dist2d(pos.x, pos.z, target.x, target.z);
    o.group.rotation.y = angleLerp(o.group.rotation.y,
      angleTo(pos.x, pos.z, target.x, target.z), Math.min(1, dt * 7));
    if (o.role === 'engage' && d > 15 && !G.shotMode) {
      pos.x += Math.sin(o.group.rotation.y) * 3.1 * dt;
      pos.z += Math.cos(o.group.rotation.y) * 3.1 * dt;
      collideWorld(pos, 0.42);
      animatePerson(o.person, dt, 3.1);
    } else {
      if (d < 12) poseCrouch(o.person); else poseAim(o.person);
      animatePerson(o.person, dt, 0);
    }
    // Fire control: only when the heat is real or the shot demands it.
    if ((G.wanted >= 1 || G.shotMode) && d < 36) {
      o.fireCd -= dt;
      if (o.fireCd <= 0) {
        o.fireCd = rand(0.7, 1.4);
        const from = gunPosOf(o.person);
        const hitChance = clamp(0.5 - d * 0.009, 0.1, 0.42);
        const willHit = Math.random() < hitChance && !G.shotMode;
        sfxShot('pistol');
        fireAt('officer', from, { x: target.x, y: 1.2, z: target.z }, {
          spread: willHit ? 0.004 : 0.05, hitSomething: true,
          onHit: () => { if (willHit) hurtPlayer(o.damage); },
        });
      }
    }
    const entry = dispatch.find((e) => e.ref === o);
    if (entry) entry.dist = Math.round(d);
  }
}
