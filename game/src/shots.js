// shots.js — screenshot staging for the four judged frames. Each scene is
// dressed to be read in a single glance: cover, map drive, chase, combat.
// Round 3 exists because round 2's cover lost its subjects in the crowd:
// now Volt and Rayo ARE the cover, close and lit, with the market row
// receding behind them and no empty asphalt anywhere.

import { G } from './state.js';
import { stageCamera, setDialoguePair } from './camera.js';
import { createPlayer } from './player.js';
import { spawnPedestrian, chatPair } from './pedestrians.js';
import { makePerson, poseChat, poseAim, poseCrouch, poseSurrender, poseDown } from './people.js';
import { makeCar, placeCar } from './vehicles.js';
import { spawnPoliceCar, dispatch } from './police.js';
import { dist2d } from './util.js';
import { spawnOfficer, hurtOfficer } from './officers.js';
import { spawnHostile, fireAt, gunPosOf } from './combat.js';
import { setHeliOrbit, setHeliAltitude } from './helicopter.js';
import { addContainer, addCrates, addBarrels, addLightPool, addGlowSprite } from './city.js';
import { fakeMission } from './missions.js';
import { parkedCars } from './traffic.js';
import { DIALOGUES } from './story.js';
import { sfxShot } from './audio.js';

export const SHOT_LIST = ['cover', 'drive', 'chase', 'combat'];

function baseState(hour) {
  G.hour = hour;
  G.wanted = 0;
  G.health = 100;
  G.armor = 0;
  G.mapOpen = false;
  G.dialogue = null;
  G.playerCar = null;
}

function addCar(type, x, z, angle, color) {
  const car = makeCar(type, color, { detail: true });
  placeCar(car, x, z, angle);
  G.scene.add(car.group);
  // Registered with the parked rows so the (now live) shot-mode traffic
  // brakes for and collides with the staged cars instead of driving
  // through them — the staged GT and roadblock cruisers included.
  car.parked = true;
  parkedCars.push(car);
  return car;
}

function personAt(x, z, heading, opts) {
  const p = makePerson(opts);
  p.group.position.set(x, 0, z);
  p.group.rotation.y = heading;
  G.scene.add(p.group);
  return p;
}

// ---------- COVER ----------
export function stageCover() {
  baseState(21.6);
  G.cash = 250; G.respect = 40; G.rankIndex = 0;
  fakeMission(0, 0);
  G.dialogue = DIALOGUES.intro;
  G.dialogueIndex = 1;
  G.dialogueDone = false;

  // THE SUBJECTS: Volt + Rayo, centre-frame, ~6.5 m out, facing each
  // other across the club's spill of light. Volt south (club side),
  // Rayo north; the pair sits slightly right of centre so SIRENA keeps
  // the upper right of the frame.
  const volt = personAt(-62.9, -24.4, 0, {
    shirt: 0xff4fa3, pants: 0x1c1420, skin: 0xe8b98d, hair: 0x2e1c10, pattern: 'plain',
  });
  const rocco = createPlayer(G.scene, -64.6, -23.6);
  // Face each other across 1.5 m of wet asphalt.
  volt.group.rotation.y = Math.atan2(rocco.group.position.x - volt.group.position.x,
    rocco.group.position.z - volt.group.position.z);
  rocco.heading = Math.atan2(volt.group.position.x - rocco.group.position.x,
    volt.group.position.z - rocco.group.position.z);
  rocco.group.rotation.y = rocco.heading;
  poseChat(volt, 0.55);
  poseChat(rocco.person, 0.3);
  setDialoguePair(rocco.group.position, volt.group.position);
  // A warm pool + a GENTLE point of light so the pair pops off the night
  // (physical falloff: anything over ~6 candela bleaches them at 2 m).
  addLightPool(G.scene, -63.9, -23.5, 4.6, 'rgba(255,150,90,0.6)');
  const warm = new THREE.PointLight(0xff9a5e, 5, 11, 1.6);
  warm.position.set(-63.9, 2.6, -23.5);
  G.scene.add(warm);

  // Foreground right: parked taxi at the kerb + browsers + scooter-side
  // crates, so the near-right asphalt is GONE.
  addCar('taxi', -57.9, -21.5, Math.PI);
  spawnPedestrian(-58.6, -25.8, { mode: 'browse', heading: -Math.PI / 2 });
  spawnPedestrian(-57.6, -18.6, { mode: 'browse', heading: Math.PI / 3 });
  addCrates(G.scene, -57.3, -27.5, 3, 91);

  // The lit sedan centre-left, headlights on the wet street.
  const sedan = addCar('sedan', -66.8, -37, Math.PI, 0x3ecfe8);
  sedan.group.rotation.y = Math.PI + 0.12;

  // Stall browsers down the west row (the row itself is initCity's).
  for (const z of [-20.5, -28.5, -36.5, -44.5]) {
    spawnPedestrian(-69.9, z, { mode: 'browse', heading: Math.PI / 2 });
  }
  spawnPedestrian(-57.9, -34.5, { mode: 'browse', heading: -Math.PI / 2 });
  // Two chat pairs mid-frame + walkers kept to the middle distance.
  chatPair(-66.5, -40, 0.7);
  chatPair(-61.5, -49, -0.5);
  spawnPedestrian(-64.8, -32, { mode: 'wander', heading: Math.PI });
  spawnPedestrian(-62.8, -56, { mode: 'wander', heading: 0.3 });
  spawnPedestrian(-67.5, -52, { mode: 'chat', heading: 2.2 });

  stageCamera(-66, 1.5, -18, -57.5, 1.5, -52);
}

