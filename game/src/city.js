// city.js — Bahía Noche itself: the road grid, six districts, canvas
// textures (asphalt, paving, facades, neon signs), and every static builder
// the staging code dresses the streets with. Layout is data-first so the
// minimap, route graph and collision audits all read the same truth.

import { rng, rand, pick, hash2, clamp } from './util.js';

export const VX = [-236, -188, -128, -64, 0, 64, 128, 192, 256];   // vertical roads (constant x)
export const HZ = [-288, -224, -160, -96, -32, 32, 96, 160, 224, 288]; // horizontal roads (constant z)
export const ROAD_W = 14;
export const BOULEVARD_X = -236;
export const WORLD = { x0: -300, x1: 320, z0: -340, z1: 340 };

export const DISTRICTS = [
  { name: 'Muelle Neón',      x0: -300, x1: -170, z0: -340, z1: 340,  color: 0xff4fa3, wash: 'rgba(255,79,163,0.60)' },
  { name: 'Isla Faro',        x0: -170, x1: 60,   z0: -340, z1: -200, color: 0x2a7d99, wash: 'rgba(42,125,153,0.62)' },
  { name: 'La Franja',        x0: -170, x1: 60,   z0: -200, z1: 200,  color: 0x3ecfe8, wash: 'rgba(62,207,232,0.58)' },
  { name: 'Mercado Nocturno', x0: 60,   x1: 320,  z0: -340, z1: -40,  color: 0xf5a623, wash: 'rgba(245,166,35,0.60)' },
  { name: 'Alto Mirador',     x0: 60,   x1: 320,  z0: -40,  z1: 200,  color: 0xd84a30, wash: 'rgba(216,74,48,0.58)' },
  { name: 'El Astillero',     x0: -170, x1: 320,  z0: 200,  z1: 340,  color: 0x2aa864, wash: 'rgba(42,168,100,0.60)' },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  return DISTRICTS[2];
}

export const PLACES = {
  club:      { x: -52,  z: -40,  name: 'Club Sirena',    short: 'Volt' },
  garage:    { x: 30,   z: 104,  name: 'Taller Noche',   short: 'Garage' },
  race:      { x: 196,  z: -104, name: 'Strip Start',    short: 'Race start' },
  pdp:       { x: 120,  z: 40,   name: 'PDP Comisaría',  short: 'PDP station' },
  hospital:  { x: -120, z: 104,  name: 'Hospital Faro',  short: 'Hospital' },
  lighthouse:{ x: -272, z: -296, name: 'El Faro',        short: 'Lighthouse' },
  marina:    { x: -264, z: 56,   name: 'Marina Docks',   short: 'Marina docks' },
  shipyard:  { x: 190,  z: 285,  name: 'El Astillero',   short: 'Shipyard' },
  market:    { x: 150,  z: -160, name: 'Mercado Central', short: 'Market' },
  casino:    { x: -200, z: -160, name: 'Casino Faro',    short: 'Casino' },
};

// Static collision registries, filled by the builders below.
export const colliders = []; // {x, z, hw, hd, rot}
export const props = [];     // {x, z, r}

// ---------- Broadphase ----------
// A uniform grid (16 m cells) over both registries, built lazily on first
// query — initCity fills the registries before anything moves, and nothing
// registers afterwards, so the grid never goes stale. Each entry is indexed
// by its bounding circle; queries gather the entries whose cells overlap
// the query circle and dedupe by stamp. This keeps per-frame collision at
// a handful of candidates instead of the full ~400-entry registries.
const GRID_CELL = 16;
let _grid = null;
let _gridStamp = 0;

function gridKey(cx, cz) { return cx * 4096 + cz; }

function buildGrid() {
  _grid = new Map();
  const add = (item, radius) => {
    const x0 = Math.floor((item.x - radius) / GRID_CELL), x1 = Math.floor((item.x + radius) / GRID_CELL);
    const z0 = Math.floor((item.z - radius) / GRID_CELL), z1 = Math.floor((item.z + radius) / GRID_CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const k = gridKey(cx, cz);
      let cell = _grid.get(k);
      if (!cell) { cell = []; _grid.set(k, cell); }
      cell.push(item);
    }
  };
  for (const c of colliders) add(c, Math.hypot(c.hw, c.hd));
  for (const p of props) add(p, p.r);
}

// Fill `out` with every collider/prop whose bounding circle might touch
// the circle (x, z, r). Entries carry an `isProp` tag on the shared
// registry objects themselves; the two shapes resolve differently.
export function queryWorld(x, z, r, out) {
  if (!_grid) buildGrid();
  out.length = 0;
  _gridStamp++;
  const x0 = Math.floor((x - r) / GRID_CELL), x1 = Math.floor((x + r) / GRID_CELL);
  const z0 = Math.floor((z - r) / GRID_CELL), z1 = Math.floor((z + r) / GRID_CELL);
  for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
    const cell = _grid.get(gridKey(cx, cz));
    if (!cell) continue;
    for (const item of cell) {
      if (item._stamp === _gridStamp) continue;
      item._stamp = _gridStamp;
      out.push(item);
    }
  }
  return out;
}

export function buildRouteGraph() {
  const nodes = new Map();
  const key = (x, z) => x + ',' + z;
  for (const x of VX) for (const z of HZ) nodes.set(key(x, z), { x, z, edges: [] });
  const link = (a, b) => {
    const na = nodes.get(key(a.x, a.z)), nb = nodes.get(key(b.x, b.z));
    const w = Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
    na.edges.push({ to: key(b.x, b.z), w });
    nb.edges.push({ to: key(a.x, a.z), w });
  };
  for (const z of HZ) for (let i = 0; i < VX.length - 1; i++) link({ x: VX[i], z }, { x: VX[i + 1], z });
  for (const x of VX) for (let j = 0; j < HZ.length - 1; j++) link({ x, z: HZ[j] }, { x, z: HZ[j + 1] });
  return { nodes, key };
}

export function randomRoadPoint(r) {
  if (r() < 0.5) {
    const x = VX[Math.floor(r() * VX.length)];
    return { x: x + (r() - 0.5) * 6, z: rand(-330, 330) };
  }
  const z = HZ[Math.floor(r() * HZ.length)];
  return { x: rand(-290, 310), z: z + (r() - 0.5) * 6 };
}

