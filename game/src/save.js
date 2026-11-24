// save.js — localStorage persistence for cash, respect, unlocks, garage.
// Deliberately forgiving: a corrupt save falls back to a fresh runner.

import { G, rankForRespect } from './state.js';

const KEY = 'neon-harbor-save-v1';

export function saveGame() {
  try {
    const data = {
      cash: G.cash, respect: G.respect,
      unlocked: G.unlocked, ammo: G.ammo,
      garageCars: G.garageCars,
      kills: G.kills, faresDone: G.faresDone, racesWon: G.racesWon,
      missionIndex: G.missionIndex,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) { /* storage unavailable — play on unsaved */ }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (typeof d.cash !== 'number' || typeof d.respect !== 'number') return false;
    G.cash = d.cash; G.respect = d.respect;
    G.rankIndex = rankForRespect(d.respect);
    if (d.unlocked) G.unlocked = Object.assign(G.unlocked, d.unlocked);
    if (d.ammo) G.ammo = Object.assign(G.ammo, d.ammo);
    if (Array.isArray(d.garageCars) && d.garageCars.length) G.garageCars = d.garageCars;
    G.kills = d.kills | 0; G.faresDone = d.faresDone | 0; G.racesWon = d.racesWon | 0;
    return true;
  } catch (e) { return false; }
}

export function wipeSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
