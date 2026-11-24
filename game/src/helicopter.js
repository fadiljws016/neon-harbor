// helicopter.js — LUCERO-1, the PDP air unit. Orbit, beam cone and pool
// follow the locked recipe: the cone is narrow at the airframe and widens
// down onto its light pool over the player.

import { G } from './state.js';
import { clamp, angleLerp } from './util.js';
import { glowTexture } from './city.js';

let heli = null;
let rotor = null, tailRotor = null, beam = null, spot = null, poolDisc = null;
let orbitAngle = 0;
let forcedOrbit = null;
let forcedAlt = null;
let strobeT = 0;

export function setHeliOrbit(a) { forcedOrbit = a; orbitAngle = a; }
export function setHeliAltitude(h) { forcedAlt = h; }
export function clearHeliPins() { forcedOrbit = null; forcedAlt = null; }
export function heliPosition() { return heli ? heli.position : null; }

export function initHeli(scene) {
  heli = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1c2f52 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.9, 4.6), bodyMat);
  heli.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.4, 1.4), darkMat);
  nose.position.set(0, -0.15, 2.8);
  heli.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 4.4), bodyMat);
  tail.position.set(0, 0.25, -4.2);
  heli.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 0.9), darkMat);
  fin.position.set(0, 0.8, -6.2);
  heli.add(fin);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.4, 4.2),
    new THREE.MeshLambertMaterial({ color: 0xff4fa3 }));
  stripe.position.y = -0.4;
  heli.add(stripe);
  // Skids.
  const skidMat = new THREE.MeshLambertMaterial({ color: 0x30363e });
  for (const sx of [-0.95, 0.95]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.4, 6), skidMat);
    skid.rotation.x = Math.PI / 2;
    skid.position.set(sx, -1.45, 0.2);
    heli.add(skid);
    for (const sz of [-1.2, 1.4]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 5), skidMat);
      strut.position.set(sx, -1.05, sz);
      heli.add(strut);
    }
  }
  // Rotors.
  const rotorMat = new THREE.MeshBasicMaterial({ color: 0x22262e, transparent: true, opacity: 0.85 });
  rotor = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.06, 0.55), rotorMat);
  rotor.position.y = 1.25;
  heli.add(rotor);
  const rotor2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 11.5), rotorMat);
  rotor2.position.y = 1.25;
  heli.add(rotor2);
  heli.userData.rotor2 = rotor2;
  tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.7, 0.3), rotorMat);
  tailRotor.position.set(0.35, 0.8, -6.2);
  heli.add(tailRotor);
  // Strobes.
  const strobeMat = new THREE.MeshBasicMaterial({ color: 0xff2a30 });
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), strobeMat);
  strobe.position.set(0, 0.9, -6.2);
  heli.add(strobe);
  heli.userData.strobe = strobe;

  // Searchlight: cone + spotlight + pool disc.
  beam = new THREE.Mesh(
    new THREE.ConeGeometry(6.5, 46, 14, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff2c0, transparent: true, opacity: 0.20,
      depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    })
  );
  beam.frustumCulled = false;
  scene.add(beam);
  spot = new THREE.SpotLight(0xfff2c0, 0, 90, 0.32, 0.5, 0.6);
  scene.add(spot);
  scene.add(spot.target);
  poolDisc = new THREE.Mesh(new THREE.CircleGeometry(5.4, 20),
    new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,242,192,0.46)'), transparent: true, depthWrite: false }));
  poolDisc.rotation.x = -Math.PI / 2;
  poolDisc.position.y = 0.06;
  scene.add(poolDisc);

  heli.position.set(-200, 30, -160);
  scene.add(heli);
}

export function updateHeli(dt) {
  if (!heli) return;
  const target = G.playerCar ? G.playerCar.group.position
    : (G.player ? G.player.group.position : null);
  if (!target) { heli.visible = false; beam.visible = false; poolDisc.visible = false; return; }
  const active = G.heliActive;
  heli.visible = active;
  beam.visible = active; poolDisc.visible = active;
  spot.intensity = active ? 11.5 : 0;
  if (!active) return;

  if (forcedOrbit === null) orbitAngle += dt * 0.32;
  const a = forcedOrbit !== null ? forcedOrbit : orbitAngle;
  const hx = target.x + Math.sin(a) * 33;
  const hz = target.z + Math.cos(a) * 33;
  const alt = forcedAlt !== null ? forcedAlt : 30 + Math.sin(G.t * 0.6) * 2;
  heli.position.x += (hx - heli.position.x) * Math.min(1, dt * 2.2);
  heli.position.z += (hz - heli.position.z) * Math.min(1, dt * 2.2);
  heli.position.y += (alt - heli.position.y) * Math.min(1, dt * 2.2);
  const face = Math.atan2(target.x - heli.position.x, target.z - heli.position.z);
  heli.rotation.y = angleLerp(heli.rotation.y, face, Math.min(1, dt * 3));
  heli.rotation.z = 0.16;

  if (rotor) rotor.rotation.y += dt * 28;
  if (heli.userData.rotor2) heli.userData.rotor2.rotation.y += dt * 28;
  if (tailRotor) tailRotor.rotation.x += dt * 32;
  strobeT += dt;
  if (heli.userData.strobe) {
    heli.userData.strobe.material.color.setHex(strobeT % 0.9 < 0.12 ? 0xff5050 : 0x551114);
  }

  // Beam: apex at the airframe, opening down onto the player.
  const hy = heli.position.y;
  beam.position.set(heli.position.x, hy / 2, heli.position.z);
  beam.lookAt(target.x, 0, target.z);
  beam.rotateX(-Math.PI / 2);
  spot.position.set(heli.position.x, hy, heli.position.z);
  spot.target.position.set(target.x, 0, target.z);
  poolDisc.position.x = target.x;
  poolDisc.position.z = target.z;

  const dx = target.x - heli.position.x, dz = target.z - heli.position.z;
  G.heliSeesPlayer = (dx * dx + dz * dz) < 52 * 52 && G.wanted >= 2;
}
