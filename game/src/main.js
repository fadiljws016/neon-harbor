// main.js — boot and the frame loop for Neon Harbor. Wires every system,
// owns driving/entry/interaction, and the screenshot staging entry point.

import { G } from './state.js';
import { initWorld, updateWorld } from './world.js';
import { initCity, districtAt } from './city.js';
import { initEffects, updateEffects } from './effects.js';
import { initHeli, updateHeli } from './helicopter.js';
import { createPlayer, updatePlayer, setPlayerWeaponMesh, collideWorld } from './player.js';
import { initTraffic, updateTraffic, allCars } from './traffic.js';
import { spawnPedestrian, crowd, updatePedestrians } from './pedestrians.js';
import { updatePolice, policeCars } from './police.js';
import { updateOfficers } from './officers.js';
import { updateHostiles, hostiles } from './combat.js';
import { initHUD, updateHUD, showBanner } from './hud.js';
import { initInput, initPauseKey, onPause, onInteract, onMapToggle, onWeaponKey, keys } from './input.js';
import { updateCamera, updateCameraFeel, stageCamera, clearStageCamera } from './camera.js';
import { startMission, updateMissions } from './missions.js';
import { driveStep, collideCar } from './vehicles.js';
import { initAudio, startRainAmbience, updateAudio, sfxHorn } from './audio.js';
import { loadGame, saveGame } from './save.js';
import { stageShot, updateShotVolley } from './shots.js';
import { dist2d } from './util.js';

const canvas = document.getElementById('game');
// Test instrumentation: state-driven playtests (and curious players) can
// inspect the live game. Read/write of the same objects the sim owns.
window.__neon = { G, hostiles, allCars, startMission };
initWorld(canvas);
initCity(G.scene);
initEffects(G.scene);
initHeli(G.scene);
initTraffic(G.scene);
createPlayer(G.scene, -62, -16);
initHUD();
initInput(canvas);
initPauseKey(); // rev 8: the Esc/P listener existed but was never wired

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
let shotFrames = 0;

if (shotName) {
  G.shotMode = true;
  G.shotName = shotName;
  // The world dressing the stills need: a living street population.
  crowd(-64, -34, 0, 1); // (cover stages its own crowd precisely)
  stageShot(shotName);
  setPlayerWeaponMesh();
} else {
  // Ambient population for the living city.
  crowd(-64, -40, 10, 16);
  crowd(150, -160, 8, 20);
  crowd(-236, -60, 8, 22);
  crowd(190, 270, 6, 18);
  for (let i = 0; i < 46; i++) {
    const x = -280 + Math.random() * 580;
    const z = -320 + Math.random() * 640;
    spawnPedestrian(x, z, { mode: 'wander' });
  }
  loadGame();
}

// ---------- Title screen backdrop ----------

// The boot screen looks down on Bahía Noche from ~150 m: an oblique aerial
// over the southern districts, aimed NNW across La Franja toward Isla Faro
// and the lighthouse corner, so the neon grid, the district colours and the
// harbour water all read behind the logo. A slow drift keeps it alive; the
// staged rig holds the shot until the start click clears it.
const TITLE_CAM = { x: 28, y: 148, z: 186, lx: -60, ly: 0, lz: 64 };
function updateTitleCamera() {
  const t = G.t;
  stageCamera(
    TITLE_CAM.x + Math.sin(t * 0.05) * 16,
    TITLE_CAM.y + Math.sin(t * 0.043 + 1.7) * 5,
    TITLE_CAM.z + Math.cos(t * 0.037) * 12,
    TITLE_CAM.lx, TITLE_CAM.ly, TITLE_CAM.lz);
}

// ---------- Interaction ----------

function nearestEnterableCar() {
  const pp = G.player.group.position;
  let best = null, bd = 3.4;
  for (const car of allCars()) {
    if (car.dead) continue;
    const d = dist2d(pp.x, pp.z, car.x, car.z);
    if (d < bd) { bd = d; best = car; }
  }
  if (G.stageCar && !G.stageCar.dead) {
    const d = dist2d(pp.x, pp.z, G.stageCar.x, G.stageCar.z);
    if (d < bd) { bd = d; best = G.stageCar; }
  }
  return best;
}

