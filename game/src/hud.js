// hud.js — every DOM readout: mission panel, dispatch board, dialogue,
// weapons, stars, speedo, toasts. Neon glass over the night.

import { G, WEAPONS, RANKS, currentWeapon } from './state.js';
import { fmtMoney, fmtClock, fmtTimer } from './util.js';
import { missionPanelInfo, missionStatusList } from './missions.js';
import { dispatch } from './police.js';
import { drawCornerMinimap, drawFullMap, routeInfo } from './minimap.js';
import { districtAt } from './city.js';

const el = {};
let lastStars = -1;
let mapCanvas = null;
let cornerCanvas = null;
let toastTimer = 0;
let mapTick = 0;

export function toast(text) { (G.toastQueue ||= []).push(text); }

export function initHUD() {
  const ids = ['mission-panel', 'mission-title', 'mission-stage', 'mission-objective', 'mission-next',
    'mission-timer', 'cash', 'respect', 'rank', 'clock', 'stars', 'radio', 'health-fill', 'armor-fill',
    'weapons', 'dispatch', 'dialogue', 'dialogue-name', 'dialogue-text', 'speedo', 'district',
    'toasts', 'vignette', 'banner', 'minimap', 'wanted-label', 'start-screen',
    'mapOverlay', 'mapCanvas', 'mmcTitle', 'mmcStage', 'mmcGiver', 'mmcObj', 'mmcNext',
    'mmcReward', 'mmcTimer', 'mmlRows', 'msCash', 'msRank', 'msRespect', 'msWanted',
    'msDistrict', 'msRoute', 'mapClock'];
  for (const id of ids) el[id] = document.getElementById(id);
  mapCanvas = el['mapCanvas'];
  cornerCanvas = el['minimap'];
  buildWeaponSlots();
}

function buildWeaponSlots() {
  if (!el['weapons']) return;
  el['weapons'].innerHTML = '';
  WEAPONS.forEach((w, i) => {
    const d = document.createElement('div');
    d.className = 'weapon-slot';
    d.id = 'weapon-' + i;
    d.innerHTML = '<div class="wname">' + w.name + '</div><div class="wammo"></div>';
    el['weapons'].appendChild(d);
  });
}

function starsHTML() {
  let s = '';
  for (let i = 0; i < 5; i++) {
    s += '<span class="star' + (i < Math.round(G.wanted) ? ' on' : '') + '">★</span>';
  }
  return s;
}

export function updateToasts(dt) {
  const box = el['toasts'];
  if (!box) return;
  if (G.toastQueue.length && !box.dataset.busy) {
    const text = G.toastQueue.shift();
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = text;
    box.appendChild(d);
    box.dataset.busy = '1';
    setTimeout(() => { d.classList.add('show'); }, 20);
    setTimeout(() => {
      d.classList.remove('show');
      setTimeout(() => { d.remove(); delete box.dataset.busy; }, 350);
    }, 2600);
  }
}

export function updateVignette() {
  if (!el['vignette']) return;
  const hurt = G.health < 35 ? (0.55 - G.health / 90) : 0;
  const wanted = G.wanted >= 4 ? 0.16 : 0;
  el['vignette'].style.opacity = String(Math.min(0.75, hurt + wanted));
}

export function showBanner(text, sub = '') {
  const b = el['banner'];
  if (!b) return;
  b.innerHTML = '<div class="banner-title">' + text + '</div>' +
    (sub ? '<div class="banner-sub">' + sub + '</div>' : '');
  b.classList.add('show');
  setTimeout(() => b.classList.remove('show'), 3400);
}

// The full-map hub panels: current-job card (with reward), the eight-job
// list with statuses, and the player strip with the live route pill.
function updateMapPanels() {
  const info = missionPanelInfo();
  if (info) {
    el['mmcTitle'].textContent = info.title;
    el['mmcStage'].textContent = info.stage;
    el['mmcGiver'].textContent = info.giver + ' · ' + info.district;
    el['mmcObj'].textContent = info.objective;
    el['mmcNext'].textContent = info.next ? 'NEXT — ' + info.next : '';
    el['mmcReward'].textContent = 'REWARD  $' + info.reward.cash.toLocaleString('en-US') +
      '  ·  +' + info.reward.respect + ' RESPECT';
    el['mmcTimer'].textContent = (info.timer !== null && info.timer !== undefined)
      ? '⏱ ' + fmtTimer(info.timer) : '';
  } else {
    el['mmcTitle'].textContent = 'Free Roam';
    el['mmcStage'].textContent = 'BAHÍA NOCHE';
    el['mmcGiver'].textContent = '';
    el['mmcObj'].textContent = 'No active job. Find a fixer marker on the map.';
    el['mmcNext'].textContent = '';
    el['mmcReward'].textContent = '';
    el['mmcTimer'].textContent = '';
  }
  // Mission list — all eight, status-coded.
  const list = missionStatusList();
  el['mmlRows'].innerHTML = list.map((m) => {
    const icon = m.status === 'done' ? '✓' : (m.status === 'active' ? '▶' : '●');
    return '<div class="mmlRow ' + m.status + '"><span class="mmlIcon">' + icon +
      '</span><span class="mmlName">' + m.title + '</span><span class="mmlMeta">' +
      m.giver.split(' ')[0] + ' · ' + m.district + '</span></div>';
  }).join('');
  // Player strip + route pill (district computed live from the car/player).
  el['msCash'].textContent = fmtMoney(G.cash);
  el['msRank'].textContent = RANKS[G.rankIndex];
  el['msRespect'].textContent = 'Respect ' + G.respect;
  el['msWanted'].textContent = G.wanted > 0.05
    ? (G.wanted >= 4 ? 'HUNTED' : G.wanted >= 2.5 ? 'TRACKING' : 'SEARCHING') : 'Clean';
  const pp = G.playerCar ? G.playerCar.group.position : (G.player ? G.player.group.position : null);
  el['msDistrict'].textContent = pp ? districtAt(pp.x, pp.z).name : G.district;
  const ri = routeInfo();
  if (ri) {
    el['msRoute'].textContent = 'ROUTE  ' + ri.dist + ' m · ≈ ' + Math.floor(ri.eta / 60) +
      ':' + String(ri.eta % 60).padStart(2, '0') + ' drive';
    el['msRoute'].style.display = '';
  } else {
    el['msRoute'].style.display = 'none';
  }
  el['mapClock'].textContent = fmtClock(G.hour);
}