export function nearestRoadPoint(x, z) {
  let best = null, bd = Infinity;
  for (const rx of VX) { const d = Math.abs(x - rx); if (d < bd) { bd = d; best = { x: rx, z }; } }
  for (const rz of HZ) { const d = Math.abs(z - rz); if (d < bd) { bd = d; best = { x, z: rz }; } }
  return best;
}

// ---------- Canvas textures ----------

function canvasTex(w, h, draw, srgb = true) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

let _asphalt = null;
export function asphaltTexture() {
  if (_asphalt) return _asphalt;
  _asphalt = canvasTex(256, 256, (g) => {
    g.fillStyle = '#23262c'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const v = 28 + Math.floor(Math.random() * 26);
      g.fillStyle = 'rgb(' + v + ',' + (v + 2) + ',' + (v + 7) + ')';
      g.fillRect(Math.random() * 256, Math.random() * 256, 1.6, 1.6);
    }
    // Tar seams and cracks.
    g.strokeStyle = 'rgba(10,10,12,0.55)'; g.lineWidth = 1.4;
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      let x = Math.random() * 256, y = Math.random() * 256;
      g.moveTo(x, y);
      for (let s = 0; s < 5; s++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = 'rgba(12,12,14,0.5)';
    g.fillRect(0, 124, 256, 3); g.fillRect(124, 0, 3, 256);
    // Wet neon streaks bleeding across the rain-slick surface.
    const streaks = ['rgba(255,79,163,0.10)', 'rgba(62,207,232,0.10)', 'rgba(245,166,35,0.08)'];
    for (let i = 0; i < 9; i++) {
      g.fillStyle = pick(streaks);
      const x = Math.random() * 256;
      g.fillRect(x, Math.random() * 140, 3 + Math.random() * 5, 60 + Math.random() * 90);
    }
    // Lamp-pool ellipses baked faintly in; real pools are added as discs.
    for (let i = 0; i < 4; i++) {
      const gr = g.createRadialGradient(40 + i * 62, 200, 2, 40 + i * 62, 200, 26);
      gr.addColorStop(0, 'rgba(255,205,130,0.10)');
      gr.addColorStop(1, 'rgba(255,205,130,0)');
      g.fillStyle = gr;
      g.fillRect(0, 160, 256, 96);
    }
  });
  return _asphalt;
}

let _paving = null;
export function pavingTexture() {
  if (_paving) return _paving;
  _paving = canvasTex(256, 256, (g) => {
    g.fillStyle = '#2c3242'; g.fillRect(0, 0, 256, 256);
    const cell = 64;
    for (let cx = 0; cx < 4; cx++) for (let cy = 0; cy < 4; cy++) {
      const v = 40 + Math.floor(Math.random() * 12);
      g.fillStyle = 'rgb(' + v + ',' + (v + 5) + ',' + (v + 14) + ')';
      g.fillRect(cx * cell + 2, cy * cell + 2, cell - 4, cell - 4);
      for (let i = 0; i < 26; i++) {
        const s = 30 + Math.floor(Math.random() * 30);
        g.fillStyle = 'rgb(' + s + ',' + (s + 4) + ',' + (s + 10) + ')';
        g.fillRect(cx * cell + 3 + Math.random() * 58, cy * cell + 3 + Math.random() * 58, 1.5, 1.5);
      }
    }
    for (let i = 0; i < 7; i++) {
      g.fillStyle = 'rgba(10,12,18,0.20)';
      g.beginPath();
      g.ellipse(Math.random() * 256, Math.random() * 256, 12 + Math.random() * 22, 8 + Math.random() * 14, Math.random() * 3, 0, 7);
      g.fill();
    }
    // Wet sheen streaks in cyan and magenta.
    g.fillStyle = 'rgba(62,207,232,0.06)'; g.fillRect(20, 0, 10, 256);
    g.fillStyle = 'rgba(255,79,163,0.06)'; g.fillRect(190, 0, 12, 256);
  });
  return _paving;
}

const FACADE_BASES = ['#2e3a52', '#3a2e4a', '#27313f', '#40364a', '#2a4048', '#4a3040', '#35424e'];
const LIT_COLORS = ['#ffd9a0', '#ffb35e', '#9fe8ff', '#57d7e8', '#ffe9f4', '#cfe3f2'];

export function facadeTexture(variant, litRatio = 0.45) {
  const base = FACADE_BASES[variant % FACADE_BASES.length];
  return canvasTex(256, 256, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    // Grime patches.
    for (let i = 0; i < 7; i++) {
      g.fillStyle = 'rgba(6,8,12,' + (0.10 + Math.random() * 0.16) + ')';
      g.beginPath();
      g.ellipse(Math.random() * 256, Math.random() * 256, 18 + Math.random() * 40, 12 + Math.random() * 30, Math.random() * 3, 0, 7);
      g.fill();
    }
    // Shopfront band along the ground floor.
    g.fillStyle = 'rgba(10,12,20,0.85)';
    g.fillRect(0, 208, 256, 48);
    for (let x = 10; x + 48 <= 256; x += 58) {
      const lit = Math.random() < 0.8;
      g.fillStyle = lit ? pick(['rgba(255,179,94,0.85)', 'rgba(87,215,232,0.75)', 'rgba(255,79,163,0.7)']) : 'rgba(24,28,40,0.9)';
      g.fillRect(x, 212, 48, 40);
      g.fillStyle = 'rgba(255,255,255,0.20)';
      g.fillRect(x, 212, 48, 3);
    }
    g.fillStyle = '#141824';
    g.fillRect(118, 204, 24, 44);
    g.fillRect(112, 200, 30, 4);
    // Window grid: 4 floors of 64 px in texture space.
    for (let f = 0; f < 4; f++) {
      const y = 14 + f * 48;
      for (let cx = 0; cx < 6; cx++) {
        const x = 12 + cx * 40;
        const lit = Math.random() < litRatio;
        if (lit) {
          g.fillStyle = pick(LIT_COLORS);
          g.globalAlpha = 0.55 + Math.random() * 0.45;
        } else {
          g.fillStyle = '#131a29';
          g.globalAlpha = 1;
        }
        g.fillRect(x, y, 24, 30);
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(x, y + 14, 24, 2);
      }
    }
  });
}

