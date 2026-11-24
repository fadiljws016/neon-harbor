// player.js — Rocco "Rayo" Vidal: on-foot movement with city collision,
// car entry, aiming and trigger discipline. The cyan jacket is load-bearing.

import { G, currentWeapon } from './state.js';
import { clamp, angleLerp, angleTo, dist2d, collideCircleOBB } from './util.js';
import { makePerson, makeGunMesh, poseStand, poseAim, animatePerson } from './people.js';
import { queryWorld } from './city.js';
import { keys, mouse } from './input.js';
import { playerShoot } from './combat.js';
import { addShake } from './camera.js';

export const PLAYER_COLORS = { shirt: 0x3ecfe8, pants: 0x23262e, skin: 0xc68863, hair: 0x14100c };

// On-foot pace in m/s: the walk reads as a harbour jog, and the sprint
// is what the escape stages are timed against.
const WALK_SPEED = 4.6;
const SPRINT_SPEED = 7.4;

let fireCd = 0;
const _push = { x: 0, z: 0 };
const _raycaster = () => new THREE.Raycaster();

export function createPlayer(scene, x, z) {
  const person = makePerson({
    shirt: PLAYER_COLORS.shirt, pants: PLAYER_COLORS.pants,
    skin: PLAYER_COLORS.skin, hair: PLAYER_COLORS.hair, gun: 'pistol', pattern: 'plain',
  });
  person.group.position.set(x, 0, z);
  scene.add(person.group);
  const player = {
    person, group: person.group,
    heading: Math.PI, speed: 0, fireCd: 0, dead: false,
    get x() { return person.group.position.x; },
    get z() { return person.group.position.z; },
  };
  G.player = player;
  return player;
}

export function aimPoint() {
  const cam = G.camera;
  if (!cam) return null;
  const rc = _raycaster();
  rc.setFromCamera({ x: mouse.x, y: mouse.y }, cam);
  const origin = rc.ray.origin, dir = rc.ray.direction;
  if (Math.abs(dir.y) < 1e-5) return null;
  const t = (1.25 - origin.y) / dir.y;
  if (t < 0 || t > 90) return null;
  return { x: origin.x + dir.x * t, y: 1.25, z: origin.z + dir.z * t };
}

export function keepOutOfCars(entity, cars, r = 0.45) {
  const pos = entity.group ? entity.group.position : entity;
  for (const car of cars) {
    if (car.dead) continue;
    _push.x = 0; _push.z = 0;
    const obb = { x: car.x, z: car.z, hw: car.spec.W / 2, hd: car.spec.L / 2, rot: car.angle };
    if (collideCircleOBB(pos.x, pos.z, r, obb, _push)) {
      pos.x += _push.x; pos.z += _push.z;
    }
  }
}

const _near = [];
export function collideWorld(pos, r = 0.45) {
  // Broadphase first (city grid): only the static shapes near the mover
  // are resolved, with the same push-out math the full scan always used.
  queryWorld(pos.x, pos.z, r + 4, _near);
  for (const c of _near) {
    if (c.hw !== undefined) {
      _push.x = 0; _push.z = 0;
      if (collideCircleOBB(pos.x, pos.z, r, c, _push)) { pos.x += _push.x; pos.z += _push.z; }
    } else {
      const d = dist2d(pos.x, pos.z, c.x, c.z);
      const min = r + c.r;
      if (d > 0.001 && d < min) {
        pos.x += (pos.x - c.x) / d * (min - d);
        pos.z += (pos.z - c.z) / d * (min - d);
      }
    }
  }
  pos.x = clamp(pos.x, -298, 318);
  pos.z = clamp(pos.z, -338, 338);
}

export function updatePlayer(dt, cars) {
  const p = G.player;
  if (!p || p.dead || G.playerCar || G.mapOpen || G.dialogue) {
    if (p && !p.dead) animatePerson(p.person, dt, 0);
    return;
  }
  const pos = p.group.position;
  const cam = G.camera;
  const camYaw = cam ? Math.atan2(cam.position.x - pos.x, cam.position.z - pos.z) + Math.PI : 0;
  let mx = 0, mz = 0;
  if (keys.w) mz += 1;
  if (keys.s) mz -= 1;
  if (keys.a) mx -= 1;
  if (keys.d) mx += 1;
  const moving = (mx !== 0 || mz !== 0);
  const sprint = keys.shift;
  const speedMax = sprint ? SPRINT_SPEED : WALK_SPEED;
  let vx = 0, vz = 0;
  if (moving) {
    const len = Math.hypot(mx, mz);
    mx /= len; mz /= len;
    // Screen basis: camYaw already carries the +PI that points from the
    // player back at the camera, so (sin, cos) of it IS the view forward
    // (away from the camera) and (-cos, sin) is screen right. The rev-8
    // Convention: heading 0 faces +z and the follow camera sits at
    // heading+PI, so the camera-forward basis is (sin(camYaw), cos(camYaw)).
    // The rev-8 audit found the old negated basis walked W toward the camera.
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const rx = -fz, rz = fx;
    vx = (fx * mz + rx * mx) * speedMax;
    vz = (fz * mz + rz * mx) * speedMax;
    p.heading = angleLerp(p.heading, Math.atan2(vx, vz), Math.min(1, dt * 12));
  }
  p.speed = moving ? speedMax : 0;

  const aiming = mouse.rightDown || mouse.down;
  const ap = aiming ? aimPoint() : null;
  if (ap && currentWeapon().id !== 'fists') {
    p.heading = angleLerp(p.heading, angleTo(pos.x, pos.z, ap.x, ap.z), Math.min(1, dt * 18));
  }
  p.group.rotation.y = p.heading;

  pos.x += vx * dt;
  pos.z += vz * dt;
  collideWorld(pos, 0.45);
  if (cars) keepOutOfCars(p, cars, 0.45);
  pos.x = clamp(pos.x, -298, 318);
  pos.z = clamp(pos.z, -338, 338);

  // Poses + trigger.
  fireCd -= dt;
  if (ap && currentWeapon().id !== 'fists') poseAim(p.person);
  else if (!moving) poseStand(p.person);
  if (mouse.down && fireCd <= 0) {
    const w = currentWeapon();
    if (w.id === 'fists') {
      fireCd = w.rate;
      playerShoot(null);
    } else if (ap) {
      fireCd = w.rate;
      playerShoot(ap);
      addShake(w.kick * 0.05);
    }
  }
  if (!mouse.down && !currentWeapon().auto) fireCd = Math.min(fireCd, 0.02);
  animatePerson(p.person, dt, moving ? speedMax : 0);
  G.speedKmh = 0;
}

export function setPlayerWeaponMesh() {
  const p = G.player;
  if (!p) return;
  const w = currentWeapon();
  const kind = w.id === 'p9' ? 'pistol' : w.id === 'kobra' ? 'smg' : w.id === 'muelle' ? 'shotgun' : null;
  if (p.person.gunMesh) {
    p.person.gunMesh.parent.remove(p.person.gunMesh);
    p.person.gunMesh = null;
  }
  if (kind) {
    const gm = makeGunMesh(kind);
    gm.position.set(0, -0.62, 0.06);
    p.person.armR.add(gm);
    p.person.gunMesh = gm;
  }
}
