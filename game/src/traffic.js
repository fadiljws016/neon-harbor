// traffic.js — ambient night traffic: cars pick a road, drive its length,
// turn at intersections, brake for the car ahead, and recycle near the
// player so the streets around him are never empty.

const TRAFFIC_TYPES = ['sedan', 'sedan', 'sport', 'taxi', 'truck'];
function spawnTrafficCar(near) {
  const rp = randomRoadPoint();
  let x = rp.x, z = rp.z;
  if (near && G.player) {
    const pp = G.player.fig.position;
    x = clamp(pp.x + rand(-70, 70), LAND.minX + 8, LAND.maxX - 8);
    z = clamp(pp.z + rand(-70, 70), LAND.minZ + 8, LAND.maxZ - 8);
    const snap = nearestRoadSnap(x, z);
    x = snap.x; z = snap.z;
  }
  const lane = 3.5;
  let heading;
  if (rp.axis === 'z') { heading = rp.dir > 0 ? 0 : Math.PI; x += rp.dir > 0 ? lane : -lane; if (near) { /* snapped */ } }
  else { heading = rp.dir > 0 ? Math.PI / 2 : -Math.PI / 2; z += rp.dir > 0 ? -lane : lane; }
  if (near) heading = pick([0, Math.PI, Math.PI / 2, -Math.PI / 2]);
  const car = spawnCar(pick(TRAFFIC_TYPES), x, z, heading, undefined, { ai: 'traffic', speed: rand(8, 13) });
  car.cruise = rand(9, 15);
  return car;
}
function initTraffic(n) {
  for (let i = 0; i < (n || 14); i++) spawnTrafficCar(false);
}
function updateTraffic(dt) {
  const pp = G.player ? G.player.fig.position : { x: 0, z: 0 };
  let trafficCount = 0;
  for (const car of G.cars) {
    if (car.ai !== 'traffic' || car.dead) continue;
    trafficCount++;
    const cp = car.mesh.position;
    const d = dist2(cp.x, cp.z, pp.x, pp.z);
    if (d > 190) { // recycle far cars back near the action
      const snap = nearestRoadSnap(pp.x + rand(-80, 80), pp.z + rand(-80, 80));
      cp.x = snap.x; cp.z = snap.z;
      car.heading = pick([0, Math.PI, Math.PI / 2, -Math.PI / 2]);
    }
    // brake for the car ahead
    let target = car.cruise || 11;
    for (const other of G.cars) {
      if (other === car) continue;
      const op = other.mesh.position;
      const aheadX = cp.x + fwdX(car.heading) * 6, aheadZ = cp.z + fwdZ(car.heading) * 6;
      if (dist2(op.x, op.z, aheadX, aheadZ) < 4.2) { target = Math.min(target, other.speed * 0.8); break; }
    }
    car.speed = lerp(car.speed, target, dt * 1.6);
    cp.x += fwdX(car.heading) * car.speed * dt;
    cp.z += fwdZ(car.heading) * car.speed * dt;
    // at an intersection, sometimes turn onto the crossing road
    const nearX = ROADS_X.some(rx => Math.abs(rx - cp.x) < 1.4);
    const nearZ = ROADS_Z.some(rz => Math.abs(rz - cp.z) < 1.4);
    if (nearX && nearZ && chance(dt * 0.5)) {
      car.heading += pick([Math.PI / 2, -Math.PI / 2]);
    }
    cp.x = clamp(cp.x, LAND.minX + 3, LAND.maxX - 3);
    cp.z = clamp(cp.z, LAND.minZ + 3, LAND.maxZ - 3);
    if (cp.x <= LAND.minX + 3.2 || cp.x >= LAND.maxX - 3.2) car.heading += Math.PI;
    if (cp.z <= LAND.minZ + 3.2 || cp.z >= LAND.maxZ - 3.2) car.heading += Math.PI;
    car.mesh.rotation.y = car.heading;
    collideCarWithCars(car);
  }
  if (G.started && !G.shotMode && trafficCount < 12 && chance(dt * 0.4)) spawnTrafficCar(true);
}