export const SIGN_STYLES = {
  SIRENA:  { bg: '#160a24', fg: '#ff4fa3', border: '#57d7e8' },
  LUNA:    { bg: '#0a1428', fg: '#cfe3f2', border: '#57d7e8' },
  ORBITA:  { bg: '#140f24', fg: '#ffb35e', border: '#ff4fa3' },
  NEON:    { bg: '#0a1a24', fg: '#57d7e8', border: '#ff4fa3' },
  PUERTO:  { bg: '#0d1f16', fg: '#7fe8a8', border: '#f5a623' },
  CASINO:  { bg: '#1c0a14', fg: '#ffd23e', border: '#ff4fa3' },
  GENERIC: { bg: '#101020', fg: '#e8e3d5', border: '#3ecfe8' },
};

export function signTexture(text, style, vertical = false) {
  const st = typeof style === 'string' ? (SIGN_STYLES[style] || SIGN_STYLES.GENERIC) : style;
  const w = vertical ? 96 : 512, h = vertical ? 512 : 96;
  const tex = canvasTex(w, h, (g) => {
    g.fillStyle = st.bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = st.border; g.lineWidth = 5;
    g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = st.fg;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = st.fg; g.shadowBlur = 18;
    if (vertical) {
      const letters = text.split('');
      const step = (h - 40) / Math.max(letters.length, 1);
      g.font = 'bold ' + Math.min(64, step - 6) + 'px Arial, sans-serif';
      letters.forEach((ch, i) => g.fillText(ch, w / 2, 24 + step * (i + 0.5)));
    } else {
      let size = 58;
      g.font = 'bold ' + size + 'px Arial, sans-serif';
      while (g.measureText(text).width > w - 40 && size > 18) {
        size -= 4; g.font = 'bold ' + size + 'px Arial, sans-serif';
      }
      g.fillText(text, w / 2, h / 2 + 2);
      g.shadowBlur = 0;
      g.fillStyle = st.border;
      g.fillRect(30, h - 14, w - 60, 3);
    }
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

const _glowTex = {};
export function glowTexture(inner = 'rgba(255,205,130,0.55)') {
  if (_glowTex[inner]) return _glowTex[inner];
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  _glowTex[inner] = tex;
  return tex;
}

// ---------- Builders ----------

export function makeSignMesh(text, style, w, h, vertical = false) {
  const mat = new THREE.MeshBasicMaterial({ map: signTexture(text, style, vertical) });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  return mesh;
}

export function addLightPool(scene, x, z, r, color = 'rgba(255,205,130,0.55)') {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(r, 20),
    new THREE.MeshBasicMaterial({ map: glowTexture(color), transparent: true, depthWrite: false, opacity: 0.5 })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.045, z);
  scene.add(mesh);
  return mesh;
}

export function addGlowSprite(scene, x, y, z, scale, colorHex) {
  const c = new THREE.Color(colorHex);
  const inner = 'rgba(' + Math.round(c.r * 255) + ',' + Math.round(c.g * 255) + ',' + Math.round(c.b * 255) + ',0.6)';
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(inner), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  spr.position.set(x, y, z);
  spr.scale.set(scale, scale, 1);
  scene.add(spr);
  return spr;
}

const _facadeMats = [];
export function ensureFacadeMats() {
  if (_facadeMats.length) return _facadeMats;
  for (let v = 0; v < 6; v++) {
    const tex = facadeTexture(v, 0.45);
    _facadeMats.push(new THREE.MeshLambertMaterial({ map: tex }));
  }
  return _facadeMats;
}
const _roofMat = new THREE.MeshLambertMaterial({ color: 0x11141d });
const _podiumMat = new THREE.MeshLambertMaterial({ color: 0x1a2029 });
const _parapetMat = new THREE.MeshLambertMaterial({ color: 0x232a36 });
const _shedRoofMat = new THREE.MeshLambertMaterial({ color: 0x39424e });

// One facade material per building segment, with the window-grid repeat
// scaled to that segment so windows keep their size across a stepped stack.
function facadeMatFor(variant, litRatio, w, hSeg) {
  let tex;
  if (litRatio !== undefined) {
    tex = facadeTexture(variant, litRatio);
  } else {
    const mats = ensureFacadeMats();
    tex = mats[variant % mats.length].map.clone();
  }
  tex.repeat.set(Math.max(1, Math.round(w / 12)), Math.max(1, Math.round(hSeg / 12)));
  tex.needsUpdate = true;
  return new THREE.MeshLambertMaterial({ map: tex });
}

// A thin rim wall around a roof edge — the cheapest silhouette win there is.
function addParapet(scene, top) {
  const t = 0.18, ph = 0.5;
  for (const s of [-1, 1]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(top.w + t * 2, ph, t), _parapetMat);
    edge.position.set(top.x, top.y + ph / 2, top.z + s * (top.d / 2 + t / 2));
    scene.add(edge);
    const side = new THREE.Mesh(new THREE.BoxGeometry(t, ph, top.d + t * 2), _parapetMat);
    side.position.set(top.x + s * (top.w / 2 + t / 2), top.y + ph / 2, top.z);
    scene.add(side);
  }
}

// Gabled or sawtooth shed roof: sloped slabs meeting at ridges along z.
function addShedRoof(scene, cx, cz, w, d, topY, kind) {
  const segments = kind === 'sawtooth' ? 3 : 1;
  const sw = w / segments;
  for (let i = 0; i < segments; i++) {
    const sx = cx - w / 2 + sw * (i + 0.5);
    const rise = Math.min(2.4, sw * 0.24);
    const len = Math.hypot(sw / 2, rise) + 0.35;
    const ang = Math.atan2(rise, sw / 2);
    for (const s of [-1, 1]) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, d + 0.4), _shedRoofMat);
      slab.position.set(sx + s * sw / 4, topY + rise / 2, cz);
      slab.rotation.z = -s * ang;
      scene.add(slab);
    }
  }
}

