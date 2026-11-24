// combat.js — hitscan gunplay on the proven effects recipe. Every shot:
// muzzle smoke x1, impact dust x2, one short tracer dash, one star flash,
// brass over the shoulder. Damage falls on officers, cars, the player.

const WEAPON_DEFS = {
  fists: { name: 'Fists', interval: 0.42, damage: 9, range: 2.1, spread: 0, auto: false },
  pistol: { name: 'P-9 Pistol', interval: 0.34, damage: 22, range: 70, spread: 0.02, auto: false },
  smg: { name: 'Kobra SMG', interval: 0.095, damage: 13, range: 60, spread: 0.05, auto: true },
  shotgun: { name: 'Muelle 12ga', interval: 0.85, damage: 11, range: 34, spread: 0.11, auto: false, pellets: 6 },
};
const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun'];

function muzzlePos(x, y, z, heading) {
  return { x: x + fwdX(heading) * 0.55, y, z: z + fwdZ(heading) * 0.55 };
}
// Generic shot: from a point toward a target point, with spread + damage
// applied to whatever the ray meets (officers / player / cars).
function fireShotAt(kind, fx, fy, fz, tx, ty, tz, opts) {
  opts = opts || {};
  const spread = opts.spread || 0;
  const dx = tx - fx + rand(-spread, spread) * 10;
  const dy = ty - fy + rand(-spread, spread) * 4;
  const dz = tz - fz + rand(-spread, spread) * 10;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const ux = dx / len, uy = dy / len, uz = dz / len;
  // find the nearest victim along the ray
  let bestT = len, victim = null;
  function testPoint(px, py, pz, r, ref) {
    const ox = px - fx, oy = py - fy, oz = pz - fz;
    const t = ox * ux + oy * uy + oz * uz;
    if (t < 0.5 || t > bestT) return;
    const cx = fx + ux * t, cy = fy + uy * t, cz = fz + uz * t;
    const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2 + (pz - cz) ** 2);
    if (d < r) { bestT = t; victim = ref; }
  }
  if (kind !== 'officer') {
    for (const o of G.officers) {
      if (o.dead) continue;
      const p = o.fig.position;
      testPoint(p.x, 1.1, p.z, 0.62, { type: 'officer', ref: o });
    }
  }
  if (kind !== 'player' && G.player && !G.player.car) {
    const p = G.player.fig.position;
    testPoint(p.x, 1.1, p.z, 0.58, { type: 'player' });
  }
  for (const car of G.cars) {
    if (car.dead) continue;
    const p = car.mesh.position;
    testPoint(p.x, 0.8, p.z, Math.max(CAR_TYPES[car.type].W, CAR_TYPES[car.type].L) * 0.42, { type: 'car', ref: car });
  }
  const hx = fx + ux * bestT, hy = Math.max(0.15, fy + uy * bestT), hz = fz + uz * bestT;
  // the recipe, exactly: smoke at the muzzle, dash mid-flight, dust at hit
  burstSmoke(fx, fy, fz, 0x8a7f70, 1, { life: 1.1, rise: 0.55, power: 0.3 });
  spawnTracer(fx, fy, fz, hx, hy, hz);
  muzzleFlash(fx, fy, fz);
  impactDust(hx, hy, hz);
  const dmg = opts.damage || 10;
  if (victim) {
    if (victim.type === 'officer') { damageOfficer(victim.ref, dmg); burst(hx, hy, hz, 0xff5a4e, 4, 1.6, {}); }
    else if (victim.type === 'player') damagePlayer(dmg * 0.6);
    else if (victim.type === 'car') damageCar(victim.ref, dmg * 0.8);
  }
  if (typeof audioShot === 'function') audioShot(kind);
  return victim;
}
let playerFireTimer = 0;
function playerShoot(dt, mouseDown) {
  playerFireTimer -= dt;
  const player = G.player;
  if (!player || G.dead || G.dialogue || G.mapOpen) return;
  const w = G.weapon;
  const def = WEAPON_DEFS[w];
  if (!def || w === 'fists') return;
  if (!mouseDown || playerFireTimer > 0) return;
  const slot = G.weapons[w];
  if (!slot.unlocked) return;
  if (slot.ammo !== Infinity && slot.ammo <= 0) return;
  playerFireTimer = def.interval;
  if (slot.ammo !== Infinity) slot.ammo -= 1;
  const pp = player.fig.position;
  let heading = player.heading;
  let baseY = 1.32;
  let ox = pp.x, oz = pp.z;
  if (player.car) {
    heading = player.car.heading;
    ox = player.car.mesh.position.x; oz = player.car.mesh.position.z;
    baseY = 1.1;
  }
  const mp = muzzlePos(ox, baseY, oz, heading);
  const pellets = def.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    fireShotAt('player', mp.x, mp.y, mp.z,
      mp.x + fwdX(heading) * def.range, baseY + rand(-0.1, 0.35), mp.z + fwdZ(heading) * def.range,
      { spread: def.spread, damage: def.damage });
  }
  ejectCasing(mp.x, mp.y, mp.z, heading);
  applyPose(player.fig, 'fire');
  player.pose = 'fire';
  setTimeout(() => { if (G.player && G.player.pose === 'fire' && !G.player.car) { applyPose(G.player.fig, 'stand'); G.player.pose = 'stand'; } }, 240);
  if (!G.shotMode) addWanted(0.25);
}
function explodeCar(car) { damageCar(car, 200); }
function updateCombat(dt) {
  // handled through playerShoot (input) + officer timers; kept as a hook
  // for staged volleys so the shutter always catches an exchange.
  if (G.volley && G.player) {
    // the red-shirt ally + staged officers trade fire continuously;
    // officers shoot via updateOfficers, the ally via his ped record.
    for (const ped of G.peds) {
      if (ped.mode !== 'ally') continue;
      ped.fireTimer = (ped.fireTimer || rand(0.2, 0.5)) - dt;
      if (ped.fireTimer <= 0) {
        ped.fireTimer = WEAPON_DEFS.smg.interval * rand(2.4, 4.2);
        const p = ped.fig.position;
        // aim at the nearest living officer
        let tgt = null, bd = Infinity;
        for (const o of G.officers) {
          if (o.dead) continue;
          const d = dist2(p.x, p.z, o.fig.position.x, o.fig.position.z);
          if (d < bd) { bd = d; tgt = o; }
        }
        if (tgt) {
          ped.fig.rotation.y = Math.atan2(tgt.fig.position.x - p.x, tgt.fig.position.z - p.z);
          const mp = muzzlePos(p.x, 1.32, p.z, ped.fig.rotation.y);
          fireShotAt('ally', mp.x, mp.y, mp.z, tgt.fig.position.x, 1.15, tgt.fig.position.z, { spread: 0.08, damage: 5 });
          ejectCasing(mp.x, mp.y, mp.z, ped.fig.rotation.y);
        }
      }
    }
  }
}
