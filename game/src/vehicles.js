// vehicles.js — the car table (proven geometry, night colours), mesh
// builder with headlight glow, spawning, damage ladder, car-vs-car physics.

const CAR_TYPES = {
  sedan: { name: 'Noche Sedan', L: 4.4, W: 1.9, H: 0.62, cabinH: 0.55, top: 38, accel: 15, grip: 3.4, price: 100,
    colors: [0x3ecfe8, 0xff4fa3, 0xe8e3d5, 0x2aa864, 0xf5a623, 0x30363e] },
  sport: { name: 'Volt GT', L: 4.2, W: 1.95, H: 0.5, cabinH: 0.42, top: 54, accel: 22, grip: 4.2, price: 90,
    colors: [0xffcf3f, 0xff4438, 0x3ecfe8, 0xf2f2f2] },
  taxi: { name: 'Taxi Noche', L: 4.4, W: 1.9, H: 0.62, cabinH: 0.58, top: 36, accel: 14, grip: 3.4, price: 110,
    colors: [0xffb340] },
  truck: { name: 'Mulo Truck', L: 5.8, W: 2.2, H: 0.9, cabinH: 0.8, top: 30, accel: 10, grip: 2.8, price: 170,
    colors: [0xb08954, 0x7a8a99, 0x54804e, 0xd84a30] },
  cruiser: { name: 'PDP Interceptor', L: 4.6, W: 1.95, H: 0.6, cabinH: 0.55, top: 48, accel: 19, grip: 4.0, price: 150,
    colors: [0xf2f2f2] },
};
let _carSeq = 1;
function shortCarId(type) { return type.slice(0, 2).toUpperCase() + '-' + (_carSeq++); }

const _glowTex = () => softDotTexture(64, 'rgba(255,240,200,0.9)', 'rgba(255,240,200,0)');
let glowTexCache = null;

function buildCarMesh(type, color) {
  const t = CAR_TYPES[type];
  const grp = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(t.W, t.H, t.L), bodyMat);
  body.position.y = 0.36 + t.H / 2;
  body.castShadow = true;
  grp.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(t.W * 0.82, t.cabinH, t.L * 0.46),
    new THREE.MeshLambertMaterial({ color: 0x1a2c3e, emissive: 0x0d2436 }));
  glass.position.set(0, 0.36 + t.H + t.cabinH / 2 - 0.04, -t.L * 0.04);
  grp.add(glass);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(t.W * 0.8, 0.07, t.L * 0.4), bodyMat);
  roof.position.set(0, 0.36 + t.H + t.cabinH + 0.0, -t.L * 0.04);
  grp.add(roof);
  // bumpers + grille
  const trim = new THREE.MeshLambertMaterial({ color: 0x14161c });
  const bf = new THREE.Mesh(new THREE.BoxGeometry(t.W * 0.98, 0.18, 0.22), trim);
  bf.position.set(0, 0.42, t.L / 2 + 0.05); grp.add(bf);
  const bb = bf.clone(); bb.position.z = -t.L / 2 - 0.05; grp.add(bb);
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x17191d });
  const wheels = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(sx * (t.W / 2 - 0.05), 0.36, sz * (t.L / 2 - 0.95));
    grp.add(w); wheels.push(w);
  }
  grp.userData.wheels = wheels;
  // headlights: glow sprites + a light pool decal under the front
  if (!glowTexCache) glowTexCache = _glowTex();
  const glowMat = new THREE.SpriteMaterial({ map: glowTexCache, color: 0xfff2c0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const sx of [-1, 1]) {
    const s = new THREE.Sprite(glowMat);
    s.scale.set(0.85, 0.85, 1);
    s.position.set(sx * t.W * 0.32, 0.62, t.L / 2 + 0.18);
    grp.add(s);
    const lampDot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xfff6d8 }));
    lampDot.position.set(sx * t.W * 0.32, 0.62, t.L / 2 + 0.02);
    grp.add(lampDot);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    tail.position.set(sx * t.W * 0.32, 0.66, -t.L / 2 - 0.02);
    grp.add(tail);
  }
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(t.W * 2.4, t.L * 0.9),
    new THREE.MeshBasicMaterial({ map: glowTexCache, color: 0xffedb8, transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.07, t.L * 0.72);
  grp.add(pool);
  if (type === 'taxi') {
    const signB = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.34),
      new THREE.MeshBasicMaterial({ color: 0xffd76e }));
    signB.position.set(0, 0.36 + t.H + t.cabinH + 0.14, -t.L * 0.04);
    grp.add(signB);
  }
  if (type === 'cruiser') {
    const bar = new THREE.Group();
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0x2a6cff }));
    bl.position.x = -0.3;
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2a3c }));
    br.position.x = 0.3;
    bar.add(bl); bar.add(br);
    bar.position.set(0, 0.36 + t.H + t.cabinH + 0.12, -t.L * 0.04);
    grp.add(bar);
    grp.userData.lightbar = bar;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(t.W + 0.02, 0.2, t.L * 0.7),
      new THREE.MeshLambertMaterial({ color: 0x1d3a5f }));
    stripe.position.y = 0.62;
    grp.add(stripe);
  }
  if (type === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(t.W * 0.96, 0.7, t.L * 0.45),
      new THREE.MeshLambertMaterial({ color: 0x4a4238 }));
    bed.position.set(0, 0.36 + t.H + 0.3, -t.L * 0.26);
    grp.add(bed);
  }
  return grp;
}

