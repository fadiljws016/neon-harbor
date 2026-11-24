// camera.js — follow camera (foot + car) and the staged camera the shots
// pin exactly: stageCamera(x,y,z, lx,ly,lz) freezes the frame composition.

let camPos = new THREE.Vector3(-140, 26, 70);
let camLook = new THREE.Vector3(-110, 1, -10);

function initCamera() {
  if (G.camera) camPos.copy(G.camera.position);
}
function stageCamera(x, y, z, lx, ly, lz) {
  G.stageCam = { x, y, z, lx, ly, lz };
  camPos.set(x, y, z);
  camLook.set(lx, ly, lz);
  if (G.camera) {
    G.camera.position.copy(camPos);
    G.camera.lookAt(camLook);
  }
}
function clearStageCam() { G.stageCam = null; }
function updateCamera(dt) {
  const cam = G.camera;
  if (!cam) return;
  if (G.stageCam) {
    cam.position.set(G.stageCam.x, G.stageCam.y, G.stageCam.z);
    cam.lookAt(G.stageCam.lx, G.stageCam.ly, G.stageCam.lz);
    return;
  }
  const player = G.player;
  if (!player) return;
  const pp = player.fig.position;
  let back = 8.5, height = 3.4, lookUp = 1.2;
  if (player.car) { back = 10.5; height = 4.0; lookUp = 1.0; }
  const h = player.heading;
  const tx = pp.x - fwdX(h) * back, tz = pp.z - fwdZ(h) * back;
  const ty = height;
  const k = 1 - Math.pow(0.0001, dt); // smooth, frame-rate independent
  camPos.x = lerp(camPos.x, tx, k * 0.6);
  camPos.z = lerp(camPos.z, tz, k * 0.6);
  camPos.y = lerp(camPos.y, ty, k * 0.8);
  // keep the camera out of buildings and above the street
  const fixed = collideBuildings(camPos.x, camPos.z, 0.8);
  camPos.x = fixed.x; camPos.z = fixed.z;
  camPos.y = Math.max(camPos.y, 1.1);
  if (G.camShake > 0) {
    G.camShake = Math.max(0, G.camShake - dt * 0.8);
    camPos.x += rand(-1, 1) * G.camShake * 0.4;
    camPos.y += rand(-1, 1) * G.camShake * 0.3;
  }
  cam.position.copy(camPos);
  camLook.x = lerp(camLook.x, pp.x + fwdX(h) * 4, k);
  camLook.z = lerp(camLook.z, pp.z + fwdZ(h) * 4, k);
  camLook.y = lerp(camLook.y, lookUp, k);
  cam.lookAt(camLook);
}
