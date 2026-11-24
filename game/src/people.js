// people.js — pivoted low-poly figures: torso/head/arms/legs on pivots so
// poses and walk cycles animate without ever rotating the root. Weapon
// models ride in the right hand. Neon-accent outfits for the night city.

const SKIN_TONES = [0xe8b48c, 0xc98a5e, 0x8a5a34, 0xf0c8a0, 0x6e4426];
const SHIRT_COLORS = [0x3ecfe8, 0xff4fa3, 0xffb340, 0x7dff6a, 0xff7847, 0xb98cff, 0xe8e3d5, 0x2aa864, 0xd8402e, 0x2478cc];
const PANTS_COLORS = [0x23262e, 0x2e3a52, 0x4a3626, 0x1d2b3a, 0x3a2e4a];

function limb(w, h, d, color, x, y, z) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, -h / 2, 0); // pivot at the top
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function buildWeaponMesh(kind) {
  const grp = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x17191d });
  const steel = new THREE.MeshLambertMaterial({ color: 0x3c4248 });
  if (kind === 'pistol') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.3), dark);
    b.position.set(0, -0.05, 0.1); grp.add(b);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.09), dark);
    grip.position.set(0, -0.14, 0.0); grip.rotation.x = 0.3; grp.add(grip);
  } else if (kind === 'smg') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.52), dark);
    b.position.set(0, -0.04, 0.18); grp.add(b);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.09), steel);
    mag.position.set(0, -0.18, 0.14); grp.add(mag);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.18), dark);
    stock.position.set(0, -0.03, -0.14); grp.add(stock);
  } else if (kind === 'shotgun') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.86), steel);
    b.position.set(0, -0.03, 0.3); grp.add(b);
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.24),
      new THREE.MeshLambertMaterial({ color: 0x6e4a2a }));
    pump.position.set(0, -0.06, 0.34); grp.add(pump);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.26),
      new THREE.MeshLambertMaterial({ color: 0x6e4a2a }));
    stock.position.set(0, -0.06, -0.2); grp.add(stock);
  }
  return grp;
}

