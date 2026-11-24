// minimap.js — corner radar and the full city map. The route is a REAL
// Dijkstra over the road graph (never hardcoded), with a live metre pill.

import { G } from './state.js';
import { VX, HZ, WORLD, ROAD_W, DISTRICTS, PLACES, buildRouteGraph, districtAt } from './city.js';
import { heliPosition } from './helicopter.js';
import { objectivePoint, missionStatusList } from './missions.js';

const SCALE = 1.6; // px per metre on the corner radar
let graph = null;

export function worldToMap(x, z, w, h) {
  const pad = 26;
  const sx = (w - pad * 2) / (WORLD.x1 - WORLD.x0);
  const sz = (h - pad * 2) / (WORLD.z1 - WORLD.z0);
  return {
    x: pad + (x - WORLD.x0) * sx,
    y: pad + (z - WORLD.z0) * sz,
  };
}

function ensureGraph() {
  if (!graph) graph = buildRouteGraph();
  return graph;
}

function nearestNode(x, z) {
  const g = ensureGraph();
  let best = null, bd = Infinity, bk = null;
  for (const [k, n] of g.nodes) {
    const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
    if (d < bd) { bd = d; best = n; bk = k; }
  }
  return { key: bk, node: best };
}

export function computeRoute(sx, sz, tx, tz) {
  const g = ensureGraph();
  const start = nearestNode(sx, sz);
  const goal = nearestNode(tx, tz);
  if (!start.node || !goal.node) return null;
  const dist = new Map([[start.key, 0]]);
  const prev = new Map();
  const open = new Set([start.key]);
  const done = new Set();
  while (open.size) {
    let ck = null, cd = Infinity;
    for (const k of open) { const d = dist.get(k); if (d < cd) { cd = d; ck = k; } }
    if (ck === null) break;
    open.delete(ck);
    done.add(ck);
    if (ck === goal.key) break;
    const node = g.nodes.get(ck);
    for (const e of node.edges) {
      if (done.has(e.to)) continue;
      const nd = cd + e.w;
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, ck);
        open.add(e.to);
      }
    }
  }
  if (!done.has(goal.key) && goal.key !== start.key) return null;
  const keys = [];
  let k = goal.key;
  while (k) { keys.unshift(k); k = prev.get(k); }
  const points = [{ x: sx, z: sz }];
  for (const kk of keys) { const n = g.nodes.get(kk); points.push({ x: n.x, z: n.z }); }
  points.push({ x: tx, z: tz });
  let metres = 0;
  for (let i = 1; i < points.length; i++) {
    metres += Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].z - points[i - 1].z);
  }
  return { points, metres: Math.round(metres) };
}

export function drawHeliMarker(g, ox, oy, s) {
  g.save();
  g.translate(ox, oy);
  g.scale(s, s);
  g.strokeStyle = '#ffd23e';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(-6, 0); g.lineTo(6, 0);
  g.moveTo(0, -2.5); g.lineTo(0, 3.5);
  g.stroke();
  g.fillStyle = '#ffd23e';
  g.beginPath(); g.arc(0, 0, 2.2, 0, 7); g.fill();
  g.restore();
}

// ---- the full map: the information hub -------------------------------------
// The round-4 hub rendering on this tree's cartography: named POIs, the PDP
// patrol zone, status-coded mission markers, district washes, and the REAL
// Dijkstra route with a metres + drive-time pill at its midpoint. The DOM
// panels around the canvas (mission card, job list, player strip) live in
// hud.js; the legend is DOM too.

function playerPos() {
  return G.playerCar ? G.playerCar.group.position : (G.player ? G.player.group.position : null);
}

export function currentRoute() {
  const obj = objectivePoint();
  const fromPos = playerPos();
  if (!obj || !fromPos) return null;
  return computeRoute(fromPos.x, fromPos.z, obj.x, obj.z);
}

// {dist in metres, eta seconds at an 11 m/s city average} for the strip pill.
export function routeInfo() {
  const r = currentRoute();
  if (!r) return null;
  return { dist: r.metres, eta: Math.round(r.metres / 11) };
}

