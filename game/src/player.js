// player.js — Rocco "Rayo" Vidal: on-foot movement, driving, car entry,
// collisions (buildings + cars are solid), vitals.

const PLAYER_COLOR = 0x2ad4e8; // cyan jacket — reads instantly at night

function spawnPlayer(x, z, opts) {
  opts = opts || {};
  if (G.player) {
    G.scene.remove(G.player.fig);
    if (G.player.car) { /* car stays in the world */ }
  }
  const fig = buildFigure({ color: PLAYER_COLOR, pants: 0x1d2733, skin: 0xc98a5e, hair: 0x17130e });
  fig.position.set(x, 0, z);
  G.scene.add(fig);
  const player = {
    fig, heading: opts.heading || 0, car: null, speed: 0,
    pose: 'stand', fireTimer: 0, stepPhase: 0,
  };
  fig.rotation.y = player.heading;
  applyPose(fig, opts.pose || 'stand');
  if (opts.weapon) setFigureWeapon(fig, opts.weapon);
  G.player = player;
  return player;
}
function putPlayerInCar(type, x, z, heading, color) {
  const car = spawnCar(type, x, z, heading, color, { driver: 'player' });
  const player = G.player || spawnPlayer(x, z);
  player.car = car;
  player.heading = heading;
  player.fig.visible = false;
  car.speed = 0;
  return car;
}
function exitCar() {
  const player = G.player;
  if (!player || !player.car) return;
  const car = player.car;
  const cp = car.mesh.position;
  const side = car.heading + Math.PI / 2;
  player.fig.position.set(cp.x + Math.sin(side) * 1.6, 0, cp.z + Math.cos(side) * 1.6);
  player.fig.visible = true;
  player.heading = car.heading;
  car.driver = null;
  player.car = null;
  applyPose(player.fig, 'stand');
}
function tryEnterNearestCar() {
  const player = G.player;
  if (!player || player.car) return false;
  const pp = player.fig.position;
  let best = null, bd = 3.4;
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = dist2(pp.x, pp.z, car.mesh.position.x, car.mesh.position.z);
    if (d < bd) { bd = d; best = car; }
  }
  if (!best) return false;
  best.driver = 'player';
  player.car = best;
  player.heading = best.heading;
  player.fig.visible = false;
  if (best.type === 'cruiser') addWanted(1);
  return true;
}
function keepOutOfCars(player) {
  const pp = player.fig.position;
  for (const car of G.cars) {
    const t = CAR_TYPES[car.type];
    const hit = collideCircleOBB(pp.x, pp.z, 0.45, car.mesh.position.x, car.mesh.position.z,
      t.W / 2 + 0.1, t.L / 2 + 0.1, car.heading);
    if (hit) { pp.x = hit.x; pp.z = hit.z; }
  }
}
function damagePlayer(amount) {
  if (G.dead || G.shotMode) return;
  if (G.armor > 0) {
    const absorbed = Math.min(G.armor, amount * 0.7);
    G.armor -= absorbed;
    amount -= absorbed;
  }
  G.health -= amount;
  G.camShake = Math.min(0.35, G.camShake + 0.12);
  if (G.health <= 0) {
    G.health = 0;
    G.dead = true;
    if (G.player) applyPose(G.player.fig, 'down');
    setTimeout(() => respawnPlayer(), 2600);
  }
}
function respawnPlayer() {
  G.dead = false;
  G.health = 100; G.armor = 25;
  G.wanted = Math.max(0, G.wanted - 2);
  const h = PLACES.hospital;
  if (G.player && G.player.car) exitCar();
  spawnPlayer(h.x - 8, h.z + 10, { heading: Math.PI });
  G.cash = Math.max(0, G.cash - 150);
}
function updatePlayer(dt) {
  const player = G.player;
  if (!player || G.dead) return;
  const k = G.keys;
  if (player.car) {
    const car = player.car;
    const t = CAR_TYPES[car.type];
    const fwdIn = (k['KeyW'] ? 1 : 0) - (k['KeyS'] ? 1 : 0);
    const steer = (k['KeyA'] ? 1 : 0) - (k['KeyD'] ? 1 : 0);
    if (fwdIn > 0) car.speed = Math.min(t.top, car.speed + t.accel * dt);
    else if (fwdIn < 0) car.speed = Math.max(-t.top * 0.35, car.speed - t.accel * 0.9 * dt);
    else car.speed = lerp(car.speed, 0, dt * (car.speed > 0 ? 0.35 : 0.8));
    if (Math.abs(car.speed) > 0.4) {
      car.heading += steer * dt * t.grip * 0.42 * Math.sign(car.speed) * clamp(Math.abs(car.speed) / 12, 0.3, 1);
    }
    const cp = car.mesh.position;
    cp.x += fwdX(car.heading) * car.speed * dt;
    cp.z += fwdZ(car.heading) * car.speed * dt;
    cp.x = clamp(cp.x, LAND.minX + 2, LAND.maxX - 2);
    cp.z = clamp(cp.z, LAND.minZ + 2, LAND.maxZ - 2);
    car.mesh.rotation.y = car.heading;
    collideCarWithCars(car);
    player.heading = car.heading;
    player.fig.position.copy(cp);
    G.speedKmh = Math.round(Math.abs(car.speed) * 3.6);
    setEngineLevel(Math.abs(car.speed) / t.top);
    return;
  }
  // on foot
  let mx = 0, mz = 0;
  if (k['KeyW']) mz -= 1;
  if (k['KeyS']) mz += 1;
  if (k['KeyA']) mx -= 1;
  if (k['KeyD']) mx += 1;
  const moving = (mx !== 0 || mz !== 0);
  const run = k['ShiftLeft'] || k['ShiftRight'];
  const spd = run ? 7.2 : 4.4;
  const pp = player.fig.position;
  if (moving && !G.dialogue && !G.mapOpen) {
    // camera-relative movement
    const camH = G.camera ? Math.atan2(G.camera.position.x - pp.x, G.camera.position.z - pp.z) + Math.PI : 0;
    const moveH = Math.atan2(mx, mz) + camH + Math.PI;
    player.heading = angLerp(player.heading, moveH, dt * 12);
    pp.x += fwdX(player.heading) * spd * dt;
    pp.z += fwdZ(player.heading) * spd * dt;
    player.stepPhase += dt * (run ? 11 : 8.4);
    animateFigure(player.fig, dt, spd, player.stepPhase);
    if (player.pose !== 'walk') { applyPose(player.fig, 'walk'); player.pose = 'walk'; }
  } else if (player.pose === 'walk') {
    applyPose(player.fig, 'stand');
    player.pose = 'stand';
  } else if (player.pose === 'stand') {
    animateFigure(player.fig, dt, 0, G.elapsed);
  }
  pp.x = clamp(pp.x, LAND.minX - 6, LAND.maxX - 2);
  pp.z = clamp(pp.z, LAND.minZ + 2, LAND.maxZ - 2);
  const fixed = collideBuildings(pp.x, pp.z, 0.45);
  pp.x = fixed.x; pp.z = fixed.z;
  keepOutOfCars(player);
  player.fig.rotation.y = player.heading;
  G.speedKmh = 0;
  setEngineLevel(0);
}
