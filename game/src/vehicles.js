// vehicles.js — the car factory. Dimensions are the approved table from
// the Bahia Heat data: overall length, width, beltline and roof heights
// are built to the same centimetres so placements read identically under
// the neon — but the bodywork itself is shaped, not stacked: a full-width
// lower hull, a narrower shoulder deck, sloped hood/trunk lids and a
// raked greenhouse under a tapered roof.

import { rand, pick, clamp, collideCircleOBB } from './util.js';
import { glowTexture, queryWorld } from './city.js';

export const CAR_TYPES = {
  sedan:  { name: 'Noche Sedan',    L: 4.4, W: 1.9,  H: 0.62, cabinH: 0.55, colors: [0x3ecfe8, 0xff4fa3, 0xe8e3d5, 0x2aa864, 0xf5a623, 0x30363e], topSpeed: 34, accel: 11, grip: 3.2 },
  sport:  { name: 'Volt GT',        L: 4.2, W: 1.95, H: 0.5,  cabinH: 0.42, colors: [0xffcf3f, 0xff4438, 0x3ecfe8, 0xf2f2f2], topSpeed: 47, accel: 17, grip: 3.8 },
  taxi:   { name: 'Taxi Noche',     L: 4.4, W: 1.9,  H: 0.62, cabinH: 0.58, colors: [0xffb340], topSpeed: 33, accel: 11, grip: 3.2 },
  truck:  { name: 'Mulo Truck',     L: 5.8, W: 2.2,  H: 0.9,  cabinH: 0.8,  colors: [0xb08954, 0x7a8a99, 0x54804e, 0xd84a30], topSpeed: 27, accel: 8, grip: 2.8 },
  cruiser:{ name: 'PDP Interceptor', L: 4.6, W: 1.95, H: 0.6,  cabinH: 0.55, colors: [0xf2f2f2], topSpeed: 44, accel: 16, grip: 3.6 },
};

// Silhouette profiles per car type (fractions of L unless noted): hood
// length, windshield/rear-glass rake in radians, cabin length/width and
// roof width, cabin centre offset. Sport sits lower with a longer hood, a
// harder rake and a rear wing; the cruiser is a sedan with a longer nose.
const CAR_SHAPES = {
  sedan:   { hood: 0.25, rake: 0.60, rearRake: 0.52, cabLen: 0.40, cabW: 0.80, roofW: 0.66, cabZ: -0.04, spoiler: false },
  sport:   { hood: 0.31, rake: 0.74, rearRake: 0.60, cabLen: 0.36, cabW: 0.78, roofW: 0.62, cabZ: -0.10, spoiler: true },
  taxi:    { hood: 0.25, rake: 0.60, rearRake: 0.52, cabLen: 0.40, cabW: 0.80, roofW: 0.66, cabZ: -0.04, spoiler: false },
  cruiser: { hood: 0.27, rake: 0.58, rearRake: 0.50, cabLen: 0.40, cabW: 0.80, roofW: 0.66, cabZ: -0.04, spoiler: false },
};

let _wheelGeo = null;
let _wheelMat = null;
let _glassMat = null;
let _darkMat = null;

function sharedMats() {
  if (!_wheelGeo) {
    _wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
    // Material groups: tyre on the barrel, pale hub discs on both caps —
    // the wheels read as tyred alloys with zero extra meshes.
    _wheelMat = [
      new THREE.MeshLambertMaterial({ color: 0x17191d }),
      new THREE.MeshLambertMaterial({ color: 0x9aa4ae }),
      new THREE.MeshLambertMaterial({ color: 0x9aa4ae }),
    ];
    _glassMat = new THREE.MeshLambertMaterial({ color: 0x101c2c });
    _darkMat = new THREE.MeshLambertMaterial({ color: 0x1c1f24 });
  }
}