export function addBuilding(scene, cx, cz, w, d, h, opts = {}) {
  const variant = opts.variant ?? Math.floor(hash2(cx, cz) * 6);
  // Massing (rev 8): the total height and the ground footprint — and so
  // the collider — are exactly what the caller asked for; the height is
  // redistributed over a podium, a main shaft, setback tiers or an
  // L-plan annex so the skyline stops reading as identical boxes.
  const tiers = opts.tiers ?? 0;
  const podiumH = opts.podium ? 1.15 : 0;
  const bodyH = h - podiumH;
  const mainH = bodyH * (tiers === 2 ? 0.58 : tiers === 1 ? 0.7 : 1);
  const t1H = tiers >= 1 ? bodyH * (tiers === 2 ? 0.26 : 0.3) : 0;
  const t2H = tiers === 2 ? bodyH - mainH - t1H : 0;
  const stack = [];
  if (podiumH) stack.push({ w, d, h: podiumH, y0: 0, podium: true });
  if (opts.lPlan && tiers === 0) {
    const w1 = w * 0.74;
    stack.push({ w: w1, d, h: mainH, y0: podiumH, dx: -(w - w1) / 2 });
    stack.push({ w: w - w1, d: d * 0.58, h: mainH * 0.52, y0: podiumH, dx: w1 / 2, dz: -d * 0.21 });
  } else {
    stack.push({ w, d, h: mainH, y0: podiumH });
  }
  if (t1H) stack.push({ w: w * 0.8, d: d * 0.8, h: t1H, y0: podiumH + mainH });
  if (t2H) stack.push({ w: w * 0.58, d: d * 0.58, h: t2H, y0: podiumH + mainH + t1H });
  let top = null;
  let mainMesh = null;
  for (const s of stack) {
    let mesh;
    if (s.podium) {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), _podiumMat);
    } else {
      const mat = facadeMatFor(variant, opts.litRatio, s.w, s.h);
      mesh = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d),
        [mat, mat, _roofMat, _roofMat, mat, mat]);
    }
    mesh.position.set(cx + (s.dx || 0), s.y0 + s.h / 2, cz + (s.dz || 0));
    scene.add(mesh);
    if (!mainMesh && !s.podium) mainMesh = mesh;
    top = { x: cx + (s.dx || 0), z: cz + (s.dz || 0), w: s.w, d: s.d, y: s.y0 + s.h };
  }
  colliders.push({ x: cx, z: cz, hw: w / 2, hd: d / 2, rot: 0 });
  const b = { x: cx, z: cz, w, d, h, mesh: mainMesh };
  if (top && top.w >= 7 && top.d >= 7 && h >= 12) addParapet(scene, top);
  if (opts.roof === 'gable' || opts.roof === 'sawtooth') addShedRoof(scene, cx, cz, w, d, h, opts.roof);
  if (opts.sign) {
    const s = opts.sign;
    const sign = makeSignMesh(s.text, s.style, s.w, s.h, s.vertical);
    const off = (s.face === 'n' || s.face === 's') ? d / 2 + 0.15 : w / 2 + 0.15;
    if (s.face === 'w') { sign.position.set(cx - off, s.y, cz + (s.along || 0)); sign.rotation.y = -Math.PI / 2; }
    if (s.face === 'e') { sign.position.set(cx + off, s.y, cz + (s.along || 0)); sign.rotation.y = Math.PI / 2; }
    if (s.face === 'n') { sign.position.set(cx + (s.along || 0), s.y, cz - off); sign.rotation.y = Math.PI; }
    if (s.face === 's') { sign.position.set(cx + (s.along || 0), s.y, cz + off); sign.rotation.y = 0; }
    scene.add(sign);
    b.sign = sign;
  }
  if (opts.awning) addAwning(scene, cx, cz, opts.awning.face, opts.awning.ci);
  if (opts.roofProps && top) {
    // Props sit on the TOP of the stack (tier roof, not the old full box).
    addRoofProps(scene, { x: top.x, z: top.z, w: top.w, d: top.d, h: top.y }, (cx * 7 + cz * 13) | 0);
  }
  return b;
}

const _lampPoleMat = new THREE.MeshLambertMaterial({ color: 0x232830 });
const _lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });

export function addLamp(scene, x, z) {
  const grp = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 5.6, 6), _lampPoleMat);
  pole.position.y = 2.8;
  grp.add(pole);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), _lampHeadMat);
  head.position.y = 5.7;
  grp.add(head);
  grp.position.set(x, 0, z);
  scene.add(grp);
  addGlowSprite(scene, x, 5.7, z, 3.4, 0xffc98a);
  addLightPool(scene, x, z, 5.2);
  props.push({ x, z, r: 0.35 });
  return grp;
}

const CANOPY_COLORS = [0xff4fa3, 0x3ecfe8, 0xf5a623, 0x2aa864, 0xff4438, 0xb678f0];

export function addStall(scene, x, z, rotY, ci) {
  const grp = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x6e5636 });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.0, 1.4), wood);
  counter.position.y = 0.5;
  grp.add(counter);
  for (const [px, pz] of [[-1.6, -0.8], [1.6, -0.8], [-1.6, 0.8], [1.6, 0.8]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5), wood);
    post.position.set(px, 1.3, pz);
    grp.add(post);
  }
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(3.9, 0.12, 2.3),
    new THREE.MeshLambertMaterial({ color: CANOPY_COLORS[ci % CANOPY_COLORS.length] })
  );
  canopy.position.y = 2.65;
  canopy.rotation.z = 0.06;
  grp.add(canopy);
  // Goods: little bright crates and jars on the counter.
  for (let i = 0; i < 4; i++) {
    const good = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.34, 0.42),
      new THREE.MeshLambertMaterial({ color: CANOPY_COLORS[(ci + i + 2) % CANOPY_COLORS.length] })
    );
    good.position.set(-1.2 + i * 0.8, 1.18, (i % 2 ? 0.25 : -0.25));
    grp.add(good);
  }
  // Bulb string under the canopy lip.
  for (let i = 0; i < 5; i++) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
    bulb.position.set(-1.6 + i * 0.8, 2.45, 1.05);
    grp.add(bulb);
  }
  grp.position.set(x, 0, z);
  grp.rotation.y = rotY;
  scene.add(grp);
  colliders.push({ x, z, hw: 1.8, hd: 1.1, rot: rotY });
  return grp;
}

