// people.js — the low-poly citizens of Bahía Noche. Pivoted limbs, canvas
// outfit patterns, readable weapon models, and the pose vocabulary the
// staging and AI share: walk, chat, aim, surrender, down.

import { rand, pick } from './util.js';

const SKINS = [0xe8b98d, 0xc68863, 0x8d5524, 0xf1c27d, 0xa0663a];
const SHIRTS = [0x3ecfe8, 0xff4fa3, 0xf5a623, 0xe8e3d5, 0x2aa864, 0xb678f0, 0xff4438, 0x4a6db0, 0xd8c84a, 0x707880];
const PANTS = [0x23262e, 0x2e3a52, 0x4a3826, 0x3a3f46, 0x5d4037, 0x1f2a38];
const HAIRS = [0x14100c, 0x2e1c10, 0x54432e, 0x8a8f96, 0x0c0c0e, 0x6e2a1e];

function shirtTexture(colorHex, pattern) {
  const cv = document.createElement('canvas');
  cv.width = 32; cv.height = 32;
  const g = cv.getContext('2d');
  const c = '#' + colorHex.toString(16).padStart(6, '0');
  g.fillStyle = c; g.fillRect(0, 0, 32, 32);
  if (pattern === 'stripes') {
    g.fillStyle = 'rgba(255,255,255,0.28)';
    for (let y = 4; y < 32; y += 9) g.fillRect(0, y, 32, 3);
  } else if (pattern === 'check') {
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let x = 0; x < 32; x += 8) { g.fillRect(x, 0, 3, 32); g.fillRect(0, x, 32, 3); }
  } else if (pattern === 'print') {
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.beginPath(); g.arc(16, 15, 6, 0, 7); g.fill();
    g.fillStyle = c;
    g.beginPath(); g.arc(16, 13, 4, 0, 7); g.fill();
  } else if (pattern === 'vest') {
    g.fillStyle = 'rgba(12,12,16,0.9)';
    g.fillRect(0, 0, 7, 32); g.fillRect(25, 0, 7, 32);
    g.fillStyle = 'rgba(255,217,90,0.9)';
    g.fillRect(13, 0, 6, 32);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function limb(w, h, d, mat) {
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.y = -h / 2;
  pivot.add(mesh);
  return pivot;
}

export function makeGunMesh(kind = 'pistol') {
  const grp = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x17191d });
  const steel = new THREE.MeshLambertMaterial({ color: 0x59616c });
  if (kind === 'pistol') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.3), dark);
    body.position.set(0, -0.02, 0.1);
    grp.add(body);
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.32), steel);
    slide.position.set(0, 0.05, 0.1);
    grp.add(slide);
  } else if (kind === 'smg') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.55), dark);
    body.position.set(0, 0, 0.16);
    grp.add(body);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.08), steel);
    mag.position.set(0, -0.16, 0.14);
    grp.add(mag);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 6), steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, 0.52);
    grp.add(barrel);
  } else if (kind === 'shotgun') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.8), dark);
    body.position.set(0, 0, 0.22);
    grp.add(body);
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.24),
      new THREE.MeshLambertMaterial({ color: 0x6e5636 }));
    pump.position.set(0, -0.05, 0.42);
    grp.add(pump);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), steel);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.05, 0.45);
    grp.add(tube);
  }
  return grp;
}