export function makeCar(typeKey, colorHex, opts = {}) {
  sharedMats();
  const t = CAR_TYPES[typeKey];
  const color = colorHex ?? pick(t.colors);
  const grp = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  // Two-tone: the roof panel runs a shade darker than the body.
  const roofMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(color).multiplyScalar(0.72),
  });

  // ---- Silhouette -------------------------------------------------------
  // The old build was three stacked slabs (body, glass box, roof) and read
  // as a toy block up close. Overall length, width, beltline and roof
  // heights stay the approved table's, so colliders, staged placements and
  // lamp positions are untouched — only the bodywork between them changes.
  const y0 = 0.36;
  const bodyTop = y0 + t.H;
  let mirrorZ = t.L * 0.14;
  let mirrorY = bodyTop + t.cabinH * 0.3;
  if (typeKey === 'truck') {
    // Mulo: chassis, a cab with a gently raked windshield, and a tall
    // cargo box behind a short gap — no more glass slab amidships.
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(t.W, t.H * 0.5, t.L), bodyMat);
    chassis.position.y = y0 + t.H * 0.25;
    grp.add(chassis);
    const cabBase = new THREE.Mesh(new THREE.BoxGeometry(t.W * 0.97, 0.52, 1.95), bodyMat);
    cabBase.position.set(0, y0 + t.H * 0.5 + 0.26, t.L / 2 - 0.98);
    grp.add(cabBase);
    const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(t.W * 0.9, 0.5, 1.45), _glassMat);
    cabGlass.position.set(0, y0 + t.H * 0.5 + 0.77, t.L / 2 - 1.08);
    grp.add(cabGlass);
    const cabShield = new THREE.Mesh(new THREE.BoxGeometry(t.W * 0.88, 0.66, 0.05), _glassMat);
    cabShield.rotation.x = -0.22;
    cabShield.position.set(0, y0 + t.H * 0.5 + 0.77, t.L / 2 - 0.34);
    grp.add(cabShield);
    const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(t.W * 0.9, 0.07, 1.5), roofMat);
    cabRoof.position.set(0, y0 + t.H * 0.5 + 1.035, t.L / 2 - 1.12);
    grp.add(cabRoof);
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(t.W * 0.99, 1.32, t.L * 0.54), roofMat);
    cargo.position.set(0, y0 + t.H * 0.5 + 0.66, -t.L / 2 + t.L * 0.27);
    grp.add(cargo);
    mirrorZ = t.L * 0.36;
    mirrorY = y0 + t.H * 0.5 + 0.62;
  } else {
    const S = CAR_SHAPES[typeKey];
    const cabLen = t.L * S.cabLen, cabW = t.W * S.cabW, cabZ = t.L * S.cabZ;
    const cabFront = cabZ + cabLen / 2, cabRear = cabZ - cabLen / 2;
    // Full-width lower hull; the narrower deck above it steps in over the
    // wheels, which reads as the fender/shoulder line.
    const lower = new THREE.Mesh(new THREE.BoxGeometry(t.W, t.H * 0.68, t.L), bodyMat);
    lower.position.y = y0 + t.H * 0.34;
    grp.add(lower);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(t.W * 0.93, t.H * 0.38, t.L * 0.9), bodyMat);
    deck.position.set(0, y0 + t.H * 0.87 - 0.03, -t.L * 0.02);
    grp.add(deck);
    // Sloped hood and trunk lids, pitched down toward the ends.
    const hood = new THREE.Mesh(new THREE.BoxGeometry(t.W * 0.9, 0.09, t.L * S.hood + 0.3), bodyMat);
    hood.rotation.x = 0.17;
    hood.position.set(0, bodyTop - 0.05, t.L / 2 - (t.L * S.hood) / 2 + 0.04);
    grp.add(hood);
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(t.W * 0.9, 0.09, t.L * 0.16 + 0.26), bodyMat);
    trunk.rotation.x = -0.13;
    trunk.position.set(0, bodyTop - 0.045, -t.L / 2 + t.L * 0.08 - 0.04);
    grp.add(trunk);
    // Greenhouse: glass core, raked windshield and rear glass, and a roof
    // narrower than the glass so the cabin tapers as it rises.
    const glass = new THREE.Mesh(new THREE.BoxGeometry(cabW, t.cabinH * 0.94, cabLen), _glassMat);
    glass.position.set(0, bodyTop + t.cabinH / 2 - 0.05, cabZ);
    grp.add(glass);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(cabW * 0.97, t.cabinH * 1.32, 0.05), _glassMat);
    shield.rotation.x = -S.rake;
    shield.position.set(0, bodyTop + t.cabinH * 0.5, cabFront + Math.tan(S.rake) * t.cabinH * 0.1);
    grp.add(shield);
    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(cabW * 0.97, t.cabinH * 1.24, 0.05), _glassMat);
    rearGlass.rotation.x = S.rearRake;
    rearGlass.position.set(0, bodyTop + t.cabinH * 0.5, cabRear - Math.tan(S.rearRake) * t.cabinH * 0.1);
    grp.add(rearGlass);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(t.W * S.roofW, 0.07, cabLen * 0.78), roofMat);
    roof.position.set(0, bodyTop + t.cabinH + 0.015, cabZ - t.L * 0.01);
    grp.add(roof);
    if (S.spoiler) {
      for (const sx of [-t.W * 0.27, t.W * 0.27]) {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.06), _darkMat);
        strut.position.set(sx, bodyTop + 0.02, -t.L / 2 + 0.32);
        grp.add(strut);
      }
      const wing = new THREE.Mesh(new THREE.BoxGeometry(t.W * 0.74, 0.045, 0.32), _darkMat);
      wing.rotation.x = -0.07;
      wing.position.set(0, bodyTop + 0.1, -t.L / 2 + 0.3);
      grp.add(wing);
    }
    mirrorZ = cabFront - 0.06;
  }
  if (opts.detail) {
    // Grille + wing mirrors for the cars the camera gets close to
    // (traffic, police, mission and staged cars — not the parked rows).
    const grille = new THREE.Mesh(new THREE.BoxGeometry(t.W * 0.62, 0.16, 0.05), _darkMat);
    grille.position.set(0, 0.52, t.L / 2 + 0.14);
    grp.add(grille);
    for (const mx of [-t.W / 2 - 0.07, t.W / 2 + 0.07]) {
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.16), bodyMat);
      mirror.position.set(mx, mirrorY, mirrorZ);
      grp.add(mirror);
    }
  }
  // Bumpers and a shadow skirt ground the car on the wet street.
  for (const bz of [t.L / 2 + 0.06, -t.L / 2 - 0.06]) {
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(t.W * 0.96, 0.18, 0.16), _darkMat);
    bumper.position.set(0, 0.42, bz);
    grp.add(bumper);
  }
  const wheelPos = [
    [-t.W / 2 + 0.05, t.L / 2 - 0.85], [t.W / 2 - 0.05, t.L / 2 - 0.85],
    [-t.W / 2 + 0.05, -t.L / 2 + 0.85], [t.W / 2 - 0.05, -t.L / 2 + 0.85],
  ];
  const wheels = [];
  for (const [wx, wz] of wheelPos) {
    const w = new THREE.Mesh(_wheelGeo, _wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    grp.add(w);
    wheels.push(w);
  }
  // Headlights: emissive lamps, glow sprites and a pool on the asphalt.
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  for (const hx of [-t.W / 2 + 0.3, t.W / 2 - 0.3]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.05), lampMat);
    lamp.position.set(hx, 0.62, t.L / 2 + 0.13);
    grp.add(lamp);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xff2a30 }));
    tail.position.set(hx, 0.66, -t.L / 2 - 0.13);
    grp.add(tail);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,240,190,0.55)'), transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.position.set(0, 0.6, t.L / 2 + 0.7);
  glow.scale.set(2.6, 1.2, 1);
  grp.add(glow);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(2.6, 14),
    new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,240,190,0.4)'), transparent: true, depthWrite: false, opacity: 0.55 }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.05, t.L / 2 + 2.2);
  pool.scale.set(1, 1.9, 1);
  grp.add(pool);

  if (typeKey === 'taxi') {
    const signMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.3), signMat);
    sign.position.set(0, 0.36 + t.H + t.cabinH + 0.14, -t.L * 0.04);
    grp.add(sign);
  }
  if (typeKey === 'cruiser') {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.26),
      new THREE.MeshBasicMaterial({ color: 0xff2a30 }));
    red.position.x = -0.28;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.26),
      new THREE.MeshBasicMaterial({ color: 0x2a6dff }));
    blue.position.x = 0.28;
    bar.add(red, blue);
    bar.position.set(0, 0.36 + t.H + t.cabinH + 0.13, -t.L * 0.04);
    grp.add(bar);
    grp.userData.lightBar = bar;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(t.W + 0.02, 0.2, t.L * 0.7),
      new THREE.MeshLambertMaterial({ color: 0x1c2f52 }));
    stripe.position.y = 0.36 + t.H * 0.55;
    grp.add(stripe);
  }
  const car = {
    group: grp, type: typeKey, spec: t, color,
    x: 0, z: 0, angle: 0, speed: 0, steer: 0,
    health: 100, dead: false, wheels, driver: null, parked: false,
    smokeAcc: 0, id: 0,
  };
  grp.userData.car = car;
  return car;
}

