// officers.js — PDP foot officers: staged phases (fire / crouch / advance /
// down) for the shots, and pursuit behaviour for the live game. Officers
// fire through combat.fireShotAt so every bullet uses the proven recipe.

function spawnOfficerAt(x, z, opts) {
  opts = opts || {};
  const fig = buildFigure({
    color: 0x1d2c44, pants: 0x141c2c, skin: opts.skin, cap: 0x16233a, stripe: true, vest: true,
  });
  fig.position.set(x, 0, z);
  const heading = opts.heading !== undefined ? opts.heading : rng() * Math.PI * 2;
  fig.rotation.y = heading;
  G.scene.add(fig);
  const off = {
    fig, heading, phase: opts.phase || 'advance', homeCar: opts.homeCar || null,
    fireTimer: rand(0.1, 0.7), health: 100, dead: false, target: opts.target || null,
    speed: 0, id: 'FOOT-' + randi(10, 99),
  };
  setFigureWeapon(fig, opts.weapon || 'pistol');
  if (off.phase === 'fire') applyPose(fig, 'fire');
  else if (off.phase === 'crouch') applyPose(fig, 'crouch');
  else if (off.phase === 'down') { applyPose(fig, 'down'); off.dead = true; }
  else applyPose(fig, 'stand');
  G.officers.push(off);
  return off;
}
function clearOfficers() {
  for (const o of G.officers) G.scene.remove(o.fig);
  G.officers.length = 0;
}
function officerShoot(off, tx, ty, tz, dt) {
  off.fireTimer -= dt;
  if (off.fireTimer > 0) return;
  const def = WEAPON_DEFS.pistol;
  off.fireTimer = def.interval * rand(0.8, 1.5);
  const p = off.fig.position;
  fireShotAt('officer', p.x, 1.32, p.z, tx, ty, tz, { spread: 0.09, damage: 6 });
}
function updateOfficers(dt) {
  const player = G.player;
  if (!player) return;
  const pp = player.fig.position;
  for (const off of G.officers) {
    if (off.dead) continue;
    const p = off.fig.position;
    const d = dist2(p.x, p.z, pp.x, pp.z);
    if (off.phase === 'fire') {
      // hold position, face the target, loose off rounds
      const tgt = off.target && off.target.fig ? off.target.fig.position : pp;
      off.heading = Math.atan2(tgt.x - p.x, tgt.z - p.z);
      off.fig.rotation.y = off.heading;
      if (G.started || G.volley) officerShoot(off, tgt.x, 1.1, tgt.z, dt);
    } else if (off.phase === 'crouch') {
      off.heading = Math.atan2(pp.x - p.x, pp.z - p.z);
      off.fig.rotation.y = off.heading;
      if ((G.started || G.volley) && d < 26 && chance(0.4)) officerShoot(off, pp.x, 1.1, pp.z, dt);
    } else if (off.phase === 'advance') {
      if (d > 13) {
        off.heading = angLerp(off.heading, Math.atan2(pp.x - p.x, pp.z - p.z), dt * 3);
        p.x += fwdX(off.heading) * 3.1 * dt;
        p.z += fwdZ(off.heading) * 3.1 * dt;
        const fixed = collideBuildings(p.x, p.z, 0.45);
        p.x = fixed.x; p.z = fixed.z;
        off.fig.rotation.y = off.heading;
        applyPose(off.fig, 'walk');
        animateFigure(off.fig, dt, 3.1, G.elapsed + p.x);
      } else {
        off.phase = 'fire';
        applyPose(off.fig, 'fire');
      }
    }
  }
}
function damageOfficer(off, amount) {
  if (off.dead) return;
  off.health -= amount;
  if (off.health <= 0) {
    off.dead = true;
    off.phase = 'down';
    applyPose(off.fig, 'down');
    addWanted(0.4);
  }
}
