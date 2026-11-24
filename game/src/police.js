// police.js — the PDP response: wanted level, pursuit cruisers, foot
// backup, the dispatch feed the HUD shows, and roadblock construction for
// the chase staging.

let policeTimer = 0;
function addWanted(v) {
  G.wanted = clamp(G.wanted + v, 0, 5);
}
function wantedStars() {
  return Math.floor(G.wanted + 0.001);
}
function spawnPursuitCruiser() {
  const p = G.player.fig.position;
  const a = rng() * Math.PI * 2;
  const x = clamp(p.x + Math.sin(a) * rand(46, 60), LAND.minX + 8, LAND.maxX - 8);
  const z = clamp(p.z + Math.cos(a) * rand(46, 60), LAND.minZ + 8, LAND.maxZ - 8);
  const snap = nearestRoadSnap(x, z);
  const car = spawnCar('cruiser', snap.x, snap.z, Math.atan2(p.x - snap.x, p.z - snap.z), 0xf2f2f2,
    { ai: 'pursue' });
  car.unit = 'UNIT-' + randi(100, 199);
  return car;
}
function nearestRoadSnap(x, z) {
  let bx = x, bz = z, bd = Infinity;
  for (const rx of ROADS_X) { const d = Math.abs(rx - x); if (d < bd) { bd = d; bx = rx; bz = z; } }
  for (const rz of ROADS_Z) { const d = Math.abs(rz - z); if (d < bd) { bd = d; bx = x; bz = rz; } }
  return { x: bx, z: bz };
}
function updatePolice(dt) {
  if (!G.started || G.shotMode || G.dead) { refreshDispatch(); return; }
  policeTimer -= dt;
  // heat cools slowly when the heli has lost you
  if (!G.heliSeesPlayer && G.wanted > 0) G.wanted = Math.max(0, G.wanted - dt * 0.02);
  const cruisers = G.cars.filter(c => c.type === 'cruiser' && !c.dead && c.ai === 'pursue');
  const wantCruisers = G.wanted >= 1 ? Math.min(1 + Math.floor(G.wanted), 5) : 0;
  if (policeTimer <= 0) {
    policeTimer = 1.2;
    if (cruisers.length < wantCruisers) spawnPursuitCruiser();
    if (G.wanted >= 2 && G.officers.filter(o => !o.dead).length < Math.floor(G.wanted) && chance(0.6)) {
      const p = G.player.fig.position;
      const a = rng() * Math.PI * 2;
      spawnOfficerAt(clamp(p.x + Math.sin(a) * 24, LAND.minX, LAND.maxX),
        clamp(p.z + Math.cos(a) * 24, LAND.minZ, LAND.maxZ), { phase: 'advance' });
    }
  }
  // pursuit driving: chase the player, ram when close
  const pp = G.player.fig.position;
  for (const car of cruisers) {
    const cp = car.mesh.position;
    const d = dist2(cp.x, cp.z, pp.x, pp.z);
    const targetH = Math.atan2(pp.x - cp.x, pp.z - cp.z);
    car.heading = angLerp(car.heading, targetH, dt * 1.6);
    const top = CAR_TYPES.cruiser.top * (d > 30 ? 1 : 0.72);
    car.speed = lerp(car.speed, top, dt * 0.8);
    cp.x += fwdX(car.heading) * car.speed * dt;
    cp.z += fwdZ(car.heading) * car.speed * dt;
    car.mesh.rotation.y = car.heading;
    collideCarWithCars(car);
  }
  refreshDispatch();
}
function refreshDispatch() {
  const rows = [];
  if (!G.player) { G.dispatch = rows; return; }
  const pp = G.player.fig.position;
  for (const car of G.cars) {
    if (car.type !== 'cruiser' || car.dead) continue;
    const cp = car.mesh.position;
    const d = Math.round(dist2(cp.x, cp.z, pp.x, pp.z));
    const unitNum = parseInt((car.unit || 'UNIT-100').replace(/\D/g, ''), 10) || 100;
    const role = d < 14 ? 'RAM' : (car.ai === 'block' ? 'BLOCK' : (unitNum % 2 ? 'FLANK' : 'PURSUIT'));
    rows.push({ unit: car.unit || 'UNIT-100', dist: d, role });
  }
  for (const o of G.officers) {
    if (o.dead) continue;
    const op = o.fig.position;
    rows.push({
      unit: o.id, dist: Math.round(dist2(op.x, op.z, pp.x, pp.z)),
      role: o.phase === 'crouch' ? 'COVER' : 'ENGAGING',
    });
  }
  if (G.heliState.active) rows.push({ unit: 'LUCERO-1', dist: null, role: 'ACTIVE' });
  rows.sort((a, b) => (a.dist === null ? 9999 : a.dist) - (b.dist === null ? 9999 : b.dist));
  G.dispatch = rows.slice(0, 6);
}
// Roadblock: two cruisers angled across the boulevard + a spike strip line.
function buildRoadblockMeshes(x, z) {
  clearRoadblock();
  const grp = new THREE.Group();
  const c1 = spawnCar('cruiser', x - 3.4, z, Math.PI / 2 + 0.35, 0xf2f2f2, { parked: true, ai: 'block' });
  const c2 = spawnCar('cruiser', x + 3.6, z - 1.5, Math.PI / 2 - 0.3, 0xf2f2f2, { parked: true, ai: 'block' });
  c1.unit = 'UNIT-167'; c2.unit = 'UNIT-168';
  const barrierMat = new THREE.MeshLambertMaterial({ color: 0xd8dde6 });
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xff7847 });
  for (let i = -1; i <= 1; i++) {
    const b = box(2.2, 0.85, 0.5, 0, x + i * 3.4, 0.43, z + 2.6, { mat: barrierMat });
    grp.add(b);
    const s = box(2.2, 0.2, 0.52, 0, x + i * 3.4, 0.62, z + 2.6, { mat: stripeMat });
    grp.add(s);
  }
  G.scene.add(grp);
  G.roadblock = { x, z, group: grp, cars: [c1, c2] };
  return G.roadblock;
}
function clearRoadblock() {
  if (!G.roadblock) return;
  G.scene.remove(G.roadblock.group);
  for (const c of G.roadblock.cars) removeCar(c);
  G.roadblock = null;
}