export function placeCar(car, x, z, angle) {
  car.x = x; car.z = z; car.angle = angle;
  car.group.position.set(x, 0, z);
  car.group.rotation.y = angle;
}

export function carOBB(car) {
  return { x: car.x, z: car.z, hw: car.spec.W / 2, hd: car.spec.L / 2, rot: car.angle };
}

// Stamping the brake from speed scrubs BRAKE_DECEL m/s² — far harder
// than the gentle reverse-throttle creep used once nearly stopped.
const BRAKE_DECEL = 22;

// Simple arcade drive step shared by the player car, traffic and police.
export function driveStep(car, dt, throttle, steerTarget) {
  const t = car.spec;
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 7);
  if (throttle > 0) car.speed += t.accel * throttle * dt;
  else if (throttle < 0) car.speed += (car.speed > 0.5 ? -BRAKE_DECEL : t.accel * 0.55 * throttle) * dt;
  else car.speed -= car.speed * Math.min(1, dt * 0.7);
  car.speed -= car.speed * Math.abs(car.steer) * dt * 0.4;
  car.speed = Math.max(-t.topSpeed * 0.35, Math.min(t.topSpeed, car.speed));
  if (Math.abs(car.speed) > 0.05) {
    // Steering tightens with speed: the lock shrinks toward top speed and
    // the yaw gain saturates, so a fast car carves a wide arc instead of
    // spinning on its axis the way the raw speed-proportional rate did.
    const speedRatio = clamp(Math.abs(car.speed) / t.topSpeed, 0, 1);
    const steerCap = 0.62 * (1 - 0.45 * speedRatio);
    const effSteer = clamp(car.steer, -steerCap, steerCap);
    const gain = car.speed / (4.4 + Math.abs(car.speed) * 0.06);
    car.angle += effSteer * dt * gain * t.grip * 0.42 * (car.speed >= 0 ? 1 : -1);
  }
  car.x += Math.sin(car.angle) * car.speed * dt;
  car.z += Math.cos(car.angle) * car.speed * dt;
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.angle;
  const spin = car.speed * dt / 0.36;
  for (const w of car.wheels) w.rotation.x += spin;
  return car.speed;
}