// ---------- DRIVE (the map frame) ----------
// The full-map hub, mid Warehouse Kings: four jobs done, the Kings active
// at stage 2, Rayo in the GT on the Mercado Nocturno east–west road — the
// live Dijkstra route to the shipyard takedown prices out at 545 m.
export function stageDrive() {
  baseState(21.9);
  G.cash = 1450; G.respect = 640; G.rankIndex = 3;
  G.unlocked.kobra = true; G.unlocked.muelle = true;
  G.ammo.p9 = 42; G.ammo.kobra = 80; G.ammo.muelle = 7;
  G.weaponIndex = 0;
  fakeMission(4, 1);            // Warehouse Kings, stage 2 — the takedown
  G.timerLeft = 0;
  const rocco = createPlayer(G.scene, 100, -166);
  const gt = addCar('sport', 100, -160, -Math.PI / 2, 0xffcf3f);
  gt.speed = 15;
  G.playerCar = gt;
  rocco.group.position.set(100, 0, -160);
  rocco.group.visible = false; // behind the wheel
  G.mapOpen = true;
  stageCamera(88, 7.5, -186, 104, 1, -150);
}

// The chase crossfire: registered shooters on staggered clocks, worked
// by updateShotVolley alongside the combat volley below.
let chaseVolley = null;

// ---------- staged chase FX ----------
// The stock fireFx muzzle flash is ONE shared sprite for the whole game
// and its tracer dash lives 0.055 s: with seven guns on staggered clocks
// the shutter kept missing the fire entirely — frames showed impact
// sparks (0.7 s life) but no muzzle fire and no bullets. So the staged
// chase carries its own per-shooter muzzle stars and travelling tracer
// streaks, drawn in the same locked style (small orange star, thin warm
// dash): a star burns full-bright ~0.12 s then fades over ~0.10 s, and
// a streak takes ~0.3 s to cross muzzle-to-target. Only the chase
// staging uses these; the combat volley keeps the stock FX. Revision 5:
// the streaks alone are recoloured deep saturated orange (body
// 0xff6a00, amber core 0xffa200) — the pale yellow washed out against
// the searchlight pool. Sizes, timing, the star recipe and the light
// itself are all unchanged.
let chaseStarTex = null;
let streakGeo = null, streakMat = null;
let streakCoreGeo = null, streakCoreMat = null;
const chaseStreaks = [];

function chaseStarTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,214,90,1)');
  grad.addColorStop(0.55, 'rgba(255,166,48,0.95)');
  grad.addColorStop(1, 'rgba(255,110,26,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(255,220,140,0.85)';
  g.fillRect(30, 2, 4, 60);
  g.fillRect(2, 30, 60, 4);
  return new THREE.CanvasTexture(cv);
}

function spawnChaseFlash(s, from) {
  if (!chaseStarTex) chaseStarTex = chaseStarTexture();
  if (!s.flash) {
    s.flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: chaseStarTex, transparent: true, opacity: 0, depthWrite: false,
    }));
    s.flash.scale.set(0.85, 0.85, 1);
    G.scene.add(s.flash);
  }
  s.flash.position.set(from.x, from.y, from.z);
  s.flash.material.rotation = Math.random() * Math.PI;
  s.flashAge = 0;
}

function spawnChaseStreak(from, hit) {
  if (!streakGeo) {
    streakGeo = new THREE.BoxGeometry(0.035, 0.035, 2.6);
    streakMat = new THREE.MeshBasicMaterial({ color: 0xff6a00, transparent: true, opacity: 0.95 });
    streakCoreGeo = new THREE.BoxGeometry(0.014, 0.014, 2.6);
    streakCoreMat = new THREE.MeshBasicMaterial({ color: 0xffa200, transparent: true, opacity: 1 });
  }
  if (chaseStreaks.length > 48) {
    const old = chaseStreaks.shift();
    G.scene.remove(old.mesh);
  }
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(streakGeo, streakMat));
  grp.add(new THREE.Mesh(streakCoreGeo, streakCoreMat));
  const a = new THREE.Vector3(from.x, from.y, from.z);
  const b = new THREE.Vector3(hit.x, hit.y, hit.z);
  grp.position.copy(a);
  grp.lookAt(b);
  G.scene.add(grp);
  chaseStreaks.push({ mesh: grp, a, b, age: 0 });
}

function updateChaseFx(dt) {
  if (chaseVolley) {
    for (const s of chaseVolley) {
      if (!s.flash) continue;
      s.flashAge = (s.flashAge ?? 99) + dt;
      const age = s.flashAge;
      s.flash.material.opacity = age <= 0.12 ? 1 : Math.max(0, 1 - (age - 0.12) / 0.10);
    }
  }
  for (let i = chaseStreaks.length - 1; i >= 0; i--) {
    const st = chaseStreaks[i];
    st.age += dt;
    if (st.age >= 0.3) {
      G.scene.remove(st.mesh);
      chaseStreaks.splice(i, 1);
      continue;
    }
    st.mesh.position.lerpVectors(st.a, st.b, st.age / 0.3);
  }
}

// One staged chase shot: the stock fireAt sentence (sparks, smoke,
// casing, shared flash) plus the staged star + streak that guarantee
// the fire stays readable in a frozen frame.
function chaseShoot(s) {
  const from = gunPosOf(s.person);
  sfxShot(s.sfx);
  const hit = fireAt(s.kind, from, s.target, { spread: s.spread, hitSomething: true });
  spawnChaseFlash(s, from);
  spawnChaseStreak(from, hit);
}