function spawnCar(type, x, z, heading, color, opts) {
  opts = opts || {};
  const t = CAR_TYPES[type];
  const mesh = buildCarMesh(type, color !== undefined ? color : pick(t.colors));
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  G.scene.add(mesh);
  const car = {
    id: shortCarId(type), type, mesh, heading, speed: opts.speed || 0,
    health: 100, driver: opts.driver || null, parked: !!opts.parked,
    ai: opts.ai || null, dead: false, smokeT: 0, color: mesh.children[0].material.color.getHex(),
  };
  mesh.userData.car = car;
  G.cars.push(car);
  return car;
}
function removeCar(car) {
  const i = G.cars.indexOf(car);
  if (i >= 0) G.cars.splice(i, 1);
  G.scene.remove(car.mesh);
}
function damageCar(car, amount) {
  if (car.dead) return;
  car.health -= amount;
  if (car.health <= 55 && car.health > 25) {
    // smoking stage handled in updateCarsFx
  }
  if (car.health <= 0) {
    car.health = 0; car.dead = true; car.speed = 0;
    explosionAt(car.mesh.position.x, 0.8, car.mesh.position.z);
    car.mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0x17181c });
  }
}
function updateCarsFx(dt) {
  for (const car of G.cars) {
    const p = car.mesh.position;
    // spin wheels by speed
    const w = car.mesh.userData.wheels;
    if (w) for (const wh of w) wh.rotation.x += car.speed * dt * 2.6;
    if (car.type === 'cruiser' && car.mesh.userData.lightbar) {
      const ph = Math.floor(G.elapsed * 6) % 2;
      car.mesh.userData.lightbar.children[0].visible = ph === 0;
      car.mesh.userData.lightbar.children[1].visible = ph === 1;
    }
    if (!car.dead && car.health <= 55) {
      car.smokeT -= dt;
      if (car.smokeT <= 0) {
        car.smokeT = 0.16;
        burstSmoke(p.x, 1.1, p.z, car.health <= 25 ? 0x2a2a2a : 0x6e6e6e, 1, { life: 1.4, rise: 1.2, power: 0.4 });
      }
    }
  }
}
// car vs car: circle vs OBB push-out for every pair in range
function collideCarWithCars(car) {
  const t = CAR_TYPES[car.type];
  const p = car.mesh.position;
  for (const other of G.cars) {
    if (other === car) continue;
    const op = other.mesh.position;
    if (Math.abs(op.x - p.x) > 9 || Math.abs(op.z - p.z) > 9) continue;
    const ot = CAR_TYPES[other.type];
    const hit = collideCircleOBB(p.x, p.z, Math.max(t.W, t.L) * 0.32, op.x, op.z, ot.W / 2 + 0.15, ot.L / 2 + 0.15, other.heading);
    if (hit) {
      const impact = Math.abs(car.speed - other.speed);
      p.x = hit.x; p.z = hit.z;
      if (impact > 6) {
        damageCar(car, impact * 0.7); damageCar(other, impact * 0.5);
        burst(p.x, 0.7, p.z, 0xffc46e, 8, 2.4, {});
        car.speed *= 0.4;
      } else car.speed *= 0.75;
    }
  }
  const fixed = collideBuildings(p.x, p.z, Math.max(t.W, t.L) * 0.3);
  if (fixed.x !== p.x || fixed.z !== p.z) {
    if (Math.abs(car.speed) > 8) { damageCar(car, Math.abs(car.speed) * 0.5); burst(p.x, 0.8, p.z, 0xffc46e, 6, 2, {}); }
    car.speed *= 0.5;
    p.x = fixed.x; p.z = fixed.z;
  }
}