export function makePerson(opts = {}) {
  const skin = opts.skin ?? pick(SKINS);
  const shirt = opts.shirt ?? pick(SHIRTS);
  const pants = opts.pants ?? pick(PANTS);
  const hair = opts.hair ?? pick(HAIRS);
  const pattern = opts.pattern ?? pick(['plain', 'stripes', 'check', 'print', 'plain']);
  const grp = new THREE.Group();

  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const shirtMat = new THREE.MeshLambertMaterial({ map: shirtTexture(shirt, opts.uniform ? 'vest' : pattern) });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const hairMat = new THREE.MeshLambertMaterial({ color: hair });

  const legL = limb(0.17, 0.82, 0.19, pantsMat); legL.position.set(-0.11, 0.82, 0);
  const legR = limb(0.17, 0.82, 0.19, pantsMat); legR.position.set(0.11, 0.82, 0);
  grp.add(legL, legR);
  // Shoes ground the silhouette (rev 8): dark, slightly longer than the leg.
  const shoeMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  for (const leg of [legL, legR]) {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.09, 0.29), shoeMat);
    shoe.position.set(0, -0.79, 0.045);
    leg.add(shoe);
  }

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.66, 0.28), shirtMat);
  torso.position.y = 1.15;
  grp.add(torso);
  // A belt line breaks the torso/legs block boundary (rev 8 detail pass,
  // together with the shoes above and the long-hair variant below).
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.1, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x191c22 }));
  belt.position.y = 0.86;
  grp.add(belt);

  const headPivot = new THREE.Group();
  headPivot.position.y = 1.52;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.3), skinMat);
  head.position.y = 0.18;
  headPivot.add(head);
  const hairCap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.32), hairMat);
  hairCap.position.y = 0.36;
  headPivot.add(hairCap);
  // Long hair down the back for a share of the crowd (never under a cap).
  if (!opts.cap && Math.random() < 0.35) {
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 0.08), hairMat);
    back.position.set(0, 0.14, -0.17);
    headPivot.add(back);
  }
  if (opts.cap) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.34), new THREE.MeshLambertMaterial({ color: opts.cap }));
    cap.position.y = 0.4;
    headPivot.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.22), cap.material);
    brim.position.set(0, 0.37, 0.26);
    headPivot.add(brim);
  }
  grp.add(headPivot);

  const armL = limb(0.13, 0.62, 0.15, shirtMat); armL.position.set(-0.33, 1.44, 0);
  const armR = limb(0.13, 0.62, 0.15, shirtMat); armR.position.set(0.33, 1.44, 0);
  // Hands in skin tone at the ends of the sleeves.
  for (const arm of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.11), skinMat);
    hand.position.y = -0.66;
    arm.add(hand);
  }
  grp.add(armL, armR);

  let gunMesh = null;
  if (opts.gun) {
    gunMesh = makeGunMesh(opts.gun);
    gunMesh.position.set(0, -0.62, 0.06);
    armR.add(gunMesh);
  }

  const person = {
    group: grp, legL, legR, armL, armR, headPivot, torso, gunMesh,
    walkPhase: Math.random() * 6, pose: 'stand', baseY: 0,
    shirtColor: shirt,
  };
  grp.userData.person = person;
  return person;
}

export function poseStand(p) {
  p.pose = 'stand';
  p.armL.rotation.set(0, 0, 0.06);
  p.armR.rotation.set(0, 0, -0.06);
  p.legL.rotation.x = 0; p.legR.rotation.x = 0;
  p.group.position.y = p.baseY;
  p.group.rotation.z = 0;
}

export function poseAim(p) {
  p.pose = 'aim';
  // Planted stance: right arm straight to the gun, left arm bracing,
  // legs split fore/aft. The ROOT never rotates — facing is the caller's.
  p.armR.rotation.set(-1.45, 0, -0.08);
  p.armL.rotation.set(-1.1, 0, 0.45);
  p.legL.rotation.x = 0.34;
  p.legR.rotation.x = -0.3;
}

export function poseChat(p, gesture = 0) {
  p.pose = 'chat';
  p.armR.rotation.set(-0.5 - gesture * 0.3, 0, -0.25);
  p.armL.rotation.set(-0.25, 0, 0.3 + gesture * 0.2);
  p.legL.rotation.x = 0.06; p.legR.rotation.x = -0.06;
}

export function poseSurrender(p) {
  p.pose = 'surrender';
  p.armL.rotation.set(0, 0, 2.6);
  p.armR.rotation.set(0, 0, -2.6);
  p.legL.rotation.x = 0.05; p.legR.rotation.x = 0.05;
}

export function poseDown(p) {
  p.pose = 'down';
  p.group.rotation.x = -Math.PI / 2 + 0.06;
  p.group.position.y = 0.22;
  p.armL.rotation.set(0.4, 0, 0.9);
  p.armR.rotation.set(-0.3, 0, -0.7);
  p.legL.rotation.x = 0.15; p.legR.rotation.x = -0.1;
}

export function poseCrouch(p) {
  p.pose = 'crouch';
  p.group.position.y = p.baseY - 0.32;
  p.legL.rotation.x = 1.15; p.legR.rotation.x = 1.3;
  p.armR.rotation.set(-1.4, 0, -0.08);
  p.armL.rotation.set(-0.9, 0, 0.4);
}

export function animatePerson(p, dt, speed) {
  if (p.pose === 'down' || p.pose === 'surrender') return;
  if (speed > 0.1) {
    p.walkPhase += dt * (4 + speed * 1.6);
    const s = Math.sin(p.walkPhase) * Math.min(0.65, 0.3 + speed * 0.09);
    p.legL.rotation.x = s;
    p.legR.rotation.x = -s;
    if (p.pose !== 'aim' && p.pose !== 'crouch') {
      p.armL.rotation.x = -s * 0.8;
      p.armR.rotation.x = p.gunMesh ? -1.2 : s * 0.8;
    }
    p.group.position.y = p.baseY + Math.abs(Math.sin(p.walkPhase)) * 0.05;
  } else if (p.pose === 'stand') {
    // Idle breath.
    const b = Math.sin(p.walkPhase + dt * 1.7) * 0.02;
    p.armL.rotation.x = b; p.armR.rotation.x = -b;
  }
}