// ---------- CHASE ----------
export function stageChase() {
  baseState(22.0);
  G.cash = 1450; G.respect = 640; G.rankIndex = 3;
  G.unlocked.kobra = true; G.unlocked.muelle = true;
  G.ammo.p9 = 42; G.ammo.kobra = 80; G.ammo.muelle = 7;
  fakeMission(1, 2);
  G.timerLeft = 64;
  G.wanted = 4.4;
  const rocco = createPlayer(G.scene, -233, -52);
  const gt = addCar('sport', -236, -50, 0, 0xffcf3f);
  gt.speed = 23; // 83 km/h on the speedo
  G.playerCar = gt;
  // THE DUEL: Rayo is not behind the wheel this time — he is leaned out
  // of the driver's door at seat height, pistol up, trading fire with
  // the roadblock ahead.
  rocco.group.position.set(-236.9, 0.30, -49.6);
  rocco.heading = 0; // facing the roadblock
  rocco.group.rotation.y = 0;
  poseAim(rocco.person);
  // The red ally hangs out of the passenger side with the SMG, answering
  // the same roadblock.
  const ally = spawnHostile(-235.1, -49.6, {
    shirt: 0xb03030, gun: 'smg', ally: true, name: 'ally', health: 999,
  });
  ally.group.position.y = 0.30;
  ally.group.rotation.y = 0;
  poseAim(ally.person);
  // The roadblock ahead: two cruisers slewed across the boulevard.
  const rb1 = spawnPoliceCar(-239.5, -31, 0.9, 'roadblock');
  const rb2 = spawnPoliceCar(-231.5, -29.5, -0.8, 'roadblock');
  rb1.speed = 0; rb2.speed = 0;
  const o1 = spawnOfficer(-243.2, -30.5, { heading: Math.PI });
  poseCrouch(o1.person);
  const o2 = spawnOfficer(-228.2, -30.0, { heading: Math.PI, gun: 'smg' });
  poseAim(o2.person);
  // Three more officers complete the firing line. The whole line is
  // spread across the open lanes in front of the cruisers' south faces
  // and the centre gap, so from the chase camera every silhouette
  // stands against open road — nobody hides behind a hood or door.
  const o3 = spawnOfficer(-237.8, -27.6, { heading: Math.PI });
  poseAim(o3.person);
  const o4 = spawnOfficer(-233.4, -27.6, { heading: Math.PI });
  poseAim(o4.person);
  const o5 = spawnOfficer(-235.6, -35.2, { heading: Math.PI });
  poseCrouch(o5.person);
  // Pursuit on the tail.
  const chase1 = spawnPoliceCar(-232.5, -62, 0.15, 'pursuit');
  chase1.speed = 21;
  // Civilian chaos: a braking sedan, a taxi fleeing the other way.
  const sedan = addCar('sedan', -228, -40, 0.35, 0xe8e3d5);
  sedan.speed = 2;
  const taxi = addCar('taxi', -245, -34, Math.PI, 0xffb340);
  taxi.speed = 12;
  spawnPedestrian(-246, -24, { mode: 'wander', heading: 2.6 });
  spawnPedestrian(-226, -40, { mode: 'wander', heading: -0.6 });
  // The two-way volley: all five officers work the GT's rear quarters
  // while Rayo and the ally answer at the roadblock. The clocks are
  // deliberately dense (0.34-0.48 s cycles, 3-round bursts from the
  // SMGs) and feed the staged chase FX below, so at any frozen instant
  // several muzzle stars are lit and several streaks are mid-flight.
  const gtRearC = { x: -236, y: 1.0, z: -52.1 };
  const gtRearL = { x: -236.8, y: 0.9, z: -52.0 };
  const gtRearR = { x: -235.2, y: 0.9, z: -52.0 };
  chaseVolley = [
    { person: o1.person, kind: 'officer', sfx: 'pistol', target: gtRearL, t: 0.05, min: 0.34, max: 0.48, spread: 0.03 },
    { person: o2.person, kind: 'officer', sfx: 'smg', target: gtRearR, t: 0.22, min: 0.34, max: 0.48, spread: 0.035, burst: 3 },
    { person: o3.person, kind: 'officer', sfx: 'pistol', target: gtRearC, t: 0.38, min: 0.34, max: 0.48, spread: 0.03 },
    { person: o4.person, kind: 'officer', sfx: 'pistol', target: gtRearL, t: 0.14, min: 0.34, max: 0.48, spread: 0.03 },
    { person: o5.person, kind: 'officer', sfx: 'pistol', target: gtRearR, t: 0.30, min: 0.34, max: 0.48, spread: 0.03 },
    { person: rocco.person, kind: 'player', sfx: 'pistol', target: { x: -233.4, y: 1.15, z: -27.6 }, t: 0.46, min: 0.34, max: 0.48, spread: 0.03 },
    { person: ally.person, kind: 'ally', sfx: 'smg', target: { x: -237.8, y: 1.1, z: -27.6 }, t: 0.08, min: 0.34, max: 0.48, spread: 0.035, burst: 3 },
  ];
  // Dispatch distances for the cars (officers refresh their own).
  for (const entry of dispatch) {
    if (entry.kind === 'car') {
      entry.dist = Math.round(dist2d(entry.ref.x, entry.ref.z, -236, -50));
    }
  }
  // LUCERO-1 pinned AHEAD of the camera, top-centre over the roadblock,
  // her cone slanting back onto the player's car.
  G.heliActive = true;
  setHeliAltitude(22);
  setHeliOrbit(0.15);
  stageCamera(-240.5, 5.4, -61, -234, 1.4, -27);
}

