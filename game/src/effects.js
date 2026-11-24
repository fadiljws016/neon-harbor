// effects.js — the proven gunfire recipe, unchanged numbers: two Points
// pools (sparks 1800 / smoke 900), short thin tracer dashes, compact star
// muzzle flashes, brass casings, explosions. At night it already pops —
// nothing here is enlarged.

let sparkPool = null, smokePool = null;
let tracers = [], flashSprites = [], casingMesh = null, casingData = [];
let flashLight = null;

function makePool(n, size, opacity) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pos[i * 3 + 1] = -100;
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size, transparent: true, opacity, vertexColors: true, depthWrite: false,
    map: softDotTexture(32, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return {
    pts, n, head: 0,
    vel: new Float32Array(n * 3), life: new Float32Array(n), maxLife: new Float32Array(n),
    rise: new Float32Array(n), grow: new Float32Array(n),
  };
}
function initEffects(scene) {
  sparkPool = makePool(1800, 0.36, 0.97);
  smokePool = makePool(900, 1.55, 0.32);
  scene.add(sparkPool.pts);
  scene.add(smokePool.pts);
  // tracer pool: short thin segment meshes
  const tGeo = new THREE.BoxGeometry(0.035, 0.035, 1);
  const tMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(tGeo, tMat);
    m.visible = false;
    scene.add(m);
    tracers.push({ mesh: m, life: 0, from: new THREE.Vector3(), to: new THREE.Vector3() });
  }
  // muzzle flash: compact star sprite
  const flashTex = texFromCanvas(makeCanvas(128, 128, (g) => {
    g.translate(64, 64);
    const gr = g.createRadialGradient(0, 0, 2, 0, 0, 60);
    gr.addColorStop(0, 'rgba(255,214,90,1)');
    gr.addColorStop(0.55, 'rgba(255,166,48,0.95)');
    gr.addColorStop(1, 'rgba(255,110,26,0)');
    g.fillStyle = gr;
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 ? 16 : 58;
      g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath(); g.fill();
  }));
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.visible = false;
    s.scale.set(0.85, 0.85, 1);
    scene.add(s);
    flashSprites.push({ sprite: s, life: 0 });
  }
  flashLight = new THREE.PointLight(0xffb35e, 0, 15);
  scene.add(flashLight);
  // casings: instanced brass
  casingMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.035, 0.035, 0.09),
    new THREE.MeshLambertMaterial({ color: 0xe0aa40 }), 240);
  casingMesh.frustumCulled = false;
  casingData = [];
  for (let i = 0; i < 240; i++) casingData.push({ life: 0, x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0, rot: 0 });
  scene.add(casingMesh);
}
function poolSpawn(pool, x, y, z, color, count, power, opts) {
  const c = new THREE.Color(color);
  const pos = pool.pts.geometry.attributes.position;
  const col = pool.pts.geometry.attributes.color;
  for (let k = 0; k < count; k++) {
    const i = pool.head; pool.head = (pool.head + 1) % pool.n;
    pos.setXYZ(i, x, y, z);
    col.setXYZ(i, c.r, c.g, c.b);
    const a = rng() * Math.PI * 2, up = rng() * 0.9;
    pool.vel[i * 3] = Math.cos(a) * power * rng();
    pool.vel[i * 3 + 1] = up * power * 0.7;
    pool.vel[i * 3 + 2] = Math.sin(a) * power * rng();
    pool.maxLife[i] = (opts.life || 0.7) * (0.6 + rng() * 0.7);
    if (opts.smokeLife) pool.maxLife[i] = (opts.life || 1.8) * (0.7 + rng() * 0.6);
    pool.life[i] = pool.maxLife[i];
    pool.rise[i] = opts.rise || 0;
    pool.grow[i] = opts.grow || 0;
  }
  pos.needsUpdate = true; col.needsUpdate = true;
}
function burst(x, y, z, color, count, power, opts) {
  count = count === undefined ? 6 : count;
  power = power === undefined ? 2 : power;
  poolSpawn(sparkPool, x, y, z, color, count, power, opts || {});
}
function burstSmoke(x, y, z, color, count, opts) {
  opts = opts || {};
  opts.smokeLife = true;
  poolSpawn(smokePool, x, y, z, color, count, 0.6, opts);
}
function impactDust(x, y, z) {
  burstSmoke(x, y, z, 0x99876c, 2, { life: 1.15, rise: 0.55, power: 0.5 });
  burst(x, y, z, 0xffc46e, 3, 1.6, {});
}
function spawnTracer(fx, fy, fz, tx, ty, tz) {
  const t = tracers.find(t => t.life <= 0) || tracers[0];
  t.from.set(fx, fy, fz); t.to.set(tx, ty, tz);
  t.life = 0.09;
  // a SHORT dash caught mid-flight: position the segment along the middle
  // third of the path, never the full muzzle-to-target beam
  const mx = fx + (tx - fx) * 0.45, my = fy + (ty - fy) * 0.45, mz = fz + (tz - fz) * 0.45;
  const len = Math.min(1.6, dist2(fx, fz, tx, tz) * 0.3);
  t.mesh.position.set(mx, my, mz);
  t.mesh.lookAt(tx, ty, tz);
  t.mesh.scale.set(1, 1, len);
  t.mesh.visible = true;
}
function muzzleFlash(x, y, z) {
  const f = flashSprites.find(f => f.life <= 0) || flashSprites[0];
  f.sprite.position.set(x, y, z);
  f.sprite.material.rotation = rng() * Math.PI;
  f.life = 0.055;
  f.sprite.visible = true;
  flashLight.position.set(x, y, z);
  flashLight.intensity = 2.2;
}
function ejectCasing(x, y, z, heading) {
  const c = casingData.find(c => c.life <= 0);
  if (!c) return;
  c.life = 1.6;
  c.x = x; c.y = y; c.z = z;
  const side = heading + Math.PI / 2;
  c.vx = Math.sin(side) * rand(0.6, 1.1); c.vz = Math.cos(side) * rand(0.6, 1.1);
  c.vy = rand(1.2, 1.9);
  c.rot = rng() * 6;
}
function explosionAt(x, y, z) {
  burstSmoke(x, y, z, 0x3a3a3a, 12, { life: 2.8, rise: 1.7, power: 1.7 });
  burstSmoke(x, y, z, 0x6e6e6e, 7, { life: 2.1, rise: 1.15, power: 2.3 });
  burst(x, y, z, 0xff8a3c, 26, 4.5, { life: 0.8 });
  burst(x, y, z, 0xffd76e, 16, 3.2, { life: 0.6 });
  muzzleFlash(x, y + 0.5, z);
  if (typeof audioExplosion === 'function') audioExplosion();
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
function updatePool(pool, dt, drag, grav) {
  const pos = pool.pts.geometry.attributes.position;
  for (let i = 0; i < pool.n; i++) {
    if (pool.life[i] <= 0) continue;
    pool.life[i] -= dt;
    if (pool.life[i] <= 0) { pos.setY(i, -100); continue; }
    pool.vel[i * 3] *= drag; pool.vel[i * 3 + 2] *= drag;
    pool.vel[i * 3 + 1] += (pool.rise[i] - grav) * dt;
    pos.setXYZ(i,
      pos.getX(i) + pool.vel[i * 3] * dt,
      pos.getY(i) + pool.vel[i * 3 + 1] * dt,
      pos.getZ(i) + pool.vel[i * 3 + 2] * dt);
  }
  pos.needsUpdate = true;
}
function updateEffects(dt) {
  if (!sparkPool) return;
  updatePool(sparkPool, dt, 0.92, 3.2);
  updatePool(smokePool, dt, 0.985, -0.15);
  for (const t of tracers) {
    if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.mesh.visible = false; }
  }
  for (const f of flashSprites) {
    if (f.life > 0) { f.life -= dt; if (f.life <= 0) f.sprite.visible = false; }
  }
  if (flashLight.intensity > 0) flashLight.intensity = Math.max(0, flashLight.intensity - dt * 30);
  casingData.forEach((c, i) => {
    if (c.life > 0) {
      c.life -= dt;
      c.vy -= 6.5 * dt;
      c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      if (c.y < 0.05) { c.y = 0.05; c.vy *= -0.35; c.vx *= 0.6; c.vz *= 0.6; }
      c.rot += dt * 7;
    }
    if (c.life <= 0 && c.y > -5) c.y = -10; // expired brass parks underground
    _e.set(c.rot, c.rot * 1.3, 0); _q.setFromEuler(_e);
    _m4.compose(_v.set(c.x, c.y, c.z), _q, _s);
    casingMesh.setMatrixAt(i, _m4);
  });
  casingMesh.instanceMatrix.needsUpdate = true;
}