// ---------- Car collision ----------
// A moving car is resolved as three circles down its spine (front,
// centre, rear; radius = half width). Each circle is pushed out of the
// static world (building OBBs and prop circles, via the city grid) and
// out of every other car's OBB; the correction moves the whole car, and
// an impact bleeds speed by the damp factor (0.45 player, 0.5 police,
// 0.8 ambient traffic). Before rev 8 the driven car resolved against
// NOTHING — it drove through buildings and parked cars.
const _nearStatic = [];
const _cpush = { x: 0, z: 0 };

export function collideCar(car, others, damp = 0.45) {
  if (car.dead) return false;
  const hw = car.spec.W / 2;
  const r = hw * 1.04;
  const sin = Math.sin(car.angle), cos = Math.cos(car.angle);
  const offs = [car.spec.L / 2 - hw, 0, hw - car.spec.L / 2];
  let hit = false;
  for (const o of offs) {
    let cx = car.x + sin * o, cz = car.z + cos * o;
    queryWorld(cx, cz, r + 4, _nearStatic);
    for (const c of _nearStatic) {
      if (c.hw !== undefined) {
        _cpush.x = 0; _cpush.z = 0;
        if (collideCircleOBB(cx, cz, r, c, _cpush)) { cx += _cpush.x; cz += _cpush.z; hit = true; }
      } else {
        const dx = cx - c.x, dz = cz - c.z;
        const d2 = dx * dx + dz * dz, min = r + c.r;
        if (d2 > 1e-6 && d2 < min * min) {
          const d = Math.sqrt(d2), push = (min - d) / d;
          cx += dx * push; cz += dz * push; hit = true;
        }
      }
    }
    for (const other of others) {
      if (other === car) continue;
      const dx = cx - other.x, dz = cz - other.z;
      const rr = r + other.spec.L / 2 + 1;
      if (dx * dx + dz * dz > rr * rr) continue;
      _cpush.x = 0; _cpush.z = 0;
      const obb = { x: other.x, z: other.z, hw: other.spec.W / 2, hd: other.spec.L / 2, rot: other.angle };
      if (collideCircleOBB(cx, cz, r, obb, _cpush)) { cx += _cpush.x; cz += _cpush.z; hit = true; }
    }
    car.x += cx - (car.x + sin * o);
    car.z += cz - (car.z + cos * o);
  }
  if (hit) {
    car.group.position.set(car.x, 0, car.z);
    car.speed *= damp;
  }
  return hit;
}

export function damageCar(car, dmg) {
  if (car.dead) return;
  car.health -= dmg;
  if (car.health <= 0) {
    car.dead = true;
    car.speed = 0;
  }
}