// ---------- COMBAT ----------
let volley = null;

function buildForklift(x, z, rotY) {
  const grp = new THREE.Group();
  const yellow = new THREE.MeshLambertMaterial({ color: 0xd8a02a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x23262e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 2.6), yellow);
  body.position.y = 0.85;
  grp.add(body);
  const cage = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 1.4), dark);
  cage.position.set(0, 1.95, -0.4);
  grp.add(cage);
  for (const mx of [-0.6, 0.6]) {
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), dark);
    mast.position.set(mx, 1.3, 1.35);
    grp.add(mast);
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 1.1), dark);
    fork.position.set(mx, 0.1, 1.85);
    grp.add(fork);
  }
  const wheelG = new THREE.CylinderGeometry(0.34, 0.34, 0.2, 9);
  for (const [wx, wz] of [[-0.65, 0.85], [0.65, 0.85], [-0.65, -0.85], [0.65, -0.85]]) {
    const w = new THREE.Mesh(wheelG, dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.34, wz);
    grp.add(w);
  }
  grp.position.set(x, 0, z);
  grp.rotation.y = rotY;
  G.scene.add(grp);
  return grp;
}

export function stageCombat() {
  baseState(22.1);
  G.cash = 1980; G.respect = 780; G.rankIndex = 4;
  G.unlocked.kobra = true; G.unlocked.muelle = true;
  G.ammo.p9 = 26; G.ammo.kobra = 64; G.ammo.muelle = 7;
  G.weaponIndex = 3; // Muelle 12ga in hand
  fakeMission(2, 1);
  G.wanted = 2.4;

  const CX = 190, CZ = 285;
  // The container corridor: stacks left + right, a third closing the back.
  for (const sx of [CX - 7.5, CX + 7.5]) {
    for (const sz of [CZ - 6, CZ + 1.5]) {
      addContainer(G.scene, sx, 0, sz, Math.PI / 2, sx < CX ? 0 : 1);
      addContainer(G.scene, sx, 2.6, sz, Math.PI / 2, sx < CX ? 3 : 4);
    }
  }
  addContainer(G.scene, CX - 3.4, 0, CZ + 10.5, 0, 2);
  addContainer(G.scene, CX + 3.4, 0, CZ + 10.5, 0, 5);
  addContainer(G.scene, CX, 2.6, CZ + 10.5, 0, 1);
  buildForklift(CX + 5.6, CZ - 2.5, -0.5);
  addCrates(G.scene, CX - 5.2, CZ + 4.5, 5, 55);
  addBarrels(G.scene, CX + 5.8, CZ + 6.5, 3, 66);
  const truck = addCar('truck', CX - 4.5, CZ + 13.5, 0.4, 0x54804e);
  truck.parked = true;
  const cruiser = spawnPoliceCar(CX - 2.5, CZ + 8.5, 2.6, 'roadblock');
  cruiser.speed = 0;
  for (const entry of dispatch) {
    if (entry.kind === 'car') entry.dist = Math.round(dist2d(entry.ref.x, entry.ref.z, CX, CZ - 5.5));
  }

  // Actors. Player centre-foreground, shotgun up; red ally at his side.
  const rocco = createPlayer(G.scene, CX, CZ - 5.5);
  rocco.heading = 0; // facing +z, into the corridor
  rocco.group.rotation.y = 0;
  poseAim(rocco.person);
  const ally = spawnHostile(CX - 2.6, CZ - 4.6, {
    shirt: 0xd84040, gun: 'smg', ally: true, name: 'ally', health: 999,
  });
  ally.group.rotation.y = 0.25;
  poseAim(ally.person);
  // Officers: crates-left, two right, one centre — all in frame.
  const oL = spawnOfficer(CX - 4.6, CZ + 5.6, { heading: Math.PI });
  poseCrouch(oL.person);
  const oR1 = spawnOfficer(CX + 4.4, CZ + 6.4, { heading: Math.PI, gun: 'smg' });
  poseAim(oR1.person);
  const oR2 = spawnOfficer(CX + 5.6, CZ + 3.4, { heading: Math.PI });
  poseAim(oR2.person);
  const oC = spawnOfficer(CX + 0.8, CZ + 8.2, { heading: Math.PI });
  poseAim(oC.person);
  // Downed officer in the near ground; surrendering civilian by the crates.
  const oDown = spawnOfficer(CX - 1.4, CZ + 0.5, { heading: Math.PI });
  hurtOfficer(oDown, 999);
  const civ = spawnPedestrian(CX - 5.6, CZ + 3.2, { mode: 'browse', heading: 1.2 });
  poseSurrender(civ.person);
  // The downed hostile, mid-frame and unmistakable.
  const dead = spawnHostile(CX + 2.2, CZ + 2.2, { shirt: 0x707880, gun: 'pistol' });
  dead.dead = true;
  poseDown(dead.person);

  volley = { ally, target: oR1, officer: oR1, t: 0.3, t2: 0.75 };
  // Camera 1-1.5 m closer than round 2: actors read big.
  stageCamera(CX - 0.8, 2.1, CZ - 13.5, CX + 0.6, 1.1, CZ + 5);
}