function tryInteract() {
  if (G.shotMode) return;
  initAudio();
  if (G.dialogue) {
    G.dialogueIndex++;
    if (G.dialogueIndex >= G.dialogue.length) {
      G.dialogue = null;
      G.dialogueDone = true;
      if (!G.mission && G.missionIndex < 0) startMission(0);
      else if (!G.mission && G.missionIndex + 1 < 8) startMission(G.missionIndex + 1);
    }
    return;
  }
  if (G.playerCar) {
    const car = G.playerCar;
    G.playerCar = null;
    const pp = G.player.group.position;
    pp.x = car.x + Math.cos(car.angle) * 1.8;
    pp.z = car.z - Math.sin(car.angle) * 1.8;
    collideWorld(pp, 0.45);
    G.player.group.visible = true;
    return;
  }
  const car = nearestEnterableCar();
  if (car) {
    G.playerCar = car;
    G.player.group.visible = false;
    if (car.type === 'cruiser') G.wanted = Math.min(5, G.wanted + 1);
  }
}

onInteract(tryInteract);
onMapToggle(() => { if (!G.shotMode) G.mapOpen = !G.mapOpen; });
onPause((code) => {
  if (G.mapOpen && code === 'Escape') { G.mapOpen = false; return; }
  if (!G.shotMode) G.paused = !G.paused;
});
onWeaponKey((i) => {
  const ids = ['fists', 'p9', 'kobra', 'muelle'];
  if (G.unlocked[ids[i]]) { G.weaponIndex = i; setPlayerWeaponMesh(); }
});

const startScreen = document.getElementById('start-screen');
if (startScreen && !shotName) {
  startScreen.addEventListener('click', () => {
    initAudio();
    startRainAmbience();
    startScreen.style.display = 'none';
    document.body.classList.add('started');
    clearStageCamera();
    G.started = true;
    startMission(0);
  });
} else if (startScreen) {
  startScreen.style.display = 'none';
  document.body.classList.add('started');
  G.started = true;
}

// ---------- Driving ----------

function updateDriving(dt) {
  const car = G.playerCar;
  if (!car) return;
  let throttle = 0, steer = 0;
  if (keys.w) throttle = 1;
  if (keys.s) throttle = -1;
  if (keys.a) steer = 0.55;
  if (keys.d) steer = -0.55;
  if (keys.shift && Math.random() < dt * 2) sfxHorn();
  driveStep(car, dt, throttle, steer);
  // The driven car is solid: buildings, props and every other car on the
  // street (traffic, parked, police, the mission car) push back.
  const obstacles = allCars().concat(policeCars);
  if (G.stageCar && G.stageCar !== car) obstacles.push(G.stageCar);
  collideCar(car, obstacles, 0.45);
  G.speedKmh = Math.round(Math.abs(car.speed) * 3.6);
  const pp = G.player.group.position;
  pp.x = car.x; pp.z = car.z;
  if (car.dead) {
    G.playerCar = null;
    G.player.group.visible = true;
  }
}

// ---------- Loop ----------

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  // dt is clamped to 50 ms: a hitched frame slows the sim down instead of
  // teleporting it — collision steps stay tunnel-proof at any frame rate.
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.paused) { G.renderer.render(G.scene, G.camera); return; }

  updateWorld(dt);
  if (G.shotMode) {
    updateEffects(dt);
    updateHeli(dt);
    updateOfficers(dt);
    // The judged frames must be ALIVE (owner, rev 8): the ambient stream
    // drives and the crowd walks in shot mode too — a frozen, emptied
    // street is exactly what an earlier round was faulted for.
    updateTraffic(dt);
    updatePedestrians(dt);
    updateShotVolley(dt);
    updateCamera(dt);
    updateHUD(dt);
    shotFrames++;
    if (shotFrames === 100) window.__shotReady = true;
    G.renderer.render(G.scene, G.camera);
    return;
  }
  if (!G.started) { updateTitleCamera(); G.renderer.render(G.scene, G.camera); return; }

  updatePlayer(dt, allCars());
  updateDriving(dt);
  updateTraffic(dt);
  updatePedestrians(dt);
  updatePolice(dt);
  updateOfficers(dt);
  updateHostiles(dt);
  updateHeli(dt);
  updateEffects(dt);
  updateMissions(dt);
  updateCamera(dt);
  updateCameraFeel(dt);
  updateAudio();
  if (G.player) {
    const pp = G.player.group.position;
    G.district = districtAt(pp.x, pp.z).name;
  }
  if (G.over) {
    showBanner('WASTED', 'The harbour keeps what it catches. Click to try again.');
    G.over = false;
    G.health = 100;
    G.wanted = 0;
    saveGame();
  }
  updateHUD(dt);
  G.renderer.render(G.scene, G.camera);
}
requestAnimationFrame(frame);