const _crateMat = new THREE.MeshLambertMaterial({ color: 0x8a6b42 });
const _crateMat2 = new THREE.MeshLambertMaterial({ color: 0x5d6d7e });

export function addCrates(scene, x, z, n, seed) {
  const grp = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const s = 0.7 + hash2(seed, i * 3) * 0.5;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), i % 2 ? _crateMat : _crateMat2);
    crate.position.set((hash2(seed + i, 1) - 0.5) * 1.6, s / 2 + (i > 3 ? s * 0.9 : 0), (hash2(seed, i + 9) - 0.5) * 1.6);
    crate.rotation.y = hash2(seed + i, 5) * 0.8;
    grp.add(crate);
  }
  grp.position.set(x, 0, z);
  scene.add(grp);
  props.push({ x, z, r: 1.2 });
  return grp;
}

const _barrelMats = [0xb03a30, 0x2a6db0, 0x707880, 0x2aa864].map(
  (c) => new THREE.MeshLambertMaterial({ color: c }));

export function addBarrels(scene, x, z, n, seed) {
  const grp = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.95, 9), _barrelMats[i % 4]);
    b.position.set((hash2(seed + i, 2) - 0.5) * 1.5, 0.48, (hash2(seed, i + 4) - 0.5) * 1.5);
    grp.add(b);
  }
  grp.position.set(x, 0, z);
  scene.add(grp);
  props.push({ x, z, r: 1.0 });
  return grp;
}

export function addScooter(scene, x, z, rotY, color = 0x3ecfe8) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 1.7),
    new THREE.MeshLambertMaterial({ color }));
  body.position.y = 0.55;
  grp.add(body);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.8),
    new THREE.MeshLambertMaterial({ color: 0x17191d }));
  seat.position.set(0, 0.9, -0.25);
  grp.add(seat);
  const wheelG = new THREE.CylinderGeometry(0.26, 0.26, 0.12, 10);
  const wheelM = new THREE.MeshLambertMaterial({ color: 0x14161a });
  for (const wz of [0.72, -0.72]) {
    const w = new THREE.Mesh(wheelG, wheelM);
    w.rotation.z = Math.PI / 2;
    w.position.set(0, 0.26, wz);
    grp.add(w);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 5),
    new THREE.MeshLambertMaterial({ color: 0x9aa4ae }));
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 1.05, 0.78);
  grp.add(bar);
  grp.position.set(x, 0, z);
  grp.rotation.y = rotY;
  scene.add(grp);
  props.push({ x, z, r: 0.8 });
  return grp;
}

const CONTAINER_COLORS = [0xb03a30, 0x2a6db0, 0x2aa864, 0xd88f2a, 0x707880, 0x7a4a8c];

export function addContainer(scene, x, y, z, rotY, ci) {
  const geo = new THREE.BoxGeometry(6.1, 2.6, 2.44);
  const mat = new THREE.MeshLambertMaterial({ color: CONTAINER_COLORS[ci % CONTAINER_COLORS.length] });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y + 1.3, z);
  mesh.rotation.y = rotY;
  scene.add(mesh);
  // Corrugation ribs read as thin darker stripes.
  const ribMat = new THREE.MeshLambertMaterial({ color: 0x000000, transparent: true, opacity: 0.16 });
  for (let i = -2; i <= 2; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.5, 2.5), ribMat);
    rib.position.set(x + Math.cos(rotY) * i * 1.1, y + 1.3, z - Math.sin(rotY) * i * 1.1);
    rib.rotation.y = rotY;
    scene.add(rib);
  }
  if (y === 0) colliders.push({ x, z, hw: 3.05, hd: 1.22, rot: rotY });
  return mesh;
}

export function addAwning(scene, x, z, face, ci) {
  const mat = new THREE.MeshLambertMaterial({ color: CANOPY_COLORS[ci % CANOPY_COLORS.length] });
  const awn = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.1, 2.0), mat);
  const off = 8.2;
  if (face === 'w') { awn.position.set(x - off, 3.4, z); }
  if (face === 'e') { awn.position.set(x + off, 3.4, z); }
  if (face === 'n') { awn.position.set(x, 3.4, z - off); awn.rotation.y = Math.PI / 2; }
  if (face === 's') { awn.position.set(x, 3.4, z + off); awn.rotation.y = Math.PI / 2; }
  awn.rotation.x = 0.18;
  scene.add(awn);
  return awn;
}

const _bulkheadMat = new THREE.MeshLambertMaterial({ color: 0x2c333e });
const _acMat = new THREE.MeshLambertMaterial({ color: 0x39424e });
const _tankMat = new THREE.MeshLambertMaterial({ color: 0x4a4238 });
const _mastMat = new THREE.MeshLambertMaterial({ color: 0x232830 });

export function addRoofProps(scene, b, seed) {
  const r = mulberrySeed(seed);
  // A helipad crowns a couple of the tallest, widest roofs.
  if (b.h >= 36 && b.w >= 15 && b.d >= 15 && r() < 0.55) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.18, 18),
      new THREE.MeshLambertMaterial({ color: 0x14181f }));
    pad.position.set(b.x, b.h + 0.09, b.z);
    scene.add(pad);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.55, 2.95, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(b.x, b.h + 0.2, b.z);
    scene.add(ring);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 4.5, 5), _mastMat);
    mast.position.set(b.x + b.w / 2 - 1.6, b.h + 2.2, b.z - b.d / 2 + 1.6);
    scene.add(mast);
    return;
  }
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const kind = r();
    const px = b.x + (r() - 0.5) * Math.max(1, b.w - 3);
    const pz = b.z + (r() - 0.5) * Math.max(1, b.d - 3);
    if (kind < 0.3) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 8), _tankMat);
      tank.position.set(px, b.h + 1.1, pz);
      scene.add(tank);
    } else if (kind < 0.55) {
      // AC cluster: two or three squat units huddled together.
      const units = 2 + Math.floor(r() * 2);
      for (let u = 0; u < units; u++) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.1 + r() * 0.7, 0.8, 0.9 + r() * 0.5), _acMat);
        box.position.set(px + (r() - 0.5) * 1.8, b.h + 0.4, pz + (r() - 0.5) * 1.8);
        scene.add(box);
      }
    } else if (kind < 0.78) {
      // Stair bulkhead with a darker door slab.
      const bulk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 2.0), _bulkheadMat);
      bulk.position.set(px, b.h + 0.75, pz);
      scene.add(bulk);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.06),
        new THREE.MeshLambertMaterial({ color: 0x11151c }));
      door.position.set(px, b.h + 0.55, pz + 1.03);
      scene.add(door);
    } else {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 4.5, 5), _mastMat);
      mast.position.set(px, b.h + 2.2, pz);
      scene.add(mast);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xff4438 }));
      tip.position.set(px, b.h + 4.5, pz);
      scene.add(tip);
    }
  }
}