// Map-facing POI presentation: the round-4 label set over this tree's places.
const POI_STYLE = {
  club:      { label: 'Club Sirena',        mark: 'V',   color: '#ff4fa3' },
  garage:    { label: 'Puerto Garage',      mark: 'G',   color: '#ffc93f' },
  race:      { label: 'Race Start',         mark: 'R',   color: '#57d7e8' },
  pdp:       { label: 'PDP Headquarters',   mark: 'PDP', color: '#57a8ff' },
  hospital:  { label: 'Hospital San Lázaro', mark: '+',  color: '#ff5566' },
  lighthouse:{ label: 'Faro Lighthouse',    mark: 'F',   color: '#ffe9b0' },
  marina:    { label: 'Muelle Docks',       mark: 'D',   color: '#ff8c42' },
  casino:    { label: 'Casino Faro',        mark: 'C',   color: '#ffcf3f' },
  market:    { label: 'Mercado Stalls',     mark: 'M',   color: '#3effa0' },
  shipyard:  { label: 'El Astillero',       mark: 'S',   color: '#69d66f' },
};

let mapStatic = null;
let mapStaticKey = '';

function buildMapStatic(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const S = (w - 52) / (WORLD.x1 - WORLD.x0); // px per metre

  // Sea.
  const sea = g.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, h * 0.72);
  sea.addColorStop(0, '#155e7a');
  sea.addColorStop(0.75, '#0d2f4a');
  sea.addColorStop(1, '#06121f');
  g.fillStyle = sea;
  g.fillRect(0, 0, w, h);
  // Shelf ring around the island.
  const a = worldToMap(WORLD.x0, WORLD.z0, w, h);
  const b = worldToMap(WORLD.x1, WORLD.z1, w, h);
  g.strokeStyle = 'rgba(110,200,235,0.22)';
  g.lineWidth = 4;
  g.strokeRect(a.x - 8, a.y - 8, (b.x - a.x) + 16, (b.y - a.y) + 16);
  // Depth rings off the Faro point.
  const faro = worldToMap(PLACES.lighthouse.x, PLACES.lighthouse.z, w, h);
  for (const [r, alpha] of [[22, 0.22], [36, 0.13], [54, 0.07]]) {
    g.strokeStyle = 'rgba(150,220,250,' + alpha + ')';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(faro.x, faro.y, r * S, 0, 7);
    g.stroke();
  }
  // Land base + district washes (alpha baked into each wash, 0.55–0.65).
  g.fillStyle = '#24344a';
  g.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  for (const d of DISTRICTS) {
    const p0 = worldToMap(d.x0, d.z0, w, h);
    const p1 = worldToMap(d.x1, d.z1, w, h);
    g.fillStyle = d.wash;
    g.fillRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
  }
  // Roads: bright casing, dark inner, centre-dash hint.
  const drawRoads = (width, style) => {
    g.strokeStyle = style;
    g.lineWidth = width;
    g.beginPath();
    for (const x of VX) {
      const p0 = worldToMap(x, WORLD.z0, w, h);
      const p1 = worldToMap(x, WORLD.z1, w, h);
      g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y);
    }
    for (const z of HZ) {
      const p0 = worldToMap(WORLD.x0, z, w, h);
      const p1 = worldToMap(WORLD.x1, z, w, h);
      g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y);
    }
    g.stroke();
  };
  drawRoads((ROAD_W + 2.6) * S, '#cfe3f2');
  drawRoads(ROAD_W * S, '#2a3140');
  drawRoads(1.6, 'rgba(245,215,110,0.5)');
  // PDP patrol zone.
  const hq = worldToMap(PLACES.pdp.x, PLACES.pdp.z, w, h);
  g.beginPath();
  g.arc(hq.x, hq.y, 55 * S, 0, 7);
  g.fillStyle = 'rgba(87,168,255,0.08)';
  g.fill();
  g.setLineDash([7, 6]);
  g.strokeStyle = 'rgba(87,168,255,0.55)';
  g.lineWidth = 1.6;
  g.stroke();
  g.setLineDash([]);
  g.font = '600 ' + Math.round(w * 0.010) + 'px Arial, sans-serif';
  g.fillStyle = 'rgba(159,196,232,0.9)';
  g.textAlign = 'center';
  g.fillText('PDP PATROL ZONE', hq.x, hq.y + 55 * S + w * 0.014);
  // District names, once each, at district hearts.
  for (const d of DISTRICTS) {
    const cPt = worldToMap((d.x0 + d.x1) / 2, (d.z0 + d.z1) / 2, w, h);
    g.textAlign = 'center';
    g.font = '700 ' + Math.round(w * 0.017) + 'px Arial, sans-serif';
    g.shadowColor = 'rgba(0,0,0,0.65)';
    g.shadowBlur = 5;
    g.fillStyle = 'rgba(255,255,255,0.94)';
    g.fillText(d.name.toUpperCase(), cPt.x, cPt.y);
    g.shadowBlur = 0;
  }
  return c;
}

