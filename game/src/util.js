// util.js — small shared helpers for Neon Harbor.
// Seeded RNG, math clamps, 2D geometry and the OBB collision test every
// mover in Bahía Noche relies on. No dependencies, no side effects.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rng = mulberry32(20261124);

export function rand(a, b) { return a + rng() * (b - a); }
export function randi(a, b) { return Math.floor(rand(a, b + 1)); }
export function pick(arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
export function chance(p) { return rng() < p; }

export function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstep(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

export function dist2d(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}
export function dist2dSq(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
}

export function angleTo(ax, az, bx, bz) { return Math.atan2(bx - ax, bz - az); }

export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Circle vs oriented-box test in the XZ plane. obb = {x, z, hw, hd, rot}
// where rot rotates the box's local axes. Returns true on overlap and, when
// push is supplied, writes the minimum separation vector into it.
export function collideCircleOBB(px, pz, r, obb, push) {
  const c = Math.cos(-obb.rot), s = Math.sin(-obb.rot);
  const dx = px - obb.x, dz = pz - obb.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  const qx = clamp(lx, -obb.hw, obb.hw), qz = clamp(lz, -obb.hd, obb.hd);
  const ex = lx - qx, ez = lz - qz;
  const d2 = ex * ex + ez * ez;
  if (d2 > r * r) return false;
  if (push) {
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2), pen = (r - d) / d;
      const wx = ex * pen, wz = ez * pen;
      const c2 = Math.cos(obb.rot), s2 = Math.sin(obb.rot);
      push.x = wx * c2 - wz * s2; push.z = wx * s2 + wz * c2;
    } else {
      // Centre inside the box: push out along the shallower axis.
      const pxOut = obb.hw - Math.abs(lx), pzOut = obb.hd - Math.abs(lz);
      const c2 = Math.cos(obb.rot), s2 = Math.sin(obb.rot);
      let wx = 0, wz = 0;
      if (pxOut < pzOut) wx = (lx >= 0 ? 1 : -1) * (pxOut + r);
      else wz = (lz >= 0 ? 1 : -1) * (pzOut + r);
      push.x = wx * c2 - wz * s2; push.z = wx * s2 + wz * c2;
    }
  }
  return true;
}

export function fmtMoney(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }

export function fmtClock(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour - Math.floor(hour)) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

export function fmtTimer(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
}

// Deterministic per-position hash so city dressing never reshuffles.
export function hash2(x, z) {
  let h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