function mulberrySeed(seed) {
  let a = (seed * 2654435761) >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// String lights across a street: a sagging catenary with emissive bulbs.
export function addStringLights(scene, x0, z0, x1, z1, y = 6.8) {
  const pts = [];
  const bulbs = 9;
  const bulbGeo = new THREE.SphereGeometry(0.09, 6, 5);
  const bulbMats = [0xffd9a0, 0xff4fa3, 0x57d7e8, 0xf5a623].map(
    (c) => new THREE.MeshBasicMaterial({ color: c }));
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const sag = Math.sin(t * Math.PI) * 1.1;
    pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, y - sag, z0 + (z1 - z0) * t));
    if (i % 2 === 0 && i > 0 && i < 16) {
      const bulb = new THREE.Mesh(bulbGeo, bulbMats[(i / 2) % 4]);
      bulb.position.copy(pts[i]);
      bulb.position.y -= 0.16;
      scene.add(bulb);
    }
  }
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0x0c0e14 })
  );
  scene.add(line);
}

// ---------- City assembly ----------

function buildGroundAndRoads(scene) {
  // Water first: the whole world floats on the dark harbour.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400),
    new THREE.MeshLambertMaterial({ color: 0x0a1a2c })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(10, -0.35, 0);
  scene.add(water);

  const land = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.x1 - WORLD.x0, WORLD.z1 - WORLD.z0),
    new THREE.MeshLambertMaterial({ map: pavingTexture() })
  );
  land.material.map.repeat.set(60, 66);
  land.rotation.x = -Math.PI / 2;
  land.position.set((WORLD.x0 + WORLD.x1) / 2, 0, (WORLD.z0 + WORLD.z1) / 2);
  scene.add(land);

  const asphalt = asphaltTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: asphalt });
  for (const x of VX) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, WORLD.z1 - WORLD.z0), roadMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.02, (WORLD.z0 + WORLD.z1) / 2);
    scene.add(p);
  }
  for (const z of HZ) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.x1 - WORLD.x0, ROAD_W), roadMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set((WORLD.x0 + WORLD.x1) / 2, 0.021, z);
    scene.add(p);
  }
  // Centre dashes.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  const dashGeo = new THREE.PlaneGeometry(0.35, 3.2);
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, 700);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const one = new THREE.Vector3(1, 1, 1);
  let di = 0;
  for (const x of VX) {
    for (let z = WORLD.z0 + 8; z < WORLD.z1 - 6 && di < 700; z += 11) {
      if (HZ.some((hz) => Math.abs(z - hz) < 9)) continue;
      m4.compose(new THREE.Vector3(x, 0.035, z), q, one);
      dashes.setMatrixAt(di++, m4);
    }
  }
  for (const z of HZ) {
    for (let x = WORLD.x0 + 8; x < WORLD.x1 - 6 && di < 700; x += 11) {
      if (VX.some((vx) => Math.abs(x - vx) < 9)) continue;
      m4.compose(new THREE.Vector3(x, 0.036, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, Math.PI / 2)), one);
      dashes.setMatrixAt(di++, m4);
    }
  }
  dashes.count = di;
  scene.add(dashes);
  // Kerb glow strips along the boulevard: the Muelle's neon spine.
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xff4fa3 });
  for (const sx of [BOULEVARD_X - ROAD_W / 2 - 0.4, BOULEVARD_X + ROAD_W / 2 + 0.4]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.3, WORLD.z1 - WORLD.z0), stripMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(sx, 0.04, 0);
    scene.add(strip);
  }
}

// Parapet-sign vocabulary for the Muelle Neón mid blocks (rev 8).
const MUELLE_SIGNS = ['HOTEL', 'BAR NEPTUNE', 'CAFÉ NOCHE', 'TIENDA', 'MARISCOS', 'HOSTAL'];
const MUELLE_SIGN_STYLES = ['GENERIC', 'NEON', 'ORBITA', 'PUERTO', 'SIRENA'];

