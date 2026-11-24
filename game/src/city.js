// city.js — Bahía Noche itself: road grid, painted ground, facades with lit
// windows, neon signs, palms, lamps with light pools, the container yard,
// the lighthouse, the road graph + Dijkstra used by the minimap route.
// Everything is painted/procedural — no external assets, works offline.

const ROADS_X = [-212, -160, -104, -48, 8, 64, 120, 176, 232, 288];
const ROADS_Z = [-290, -234, -178, -122, -66, -10, 46, 102, 158, 214, 270];
const ROAD_W = 14;
const BOULEVARD_X = -212;

const DISTRICTS = [
  { name: 'Isla Faro', minX: -252, maxX: -205, minZ: -340, maxZ: -245 },
  { name: 'Muelle Neón', minX: -252, maxX: -160, minZ: -245, maxZ: 120 },
  { name: 'La Franja', minX: -160, maxX: -20, minZ: -340, maxZ: 120 },
  { name: 'Mercado Nocturno', minX: -20, maxX: 300, minZ: -340, maxZ: -130 },
  { name: 'Alto Mirador', minX: -20, maxX: 300, minZ: -130, maxZ: 120 },
  { name: 'El Astillero', minX: -252, maxX: 300, minZ: 120, maxZ: 340 },
];

const PLACES = {
  sirena: { x: -96, z: -16, label: 'Club Sirena' },
  volt: { x: -108, z: -15, label: 'Volt' },
  garage: { x: -186, z: 158, label: 'Garage' },
  pdp: { x: 64, z: -66, label: 'PDP station' },
  hospital: { x: 176, z: 46, label: 'Hospital' },
  lighthouse: { x: -238, z: -300, label: 'Lighthouse' },
  marinaGate: { x: -212, z: 270, label: 'Marina gate' },
  marina: { x: -238, z: 214, label: 'Marina docks' },
  raceStart: { x: -212, z: -178, label: 'Race start' },
  mercado: { x: 232, z: -234, label: 'Mercado' },
  containerYard: { x: 150, z: 240, label: 'Container yard' },
  cranes: { x: 40, z: 250, label: 'Cranes' },
};

const NIGHT_BASE = [0x2e3a52, 0x3a2e4a, 0x27313f, 0x40364a, 0x2a4048, 0x4a3040, 0x35424e];
const NIGHT_TOWER = [0x39465c, 0x2f3a4e, 0x46536a];
const AWNING_COLORS = [0xff4fa3, 0x57d7e8, 0xffb340, 0x7dff6a, 0xff7847, 0xb98cff];
const NEON_SIGNS = [
  { text: 'SIRENA', bg: '#160a24', letters: '#ff4fa3', accent: '#57d7e8' },
  { text: 'HOTEL LUNA', bg: '#0a1428', letters: '#9fe8ff', accent: '#ffb340' },
  { text: 'BAR ÓRBITA', bg: '#14061f', letters: '#b98cff', accent: '#ff4fa3' },
  { text: 'NEÓN', bg: '#06181c', letters: '#57d7e8', accent: '#ff7847' },
  { text: 'PUERTO', bg: '#1c0a10', letters: '#ff7847', accent: '#57d7e8' },
  { text: 'CASINO FARO', bg: '#101a08', letters: '#ffd76e', accent: '#ff4fa3' },
];
const GATEWAY_SIGNS = [
  { text: 'MUELLE NEÓN', bg: '#160a24', letters: '#ff4fa3', accent: '#57d7e8' },
  { text: 'LA FRANJA', bg: '#06181c', letters: '#57d7e8', accent: '#ffb340' },
  { text: 'MERCADO NOCTURNO', bg: '#1c1005', letters: '#ffb340', accent: '#ff4fa3' },
  { text: 'EL ASTILLERO', bg: '#0a1c0e', letters: '#7dff6a', accent: '#57d7e8' },
  { text: 'ISLA FARO', bg: '#14061f', letters: '#b98cff', accent: '#ffd76e' },
  { text: 'ALTO MIRADOR', bg: '#1c0a10', letters: '#ff8f8f', accent: '#57d7e8' },
];