// Staged crossfire so the shutter catches live sparks: the ally works his
// SMG at the right-hand officer; that officer answers at the ally.
export function updateShotVolley(dt) {
  if (chaseVolley) {
    updateChaseFx(dt);
    for (const s of chaseVolley) {
      if (s.burstLeft > 0) {
        s.burstT -= dt;
        if (s.burstT <= 0) {
          s.burstLeft--;
          s.burstT = 0.06;
          chaseShoot(s);
        }
        continue;
      }
      s.t -= dt;
      if (s.t > 0) continue;
      s.t = s.min + Math.random() * (s.max - s.min);
      s.burstLeft = (s.burst || 1) - 1;
      s.burstT = 0.06;
      chaseShoot(s);
    }
  }
  if (!volley) return;
  volley.t -= dt;
  volley.t2 -= dt;
  if (volley.t <= 0) {
    volley.t = 0.85 + Math.random() * 0.5;
    const from = gunPosOf(volley.ally.person);
    const tp = volley.target.group.position;
    sfxShot('smg');
    fireAt('ally', from, { x: tp.x, y: 1.2, z: tp.z }, { spread: 0.03, hitSomething: true });
  }
  if (volley.t2 <= 0) {
    volley.t2 = 1.1 + Math.random() * 0.6;
    const from = gunPosOf(volley.officer.person);
    const tp = volley.ally.group.position;
    sfxShot('pistol');
    fireAt('officer', from, { x: tp.x, y: 1.2, z: tp.z }, { spread: 0.045, hitSomething: true });
  }
}

export function stageShot(name) {
  if (name === 'cover') stageCover();
  else if (name === 'drive') stageDrive();
  else if (name === 'chase') stageChase();
  else if (name === 'combat') stageCombat();
}
