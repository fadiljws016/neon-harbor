// minimap.js — the painted city map: one pre-rendered static layer at
// 1.6 px/m shared by the corner minimap and the full map. Sea gradient,
// depth rings, district washes, plaza greens, POI glyphs from PLACES, and
// a REAL Dijkstra route with a live distance pill.

const MAP_SCALE = 1.6;
let staticMap = null;
let currentRoute = null, routeTargetKey = '';

function w2mX(x) { return (x - WORLD.minX) * MAP_SCALE; }
function w2mY(z) { return (z - WORLD.minZ) * MAP_SCALE; }
function buildStaticMap() {
  const W = Math.round((WORLD.maxX - WORLD.minX) * MAP_SCALE);
  const H = Math.round((WORLD.maxZ - WORLD.minZ) * MAP_SCALE);
  staticMap = makeCanvas(W, H, (g) => {
    // sea
    const sea = g.createLinearGradient(0, 0, W, H);
    sea.addColorStop(0, '#06121f');
    sea.addColorStop(0.75, '#0d2f4a');
    sea.addColorStop(1, '#155e7a');
    g.fillStyle = sea; g.fillRect(0, 0, W, H);
    // shallow shelf + depth rings around the landmass
    g.strokeStyle = 'rgba(110,200,235,0.22)';
    g.lineWidth = 10;
    g.strokeRect(w2mX(LAND.minX) - 8, w2mY(LAND.minZ) - 8,
      (LAND.maxX - LAND.minX) * MAP_SCALE + 16, (LAND.maxZ - LAND.minZ) * MAP_SCALE + 16);
    for (const [off, alpha] of [[22, 0.22], [36, 0.13], [54, 0.07]]) {
      g.strokeStyle = `rgba(150,220,250,${alpha})`;
      g.lineWidth = 2;
      g.strokeRect(w2mX(LAND.minX) - off, w2mY(LAND.minZ) - off,
        (LAND.maxX - LAND.minX) * MAP_SCALE + off * 2, (LAND.maxZ - LAND.minZ) * MAP_SCALE + off * 2);
    }
    // land base
    g.fillStyle = '#1d2b3a';
    g.fillRect(w2mX(LAND.minX), w2mY(LAND.minZ),
      (LAND.maxX - LAND.minX) * MAP_SCALE, (LAND.maxZ - LAND.minZ) * MAP_SCALE);
    // district washes
    const wash = {
      'Muelle Neón': 'rgba(255,79,163,0.40)', 'La Franja': 'rgba(62,207,232,0.42)',
      'Mercado Nocturno': 'rgba(255,179,64,0.40)', 'El Astillero': 'rgba(146,219,150,0.36)',
      'Isla Faro': 'rgba(198,180,232,0.40)', 'Alto Mirador': 'rgba(255,120,120,0.36)',
    };
    for (const d of DISTRICTS) {
      g.fillStyle = wash[d.name] || 'rgba(255,255,255,0.1)';
      g.fillRect(w2mX(d.minX), w2mY(d.minZ), (d.maxX - d.minX) * MAP_SCALE, (d.maxZ - d.minZ) * MAP_SCALE);
    }
    // quay strip at the west edge + waterline
    g.fillStyle = '#6e6250';
    g.fillRect(w2mX(-252), w2mY(LAND.minZ), 27 * MAP_SCALE, (LAND.maxZ - LAND.minZ) * MAP_SCALE);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(w2mX(-252), w2mY(LAND.minZ), 1.6 * MAP_SCALE, (LAND.maxZ - LAND.minZ) * MAP_SCALE);
    // city blocks (dark) then roads (casing + fill) over them
    g.fillStyle = '#141c28';
    for (let i = 0; i < ROADS_X.length - 1; i++) for (let j = 0; j < ROADS_Z.length - 1; j++) {
      g.fillRect(w2mX(ROADS_X[i] + 7), w2mY(ROADS_Z[j] + 7),
        (ROADS_X[i + 1] - ROADS_X[i] - 14) * MAP_SCALE, (ROADS_Z[j + 1] - ROADS_Z[j] - 14) * MAP_SCALE);
    }
    g.strokeStyle = '#9fb6c9'; g.lineCap = 'round';
    for (const x of ROADS_X) {
      g.lineWidth = (ROAD_W + 2) * MAP_SCALE * 0.5;
      g.beginPath(); g.moveTo(w2mX(x), w2mY(LAND.minZ)); g.lineTo(w2mX(x), w2mY(LAND.maxZ)); g.stroke();
    }
    for (const z of ROADS_Z) {
      g.lineWidth = (ROAD_W + 2) * MAP_SCALE * 0.5;
      g.beginPath(); g.moveTo(w2mX(LAND.minX), w2mY(z)); g.lineTo(w2mX(LAND.maxX), w2mY(z)); g.stroke();
    }
    g.strokeStyle = '#2c3a4c';
    for (const x of ROADS_X) {
      g.lineWidth = ROAD_W * MAP_SCALE * 0.5;
      g.beginPath(); g.moveTo(w2mX(x), w2mY(LAND.minZ)); g.lineTo(w2mX(x), w2mY(LAND.maxZ)); g.stroke();
    }
    for (const z of ROADS_Z) {
      g.lineWidth = ROAD_W * MAP_SCALE * 0.5;
      g.beginPath(); g.moveTo(w2mX(LAND.minX), w2mY(z)); g.lineTo(w2mX(LAND.maxX), w2mY(z)); g.stroke();
    }
    // the strip glows gold
    g.strokeStyle = '#ffd76e'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(w2mX(-104), w2mY(-130)); g.lineTo(w2mX(-104), w2mY(70)); g.stroke();
    // plaza greens
    g.fillStyle = '#14532d';
    for (const [px, pz] of [[-76, -94], [92, 74], [204, -156], [-186, -36]]) {
      g.fillRect(w2mX(px - 12), w2mY(pz - 12), 24 * MAP_SCALE, 24 * MAP_SCALE);
    }
    // marina timber
    g.fillStyle = '#8a6844';
    for (let i = 0; i < 9; i++) g.fillRect(w2mX(-252), w2mY(158 + i * 17), 15 * MAP_SCALE, 2.4 * MAP_SCALE);
    // district labels, once each
    g.fillStyle = 'rgba(240,248,255,0.92)';
    g.font = 'bold 17px Arial'; g.textAlign = 'center';
    for (const d of DISTRICTS) {
      g.fillText(d.name.toUpperCase(), w2mX((d.minX + d.maxX) / 2), w2mY((d.minZ + d.maxZ) / 2));
    }
  });
  return staticMap;
}
function poiGlyphs() {
  return [
    { at: PLACES.garage, ch: 'G', col: '#ffd76e' },
    { at: PLACES.volt, ch: 'V', col: '#ff4fa3' },
    { at: PLACES.raceStart, ch: '⚑', col: '#ffffff' },
    { at: PLACES.pdp, ch: 'P', col: '#57a8ff' },
    { at: PLACES.hospital, ch: '+', col: '#ff5a5a' },
    { at: PLACES.lighthouse, ch: '▲', col: '#ffe9b0' },
    { at: PLACES.marina, ch: '⚓', col: '#9fe8ff' },
    { at: PLACES.sirena, ch: 'S', col: '#ff4fa3' },
  ];
}
function drawGlyphs(g, scale) {
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const p of poiGlyphs()) {
    const x = w2mX(p.at.x), y = w2mY(p.at.z);
    g.fillStyle = 'rgba(6,10,18,0.8)';
    g.beginPath(); g.arc(x, y, 9 * scale, 0, Math.PI * 2); g.fill();
    g.fillStyle = p.col;
    g.font = 'bold ' + Math.round(12 * scale) + 'px Arial';
    g.fillText(p.ch, x, y + 1);
  }
}
function refreshRoute() {
  const obj = objectivePoint();
  if (!obj || !G.player) { currentRoute = null; return; }
  const pp = G.player.fig.position;
  const key = Math.round(obj.x) + ',' + Math.round(obj.z) + ',' + Math.round(pp.x / 18) + ',' + Math.round(pp.z / 18);
  if (key === routeTargetKey && currentRoute) return;
  routeTargetKey = key;
  currentRoute = findRoute(pp.x, pp.z, obj.x, obj.z);
}
function drawRoute(g, scale) {
  if (!currentRoute || !currentRoute.pts.length) return;
  g.strokeStyle = '#ffd76e';
  g.lineWidth = 3.4 * scale;
  g.lineJoin = 'round';
  g.beginPath();
  currentRoute.pts.forEach((p, i) => {
    const x = w2mX(p.x), y = w2mY(p.z);
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  });
  g.stroke();
  const end = currentRoute.pts[currentRoute.pts.length - 1];
  g.fillStyle = '#ffd76e';
  g.beginPath(); g.arc(w2mX(end.x), w2mY(end.z), 6 * scale, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0a0e18';
  g.beginPath(); g.arc(w2mX(end.x), w2mY(end.z), 3 * scale, 0, Math.PI * 2); g.fill();
}
function drawActors(g, scale, pulse) {
  // police dots
  g.fillStyle = '#57a8ff';
  for (const car of G.cars) {
    if (car.type !== 'cruiser' || car.dead) continue;
    g.beginPath(); g.arc(w2mX(car.mesh.position.x), w2mY(car.mesh.position.z), 3.4 * scale, 0, Math.PI * 2); g.fill();
  }
  for (const o of G.officers) {
    if (o.dead) continue;
    g.beginPath(); g.arc(w2mX(o.fig.position.x), w2mY(o.fig.position.z), 3 * scale, 0, Math.PI * 2); g.fill();
  }
  // heli
  if (G.heliState.active && G.heli) {
    const hp = G.heli.position;
    g.fillStyle = '#ffffff';
    g.font = 'bold ' + Math.round(11 * scale) + 'px Arial'; g.textAlign = 'center';
    g.fillText('✦', w2mX(hp.x), w2mY(hp.z));
  }
  // player arrow, pulsing
  if (G.player) {
    const pp = G.player.fig.position;
    const x = w2mX(pp.x), y = w2mY(pp.z);
    const r = (5.5 + Math.sin(pulse * 5) * 1.2) * scale;
    g.save();
    g.translate(x, y);
    g.rotate(Math.atan2(fwdX(G.player.heading), -fwdZ(G.player.heading)) + Math.PI);
    g.fillStyle = '#2ad4e8';
    g.beginPath();
    g.moveTo(0, -r * 1.5); g.lineTo(r * 0.9, r); g.lineTo(0, r * 0.4); g.lineTo(-r * 0.9, r);
    g.closePath(); g.fill();
    g.restore();
  }
}
function drawCornerMap() {
  const cv = document.getElementById('minimap');
  if (!cv || !staticMap || !G.player) return;
  const g = cv.getContext('2d');
  const S = cv.width;
  const pp = G.player.fig.position;
  const viewM = 95; // metres across
  const src = viewM * MAP_SCALE;
  g.clearRect(0, 0, S, S);
  g.save();
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); g.clip();
  g.drawImage(staticMap, w2mX(pp.x) - src / 2, w2mY(pp.z) - src / 2, src, src, 0, 0, S, S);
  // route + actors in view space
  const k = S / src;
  g.translate(S / 2, S / 2);
  g.scale(k, k);
  g.translate(-w2mX(pp.x), -w2mY(pp.z));
  drawRoute(g, 1 / MAP_SCALE * 1.4);
  drawGlyphs(g, 1.1);
  drawActors(g, 1.15, G.elapsed);
  g.restore();
  // north tick
  g.fillStyle = '#e8f4ff';
  g.font = 'bold 11px Arial'; g.textAlign = 'center';
  g.fillText('N', S / 2, 13);
  g.restore();
}
function drawFullMap() {
  const cv = document.getElementById('fullmap');
  if (!cv || !staticMap) return;
  const g = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  const scale = Math.min(W / staticMap.width, H / staticMap.height);
  const ox = (W - staticMap.width * scale) / 2, oy = (H - staticMap.height * scale) / 2;
  g.save();
  g.translate(ox, oy);
  g.scale(scale, scale);
  g.drawImage(staticMap, 0, 0);
  refreshRoute();
  drawRoute(g, 1.6);
  drawGlyphs(g, 1.6);
  drawActors(g, 1.6, G.elapsed);
  // compass rose
  const cx = staticMap.width - 60, cy = 56;
  g.strokeStyle = 'rgba(232,244,255,0.8)'; g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, 30, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#ffd76e';
  g.beginPath(); g.moveTo(cx, cy - 26); g.lineTo(cx + 6, cy); g.lineTo(cx - 6, cy); g.closePath(); g.fill();
  g.fillStyle = '#e8f4ff'; g.font = 'bold 15px Arial'; g.textAlign = 'center';
  g.fillText('N', cx, cy - 36);
  g.restore();
  // route distance pill
  if (currentRoute) {
    const label = currentRoute.dist + ' m';
    g.font = 'bold 17px Arial';
    const tw = g.measureText(label).width + 26;
    g.fillStyle = 'rgba(8,12,22,0.88)';
    g.beginPath(); g.roundRect(ox + 18, H - oy - 46, tw, 30, 15); g.fill();
    g.strokeStyle = '#ffd76e'; g.lineWidth = 1.6;
    g.beginPath(); g.roundRect(ox + 18, H - oy - 46, tw, 30, 15); g.stroke();
    g.fillStyle = '#ffd76e'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(label, ox + 31, H - oy - 30);
  }
  const cap = document.getElementById('mapDistrict');
  if (cap) cap.textContent = G.district ? G.district.toUpperCase() : '';
}
function initMinimap() {
  buildStaticMap();
}