export function updateHUD(dt) {
  if (!el['cash']) return;
  el['cash'].textContent = fmtMoney(G.cash);
  el['respect'].textContent = 'Respect ' + G.respect;
  el['rank'].textContent = RANKS[G.rankIndex];
  el['clock'].textContent = fmtClock(G.hour);
  el['radio'].textContent = G.radio + ' · "' + G.radioTrack + '"';
  el['health-fill'].style.width = Math.max(0, G.health) + '%';
  el['armor-fill'].style.width = Math.max(0, G.armor) + '%';
  el['district'].textContent = G.district.toUpperCase();

  const wStars = Math.round(G.wanted);
  if (wStars !== lastStars) {
    lastStars = wStars;
    el['stars'].innerHTML = starsHTML();
  }
  el['wanted-label'].textContent =
    G.wanted >= 4 ? 'HUNTED' : G.wanted >= 2.5 ? 'TRACKING' : G.wanted >= 1 ? 'SEARCHING' : '';

  // Mission panel.
  const info = missionPanelInfo();
  if (info) {
    el['mission-panel'].style.display = 'block';
    el['mission-title'].textContent = info.title;
    el['mission-stage'].textContent = info.stage;
    el['mission-objective'].textContent = info.objective;
    el['mission-next'].innerHTML = info.next ? '<span class="next-tag">NEXT</span> ' + info.next : '';
    if (info.timer !== null && info.timer !== undefined) {
      el['mission-timer'].style.display = 'block';
      el['mission-timer'].textContent = fmtTimer(info.timer);
      el['mission-timer'].classList.toggle('urgent', info.timer < 15);
    } else el['mission-timer'].style.display = 'none';
  } else {
    el['mission-panel'].style.display = 'none';
  }

  // Weapons.
  WEAPONS.forEach((w, i) => {
    const slot = document.getElementById('weapon-' + i);
    if (!slot) return;
    const unlocked = G.unlocked[w.id];
    slot.classList.toggle('active', G.weaponIndex === i);
    slot.classList.toggle('locked', !unlocked);
    const ammoEl = slot.querySelector('.wammo');
    if (!unlocked) ammoEl.textContent = 'LOCKED';
    else if (w.id === 'fists') ammoEl.textContent = '∞';
    else ammoEl.textContent = String(G.ammo[w.id] ?? 0);
  });

  // Dispatch board (top five nearest units, unique ids by construction).
  if (dispatch.length) {
    el['dispatch'].style.display = 'block';
    const rows = dispatch.slice()
      .sort((a, b) => (a.dist ?? 999) - (b.dist ?? 999))
      .slice(0, 5)
      .map((d) => '<div class="drow"><span class="did">' + d.id + ' · ' + (d.dist ?? '—') + ' m</span>' +
        '<span class="dstatus">' + d.status + '</span></div>')
      .join('');
    el['dispatch'].innerHTML = '<div class="dhead">PDP DISPATCH</div>' + rows;
  } else el['dispatch'].style.display = 'none';

  // Dialogue.
  if (G.dialogue) {
    const line = G.dialogue[G.dialogueIndex];
    if (line) {
      el['dialogue'].style.display = 'flex';
      el['dialogue-name'].textContent = line.who.name;
      el['dialogue-name'].style.color = line.who.color;
      el['dialogue-text'].textContent = line.text;
    }
  } else el['dialogue'].style.display = 'none';

  // Speedo.
  if (G.playerCar) {
    el['speedo'].style.display = 'block';
    el['speedo'].innerHTML = Math.round(Math.abs(G.playerCar.speed) * 3.6) +
      ' <span class="unit">km/h</span>';
  } else el['speedo'].style.display = 'none';

  // Maps: the hub overlay takes the screen and the in-game HUD hides so
  // nothing ghosts through it (body.map-open CSS in index.html).
  const overlay = el['mapOverlay'];
  if (overlay) overlay.classList.toggle('open', G.mapOpen);
  document.body.classList.toggle('map-open', G.mapOpen);
  if (G.mapOpen && mapCanvas) {
    mapTick -= dt;
    if (mapTick <= 0) {
      mapTick = 0.12;
      drawFullMap(mapCanvas);
      updateMapPanels();
    }
  } else if (cornerCanvas) drawCornerMinimap(cornerCanvas);

  updateToasts(dt);
  updateVignette();
  if (G.pendingRankUp) {
    G.pendingRankUp = false;
    showBanner('RANK UP — ' + RANKS[G.rankIndex].toUpperCase(), 'Bahía Noche notices you now.');
  }
}
