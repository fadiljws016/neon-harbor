// camera.js — follow/driving cameras, the staged shot camera, dialogue
// framing, and impact shake. Staging always wins: while a shot camera is
// set, the follow rig stays silent.

import { G } from './state.js';
import { clamp, lerp, angleLerp } from './util.js';

let staged = null;
let shakeAmp = 0;
let followDist = 7.5;
let followHeight = 3.1;
let camYaw = Math.PI;
let dialoguePair = null;

export function stageCamera(x, y, z, lx, ly, lz) {
  staged = { x, y, z, lx, ly, lz };
  if (G.camera) {
    G.camera.position.set(x, y, z);
    G.camera.lookAt(lx, ly, lz);
  }
}
export function clearStageCamera() { staged = null; }
export function isStaged() { return staged !== null; }

export function addShake(amp) { shakeAmp = Math.min(0.5, shakeAmp + amp); }

export function setDialoguePair(a, b) { dialoguePair = { a, b }; }
export function clearDialoguePair() { dialoguePair = null; }

export function updateDialogueCamera(dt) {
  if (!dialoguePair || !G.camera) return;
  const { a, b } = dialoguePair;
  const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  const px = -dz / len, pz = dx / len;
  const tx = mx + px * 3.4, tz = mz + pz * 3.4;
  G.camera.position.x = lerp(G.camera.position.x, tx, Math.min(1, dt * 3));
  G.camera.position.y = lerp(G.camera.position.y, 1.6, Math.min(1, dt * 3));
  G.camera.position.z = lerp(G.camera.position.z, tz, Math.min(1, dt * 3));
  G.camera.lookAt(mx, 1.35, mz);
}

export function updateCamera(dt) {
  const cam = G.camera;
  if (!cam) return;
  if (staged) {
    cam.position.set(staged.x, staged.y, staged.z);
    cam.lookAt(staged.lx, staged.ly, staged.lz);
    return;
  }
  if (dialoguePair) { updateDialogueCamera(dt); return; }
  const p = G.player;
  if (!p) return;
  const target = G.playerCar || p;
  const tPos = target.group ? target.group.position : target.pos;
  const baseYaw = G.playerCar ? G.playerCar.angle : p.heading;
  camYaw = angleLerp(camYaw, baseYaw + Math.PI, Math.min(1, dt * (G.playerCar ? 3.2 : 5)));
  const dist = G.playerCar ? 8.6 : followDist;
  const height = G.playerCar ? 3.4 : followHeight;
  const tx = tPos.x + Math.sin(camYaw) * dist;
  const tz = tPos.z + Math.cos(camYaw) * dist;
  cam.position.x = lerp(cam.position.x, tx, Math.min(1, dt * 6));
  cam.position.y = lerp(cam.position.y, height + (G.playerCar ? Math.abs(G.playerCar.speed) * 0.008 : 0), Math.min(1, dt * 6));
  cam.position.z = lerp(cam.position.z, tz, Math.min(1, dt * 6));
  cam.lookAt(tPos.x, 1.3, tPos.z);
}

export function updateCameraFeel(dt) {
  if (shakeAmp > 0.001 && G.camera && !staged) {
    G.camera.position.x += (Math.random() - 0.5) * shakeAmp;
    G.camera.position.y += (Math.random() - 0.5) * shakeAmp * 0.6;
    shakeAmp = Math.max(0, shakeAmp - dt * 1.8);
  }
  // Speed FOV stretch in the car.
  if (G.camera) {
    const target = G.playerCar ? 66 + clamp(Math.abs(G.playerCar.speed), 0, 47) * 0.16 : 66;
    if (Math.abs(G.camera.fov - target) > 0.1) {
      G.camera.fov = lerp(G.camera.fov, target, Math.min(1, dt * 4));
      G.camera.updateProjectionMatrix();
    }
  }
}
