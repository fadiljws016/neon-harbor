// traffic.js — ambient cars: parked rows dressing the kerbs and a living
// stream of drivers who brake for trouble and flee gunfire.

import { G } from './state.js';
import { rand, pick, dist2d, clamp } from './util.js';
import { VX, HZ, WORLD, BOULEVARD_X } from './city.js';
import { makeCar, placeCar, driveStep, collideCar } from './vehicles.js';
import { policeCars } from './police.js';
import { officers } from './officers.js';
import { peds } from './pedestrians.js';
import { sfxHorn } from './audio.js';

export const trafficCars = [];
export const parkedCars = [];
let carSeq = 1;

export function allCars() { return trafficCars.concat(parkedCars); }

function parkRow(scene, x, z0, z1, side, vertical = true) {
  for (let z = z0; z <= z1; z += rand(7.5, 10.5)) {
    if (Math.random() < 0.22) continue;
    const type = pick(['sedan', 'sedan', 'taxi', 'sport', 'truck']);
    const car = makeCar(type);
    car.id = carSeq++;
    car.parked = true;
    if (vertical) placeCar(car, x + side * 5.1, z + rand(-0.6, 0.6), side > 0 ? Math.PI : 0);
    else placeCar(car, z + rand(-0.6, 0.6), x + side * 5.1, side > 0 ? Math.PI / 2 : -Math.PI / 2);
    scene.add(car.group);
    parkedCars.push(car);
  }
}

export function initTraffic(scene) {
  // Parked dressing on the busiest streets, both kerbs of the cover street.
  parkRow(scene, -64, -70, -4, -1);
  parkRow(scene, -64, -70, -4, 1);
  parkRow(scene, BOULEVARD_X, -300, 300, -1);
  parkRow(scene, BOULEVARD_X, -300, 300, 1);
  parkRow(scene, 0, -200, 200, -1);
  parkRow(scene, 128, -260, -60, 1);
  parkRow(scene, -32, -260, 260, -1, false);
  parkRow(scene, 96, -260, 260, 1, false);
  // The living stream.
  for (let i = 0; i < 26; i++) {
    const type = pick(['sedan', 'sedan', 'taxi', 'sport', 'truck']);
    const car = makeCar(type, undefined, { detail: true });
    car.id = carSeq++;
    const vertical = Math.random() < 0.55;
    const lane = Math.random() < 0.5 ? 2.6 : -2.6;
    if (vertical) {
      const x = pick(VX);
      const dir = lane > 0 ? 1 : -1;
      placeCar(car, x + lane, rand(WORLD.z0 + 20, WORLD.z1 - 20), dir > 0 ? 0 : Math.PI);
    } else {
      const z = pick(HZ);
      const dir = lane > 0 ? 1 : -1;
      placeCar(car, rand(WORLD.x0 + 20, WORLD.x1 - 20), z + lane, dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    car.speed = rand(6, 11);
    car.cruise = rand(8, 13);
    scene.add(car.group);
    trafficCars.push(car);
  }
}

export function updateTraffic(dt) {
  const pp = G.playerCar ? G.playerCar.group.position
    : (G.player ? G.player.group.position : null);
  for (const car of trafficCars) {
    if (car.dead) continue;
    let throttle = 0;
    const target = car.fleeing ? 20 : (car.cruise || 10);
    if (car.speed < target) throttle = 0.7;
    // Brake for the car ahead, the player, or a roadblock of trouble.
    let blocked = false;
    const fx = car.x + Math.sin(car.angle) * 7;
    const fz = car.z + Math.cos(car.angle) * 7;
    for (const other of trafficCars) {
      if (other === car) continue;
      if (dist2d(fx, fz, other.x, other.z) < 4.4) { blocked = true; break; }
    }
    if (!blocked) {
      for (const other of parkedCars) {
        if (dist2d(fx, fz, other.x, other.z) < 3.6) { blocked = true; break; }
      }
    }
    // People in the road are obstacles too: officers on a cordon and
    // pedestrians mid-crossing make the stream brake instead of ghosting
    // through them (in shot mode this is what keeps the chase cordon
    // readable — traffic queues behind the roadblock instead of
    // wandering through the duel).
    if (!blocked) {
      for (const o of officers) {
        if (!o.dead && dist2d(fx, fz, o.group.position.x, o.group.position.z) < 3.4) { blocked = true; break; }
      }
    }
    if (!blocked) {
      for (const p of peds) {
        if (!p.dead && dist2d(fx, fz, p.group.position.x, p.group.position.z) < 3.2) { blocked = true; break; }
      }
    }
    if (!blocked && pp && dist2d(fx, fz, pp.x, pp.z) < 3.4) blocked = true;
    if (blocked) {
      throttle = car.speed > 1 ? -1 : 0;
      if (Math.random() < dt * 0.25) sfxHorn();
    }
    // Panic near gunfire.
    if (pp && G.t - (G.lastHurtT || -99) < 3 && dist2d(car.x, car.z, pp.x, pp.z) < 16) {
      car.fleeing = true;
    }
    if (car.fleeing && pp && dist2d(car.x, car.z, pp.x, pp.z) > 42) car.fleeing = false;
    driveStep(car, dt, throttle, 0);
    // Ambient cars resolve against the static world and the parked rows
    // too, so a braking failure ends in a nudge, not an overlap.
    collideCar(car, allCars().concat(policeCars), 0.8);
    // Keep to the grid: at the world edge, turn around.
    if (car.x < WORLD.x0 + 8 || car.x > WORLD.x1 - 8 || car.z < WORLD.z0 + 8 || car.z > WORLD.z1 - 8) {
      car.angle += Math.PI;
      car.x = clamp(car.x, WORLD.x0 + 10, WORLD.x1 - 10);
      car.z = clamp(car.z, WORLD.z0 + 10, WORLD.z1 - 10);
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = car.angle;
    }
  }
}
