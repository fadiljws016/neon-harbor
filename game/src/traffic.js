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

// Drop a stream car on a random road lane, in the lane that matches its
// heading, clear of the rest of the stream. Used at boot and by the
// anti-stall respawn. Returns false if no clear stretch turned up.
function placeStreamCar(car, playerPos) {
  for (let tries = 0; tries < 10; tries++) {
    const vertical = Math.random() < 0.55;
    const lane = Math.random() < 0.5 ? 2.6 : -2.6;
    let x, z, angle;
    if (vertical) {
      const rx = pick(VX);
      const dir = lane > 0 ? 1 : -1;
      x = rx + lane; z = rand(WORLD.z0 + 24, WORLD.z1 - 24); angle = dir > 0 ? 0 : Math.PI;
    } else {
      const rz = pick(HZ);
      const dir = lane > 0 ? 1 : -1;
      x = rand(WORLD.x0 + 24, WORLD.x1 - 24); z = rz + lane; angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    if (playerPos && dist2d(x, z, playerPos.x, playerPos.z) < 38) continue;
    let clear = true;
    for (const o of trafficCars) {
      if (o !== car && dist2d(x, z, o.x, o.z) < 11) { clear = false; break; }
    }
    if (!clear) continue;
    placeCar(car, x, z, angle);
    car.speed = (car.cruise || 10) * 0.6;
    car.stallT = 0;
    car.escapeT = 0;
    return true;
  }
  return false;
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
  for (let i = 0; i < 36; i++) {
    const type = pick(['sedan', 'sedan', 'taxi', 'sport', 'truck']);
    const car = makeCar(type, undefined, { detail: true });
    car.id = carSeq++;
    car.speed = rand(6, 11);
    car.cruise = rand(8, 13);
    car.stallT = 0;
    car.escapeT = 0;
    placeStreamCar(car, null);
    scene.add(car.group);
    trafficCars.push(car);
  }
}

// Corridor scan: how far ahead of `car` is the point (ox, oz), if it lies
// inside the band the car is actually driving down? Returns the distance
// along the heading, or -1 when the point is behind, too far ahead, or
// off to the side. The old brake check was a radial probe — a point 7 m
// ahead with a 3.6–4.4 m radius — so a car driving past a parked row
// braked for every parked car whose centre drifted inside the circle,
// and whole streets froze solid beside their own kerbs.
function corridorAhead(car, ox, oz, latMax, lonMax) {
  const sin = Math.sin(car.angle), cos = Math.cos(car.angle);
  const dx = ox - car.x, dz = oz - car.z;
  const lon = dx * sin + dz * cos;
  if (lon < 0.5 || lon > lonMax) return -1;
  const lat = dx * cos - dz * sin;
  if (Math.abs(lat) > latMax) return -1;
  return lon;
}

export function updateTraffic(dt) {
  const pp = G.playerCar ? G.playerCar.group.position
    : (G.player ? G.player.group.position : null);
  for (const car of trafficCars) {
    if (car.dead) continue;
    // How far did the car actually travel since its last update? The
    // anti-stall logic below lives on this, not on the speedometer —
    // a wedged car can hold speed against a push-out forever.
    const movedStep = (car._px === undefined) ? 1
      : Math.hypot(car.x - car._px, car.z - car._pz);
    car._px = car.x; car._pz = car.z;

    // What blocks my corridor? Vehicles count inside a lane-width band;
    // people and the player get a wider one — a driver must never thread
    // close past a person standing in the road. Officers on a cordon and
    // pedestrians mid-crossing still stop the stream (in shot mode this
    // is what keeps the chase cordon readable — traffic queues behind
    // the roadblock instead of wandering through the duel).
    let blocker = null; // 'car' | 'parked' | 'police' | 'person' | 'player'
    let blockerCar = null;
    let best = Infinity;
    const scan = (ox, oz, latMax, lonMax, kind, ref) => {
      const lon = corridorAhead(car, ox, oz, latMax, lonMax);
      if (lon >= 0 && lon < best) { best = lon; blocker = kind; blockerCar = ref || null; }
    };
    for (const o of trafficCars) { if (o !== car && !o.dead) scan(o.x, o.z, 2.0, 9.5, 'car', o); }
    for (const o of parkedCars) scan(o.x, o.z, 2.0, 9.5, 'parked', o);
    for (const o of policeCars) { if (!o.dead) scan(o.x, o.z, 2.0, 9.5, 'police', o); }
    for (const o of officers) { if (!o.dead) scan(o.group.position.x, o.group.position.z, 2.6, 9, 'person'); }
    for (const p of peds) { if (!p.dead) scan(p.group.position.x, p.group.position.z, 2.6, 9, 'person'); }
    if (pp) scan(pp.x, pp.z, 2.6, 9, 'player');
    const blocked = blocker !== null;

    let throttle = 0;
    let steer = 0;
    const target = car.fleeing ? 20 : (car.cruise || 10);
    if (car.escapeT > 0) {
      // Anti-stall wiggle near the player: back out with lock on and let
      // the corridor clear itself, instead of teleporting in view.
      car.escapeT -= dt;
      throttle = -1;
      steer = car.escapeDir || 0.6;
    } else if (blocked) {
      throttle = car.speed > 1 ? -1 : 0;
      if (Math.random() < dt * 0.25) sfxHorn();
    } else if (car.speed < target) {
      throttle = 0.7;
    }
    // Panic near gunfire.
    if (pp && G.t - (G.lastHurtT || -99) < 3 && dist2d(car.x, car.z, pp.x, pp.z) < 16) {
      car.fleeing = true;
    }
    if (car.fleeing && pp && dist2d(car.x, car.z, pp.x, pp.z) > 42) car.fleeing = false;

    // Anti-stall: a car that wants to move but is not moving is wedged
    // or false-braked, and without recovery it stays frozen forever.
    // Waiting is legitimate only behind a person, the player, or a car
    // that is itself legitimately waiting — a queue is not a stall.
    // Shot mode never recovers: the staged frames own their traffic.
    const legitWait = blocked && (blocker === 'person' || blocker === 'player'
      || (blocker === 'car' && blockerCar && (blockerCar.stallT || 0) <= 3));
    const wantsGo = car.escapeT <= 0 && !legitWait;
    const creeping = movedStep < 0.02 && (Math.abs(car.speed) > 0.8 || throttle > 0 || blocked);
    if (!G.shotMode && wantsGo && creeping) car.stallT = (car.stallT || 0) + dt;
    else car.stallT = Math.max(0, (car.stallT || 0) - dt * 2);
    if (!G.shotMode && car.stallT > 5) {
      car.stallT = 0;
      if (!pp || dist2d(car.x, car.z, pp.x, pp.z) > 35) {
        placeStreamCar(car, pp); // too far away to be seen popping
      } else {
        car.escapeT = 1.1;
        car.escapeDir = (Math.random() < 0.5 ? -0.6 : 0.6);
      }
    }

    driveStep(car, dt, throttle, steer);
    // Ambient cars resolve against the static world and the parked rows
    // too, so a braking failure ends in a nudge, not an overlap.
    collideCar(car, allCars().concat(policeCars), 0.8);
    // Keep to the grid: at the world edge, turn around — mirrored across
    // the road centre, so the U-turn lands in the opposing lane instead
    // of driving head-on down the lane it just came up.
    if (car.x < WORLD.x0 + 8 || car.x > WORLD.x1 - 8 || car.z < WORLD.z0 + 8 || car.z > WORLD.z1 - 8) {
      const alongZ = Math.abs(Math.cos(car.angle)) > 0.5;
      car.angle += Math.PI;
      if (alongZ) {
        let rx = VX[0];
        for (const v of VX) if (Math.abs(v - car.x) < Math.abs(rx - car.x)) rx = v;
        car.x = 2 * rx - car.x;
      } else {
        let rz = HZ[0];
        for (const v of HZ) if (Math.abs(v - car.z) < Math.abs(rz - car.z)) rz = v;
        car.z = 2 * rz - car.z;
      }
      car.x = clamp(car.x, WORLD.x0 + 10, WORLD.x1 - 10);
      car.z = clamp(car.z, WORLD.z0 + 10, WORLD.z1 - 10);
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = car.angle;
    }
  }
}
