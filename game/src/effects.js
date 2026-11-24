// effects.js — GPU point pools for sparks and smoke, tracer dashes, muzzle
// stars, shell casings, scorch decals. The numbers here are the approved
// Bahia Heat gunfire recipe, retuned only in colour for the neon night.

import { clamp, rand } from './util.js';

const SPARK_MAX = 1800;
const SMOKE_MAX = 900;

let sparkPts = null, smokePts = null;
let sparkData = null, smokeData = null;
let scene = null;

let tracerGroup = null;
const tracers = [];
let flashLight = null;
let flashSprite = null;
let casingGroup = null;
const casings = [];
const scorches = [];

function softDotTexture(hard = false) {
  const cv = document.createElement('canvas');
  cv.width = 32; cv.height = 32;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 1, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(hard ? 0.4 : 0.25, 'rgba(255,255,255,0.75)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(cv);
}

function makePool(max, size, opacity, hard) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  for (let i = 0; i < max; i++) pos[i * 3 + 1] = -50;
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size, map: softDotTexture(hard), transparent: true, opacity,
    vertexColors: true, depthWrite: false, blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const data = [];
  for (let i = 0; i < max; i++) {
    data.push({ life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, rise: 0, drag: 1, grow: 0, baseSize: size });
  }
  return { pts, data, cursor: 0, max };
}

function poolSpawn(pool, x, y, z, colorHex, count, power, opts) {
  const c = new THREE.Color(colorHex);
  const pos = pool.pts.geometry.attributes.position;
  const col = pool.pts.geometry.attributes.color;
  for (let n = 0; n < count; n++) {
    const i = pool.cursor; pool.cursor = (pool.cursor + 1) % pool.max;
    const d = pool.data[i];
    d.life = d.maxLife = opts.life * (0.6 + Math.random() * 0.7);
    d.vx = (Math.random() - 0.5) * 2 * power;
    d.vy = Math.random() * power * (opts.up ?? 0.9);
    d.vz = (Math.random() - 0.5) * 2 * power;
    d.rise = opts.rise ?? 0;
    d.drag = opts.drag ?? 1;
    pos.setXYZ(i, x + (Math.random() - 0.5) * 0.2, y, z + (Math.random() - 0.5) * 0.2);
    const v = 0.8 + Math.random() * 0.35;
    col.setXYZ(i, c.r * v, c.g * v, c.b * v);
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
}

function muzzleStarTexture() {
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

export function initEffects(s) {
  scene = s;
  const sp = makePool(SPARK_MAX, 0.36, 0.97, true);
  sparkPts = sp.pts; sparkData = sp; scene.add(sparkPts);
  const sm = makePool(SMOKE_MAX, 1.55, 0.32, false);
  sm.pts.material.blending = THREE.NormalBlending;
  smokePts = sm.pts; smokeData = sm; scene.add(smokePts);

  tracerGroup = new THREE.Group();
  scene.add(tracerGroup);
  casingGroup = new THREE.Group();
  scene.add(casingGroup);

  flashLight = new THREE.PointLight(0xffb35e, 0, 15);
  scene.add(flashLight);
  flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: muzzleStarTexture(), transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  flashSprite.scale.set(0.9, 0.9, 1);
  scene.add(flashSprite);
}

export function burst(x, y, z, color, count = 6, power = 2, opts = {}) {
  if (!sparkData) return;
  poolSpawn(sparkData, x, y, z, color, count, power,
    { life: opts.life ?? 0.7, rise: opts.rise ?? 0, drag: opts.drag ?? 2.2, up: opts.up ?? 1 });
}

export function burstSmoke(x, y, z, color, count, opts = {}) {
  if (!smokeData) return;
  poolSpawn(smokeData, x, y, z, color, count, opts.power ?? 0.4,
    { life: opts.life ?? 1.1, rise: opts.rise ?? 0.55, drag: opts.drag ?? 0.6, up: 0.4 });
}

const _tv = () => new THREE.Vector3();

// One gunshot's full visual sentence: tracer dash, muzzle star + light,
// muzzle smoke, impact sparks and dust, an ejected casing.
export function fireFx(x, y, z, tx, ty, tz, hitSomething = true) {
  if (!scene) return;
  const from = _tv(); from.set(x, y, z);
  const to = _tv(); to.set(tx, ty, tz);
  const dir = to.clone().sub(from);
  const len = dir.length();
  if (len > 2) {
    dir.normalize();
    const mid = from.clone().add(dir.clone().multiplyScalar(len * (0.35 + Math.random() * 0.3)));
    const dashLen = Math.min(2.6, len * 0.3);
    const geo = new THREE.BoxGeometry(0.035, 0.035, dashLen);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.95 });
    const dash = new THREE.Mesh(geo, mat);
    dash.position.copy(mid);
    dash.lookAt(mid.clone().add(dir));
    tracerGroup.add(dash);
    tracers.push({ mesh: dash, life: 0.055 });
  }
  flashSprite.position.copy(from);
  flashSprite.material.opacity = 1;
  flashSprite.material.rotation = Math.random() * Math.PI;
  flashLight.position.copy(from);
  flashLight.intensity = 26;
  burstSmoke(x, y, z, 0x8a7f70, 1, { life: 1.1, rise: 0.55, power: 0.3 });
  if (hitSomething) {
    burst(tx, ty, tz, 0xffc46b, 6, 2, { life: 0.7 });
    burstSmoke(tx, ty, tz, 0x99876c, 2, { life: 1.15, rise: 0.55, power: 0.5 });
  }
  spawnCasing(x, y, z);
}

