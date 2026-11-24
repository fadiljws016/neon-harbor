// util.js — shared helpers for Neon Harbor: seeded RNG, math, collision,
// canvas painting helpers. Loaded first; everything else builds on these.

// Deterministic RNG (mulberry32) so the city builds identically every load.
let _seed = 1337;
function srand(seed) { _seed = seed >>> 0; }
function rng() {
  _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function rand(a, b) { return a + rng() * (b - a); }
function randi(a, b) { return Math.floor(rand(a, b + 1)); }
function pick(arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
function chance(p) { return rng() < p; }

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist2(x1, z1, x2, z2) { const dx = x2 - x1, dz = z2 - z1; return Math.sqrt(dx * dx + dz * dz); }
function angLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
// Heading convention across the whole game: forward = (sin h, cos h) in xz.
function fwdX(h) { return Math.sin(h); }
function fwdZ(h) { return Math.cos(h); }

// Push a circle (x,z,r) out of an oriented box (centre cx,cz, half extents
// hw,hd, rotated by heading). Returns {x,z} corrected position or null.
function collideCircleOBB(x, z, r, cx, cz, hw, hd, heading) {
  const cos = Math.cos(-heading), sin = Math.sin(-heading);
  const dx = x - cx, dz = z - cz;
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  const qx = clamp(lx, -hw, hw), qz = clamp(lz, -hd, hd);
  let px = lx - qx, pz = lz - qz;
  const d2 = px * px + pz * pz;
  if (d2 > r * r) return null;
  if (d2 < 1e-6) { // centre inside the box: exit along smallest penetration
    const ex = hw + r - Math.abs(lx), ez = hd + r - Math.abs(lz);
    let ox = lx, oz = lz;
    if (ex < ez) ox = lx >= 0 ? hw + r : -(hw + r); else oz = lz >= 0 ? hd + r : -(hd + r);
    const wx = ox * Math.cos(heading) - oz * Math.sin(heading);
    const wz = ox * Math.sin(heading) + oz * Math.cos(heading);
    return { x: cx + wx, z: cz + wz };
  }
  const d = Math.sqrt(d2), push = (r - d) / d;
  px *= push; pz *= push;
  const wx = px * Math.cos(heading) - pz * Math.sin(heading);
  const wz = px * Math.sin(heading) + pz * Math.cos(heading);
  return { x: x + wx, z: z + wz };
}

// Canvas helpers for painted textures.
function makeCanvas(w, h, painter) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  if (painter) painter(c.getContext('2d'), w, h);
  return c;
}
function texFromCanvas(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}
function softDotTexture(size, inner, outer) {
  return texFromCanvas(makeCanvas(size, size, (g) => {
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, inner);
    gr.addColorStop(1, outer);
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
  }));
}
