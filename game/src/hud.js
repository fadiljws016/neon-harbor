// hud.js — neon glass HUD: mission panel, PDP dispatch feed, vitals,
// weapon slots, dialogue box, speedo, district caption. DOM lives in
// index.html; this module only reads state and paints values.

function el(id) { return document.getElementById(id); }
let hudReady = false;
function initHUD() {
  const slots = el('weaponSlots');
  if (slots && !slots.children.length) {
    WEAPON_ORDER.forEach((w, i) => {
      const d = document.createElement('div');
      d.className = 'wslot';
      d.id = 'wslot-' + w;
      d.innerHTML = '<div class="wname">' + WEAPON_DEFS[w].name + '</div><div class="wammo"></div>';
      slots.appendChild(d);
    });
  }
  hudReady = true;
}
function fmtTime(s) {
  if (s === null || s === undefined) return '';
  s = Math.max(0, Math.ceil(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
function refreshHUD() {
  if (!hudReady) return;
  const info = missionPanelInfo();
  el('mpTitle').textContent = info.title || 'Bahía Noche';
  el('mpStage').textContent = info.stage || '';
  el('mpObjective').textContent = info.objective || 'Free roam — find Madame Volt at Club Sirena';
  el('mpNext').textContent = info.next ? 'NEXT ' + info.next : '';
  el('mpTimer').textContent = info.timer !== null && info.timer !== undefined ? fmtTime(info.timer) : '';
  el('mpTimer').style.display = (info.timer !== null && info.timer !== undefined) ? 'block' : 'none';
  // economy + rank
  el('cashAmt').textContent = '$' + G.cash;
  el('rankLine').textContent = RANKS[G.rankIndex].name + ' · Respect ' + G.respect;
  const clock = el('clockLine');
  if (clock) {
    const hh = Math.floor(G.timeHours), mm = Math.floor((G.timeHours - hh) * 60);
    clock.textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }
  // wanted stars
  const stars = wantedStars();
  let starStr = '';
  for (let i = 0; i < 5; i++) starStr += i < stars ? '★' : '☆';
  el('stars').textContent = starStr;
  el('stars').style.opacity = stars > 0 ? '1' : '0.25';
  el('searchLine').textContent = stars > 0 ? (G.heliSeesPlayer ? 'TRACKING' : 'SEARCHING') : '';
  // vitals
  el('healthFill').style.width = clamp(G.health, 0, 100) + '%';
  el('armorFill').style.width = clamp(G.armor, 0, 100) + '%';
  // weapons
  for (const w of WEAPON_ORDER) {
    const slot = el('wslot-' + w);
    if (!slot) continue;
    const data = G.weapons[w];
    slot.classList.toggle('active', G.weapon === w);
    slot.classList.toggle('locked', !data.unlocked);
    slot.querySelector('.wammo').textContent = !data.unlocked ? 'LOCKED'
      : (data.ammo === Infinity ? '∞' : String(data.ammo));
  }
  // dispatch feed
  const dp = el('dpRows');
  if (dp) {
    if (!G.dispatch.length) {
      dp.innerHTML = '<div class="dprow dim"><span>PDP DISPATCH</span><span>QUIET</span></div>';
    } else {
      dp.innerHTML = G.dispatch.map(r =>
        '<div class="dprow"><span>' + r.unit + (r.dist !== null ? ' · ' + r.dist + ' m' : '') +
        '</span><span class="role">' + r.role + '</span></div>').join('');
    }
  }
  // speedo
  const inCar = G.player && G.player.car;
  el('speedo').style.display = inCar ? 'block' : 'none';
  if (inCar) {
    el('spSpeed').textContent = G.speedKmh;
    el('spCar').textContent = CAR_TYPES[G.player.car.type].name;
    el('spCond').textContent = G.player.car.dead ? 'WRECKED' : (G.player.car.health > 55 ? 'CONDITION OK' : 'DAMAGED');
  }
  // district caption
  if (G.player) {
    const d = districtAt(G.player.fig.position.x, G.player.fig.position.z);
    if (d && d !== G.district) {
      G.district = d;
      el('districtCaption').textContent = d.toUpperCase();
    }
  }
  renderDialogue();
}
// ---------- dialogue ----------
function showDialogue(lines, onDone) {
  G.dialogue = { lines, index: 0, onDone: onDone || null };
  renderDialogue();
}
function advanceDialogue() {
  if (!G.dialogue) return;
  G.dialogue.index++;
  if (G.dialogue.index >= G.dialogue.lines.length) {
    const cb = G.dialogue.onDone;
    G.dialogue = null;
    if (cb) cb();
  }
  renderDialogue();
}
function dialogueLineShape(l) {
  if (l.name) return l;
  const ch = CHARACTERS[l.who] || { name: l.who || '', color: 0xffffff };
  return { name: ch.name, color: ch.color, text: l.text };
}
function renderDialogue() {
  const box = el('dialogue');
  if (!box) return;
  if (!G.dialogue || !G.dialogue.lines.length) { box.style.display = 'none'; return; }
  const line = dialogueLineShape(G.dialogue.lines[Math.min(G.dialogue.index, G.dialogue.lines.length - 1)]);
  box.style.display = 'block';
  const nm = el('dgName');
  nm.textContent = line.name;
  nm.style.color = '#' + (line.color || 0xffffff).toString(16).padStart(6, '0');
  el('dgText').textContent = line.text;
  const initials = (line.name || '?').replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('');
  const av = el('dgAvatar');
  av.textContent = initials;
  av.style.background = '#' + (line.color || 0x888888).toString(16).padStart(6, '0');
}
