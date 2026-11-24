// pedestrians.js — ambient night crowd: walkers on the sidewalks, chat
// pairs under the signs, browsers at the stalls, sitters on the quay.
// spawnPedAt/crowd are also the staging API the shots use.

function spawnPedAt(x, z, mode, opts) {
  opts = opts || {};
  const fig = buildFigure(opts);
  fig.position.set(x, 0, z);
  const heading = opts.heading !== undefined ? opts.heading : rng() * Math.PI * 2;
  fig.rotation.y = heading;
  G.scene.add(fig);
  const ped = {
    fig, mode: mode || 'idle', heading, speed: 0, name: opts.name || null,
    phase: rng() * 10, homeX: x, homeZ: z, poseT: 0, chatPartner: null,
  };
  if (opts.pose) applyPose(fig, opts.pose);
  else if (mode === 'walk') applyPose(fig, 'walk');
  else if (mode === 'chat') applyPose(fig, 'chat');
  else if (mode === 'sit') applyPose(fig, 'sit');
  else applyPose(fig, 'stand');
  if (opts.weapon) setFigureWeapon(fig, opts.weapon);
  G.peds.push(ped);
  return ped;
}
function crowd(x, z, n, seed, modes) {
  const keep = _seed;
  if (seed !== undefined) srand(seed * 7919 + 17);
  const out = [];
  modes = modes || ['walk', 'idle', 'chat'];
  for (let i = 0; i < n; i++) {
    const px = x + rand(-7, 7), pz = z + rand(-7, 7);
    const mode = pick(modes);
    out.push(spawnPedAt(px, pz, mode, { heading: rng() * Math.PI * 2 }));
  }
  srand(keep + n);
  return out;
}
function removePed(ped) {
  const i = G.peds.indexOf(ped);
  if (i >= 0) G.peds.splice(i, 1);
  G.scene.remove(ped.fig);
}
function clearPedsNear(x, z, r) {
  for (let i = G.peds.length - 1; i >= 0; i--) {
    const p = G.peds[i].fig.position;
    if (dist2(p.x, p.z, x, z) < r) removePed(G.peds[i]);
  }
}
function clearAllPeds() {
  for (let i = G.peds.length - 1; i >= 0; i--) removePed(G.peds[i]);
}
// ambient population for the live game (kept light; staged shots clear it)
function populateAmbient() {
  for (const rz of ROADS_Z) {
    for (let i = 0; i < 3; i++) {
      const x = rand(LAND.minX + 16, LAND.maxX - 16);
      spawnPedAt(x, rz + (chance(0.5) ? 9.6 : -9.6), 'walk', {});
    }
  }
  for (const x of ROADS_X) {
    for (let i = 0; i < 2; i++) {
      const z = rand(LAND.minZ + 16, LAND.maxZ - 16);
      spawnPedAt(x + (chance(0.5) ? 9.6 : -9.6), z, 'walk', {});
    }
  }
  crowd(-196, 10, 6, 11);
  crowd(-120, -30, 5, 23, ['chat', 'idle']);
  crowd(232, -220, 5, 31, ['walk', 'idle', 'chat']);
}
function updatePeds(dt) {
  const t = G.elapsed;
  for (const ped of G.peds) {
    const p = ped.fig.position;
    if (ped.mode === 'walk') {
      ped.speed = 1.5;
      // stroll, gently steering back toward home turf
      ped.phase += dt * 0.14;
      const targetH = Math.atan2(ped.homeX - p.x, ped.homeZ - p.z) + Math.sin(ped.phase) * 1.2;
      ped.heading = angLerp(ped.heading, targetH, dt * 1.4);
      p.x += fwdX(ped.heading) * ped.speed * dt;
      p.z += fwdZ(ped.heading) * ped.speed * dt;
      const fixed = collideBuildings(p.x, p.z, 0.45);
      p.x = fixed.x; p.z = fixed.z;
      ped.fig.rotation.y = ped.heading;
      animateFigure(ped.fig, dt, ped.speed, t + ped.phase * 7);
    } else if (ped.mode === 'chat') {
      animateFigure(ped.fig, dt, 0, t + ped.phase * 7);
    } else if (ped.mode === 'flee') {
      ped.speed = 4.4;
      const away = Math.atan2(p.x - (G.player ? G.player.fig.position.x : p.x), p.z - (G.player ? G.player.fig.position.z : p.z));
      ped.heading = angLerp(ped.heading, away, dt * 3);
      p.x += fwdX(ped.heading) * ped.speed * dt;
      p.z += fwdZ(ped.heading) * ped.speed * dt;
      ped.fig.rotation.y = ped.heading;
      animateFigure(ped.fig, dt, ped.speed, t + ped.phase * 7);
      ped.poseT -= dt;
      if (ped.poseT <= 0) ped.mode = 'idle';
    } else {
      animateFigure(ped.fig, dt, 0, t + ped.phase * 7);
    }
  }
}