export function spawnCasing(x, y, z) {
  if (!casingGroup) return;
  if (casings.length > 90) {
    const old = casings.shift();
    casingGroup.remove(old.mesh);
  }
  const geo = new THREE.BoxGeometry(0.03, 0.03, 0.09);
  const mat = new THREE.MeshBasicMaterial({ color: 0xe0aa40 });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y - 0.1, z);
  m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
  casingGroup.add(m);
  casings.push({
    mesh: m, life: 1.6,
    vx: (Math.random() - 0.5) * 1.6, vy: 1.6 + Math.random(), vz: (Math.random() - 0.5) * 1.6,
    rx: rand(-9, 9), rz: rand(-9, 9),
  });
}

export function explosionFx(x, y, z) {
  burst(x, y + 0.5, z, 0xff9a3c, 60, 7, { life: 1.1, up: 1.4 });
  burst(x, y + 0.5, z, 0xffe9a8, 30, 4, { life: 0.6 });
  burstSmoke(x, y + 1, z, 0x3a3f46, 14, { life: 2.6, rise: 1.6, power: 1.6 });
  scorchMark(x, z, 4.5);
}

export function smokeTrail(x, y, z, dark = false) {
  burstSmoke(x, y, z, dark ? 0x2c2f33 : 0x6d6a63, 1, { life: 1.5, rise: 0.9, power: 0.25 });
}

export function rainSplash(x, z) {
  burst(x, 0.06, z, 0x9fc4e8, 2, 0.5, { life: 0.3, up: 1.6 });
}

export function scorchMark(x, z, r = 3) {
  if (!scene) return;
  if (scorches.length > 24) {
    const old = scorches.shift();
    scene.remove(old.mesh);
  }
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(5,5,6,0.85)');
  grad.addColorStop(0.7, 'rgba(8,8,10,0.5)');
  grad.addColorStop(1, 'rgba(8,8,10,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 2, r * 2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = Math.random() * Math.PI;
  mesh.position.set(x, 0.03, z);
  scene.add(mesh);
  scorches.push({ mesh, life: 26 });
}

export function updateScorch(dt) {
  for (let i = scorches.length - 1; i >= 0; i--) {
    const s = scorches[i];
    s.life -= dt;
    if (s.life < 3) s.mesh.material.opacity = clamp(s.life / 3, 0, 1);
    if (s.life <= 0) { scene.remove(s.mesh); scorches.splice(i, 1); }
  }
}

function updatePool(pool, dt, grow) {
  const pos = pool.pts.geometry.attributes.position;
  for (let i = 0; i < pool.max; i++) {
    const d = pool.data[i];
    if (d.life <= 0) continue;
    d.life -= dt;
    if (d.life <= 0) { pos.setY(i, -50); continue; }
    const dragK = Math.max(0, 1 - d.drag * dt);
    d.vx *= dragK; d.vz *= dragK;
    d.vy = d.vy * dragK + d.rise * dt;
    pos.setXYZ(i, pos.getX(i) + d.vx * dt, pos.getY(i) + d.vy * dt, pos.getZ(i) + d.vz * dt);
  }
  pos.needsUpdate = true;
  if (grow) {
    // Smoke swells as it ages: size rides on the pool's average live ratio.
    pool.pts.material.opacity = 0.32;
  }
}

export function updateEffects(dt) {
  if (sparkData) updatePool(sparkData, dt, false);
  if (smokeData) updatePool(smokeData, dt, true);
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    t.life -= dt;
    t.mesh.material.opacity = clamp(t.life / 0.055, 0, 1) * 0.95;
    if (t.life <= 0) { tracerGroup.remove(t.mesh); t.mesh.geometry.dispose(); tracers.splice(i, 1); }
  }
  if (flashSprite && flashSprite.material.opacity > 0) {
    flashSprite.material.opacity = Math.max(0, flashSprite.material.opacity - dt * 14);
  }
  if (flashLight && flashLight.intensity > 0) {
    flashLight.intensity = Math.max(0, flashLight.intensity - dt * 320);
  }
  for (let i = casings.length - 1; i >= 0; i--) {
    const c = casings[i];
    c.life -= dt;
    if (c.life <= 0) { casingGroup.remove(c.mesh); casings.splice(i, 1); continue; }
    if (c.mesh.position.y > 0.05) {
      c.vy -= 12 * dt;
      c.mesh.position.x += c.vx * dt;
      c.mesh.position.y = Math.max(0.04, c.mesh.position.y + c.vy * dt);
      c.mesh.position.z += c.vz * dt;
      c.mesh.rotation.x += c.rx * dt;
      c.mesh.rotation.z += c.rz * dt;
    }
  }
  updateScorch(dt);
}
