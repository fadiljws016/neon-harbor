// helicopter.js — LUCERO-1, the PDP air unit. Orbit/beam recipe is exact:
// r=33 around the player, beam cone apex at the heli widening to a pool on
// the player, spotlight tracking, strobes on the proven blink pattern.

let heliGroup = null, rotorMain = null, rotorTail = null, beamMesh = null;
let spotLight = null, poolDisc = null, strobeTail = null, strobePort = null;

function initHeli(scene) {
  heliGroup = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x232a38 });
  const accent = new THREE.MeshLambertMaterial({ color: 0x2a6cff });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.9, 5.6), bodyMat);
  body.castShadow = true;
  heliGroup.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.3, 1.6),
    new THREE.MeshLambertMaterial({ color: 0x9fd4e8, emissive: 0x274b63 }));
  nose.position.set(0, -0.15, 3.2);
  heliGroup.add(nose);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.34, 5.64), accent);
  stripe.position.y = 0.35;
  heliGroup.add(stripe);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 4.6), bodyMat);
  tail.position.set(0, 0.35, -4.8);
  heliGroup.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 0.9), accent);
  fin.position.set(0, 0.9, -6.9);
  heliGroup.add(fin);
  rotorMain = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 11.4),
    new THREE.MeshLambertMaterial({ color: 0x11141a }));
  rotorMain.position.y = 1.25;
  heliGroup.add(rotorMain);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 6), bodyMat);
  mast.position.y = 1.05;
  heliGroup.add(mast);
  rotorTail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2, 0.22),
    new THREE.MeshLambertMaterial({ color: 0x11141a }));
  rotorTail.position.set(0.35, 0.9, -6.9);
  heliGroup.add(rotorTail);
  for (const sx of [-1, 1]) { // skids
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 4.4), bodyMat);
    skid.position.set(sx * 1.05, -1.35, 0.2);
    heliGroup.add(skid);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), bodyMat);
    strut.position.set(sx * 1.05, -1.0, 1.2);
    heliGroup.add(strut);
    const strut2 = strut.clone(); strut2.position.z = -1.0;
    heliGroup.add(strut2);
  }
  strobeTail = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xffffff }));
  strobeTail.position.set(0, 1.7, -6.9);
  heliGroup.add(strobeTail);
  strobePort = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xff2a1e }));
  strobePort.position.set(-1.15, 0.2, 0.6);
  heliGroup.add(strobePort);
  heliGroup.visible = false;
  scene.add(heliGroup);

  // searchlight beam: cone apex at the heli, opening onto the player
  beamMesh = new THREE.Mesh(
    new THREE.ConeGeometry(6.5, 46, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  beamMesh.visible = false;
  scene.add(beamMesh);
  spotLight = new THREE.SpotLight(0xfff2c0, 0, 90, 0.32, 0.5, 0.6);
  scene.add(spotLight);
  scene.add(spotLight.target);
  poolDisc = new THREE.Mesh(new THREE.CircleGeometry(6.2, 20),
    new THREE.MeshBasicMaterial({ map: softDotTexture(128, 'rgba(255,242,192,0.5)', 'rgba(255,242,192,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  poolDisc.rotation.x = -Math.PI / 2;
  poolDisc.visible = false;
  scene.add(poolDisc);
  G.heli = heliGroup;
}
function setHeliOrbit(a) {
  G.heliState.forcedOrbit = a;
  G.heliState.orbitAngle = a;
}
function setHeliAltitude(h) { G.heliState.forcedAltitude = h; }
function updateHeli(dt) {
  if (!heliGroup) return;
  const st = G.heliState;
  const active = G.wanted >= 2.8 && (G.started || G.shotMode) && G.player && !G.dead;
  st.active = !!active;
  heliGroup.visible = !!active;
  beamMesh.visible = !!active;
  poolDisc.visible = !!active;
  if (!active) { spotLight.intensity = 0; G.heliSeesPlayer = false; return; }
  const p = G.player.fig.position;
  if (st.forcedOrbit === null || st.forcedOrbit === undefined) st.orbitAngle += dt * 0.32;
  const a = st.orbitAngle;
  const hx = p.x + Math.sin(a) * 33;
  const hz = p.z + Math.cos(a) * 33;
  const hy = st.forcedAltitude !== null && st.forcedAltitude !== undefined
    ? st.forcedAltitude : 30 + Math.sin(G.elapsed * 0.6) * 2;
  heliGroup.position.set(hx, hy, hz);
  heliGroup.rotation.y = Math.atan2(p.x - hx, p.z - hz);
  heliGroup.rotation.z = 0.16;
  rotorMain.rotation.y += dt * 28;
  rotorTail.rotation.x += dt * 32;
  // beam from heli to player
  beamMesh.position.set((hx + p.x) / 2, hy / 2, (hz + p.z) / 2);
  beamMesh.lookAt(p.x, 0, p.z);
  beamMesh.rotateX(-Math.PI / 2);
  spotLight.position.set(hx, hy, hz);
  spotLight.target.position.set(p.x, 0, p.z);
  spotLight.intensity = 3.2;
  poolDisc.position.set(p.x, 0.12, p.z);
  // strobes: tail double-blink, port red at 1.4 Hz
  const ph = G.elapsed % 1.5;
  strobeTail.visible = ph < 0.08 || (ph > 0.18 && ph < 0.26);
  strobePort.material.color.setHex(Math.sin(G.elapsed * Math.PI * 2 * 1.4) > 0 ? 0xff2a1e : 0x661008);
  G.heliSeesPlayer = dist2(hx, hz, p.x, p.z) < 60;
}