function buildBlocks(scene) {
  const r = mulberrySeed(777);
  for (let i = 0; i < VX.length - 1; i++) {
    for (let j = 0; j < HZ.length - 1; j++) {
      const bx0 = VX[i] + ROAD_W / 2 + 2.5, bx1 = VX[i + 1] - ROAD_W / 2 - 2.5;
      const bz0 = HZ[j] + ROAD_W / 2 + 2.5, bz1 = HZ[j + 1] - ROAD_W / 2 - 2.5;
      const bw = bx1 - bx0, bd = bz1 - bz0;
      if (bw < 14 || bd < 14) continue;
      const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
      const dist = districtAt(cx, cz);
      // The club block and the shipyard floor stay hand-dressed.
      if (Math.abs(cx - (-64 + 32)) < 40 && cz > -90 && cz < 10) continue;
      if (dist.name === 'El Astillero' && cx > 60) continue;
      if (dist.name === 'Isla Faro' && hash2(i, j) < 0.4) continue; // island park gaps
      const tower = dist.name === 'Alto Mirador' || dist.name === 'Mercado Nocturno';
      const split = r() < 0.4 ? 2 : 1;
      for (let sIdx = 0; sIdx < split; sIdx++) {
        const w = split === 2 ? bw / 2 - 2 : bw * (0.72 + r() * 0.2);
        const d = bd * (0.72 + r() * 0.2);
        const px = split === 2 ? bx0 + bw / 4 + sIdx * (bw / 2) : cx + (r() - 0.5) * 3;
        const pz = cz + (r() - 0.5) * 3;
        const hBase = tower ? 22 + r() * 30 : 11 + r() * 15;
        const bopts = {
          litRatio: 0.45 + r() * 0.2,
          roofProps: r() < 0.7,
          variant: Math.floor(r() * 6),
        };
        // District silhouettes (rev 8). All variation derives from the
        // per-position hash, NEVER from r(): the seeded stream above is
        // the layout, and it must produce the same slots as always.
        const hh = hash2(px * 1.31 + 7, pz * 0.97 - 3);
        let bw2 = w, bd2 = d, h = hBase;
        if (dist.name === 'Alto Mirador') {
          bw2 *= 0.82; bd2 *= 0.82; // slimmer towers in the same slots
          bopts.tiers = 2;
        } else if (dist.name === 'Mercado Nocturno') {
          bopts.tiers = hh < 0.6 ? 2 : 1;
          if (hh >= 0.72) bopts.podium = true;
        } else if (dist.name === 'El Astillero') {
          h = 6.5 + (hBase - 11) / 15 * 4.5; // low wide sheds, 6.5–11 m
          bopts.roof = hh < 0.5 ? 'gable' : 'sawtooth';
          bopts.litRatio = 0.3;
        } else if (dist.name === 'Muelle Neón') {
          if (hh < 0.45) {
            bopts.sign = {
              text: MUELLE_SIGNS[Math.floor(hash2(px, pz * 3) * MUELLE_SIGNS.length)],
              style: MUELLE_SIGN_STYLES[Math.floor(hash2(px * 3, pz) * MUELLE_SIGN_STYLES.length)],
              w: 9, h: 2.2, face: 'w', y: Math.min(10.5, hBase - 3),
            };
          } else if (hh < 0.65) bopts.lPlan = true;
          else if (hh < 0.85) bopts.podium = true;
        } else if (dist.name === 'La Franja') {
          bopts.tiers = hh < 0.45 ? 1 : 0;
          if (hh >= 0.52 && hh < 0.68) bopts.lPlan = true;
          if (hh >= 0.72 && hh < 0.9) bopts.podium = true;
        }
        addBuilding(scene, px, pz, bw2, bd2, h, bopts);
      }
    }
  }
}

// Palms for the Muelle: painted-frond crowns on curved trunks.
const _frondTex = (() => null)();
let _frondTexture = null;
function frondTexture() {
  if (_frondTexture) return _frondTexture;
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = '#2e7d4f';
  g.lineWidth = 5;
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    g.beginPath();
    g.moveTo(64, 64);
    g.quadraticCurveTo(
      64 + Math.cos(a) * 34, 64 + Math.sin(a) * 30 - 8,
      64 + Math.cos(a) * 58, 64 + Math.sin(a) * 46 + 14);
    g.stroke();
  }
  g.strokeStyle = '#3f9e63';
  g.lineWidth = 2.5;
  for (let i = 0; i < 9; i++) {
    const a = ((i + 0.5) / 9) * Math.PI * 2;
    g.beginPath();
    g.moveTo(64, 64);
    g.quadraticCurveTo(
      64 + Math.cos(a) * 30, 64 + Math.sin(a) * 26 - 6,
      64 + Math.cos(a) * 50, 64 + Math.sin(a) * 40 + 10);
    g.stroke();
  }
  _frondTexture = new THREE.CanvasTexture(cv);
  return _frondTexture;
}

const _trunkMat = new THREE.MeshLambertMaterial({ color: 0x6e5636 });

export function addPalm(scene, x, z, lean = 0) {
  const grp = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, 7.5, 6), _trunkMat);
  trunk.position.y = 3.75;
  trunk.rotation.z = lean;
  grp.add(trunk);
  const crownMat = new THREE.MeshBasicMaterial({
    map: frondTexture(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
  });
  for (const ry of [0, Math.PI / 2]) {
    const crown = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4), crownMat);
    crown.position.set(Math.sin(lean) * -3.4, 7.7, 0);
    crown.rotation.x = -Math.PI / 2 + 0.25;
    crown.rotation.z = ry;
    grp.add(crown);
  }
  grp.position.set(x, 0, z);
  scene.add(grp);
  props.push({ x, z, r: 0.45 });
  return grp;
}