function buildFigure(opts) {
  opts = opts || {};
  const skin = opts.skin || pick(SKIN_TONES);
  const shirt = opts.color !== undefined ? opts.color : (opts.shirt || pick(SHIRT_COLORS));
  const pants = opts.pants || pick(PANTS_COLORS);
  const grp = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34),
    new THREE.MeshLambertMaterial({ color: shirt }));
  torso.position.y = 1.06;
  torso.castShadow = true;
  grp.add(torso);
  if (opts.stripe) { // reflective stripe (police)
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.1, 0.36),
      new THREE.MeshBasicMaterial({ color: 0xd8f4ff }));
    s.position.y = 1.18;
    grp.add(s);
  }
  if (opts.vest) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.5, 0.38),
      new THREE.MeshLambertMaterial({ color: 0x1d2733 }));
    v.position.y = 1.08;
    grp.add(v);
  }
  const head = new THREE.Group();
  head.position.y = 1.62;
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.4),
    new THREE.MeshLambertMaterial({ color: skin }));
  skull.position.y = 0.16;
  skull.castShadow = true;
  head.add(skull);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.42),
    new THREE.MeshLambertMaterial({ color: opts.hair || pick([0x17130e, 0x2c1e12, 0x4a3626, 0x8a8f98, 0xd8b13c]) }));
  hair.position.y = 0.4;
  head.add(hair);
  if (opts.cap) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.44),
      new THREE.MeshLambertMaterial({ color: opts.cap }));
    cap.position.y = 0.42; head.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.24),
      new THREE.MeshLambertMaterial({ color: opts.cap }));
    brim.position.set(0, 0.38, 0.32); head.add(brim);
  }
  grp.add(head);
  const armL = limb(0.17, 0.66, 0.17, shirt, -0.4, 1.36, 0);
  const armR = limb(0.17, 0.66, 0.17, shirt, 0.4, 1.36, 0);
  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.15), new THREE.MeshLambertMaterial({ color: skin }));
  handL.position.y = -0.7; armL.add(handL);
  const handR = handL.clone(); armR.add(handR);
  grp.add(armL); grp.add(armR);
  const legL = limb(0.21, 0.72, 0.21, pants, -0.16, 0.72, 0);
  const legR = limb(0.21, 0.72, 0.21, pants, 0.16, 0.72, 0);
  grp.add(legL); grp.add(legR);
  grp.userData.parts = { torso, head, armL, armR, legL, legR, handR };
  grp.userData.weapon = null;
  return grp;
}
function setFigureWeapon(fig, kind) {
  const parts = fig.userData.parts;
  if (fig.userData.weapon) { parts.armR.remove(fig.userData.weapon); fig.userData.weapon = null; }
  if (!kind) return;
  const w = buildWeaponMesh(kind);
  w.position.set(0, -0.68, 0.06);
  parts.armR.add(w);
  fig.userData.weapon = w;
}
// Poses: stand, walk (animated separately), chat, sit, crouch, fire,
// surrender, aim (planted gun stance), down (lying flat, set at spawn).
function applyPose(fig, pose) {
  const p = fig.userData.parts;
  p.armL.rotation.set(0, 0, 0.06);
  p.armR.rotation.set(0, 0, -0.06);
  p.legL.rotation.set(0, 0, 0);
  p.legR.rotation.set(0, 0, 0);
  p.head.rotation.set(0, 0, 0);
  fig.position.y = 0;
  if (pose === 'chat') {
    p.armR.rotation.x = -0.7; p.armL.rotation.x = -0.25;
  } else if (pose === 'sit') {
    p.legL.rotation.x = -1.5; p.legR.rotation.x = -1.5;
    fig.position.y = -0.55;
    p.armL.rotation.x = -0.4; p.armR.rotation.x = -0.4;
  } else if (pose === 'crouch') {
    p.legL.rotation.x = -1.9; p.legR.rotation.x = -0.7;
    fig.position.y = -0.5;
    p.armR.rotation.x = -1.35; p.armL.rotation.x = -1.1;
  } else if (pose === 'fire' || pose === 'aim') {
    // planted aim stance: right arm level at the target, left supporting
    p.armR.rotation.x = -1.5;
    p.armL.rotation.x = -1.25; p.armL.rotation.z = 0.5;
    p.legL.rotation.x = 0.18; p.legR.rotation.x = -0.22;
  } else if (pose === 'surrender') {
    p.armL.rotation.z = 2.9; p.armR.rotation.z = -2.9;
    p.armL.rotation.x = 0; p.armR.rotation.x = 0;
    p.head.rotation.x = 0.25;
  } else if (pose === 'down') {
    fig.rotation.x = -Math.PI / 2;
    fig.position.y = 0.22;
    p.armL.rotation.x = -0.4; p.armR.rotation.x = -2.6;
    p.legL.rotation.x = 0.15; p.legR.rotation.x = -0.1;
  } else if (pose === 'drive') {
    p.legL.rotation.x = -1.4; p.legR.rotation.x = -1.4;
    fig.position.y = -0.5;
    p.armL.rotation.x = -0.9; p.armR.rotation.x = -0.9;
  }
  fig.userData.pose = pose;
}
function animateFigure(fig, dt, moveSpeed, t) {
  const p = fig.userData.parts;
  const pose = fig.userData.pose || 'stand';
  if (pose === 'walk' || moveSpeed > 0.2) {
    const sw = Math.sin(t * 9) * 0.55 * Math.min(1, moveSpeed / 3);
    p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
    p.armL.rotation.x = -sw * 0.8; p.armR.rotation.x = sw * 0.8;
    fig.position.y = Math.abs(Math.sin(t * 9)) * 0.05;
  } else if (pose === 'chat') {
    p.head.rotation.y = Math.sin(t * 0.7) * 0.3;
    p.armR.rotation.x = -0.7 + Math.sin(t * 2.2) * 0.12;
  } else if (pose === 'stand' || pose === 'idle') {
    p.armL.rotation.x = Math.sin(t * 1.4) * 0.05;
    p.armR.rotation.x = Math.cos(t * 1.1) * 0.05;
  }
}