export function drawFullMap(canvas) {
  const w = canvas.width, h = canvas.height;
  const key = w + 'x' + h;
  if (!mapStatic || mapStaticKey !== key) {
    mapStatic = buildMapStatic(w, h);
    mapStaticKey = key;
  }
  const g = canvas.getContext('2d');
  g.drawImage(mapStatic, 0, 0);

  // Route (real Dijkstra polyline) + pill at its midpoint.
  const route = currentRoute();
  const obj = objectivePoint();
  if (route && route.points.length > 1) {
    g.save();
    g.strokeStyle = '#ffc93f';
    g.lineWidth = Math.max(2.4, w * 0.0032);
    g.lineJoin = 'round';
    g.shadowColor = 'rgba(255,201,63,0.8)';
    g.shadowBlur = 7;
    g.beginPath();
    route.points.forEach((p, i) => {
      const m = worldToMap(p.x, p.z, w, h);
      if (i === 0) g.moveTo(m.x, m.y); else g.lineTo(m.x, m.y);
    });
    g.stroke();
    g.restore();
    const eta = Math.round(route.metres / 11);
    const label = route.metres + ' m · ≈ ' + Math.floor(eta / 60) + ':' +
      String(eta % 60).padStart(2, '0') + ' drive';
    const mid = route.points[Math.floor(route.points.length / 2)];
    const mm = worldToMap(mid.x, mid.z, w, h);
    g.font = '700 ' + Math.round(w * 0.0135) + 'px Arial, sans-serif';
    const tw = g.measureText(label).width + 20;
    const th = w * 0.024;
    let px = mm.x - tw / 2, py = mm.y - th - 12;
    px = Math.max(6, Math.min(w - tw - 6, px));
    py = Math.max(6, py);
    g.fillStyle = 'rgba(8,12,20,0.88)';
    g.strokeStyle = '#ffc93f';
    g.lineWidth = 1.4;
    g.beginPath();
    g.roundRect(px, py, tw, th, 7);
    g.fill(); g.stroke();
    g.fillStyle = '#ffc93f';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, px + tw / 2, py + th / 2 + 1);
    g.textBaseline = 'alphabetic';
  }

  // Objective marker: pulsing gold diamond.
  if (obj) {
    const m = worldToMap(obj.x, obj.z, w, h);
    const pulse = 1 + Math.sin((G.t || 0) * 4) * 0.18;
    g.save();
    g.translate(m.x, m.y);
    g.rotate(Math.PI / 4);
    g.fillStyle = '#ffc93f';
    const r = w * 0.008 * pulse;
    g.fillRect(-r, -r, r * 2, r * 2);
    g.restore();
  }

  // Mission markers (status-coded), offset above the POI glyphs.
  for (const ms of missionStatusList()) {
    if (!ms.at) continue;
    const m = worldToMap(ms.at.x, ms.at.z, w, h);
    const y = m.y - w * 0.016;
    g.beginPath();
    g.arc(m.x, y, w * 0.0085, 0, 7);
    if (ms.status === 'active') { g.fillStyle = '#ffc93f'; g.fill(); }
    else if (ms.status === 'done') { g.fillStyle = 'rgba(140,150,165,0.9)'; g.fill(); }
    else { g.strokeStyle = '#57d7e8'; g.lineWidth = 1.8; g.stroke(); }
    g.fillStyle = ms.status === 'active' ? '#14100a' : '#e8f2fa';
    g.font = '700 ' + Math.round(w * 0.010) + 'px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ms.status === 'done' ? '✓' : (ms.status === 'active' ? '▶' : '●'), m.x, y + 1);
    g.textBaseline = 'alphabetic';
  }

  // POI glyphs + NAME labels (the information layer).
  for (const key of Object.keys(POI_STYLE)) {
    const p = PLACES[key];
    if (!p) continue;
    const st = POI_STYLE[key];
    const m = worldToMap(p.x, p.z, w, h);
    g.beginPath();
    g.arc(m.x, m.y, w * 0.0075, 0, 7);
    g.fillStyle = st.color;
    g.fill();
    g.strokeStyle = 'rgba(4,8,14,0.85)';
    g.lineWidth = 1.6;
    g.stroke();
    g.fillStyle = '#0a0e14';
    g.font = '700 ' + Math.round(w * 0.0085) + 'px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(st.mark, m.x, m.y + 0.5);
    g.font = '600 ' + Math.round(w * 0.0115) + 'px Arial, sans-serif';
    const label = st.label.toUpperCase();
    const tw = g.measureText(label).width;
    const flip = m.x + 14 + tw > w - 4;
    g.shadowColor = 'rgba(0,0,0,0.8)';
    g.shadowBlur = 4;
    g.fillStyle = 'rgba(240,248,255,0.95)';
    g.textAlign = flip ? 'right' : 'left';
    g.fillText(label, m.x + (flip ? -11 : 11), m.y + 1);
    g.shadowBlur = 0;
    g.textBaseline = 'alphabetic';
  }

  // LUCERO-1 marker while the air unit is up.
  const hp = heliPosition();
  if (hp && G.heliActive) {
    const m = worldToMap(hp.x, hp.z, w, h);
    drawHeliMarker(g, m.x, m.y, 1.1);
  }

  // Player arrow.
  const fromPos = playerPos();
  if (fromPos) {
    const m = worldToMap(fromPos.x, fromPos.z, w, h);
    const heading = G.playerCar ? G.playerCar.angle : (G.player ? G.player.heading : 0);
    g.save();
    g.translate(m.x, m.y);
    g.rotate(Math.PI - heading);
    g.fillStyle = '#57d7e8';
    g.strokeStyle = 'rgba(4,8,14,0.9)';
    g.lineWidth = 1.4;
    const r = w * 0.009;
    g.beginPath();
    g.moveTo(0, -r);
    g.lineTo(r * 0.72, r * 0.8);
    g.lineTo(0, r * 0.4);
    g.lineTo(-r * 0.72, r * 0.8);
    g.closePath();
    g.fill(); g.stroke();
    g.restore();
  }
}