// ---------- painted ground textures ----------
function asphaltTexture() {
  const c = makeCanvas(256, 256, (g) => {
    g.fillStyle = '#23262c'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { // aggregate speckle
      const v = randi(18, 58);
      g.fillStyle = `rgb(${v},${v + 3},${v + 9})`;
      g.fillRect(rng() * 256, rng() * 256, 1.6, 1.6);
    }
    g.strokeStyle = 'rgba(8,9,12,0.55)'; g.lineWidth = 1.2; // cracks
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      let x = rng() * 256, y = rng() * 256;
      g.moveTo(x, y);
      for (let s = 0; s < 5; s++) { x += rand(-26, 26); y += rand(-26, 26); g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = 'rgba(10,10,14,0.35)'; // tar seams
    for (let i = 0; i < 4; i++) g.fillRect(rng() * 256, 0, rand(2, 5), 256);
    // neon reflection streaks — the wet-night signature
    const cols = ['87,215,232', '255,79,163', '255,179,64', '185,140,255'];
    for (let i = 0; i < 12; i++) {
      const x = rng() * 256, w = rand(3, 9), col = pick(cols);
      const gr = g.createLinearGradient(x, 0, x + w, 0);
      gr.addColorStop(0, `rgba(${col},0)`);
      gr.addColorStop(0.5, `rgba(${col},${rand(0.05, 0.14)})`);
      gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr;
      g.fillRect(x, rng() * 200, w, rand(60, 256));
    }
    // lamp pool ellipses baked faintly into the street
    for (let i = 0; i < 3; i++) {
      const x = rng() * 256, y = rng() * 256;
      const gr = g.createRadialGradient(x, y, 2, x, y, rand(26, 44));
      gr.addColorStop(0, 'rgba(255,214,150,0.10)');
      gr.addColorStop(1, 'rgba(255,214,150,0)');
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(x, y, 44, 26, 0, 0, Math.PI * 2); g.fill();
    }
  });
  return texFromCanvas(c, true);
}
function pavingTexture() {
  const c = makeCanvas(256, 256, (g) => {
    g.fillStyle = '#39404e'; g.fillRect(0, 0, 256, 256); // grout
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const v = randi(-8, 8);
      g.fillStyle = `rgb(${52 + v},${60 + v},${76 + v})`;
      g.fillRect(sx * 64 + 2, sy * 64 + 2, 60, 60);
      for (let i = 0; i < 26; i++) {
        g.fillStyle = `rgba(160,180,210,${rand(0.04, 0.12)})`;
        g.fillRect(sx * 64 + 2 + rng() * 58, sy * 64 + 2 + rng() * 58, 2, 2);
      }
    }
    for (let i = 0; i < 7; i++) { // stains
      const x = rng() * 256, y = rng() * 256, r = rand(18, 40);
      const gr = g.createRadialGradient(x, y, 1, x, y, r);
      gr.addColorStop(0, `rgba(6,8,14,${rand(0.10, 0.18)})`);
      gr.addColorStop(1, 'rgba(6,8,14,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    // wet sheen streaks
    for (let i = 0; i < 8; i++) {
      g.fillStyle = `rgba(140,200,235,${rand(0.03, 0.08)})`;
      g.fillRect(rng() * 256, rng() * 256, rand(2, 5), rand(30, 90));
    }
  });
  return texFromCanvas(c, true);
}
function sandTexture() {
  const c = makeCanvas(256, 256, (g) => {
    g.fillStyle = '#4a4234'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2000; i++) {
      const v = randi(52, 96);
      g.fillStyle = `rgb(${v},${v - 6},${v - 22})`;
      g.fillRect(rng() * 256, rng() * 256, 1.5, 1.5);
    }
    g.strokeStyle = 'rgba(30,26,18,0.25)';
    for (let i = 0; i < 10; i++) {
      g.beginPath();
      g.arc(rng() * 256, rng() * 256, rand(14, 40), 0.2, 2.4);
      g.stroke();
    }
  });
  return texFromCanvas(c, true);
}

// ---------- painted facades (night: ~45% of windows lit) ----------
function facadeTexture(baseColor, opts) {
  opts = opts || {};
  const base = '#' + baseColor.toString(16).padStart(6, '0');
  const c = makeCanvas(256, 256, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 7; i++) { // grime
      g.fillStyle = `rgba(10,8,16,${0.03 + rng() * 0.05})`;
      g.fillRect(rng() * 200, rng() * 200, 30 + rng() * 60, 20 + rng() * 50);
    }
    const litWarm = ['#ffd9a0', '#ffc98a', '#ffe9c4'];
    const litCool = ['#9fe8ff', '#b8f4ff', '#7ad7e8'];
    for (let f = 0; f < 4; f++) {
      const y = f * 64;
      if (f === 3) { // ground floor
        if (opts.shop) {
          g.fillStyle = '#5a6673'; g.fillRect(0, y, 256, 14);
          for (let x = 10; x < 230; x += 58) { // storefronts, bright panes
            g.fillStyle = '#0d2733'; g.fillRect(x, y + 14, 48, 40);
            g.fillStyle = chance(0.75) ? pick(litWarm) : pick(litCool);
            g.globalAlpha = 0.92;
            g.fillRect(x + 4, y + 18, 18, 32);
            g.fillRect(x + 26, y + 18, 18, 32);
            g.globalAlpha = 1;
          }
          g.fillStyle = '#3a2c20'; g.fillRect(118, y + 12, 24, 44);
        } else {
          g.fillStyle = '#241a14'; g.fillRect(112, y + 8, 30, 48);
          g.fillStyle = 'rgba(255,217,160,0.85)'; g.fillRect(122, y + 16, 10, 14);
          for (let x = 14; x < 230; x += 52) {
            g.fillStyle = chance(0.45) ? pick(litWarm) : '#10141f';
            g.fillRect(x, y + 14, 22, 30);
          }
        }
      } else {
        for (let x = 12; x < 232; x += 34) { // upper windows
          const lit = chance(0.45);
          g.fillStyle = lit ? (chance(0.6) ? pick(litWarm) : pick(litCool)) : '#0d1120';
          g.fillRect(x, y + 14, 20, 30);
          if (lit && chance(0.4)) { // blind slats over a lit pane
            g.fillStyle = 'rgba(10,10,16,0.45)';
            for (let s = 0; s < 3; s++) g.fillRect(x, y + 18 + s * 9, 20, 3);
          }
          if (chance(0.3)) { // shutters
            g.fillStyle = 'rgba(8,10,16,0.6)';
            g.fillRect(x - 5, y + 14, 4, 30); g.fillRect(x + 21, y + 14, 4, 30);
          }
          if (chance(0.18)) { // AC box
            g.fillStyle = '#6a7482'; g.fillRect(x + 2, y + 46, 14, 9);
          }
        }
      }
    }
  });
  const t = texFromCanvas(c, false);
  return t;
}
function signTexture(sign, w) {
  const c = makeCanvas(w || 1024, 160, (g, cw, ch) => {
    g.fillStyle = sign.bg; g.fillRect(0, 0, cw, ch);
    g.strokeStyle = sign.accent; g.lineWidth = 7;
    g.strokeRect(9, 9, cw - 18, ch - 18);
    g.font = `bold ${sign.text.length > 10 ? 74 : 96}px Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = sign.letters; g.shadowBlur = 26;
    g.fillStyle = sign.letters;
    g.fillText(sign.text, cw / 2, ch / 2 + 4);
    g.shadowBlur = 10;
    g.fillText(sign.text, cw / 2, ch / 2 + 4);
  });
  return texFromCanvas(c, false);
}
function makeSignMesh(sign, wMeters, hMeters) {
  const grp = new THREE.Group();
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(wMeters + 0.24, hMeters + 0.24, 0.18),
    new THREE.MeshLambertMaterial({ color: 0x14161c }));
  grp.add(back);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(wMeters, hMeters),
    new THREE.MeshBasicMaterial({ map: signTexture(sign, wMeters > 12 ? 1216 : 1024) }));
  face.position.z = 0.1;
  grp.add(face);
  const rear = face.clone();
  rear.rotation.y = Math.PI; rear.position.z = -0.1;
  grp.add(rear);
  return grp;
}

// ---------- geometry helpers ----------
function box(w, h, d, color, x, y, z, opts) {
  opts = opts || {};
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    opts.mat || new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  m.castShadow = !!opts.shadow; m.receiveShadow = true;
  return m;
}
function groundPlane(w, d, mat, x, z, y) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y || 0, z);
  m.receiveShadow = true;
  return m;
}

// ---------- the build ----------
function buildCity(scene) {
  srand(20211);
  const city = { buildings: [], districts: DISTRICTS, graph: null, lamps: [], palms: [] };
  const asphalt = asphaltTexture();
  const paving = pavingTexture();
  const sand = sandTexture();

  // sea + land base
  const seaMat = new THREE.MeshPhongMaterial({ color: 0x0d2f4a, shininess: 90, specular: 0x99ccee });
  scene.add(groundPlane(1400, 1400, seaMat, 10, 0, -0.25));
  const landMat = new THREE.MeshLambertMaterial({ map: paving });
  landMat.map.repeat.set(60, 74);
  scene.add(groundPlane(LAND.maxX - LAND.minX, LAND.maxZ - LAND.minZ, landMat,
    (LAND.minX + LAND.maxX) / 2, (LAND.minZ + LAND.maxZ) / 2, -0.02));
  // quay / sand strip along the west waterfront
  const quayMat = new THREE.MeshLambertMaterial({ map: sand });
  quayMat.map.repeat.set(2, 50);
  scene.add(groundPlane(24, LAND.maxZ - LAND.minZ, quayMat, -240, 0, 0.0));

  // roads: asphalt strips with centre dashes
  const roadMat = new THREE.MeshLambertMaterial({ map: asphalt });
  roadMat.map.repeat.set(1, 40);
  const roadMatH = new THREE.MeshLambertMaterial({ map: asphaltTexture() });
  roadMatH.map.repeat.set(40, 1);
  for (const x of ROADS_X) {
    scene.add(groundPlane(ROAD_W, LAND.maxZ - LAND.minZ, roadMat, x, 0, 0.02));
  }
  for (const z of ROADS_Z) {
    scene.add(groundPlane(LAND.maxX - LAND.minX, ROAD_W, roadMatH, (LAND.minX + LAND.maxX) / 2, z, 0.03));
  }
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  const dashGeo = new THREE.BoxGeometry(0.28, 0.04, 3);
  const dashCount = ROADS_X.length * 60 + ROADS_Z.length * 62;
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
  const mtx = new THREE.Matrix4();
  let di = 0;
  for (const x of ROADS_X) for (let z = LAND.minZ + 6; z < LAND.maxZ - 4 && di < dashCount; z += 11) {
    mtx.setPosition(x, 0.06, z); dashes.setMatrixAt(di++, mtx);
  }
  for (const z of ROADS_Z) for (let x = LAND.minX + 6; x < LAND.maxX - 4 && di < dashCount; x += 11) {
    mtx.makeRotationY(Math.PI / 2); mtx.setPosition(x, 0.06, z); dashes.setMatrixAt(di++, mtx);
  }
  dashes.count = di;
  scene.add(dashes);
  // kerbs along the boulevard
  const kerbMat = new THREE.MeshLambertMaterial({ color: 0x8a2f3a });
  for (let z = LAND.minZ; z < LAND.maxZ; z += 24) {
    scene.add(box(0.7, 0.22, 22, 0, BOULEVARD_X - 8.2, 0.11, z + 11, { mat: kerbMat }));
    scene.add(box(0.7, 0.22, 22, 0, BOULEVARD_X + 8.2, 0.11, z + 11, { mat: kerbMat }));
  }

  buildBuildings(scene, city);
  buildWaterfront(scene, city);
  buildAstillero(scene, city);
  buildLighthouse(scene, city);
  city.graph = buildRoadGraph();
  G.city = city;
  return city;
}

function buildBuildings(scene, city) {
  const facadeCache = {};
  function facadeFor(color, shop) {
    const key = color + (shop ? 's' : '');
    if (!facadeCache[key]) facadeCache[key] = facadeTexture(color, { shop });
    return facadeCache[key];
  }
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x1c222c });
  const trimMat = new THREE.MeshLambertMaterial({ color: 0x9aa4b4 });

  function addBuilding(cx, cz, w, d, h, face, opts) {
    opts = opts || {};
    const tower = h > 17;
    const color = opts.color || (tower ? pick(NIGHT_TOWER) : pick(NIGHT_BASE));
    const shop = opts.shop !== undefined ? opts.shop : (h < 15 && chance(0.6));
    const tex = facadeFor(color, shop);
    const mats = [];
    // per-face UV: facade texture on the sides, roof on top
    const side = new THREE.MeshLambertMaterial({ map: tex, color: 0xbfc8dd });
    for (let i = 0; i < 4; i++) mats.push(side);
    mats.push(roofMat, roofMat);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    // widen the texture repeat on tall faces via geometry UV scale
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    // cornice trim
    scene.add(box(w + 0.5, 0.3, d + 0.5, 0, cx, h + 0.1, cz, { mat: trimMat }));
    // awning on the shop front
    let balconies = [];
    if (shop) {
      const awn = box(Math.min(w, d) * 0.7, 0.12, 1.6, pick(AWNING_COLORS), 0, 3.1, 0);
      if (face === 'W') { awn.position.set(cx - w / 2 - 0.7, 3.1, cz); }
      else if (face === 'E') { awn.position.set(cx + w / 2 + 0.7, 3.1, cz); }
      else if (face === 'N') { awn.position.set(cx, 3.1, cz - d / 2 - 0.7); awn.rotation.y = Math.PI / 2; }
      else { awn.position.set(cx, 3.1, cz + d / 2 + 0.7); awn.rotation.y = Math.PI / 2; }
      scene.add(awn);
    } else if (h >= 9) { // balconies on the front face
      for (const by of [3.1, 4.3, 7.5]) {
        if (by < h - 1.5) balconies.push({ y: by, off: (rng() - 0.5) * (Math.min(w, d) - 3) });
      }
      for (const b of balconies) {
        const slab = box(2.6, 0.14, 0.9, 0x2c3442, 0, b.y, 0);
        if (face === 'S') slab.position.set(cx + b.off, b.y, cz + d / 2 + 0.45);
        else if (face === 'N') slab.position.set(cx + b.off, b.y, cz - d / 2 - 0.45);
        else if (face === 'W') { slab.position.set(cx - w / 2 - 0.45, b.y, cz + b.off); slab.rotation.y = Math.PI / 2; }
        else { slab.position.set(cx + w / 2 + 0.45, b.y, cz + b.off); slab.rotation.y = Math.PI / 2; }
        scene.add(slab);
      }
    }
    const rec = { x: cx, z: cz, w, d, h, face, balconies, color };
    city.buildings.push(rec);
    return rec;
  }

  // named buildings first (generic fill keeps off their plots)
  const named = [];
  function namedPlot(x, z, r) { named.push({ x, z, r }); }
  // Club Sirena — magenta-fronted, fronts the x=-104 road facing west
  const sirena = addBuilding(-96, -16, 15, 15, 12, 'W', { color: 0x4a2440, shop: true });
  namedPlot(-96, -16, 13);
  const sirenaSign = makeSignMesh(NEON_SIGNS[0], 13, 1.9);
  sirenaSign.position.set(-104.4, 8.6, -16);
  sirenaSign.rotation.y = -Math.PI / 2;
  scene.add(sirenaSign);
  // PDP station — blue lit block at its corner
  addBuilding(72, -74, 16, 13, 11, 'S', { color: 0x2c4460, shop: false });
  namedPlot(72, -74, 13);
  const pdpSign = makeSignMesh({ text: 'POLICÍA DEL PUERTO', bg: '#081426', letters: '#9fe8ff', accent: '#ffd76e' }, 11, 1.5);
  pdpSign.position.set(72, 8.2, -67.2);
  scene.add(pdpSign);
  // hospital — pale block, lit cross
  addBuilding(184, 38, 17, 14, 13, 'W', { color: 0x51606e, shop: false });
  namedPlot(184, 38, 14);
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xff5a5a });
  scene.add(box(0.3, 2.6, 0.9, 0, 175.2, 10.4, 38, { mat: crossMat }));
  scene.add(box(0.3, 0.9, 2.6, 0, 175.2, 10.4, 38, { mat: crossMat }));
  // garage in Muelle
  addBuilding(-186, 150, 18, 14, 7, 'E', { color: 0x54432c, shop: true });
  namedPlot(-186, 150, 14);
  const garSign = makeSignMesh({ text: 'TALLER NOCHE', bg: '#140f04', letters: '#ffb340', accent: '#57d7e8' }, 10, 1.4);
  garSign.position.set(-176.6, 5.6, 150);
  garSign.rotation.y = Math.PI / 2;
  scene.add(garSign);

  // generic fill: one or two buildings per block, fronting a road
  for (let i = 0; i < ROADS_X.length - 1; i++) {
    for (let j = 0; j < ROADS_Z.length - 1; j++) {
      const x0 = ROADS_X[i] + ROAD_W / 2, x1 = ROADS_X[i + 1] - ROAD_W / 2;
      const z0 = ROADS_Z[j] + ROAD_W / 2, z1 = ROADS_Z[j + 1] - ROAD_W / 2;
      const bw = x1 - x0, bd = z1 - z0;
      if (bw < 18 || bd < 18) continue;
      // skip the container yard, the marina, the lighthouse point, plazas
      const cxm = (x0 + x1) / 2, czm = (z0 + z1) / 2;
      if (cxm > 96 && cxm < 210 && czm > 190 && czm < 300) continue;
      if (cxm < -195 && czm > 150) continue;
      if (cxm < -200 && czm < -240) continue;
      if (named.some(n => Math.abs(n.x - cxm) < n.r + bw / 2 && Math.abs(n.z - czm) < n.r + bd / 2)) continue;
      if (chance(0.14)) { // plaza: green + stalls, no building
        scene.add(groundPlane(bw - 6, bd - 6, new THREE.MeshLambertMaterial({ color: 0x0d3820 }), cxm, czm, 0.04));
        addStalls(scene, cxm, czm, 3);
        continue;
      }
      const two = bw > 40 && chance(0.6);
      const n = two ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const w = two ? bw / 2 - rand(6, 10) : bw - rand(6, 12);
        const d = bd - rand(6, 12);
        const cx = two ? x0 + (k + 0.5) * (bw / 2) : cxm;
        const inFranja = cx > -160 && cx < -20 && czm > -130 && czm < 70;
        const inMercado = czm < -130 && cx > -20;
        const towerBias = (cx > 60 && czm < 60 && czm > -190) ? 0.5 : 0.16;
        const h = chance(towerBias) ? rand(18, 30) : rand(7, 16);
        const face = chance(0.5) ? 'W' : 'S';
        const rec = addBuilding(cx, czm, w, d, h, face, {});
        // neon signs on La Franja + Mercado fronts
        if ((inFranja || inMercado) && chance(0.55)) {
          const s = pick(NEON_SIGNS);
          const sm = makeSignMesh(s, Math.min(w * 0.8, 13), 1.6);
          if (face === 'W') { sm.position.set(cx - w / 2 - 0.35, h - rand(1.8, 3), czm); sm.rotation.y = -Math.PI / 2; }
          else { sm.position.set(cx, h - rand(1.8, 3), czm + d / 2 + 0.35); }
          scene.add(sm);
        }
        // rooftop water tank / AC clutter on towers
        if (h > 17 && chance(0.6)) {
          scene.add(box(rand(1.6, 2.6), rand(1, 1.8), rand(1.6, 2.6), 0x232a36,
            cx + rand(-w / 4, w / 4), h + 0.8, czm + rand(-d / 4, d / 4)));
        }
      }
    }
  }
  // district gateway signs over their entry roads
  const gateways = [
    { s: GATEWAY_SIGNS[0], x: BOULEVARD_X, z: -178, ry: 0 },
    { s: GATEWAY_SIGNS[1], x: -104, z: 46, ry: Math.PI / 2 },
    { s: GATEWAY_SIGNS[2], x: 120, z: -178, ry: Math.PI / 2 },
    { s: GATEWAY_SIGNS[3], x: 64, z: 158, ry: Math.PI / 2 },
    { s: GATEWAY_SIGNS[4], x: BOULEVARD_X, z: -290, ry: 0 },
    { s: GATEWAY_SIGNS[5], x: 232, z: -10, ry: Math.PI / 2 },
  ];
  for (const gw of gateways) {
    const sm = makeSignMesh(gw.s, 11, 1.6);
    sm.position.set(gw.x, 6.4, gw.z);
    sm.rotation.y = gw.ry + Math.PI / 2;
    scene.add(sm);
    scene.add(box(0.22, 6.4, 0.22, 0x3c4248, gw.x - (gw.ry ? 0 : 5.6), 3.2, gw.z - (gw.ry ? 5.6 : 0)));
    scene.add(box(0.22, 6.4, 0.22, 0x3c4248, gw.x + (gw.ry ? 0 : 5.6), 3.2, gw.z + (gw.ry ? 5.6 : 0)));
  }
}
function addStalls(scene, cx, cz, n) {
  for (let i = 0; i < n; i++) {
    const x = cx + rand(-9, 9), z = cz + rand(-9, 9);
    const col = pick(AWNING_COLORS);
    scene.add(box(2.6, 1.1, 1.4, 0x6e5636, x, 0.55, z));
    const roof = box(3.2, 0.1, 2.2, col, x, 2.15, z);
    roof.rotation.z = 0.08;
    scene.add(roof);
    scene.add(box(0.09, 2.1, 0.09, 0x3a3f47, x - 1.4, 1.05, z - 0.9));
    scene.add(box(0.09, 2.1, 0.09, 0x3a3f47, x + 1.4, 1.05, z + 0.9));
    // warm bulb glow under the stall canopy
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
    bulb.position.set(x, 1.9, z);
    scene.add(bulb);
  }
}

// ---------- waterfront: palms, lamps, marina ----------
function palmTextures() {
  const frond = texFromCanvas(makeCanvas(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    g.strokeStyle = '#1d5c2e'; g.lineWidth = 5; g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      g.beginPath();
      g.moveTo(64, 64);
      g.quadraticCurveTo(64 + Math.cos(a) * 34, 64 + Math.sin(a) * 30 - 12,
        64 + Math.cos(a) * 60, 64 + Math.sin(a) * 56 + 14);
      g.stroke();
    }
  }));
  return frond;
}
function buildWaterfront(scene, city) {
  // palms: instanced trunks + two crossed instanced crowns
  const spots = [];
  for (let z = -120; z <= 130; z += 15) if (chance(0.7)) spots.push({ x: -202 + rng() * 3, z, s: 0.8 + rng() * 0.4, lean: (rng() - 0.5) * 0.2 });
  for (const rz of ROADS_Z) for (let i = 0; i < 3; i++) {
    spots.push({ x: -140 + rng() * 380, z: rz + (chance(0.5) ? 10.8 : -10.8), s: 0.8 + rng() * 0.35, lean: (rng() - 0.5) * 0.1 });
  }
  for (let z = -160; z <= 160; z += 32) spots.push({ x: BOULEVARD_X, z: z + rand(-3, 3), s: 0.85 + rng() * 0.3, lean: (rng() - 0.5) * 0.12 });
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.34, 7.5, 6);
  trunkGeo.translate(0, 3.75, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6e5636 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const crownGeo = new THREE.PlaneGeometry(6.4, 6.4);
  crownGeo.translate(0, 7.7, 0);
  const crownMat = new THREE.MeshLambertMaterial({
    map: palmTextures(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
  const crownsA = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
  const crownsB = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sv = new THREE.Vector3();
  spots.forEach((p, i) => {
    e.set(p.lean, rng() * Math.PI, 0); q.setFromEuler(e);
    v.set(p.x, 0, p.z); sv.set(p.s, p.s, p.s);
    m4.compose(v, q, sv); trunks.setMatrixAt(i, m4); crownsA.setMatrixAt(i, m4);
    e.set(p.lean, rng() * Math.PI + Math.PI / 2, 0); q.setFromEuler(e);
    m4.compose(v, q, sv); crownsB.setMatrixAt(i, m4);
    city.palms.push(p);
  });
  scene.add(trunks); scene.add(crownsA); scene.add(crownsB);

  // lamp posts at corner kerbs + additive light-pool decals
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c313a });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0 });
  const poolTex = softDotTexture(128, 'rgba(255,214,150,0.55)', 'rgba(255,214,150,0)');
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const lampPositions = [];
  for (const x of ROADS_X) for (const z of ROADS_Z) {
    for (const [ox, oz] of [[-8.6, -8.6], [8.6, 8.6]]) {
      if (chance(0.25)) continue;
      lampPositions.push({ x: x + ox, z: z + oz });
    }
  }
  for (let z = -300; z < 330; z += 26) lampPositions.push({ x: BOULEVARD_X - 8.6, z });
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 5.2, 6);
  poleGeo.translate(0, 2.6, 0);
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampPositions.length);
  const bulbGeo = new THREE.SphereGeometry(0.22, 6, 5);
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, lampPositions.length);
  const poolGeo = new THREE.PlaneGeometry(11, 11);
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, lampPositions.length);
  const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  lampPositions.forEach((p, i) => {
    m4.compose(v.set(p.x, 0, p.z), q.identity(), sv.set(1, 1, 1));
    poles.setMatrixAt(i, m4);
    m4.compose(v.set(p.x, 5.25, p.z), q, sv);
    bulbs.setMatrixAt(i, m4);
    m4.compose(v.set(p.x, 0.09, p.z), flat, sv);
    pools.setMatrixAt(i, m4);
    city.lamps.push(p);
  });
  scene.add(poles); scene.add(bulbs); scene.add(pools);

  // marina: timber docks + moored boats at real berths
  const timber = new THREE.MeshLambertMaterial({ color: 0x5c4630 });
  for (let i = 0; i < 9; i++) {
    const z = 160 + i * 17;
    scene.add(box(16, 0.5, 2.2, 0, -246, 0.25, z, { mat: timber }));
    if (i % 2 === 0) continue;
    const boat = new THREE.Group();
    const hull = box(2.2, 0.9, 6.4, pick([0xe8e3d5, 0x3ecfe8, 0xff7847, 0xf2f2f2]), 0, 0.45, 0);
    boat.add(hull);
    boat.add(box(1.6, 0.7, 2.4, 0xd8dde6, 0, 1.2, -0.6));
    boat.add(box(0.09, 3.4, 0.09, 0x8a8f98, 0, 2.4, 0.6));
    const lampDot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
    lampDot.position.set(0, 4.1, 0.6);
    boat.add(lampDot);
    boat.position.set(-256 - (i % 3) * 2, -0.1, z + 4);
    boat.rotation.y = rand(-0.06, 0.06);
    scene.add(boat);
  }
}

// ---------- El Astillero: container stacks + cranes ----------
const CONTAINER_COLORS = [0xc94f38, 0x2f7f8f, 0xe8a33c, 0x3f7d4e, 0x7a4a8f, 0xd84f78, 0x2478cc];
function buildAstillero(scene, city) {
  const yard = PLACES.containerYard;
  // dark asphalt apron for the yard
  const apron = groundPlane(130, 120, new THREE.MeshLambertMaterial({ color: 0x1d2026 }), yard.x, yard.z, 0.045);
  scene.add(apron);
  const ribbed = [];
  function container(x, z, ry, level) {
    const col = pick(CONTAINER_COLORS);
    const m = box(12.2, 2.6, 2.45, col, x, 1.3 + level * 2.6, z, { ry, shadow: true });
    scene.add(m);
    ribbed.push(m);
    return m;
  }
  // stacks framing the yard, leaving the fight floor open in the middle
  for (let i = 0; i < 5; i++) {
    const x = yard.x - 44 + i * 4, z = yard.z - 34;
    container(x + 20, z, 0, 0); if (chance(0.6)) container(x + 20, z, 0, 1);
  }
  for (let i = 0; i < 4; i++) {
    const x = yard.x + 34, z = yard.z - 26 + i * 13;
    container(x, z, Math.PI / 2, 0); if (chance(0.5)) container(x, z, Math.PI / 2, 1);
  }
  for (let i = 0; i < 4; i++) {
    const x = yard.x - 40 + i * 13, z = yard.z + 36;
    container(x, z, 0, 0);
  }
  for (let i = 0; i < 3; i++) {
    container(yard.x - 38, yard.z - 20 + i * 14, Math.PI / 2, 0);
  }
  // loose crates near the fight floor (cover props)
  for (const [ox, oz] of [[6, -6], [7.4, -5], [6.6, -7.4], [-14, 10], [12, 12]]) {
    scene.add(box(1.3, 1.3, 1.3, 0x8a6a42, yard.x + ox, 0.65, yard.z + oz, { ry: rng() * 0.6, shadow: true }));
  }
  // two gantry cranes over the docks
  for (const cx of [10, 90]) {
    const legMat = new THREE.MeshLambertMaterial({ color: 0x8a4d16 });
    for (const [ox, oz] of [[-14, -10], [14, -10], [-14, 10], [14, 10]]) {
      scene.add(box(1.1, 21, 1.1, 0, cx + ox, 10.5, 250 + oz, { mat: legMat }));
    }
    scene.add(box(34, 1.6, 24, 0, cx, 21.5, 250, { mat: legMat }));
    scene.add(box(2.2, 2.2, 3, 0xd8dde6, cx - 8, 19.8, 250));
    const craneSign = makeSignMesh({ text: 'ASTILLERO', bg: '#0a1c0e', letters: '#7dff6a', accent: '#57d7e8' }, 12, 1.6);
    craneSign.position.set(cx, 18.6, 237.6);
    scene.add(craneSign);
  }
  // docked freighter silhouette south of the yard
  const ship = new THREE.Group();
  ship.add(box(16, 5, 90, 0x27313f, 0, 2.5, 0));
  ship.add(box(10, 9, 12, 0xd8dde6, 0, 8, -32));
  for (let i = 0; i < 5; i++) ship.add(box(13, 2.6, 10, pick(CONTAINER_COLORS), 0, 6.3, -14 + i * 13));
  ship.position.set(210, 0, 352);
  scene.add(ship);
}

// ---------- Isla Faro lighthouse ----------
let lighthouseBeam = null;
function buildLighthouse(scene, city) {
  const { x, z } = PLACES.lighthouse;
  scene.add(groundPlane(60, 70, new THREE.MeshLambertMaterial({ color: 0x3a4a3a }), x, z, 0.03));
  const towerMat = new THREE.MeshLambertMaterial({ color: 0xd8d2c4 });
  const bandMat = new THREE.MeshLambertMaterial({ color: 0xc23b2e });
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(2.6 - i * 0.28, 2.9 - i * 0.28, 3.4, 10),
      i % 2 ? bandMat : towerMat);
    seg.position.set(x, 1.7 + i * 3.4, z);
    seg.castShadow = true;
    scene.add(seg);
  }
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 2, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9b0 }));
  lampRoom.position.set(x, 14.6, z);
  scene.add(lampRoom);
  scene.add(box(4.4, 0.4, 4.4, 0x1c222c, x, 15.9, z));
  const beamTex = softDotTexture(128, 'rgba(255,240,190,0.85)', 'rgba(255,240,190,0)');
  lighthouseBeam = new THREE.Mesh(new THREE.PlaneGeometry(46, 7),
    new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  lighthouseBeam.position.set(x + 20, 14.6, z);
  scene.add(lighthouseBeam);
  // keeper's hut
  scene.add(box(6, 3.2, 5, 0x51606e, x + 9, 1.6, z + 8));
  scene.add(box(6.8, 0.3, 5.8, 0x1c222c, x + 9, 3.4, z + 8));
}

// ---------- road graph + Dijkstra (the minimap route is real) ----------
function buildRoadGraph() {
  const nodes = [];
  const index = new Map();
  ROADS_X.forEach((x, i) => ROADS_Z.forEach((z, j) => {
    index.set(i + ',' + j, nodes.length);
    nodes.push({ x, z, edges: [] });
  }));
  function link(a, b) {
    const d = dist2(nodes[a].x, nodes[a].z, nodes[b].x, nodes[b].z);
    nodes[a].edges.push({ to: b, d });
    nodes[b].edges.push({ to: a, d });
  }
  ROADS_X.forEach((x, i) => ROADS_Z.forEach((z, j) => {
    if (i + 1 < ROADS_X.length) link(index.get(i + ',' + j), index.get((i + 1) + ',' + j));
    if (j + 1 < ROADS_Z.length) link(index.get(i + ',' + j), index.get(i + ',' + (j + 1)));
  }));
  return { nodes, index };
}
function nearestNode(g, x, z) {
  let best = 0, bd = Infinity;
  g.nodes.forEach((n, i) => {
    const d = dist2(x, z, n.x, n.z);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
function findRoute(x1, z1, x2, z2) {
  const g = G.city.graph;
  const start = nearestNode(g, x1, z1), goal = nearestNode(g, x2, z2);
  const dist = new Array(g.nodes.length).fill(Infinity);
  const prev = new Array(g.nodes.length).fill(-1);
  const seen = new Array(g.nodes.length).fill(false);
  dist[start] = 0;
  for (let iter = 0; iter < g.nodes.length; iter++) {
    let u = -1, ud = Infinity;
    for (let i = 0; i < g.nodes.length; i++) if (!seen[i] && dist[i] < ud) { ud = dist[i]; u = i; }
    if (u < 0 || u === goal) break;
    seen[u] = true;
    for (const e of g.nodes[u].edges) {
      const nd = dist[u] + e.d;
      if (nd < dist[e.to]) { dist[e.to] = nd; prev[e.to] = u; }
    }
  }
  const pts = [];
  let cur = goal;
  while (cur >= 0) { pts.unshift({ x: g.nodes[cur].x, z: g.nodes[cur].z }); cur = prev[cur]; }
  pts.unshift({ x: x1, z: z1 });
  pts.push({ x: x2, z: z2 });
  // total = graph distance + the two off-graph legs
  let total = dist[goal];
  if (pts.length > 2) {
    total += dist2(x1, z1, pts[1].x, pts[1].z) + dist2(x2, z2, pts[pts.length - 2].x, pts[pts.length - 2].z);
  }
  return { pts, dist: Math.round(total) };
}
function randomRoadPoint() {
  if (chance(0.5)) {
    const line = pick(ROADS_X);
    return { axis: 'z', line, dir: chance(0.5) ? 1 : -1, x: line, z: rand(LAND.minZ + 10, LAND.maxZ - 10) };
  }
  const line = pick(ROADS_Z);
  return { axis: 'x', line, dir: chance(0.5) ? 1 : -1, x: rand(LAND.minX + 10, LAND.maxX - 10), z: line };
}
// Push a circle out of every building footprint (audit-clean placement
// means this only fires on genuine contact).
function collideBuildings(x, z, r) {
  if (!G.city) return { x, z };
  for (const b of G.city.buildings) {
    const hit = collideCircleOBB(x, z, r, b.x, b.z, b.w / 2, b.d / 2, 0);
    if (hit) { x = hit.x; z = hit.z; }
  }
  return { x, z };
}
function updateCity(dt) {
  if (lighthouseBeam) {
    const t = G.elapsed * 0.35;
    lighthouseBeam.rotation.y = t;
    const p = PLACES.lighthouse;
    lighthouseBeam.position.set(p.x + Math.sin(t) * 20, 14.6, p.z + Math.cos(t) * 20);
  }
}
