// police.js — PDP pursuit cars and the dispatch board. Every unit carries
// a UNIQUE id (CAR-###) — the round-1 build listed the same unit twice
// and the owner noticed; never again.

import { G } from './state.js';
import { clamp, dist2d, angleTo, angleDiff } from './util.js';
import { makeCar, placeCar, driveStep, collideCar } from './vehicles.js';
import { nearestRoadPoint } from './city.js';
import { allCars } from './traffic.js';

export const policeCars = [];
export const dispatch = [];
let carUnitSeq = 161; // CAR-161 upward, roadblocks and pursuers alike

export function nextCarUnit() { return 'CAR-' + (carUnitSeq++); }

export function spawnPoliceCar(x, z, angle = 0, role = 'pursuit') {
  const car = makeCar('cruiser', undefined, { detail: true });
  placeCar(car, x, z, angle);
  car.unit = nextCarUnit();
  car.role = role;
  car.speed = 0;
  G.scene.add(car.group);
  policeCars.push(car);
  dispatch.push({ id: car.unit, kind: 'car', ref: car, status: role === 'roadblock' ? 'BLOCKING' : 'PURSUIT' });
  return car;
}

export function clearPolice() {
  for (const c of policeCars) G.scene.remove(c.group);
  policeCars.length = 0;
  dispatch.length = 0;
}

export function desiredPoliceCount() {
  if (G.wanted < 1) return 0;
  if (G.wanted < 2) return 1;
  if (G.wanted < 3) return 2;
  if (G.wanted < 4) return 3;
  return 4;
}

function spawnNearPlayer() {
  const p = G.playerCar ? G.playerCar.group.position : G.player.group.position;
  const a = Math.random() * Math.PI * 2;
  const near = nearestRoadPoint(p.x + Math.sin(a) * 55, p.z + Math.cos(a) * 55);
  return spawnPoliceCar(near.x, near.z, Math.random() * Math.PI * 2, 'pursuit');
}

export function updatePolice(dt) {
  // Wanted decay: lie low and the heat bleeds off.
  if (!G.shotMode && G.wanted > 0 && G.t - (G.lastHurtT || -99) > 14) {
    G.wanted = Math.max(0, G.wanted - dt * 0.03);
  }
  G.heliActive = G.wanted >= 3;
  const want = G.shotMode ? policeCars.length : desiredPoliceCount();
  const pursuers = policeCars.filter((c) => c.role === 'pursuit' && !c.dead);
  if (!G.shotMode && pursuers.length < want && G.player) {
    if (Math.random() < dt * 0.7) spawnNearPlayer();
  }
  const target = G.playerCar ? G.playerCar.group.position
    : (G.player ? G.player.group.position : null);
  if (!target) return;
  for (const car of policeCars) {
    if (car.dead) continue;
    if (car.group.userData.lightBar) {
      const bar = car.group.userData.lightBar;
      bar.children[0].material.color.setHex(G.t % 0.5 < 0.25 ? 0xff5050 : 0x551114);
      bar.children[1].material.color.setHex(G.t % 0.5 < 0.25 ? 0x112a55 : 0x4d8dff);
    }
    if (car.role === 'roadblock') continue;
    const d = dist2d(car.x, car.z, target.x, target.z);
    const desired = angleTo(car.x, car.z, target.x, target.z);
    const diff = angleDiff(car.angle, desired);
    const steer = clamp(diff * 1.6, -0.62, 0.62);
    let throttle = 0;
    if (d > 9) throttle = 1;
    else if (d > 4.5) throttle = 0.45;
    else throttle = -0.4;
    if (Math.abs(diff) > 2.4 && d < 12) throttle = -0.8;
    driveStep(car, dt, throttle, steer);
    // Pursuers are solid too: walls and parked cars stop a chase cold.
    // (Their own fleet-mates are in the list — cruisers shove each other
    // out of overlaps instead of stacking inside one another.)
    const obstacles = allCars().concat(policeCars);
    if (G.stageCar && G.stageCar !== car) obstacles.push(G.stageCar);
    if (G.playerCar && G.playerCar !== car) obstacles.push(G.playerCar);
    collideCar(car, obstacles, 0.5);
    // Ram pressure: nudge the player's car on contact.
    if (G.playerCar && d < 3.4 && !G.playerCar.dead) {
      G.playerCar.speed *= (1 - dt * 1.4);
    }
  }
  // Refresh dispatch distances/status.
  for (const entry of dispatch) {
    if (entry.kind !== 'car') continue;
    const c = entry.ref;
    entry.dist = Math.round(dist2d(c.x, c.z, target.x, target.z));
    if (c.dead) entry.status = 'DISABLED';
  }
}