// The corner radar: a rotating-free, north-up disc showing the player's
// block, the objective bearing and the district underfoot.
export function drawCornerMinimap(canvas) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2;
  const R = Math.min(w, h) / 2 - 3;
  const fromPos = G.playerCar ? G.playerCar.group.position : (G.player ? G.player.group.position : null);
  g.clearRect(0, 0, w, h);
  g.save();
  g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip();
  g.fillStyle = '#1b2940';
  g.fillRect(0, 0, w, h);
  if (fromPos) {
    const toPx = (x, z) => ({
      x: cx + (x - fromPos.x) * SCALE * 0.42,
      y: cy + (z - fromPos.z) * SCALE * 0.42,
    });
    // District wash underfoot.
    const d = districtAt(fromPos.x, fromPos.z);
    g.fillStyle = d.wash;
    g.fillRect(0, 0, w, h);
    // Roads.
    g.strokeStyle = '#cfe3f2';
    g.lineWidth = 5;
    for (const x of VX) {
      const p = toPx(x, 0);
      if (p.x < -8 || p.x > w + 8) continue;
      g.globalAlpha = 0.8;
      g.beginPath(); g.moveTo(p.x, 0); g.lineTo(p.x, h); g.stroke();
    }
    for (const z of HZ) {
      const p = toPx(0, z);
      if (p.y < -8 || p.y > h + 8) continue;
      g.beginPath(); g.moveTo(0, p.y); g.lineTo(w, p.y); g.stroke();
    }
    g.globalAlpha = 1;
    // Route stub toward the objective.
    const obj = objectivePoint();
    if (obj) {
      const route = computeRoute(fromPos.x, fromPos.z, obj.x, obj.z);
      if (route && route.points.length > 1) {
        g.strokeStyle = '#ffd23e';
        g.lineWidth = 2.6;
        g.beginPath();
        route.points.slice(0, 4).forEach((p, i) => {
          const m = toPx(p.x, p.z);
          if (i === 0) g.moveTo(m.x, m.y); else g.lineTo(m.x, m.y);
        });
        g.stroke();
      }
      const om = toPx(obj.x, obj.z);
      const clampedX = Math.max(8, Math.min(w - 8, om.x));
      const clampedY = Math.max(8, Math.min(h - 8, om.y));
      g.fillStyle = '#ffd23e';
      g.beginPath(); g.arc(clampedX, clampedY, 4.4, 0, 7); g.fill();
    }
    const hp = heliPosition();
    if (hp && G.heliActive) {
      const m = toPx(hp.x, hp.z);
      drawHeliMarker(g, m.x, m.y, 0.8);
    }
    // Player arrow.
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(cx, cy - 7); g.lineTo(4.8, cy + 5.4); g.lineTo(0, cy + 2.6); g.lineTo(-4.8, cy + 5.4);
    g.closePath(); g.fill();
  }
  g.restore();
  g.strokeStyle = 'rgba(87,215,232,0.7)';
  g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
  g.fillStyle = '#eaf4ff';
  g.font = 'bold 10px Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText('N', cx, 13);
}