// The hand-dressed cover street: Club Sirena's block on the x=-64 road.
// Both flanks are built here so the market strip reads from any angle.
function buildMarketStrip(scene) {
  const zs = [-72, -56, -40, -24, -8];
  const heights = [15, 18, 16, 20, 14];
  zs.forEach((z, i) => {
    // Same heights and footprints as always; alternating setbacks and a
    // podium under the club row give the cover street its relief (rev 8).
    addBuilding(scene, -79.5, z, 13, 13.5, heights[i], { litRatio: 0.6, roofProps: true, variant: i, tiers: i % 2 === 0 ? 1 : 0 });
    addBuilding(scene, -48.5, z, 13, 13.5, heights[(i + 2) % 5], { litRatio: 0.6, roofProps: true, variant: i + 2, tiers: i % 2 === 1 ? 1 : 0, podium: i === 2 });
  });
  // Signs: SIRENA over the club door (east flank, faces the street).
  const sirena = makeSignMesh('SIRENA', 'SIRENA', 17, 3.4);
  sirena.position.set(-55.4, 7.2, -40);
  sirena.rotation.y = -Math.PI / 2;
  scene.add(sirena);
  addGlowSprite(scene, -56.5, 7.2, -40, 15, 0xff4fa3);
  // NEÓN on the SOUTH face of the west z=-56 building: a face the cover
  // camera actually sees, inside its frustum (the z=-40 face lands just
  // off the left edge; the flank's east faces are edge-on).
  const neon = makeSignMesh('NEÓN', 'NEON', 12, 3);
  neon.position.set(-79.5, 6.2, -49.1);
  neon.rotation.y = 0;
  scene.add(neon);
  const orbita = makeSignMesh('BAR ÓRBITA', 'ORBITA', 12, 2.6);
  orbita.position.set(-72.4, 6.4, -58);
  orbita.rotation.y = Math.PI / 2;
  scene.add(orbita);
  // HOTEL LUNA: a tall vertical sign on the NEAR east building so the
  // letters stay legible from the cover camera.
  const luna = makeSignMesh('LUNA', 'LUNA', 3.2, 13, true);
  luna.position.set(-55.4, 10, -45.5);
  luna.rotation.y = -Math.PI / 2;
  scene.add(luna);
  addGlowSprite(scene, -56.4, 9.5, -22, 10, 0x9fd4ff);
  // Stall row down the west sidewalk, tightened so it reads as one row.
  const stallZ = [-19, -27, -35, -43, -51, -59];
  stallZ.forEach((z, i) => addStall(scene, -71.6, z, Math.PI / 2, i));
  // Two stalls on the east sidewalk facing the club crowd.
  addStall(scene, -56.6, -33, -Math.PI / 2, 3);
  addStall(scene, -56.6, -49, -Math.PI / 2, 5);
  // String lights sagging across the street.
  for (const z of [-21, -33, -45, -57]) addStringLights(scene, -72.5, z, -55.5, z, 6.9);
  // Kerb dressing: crates, barrels, a scooter by the club.
  addCrates(scene, -70.8, -22.5, 4, 21);
  addBarrels(scene, -57.6, -44, 3, 33);
  addScooter(scene, -57.2, -29, Math.PI / 2, 0xff4fa3);
  addCrates(scene, -57.4, -53, 3, 47);
  // Warm pools under the club frontage.
  addLightPool(scene, -58, -40, 7, 'rgba(255,79,163,0.5)');
  addLightPool(scene, -64, -26, 6, 'rgba(255,205,130,0.5)');
}

function buildShipyard(scene) {
  const r = mulberrySeed(4242);
  // Container field across El Astillero's working floor.
  for (let i = 0; i < 46; i++) {
    const x = 84 + r() * 210;
    const z = 232 + r() * 88;
    if (Math.abs(x - 190) < 16 && Math.abs(z - 285) < 16) continue; // combat yard stays staged
    const rot = r() < 0.5 ? 0 : Math.PI / 2;
    addContainer(scene, x, 0, z, rot, Math.floor(r() * 6));
    if (r() < 0.4) addContainer(scene, x, 2.6, z, rot, Math.floor(r() * 6));
  }
  addCrates(scene, 120, 250, 6, 61);
  addBarrels(scene, 250, 300, 5, 71);
  addCrates(scene, 265, 245, 4, 83);
  // Gantry crane silhouettes.
  const craneMat = new THREE.MeshLambertMaterial({ color: 0x2c3542 });
  for (const cx of [130, 235]) {
    for (const lx of [-16, 16]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 26, 1.4), craneMat);
      leg.position.set(cx + lx, 13, 268);
      scene.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(38, 1.6, 1.6), craneMat);
    beam.position.set(cx, 26, 268);
    scene.add(beam);
    addGlowSprite(scene, cx, 24, 268, 5, 0xff4438);
  }
}

function buildLandmarks(scene) {
  // El Faro lighthouse on Isla Faro's point.
  const lh = PLACES.lighthouse;
  const towerMat = new THREE.MeshLambertMaterial({ color: 0xd8dee8 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.1, 17, 10), towerMat);
  tower.position.set(lh.x, 8.5, lh.z);
  scene.add(tower);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.7, 3.4, 10),
    new THREE.MeshLambertMaterial({ color: 0xd84a30 }));
  band.position.set(lh.x, 10.5, lh.z);
  scene.add(band);
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.4, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
  lampRoom.position.set(lh.x, 18.2, lh.z);
  scene.add(lampRoom);
  addGlowSprite(scene, lh.x, 18.2, lh.z, 16, 0xffe9a8);
  colliders.push({ x: lh.x, z: lh.z, hw: 3, hd: 3, rot: 0 });
  // Marina docks: plank fingers into the harbour.
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x54432e });
  for (let i = 0; i < 4; i++) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(26, 0.5, 3.4), dockMat);
    dock.position.set(-282, 0.25, 30 + i * 18);
    scene.add(dock);
    addLamp(scene, -272, 30 + i * 18);
  }
  // Casino Faro's marquee on the boulevard.
  const casino = makeSignMesh('CASINO FARO', 'CASINO', 20, 3.6);
  casino.position.set(-216, 8.5, -160);
  casino.rotation.y = Math.PI / 2;
  scene.add(casino);
  // District gateways on the boulevard entries.
  const gate1 = makeSignMesh('MUELLE NEÓN', 'SIRENA', 15, 2.8);
  gate1.position.set(-224, 7.5, -96);
  gate1.rotation.y = Math.PI / 2;
  scene.add(gate1);
  const gate2 = makeSignMesh('PUERTO', 'PUERTO', 13, 2.8);
  gate2.position.set(52, 7.5, 224);
  scene.add(gate2);
}

export function initCity(scene) {
  colliders.length = 0;
  props.length = 0;
  _grid = null; // the broadphase must rebuild over the fresh registries
  buildGroundAndRoads(scene);
  buildBlocks(scene);
  buildMarketStrip(scene);
  buildShipyard(scene);
  buildLandmarks(scene);
  // Intersection lamps on corner kerbs (two diagonal corners each).
  for (const x of VX) {
    for (const z of HZ) {
      if (hash2(x, z) < 0.25) continue;
      addLamp(scene, x - ROAD_W / 2 - 1.2, z - ROAD_W / 2 - 1.2);
      addLamp(scene, x + ROAD_W / 2 + 1.2, z + ROAD_W / 2 + 1.2);
    }
  }
  // Palms parade down the Muelle waterfront.
  for (let z = -320; z <= 330; z += 34) {
    addPalm(scene, BOULEVARD_X - ROAD_W / 2 - 2.6, z + hash2(z, 1) * 6, 0.05);
    if (hash2(z, 7) < 0.6) addPalm(scene, BOULEVARD_X + ROAD_W / 2 + 2.6, z + 14, -0.04);
  }
  return { colliders, props };
}
