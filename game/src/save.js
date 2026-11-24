// save.js — localStorage persistence: cash, respect, unlocks, mission
// progress. Shot mode never reads or writes the save.

const SAVE_KEY = 'neonharbor-save-v1';
function saveGame() {
  if (G.shotMode) return;
  try {
    const data = {
      cash: G.cash, respect: G.respect,
      missionIndex: G.mission.index,
      weapons: {
        pistol: { unlocked: G.weapons.pistol.unlocked, ammo: G.weapons.pistol.ammo },
        smg: { unlocked: G.weapons.smg.unlocked, ammo: G.weapons.smg.ammo },
        shotgun: { unlocked: G.weapons.shotgun.unlocked, ammo: G.weapons.shotgun.ammo },
      },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* storage unavailable — play session-only */ }
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    G.cash = data.cash || 0;
    G.respect = data.respect || 0;
    G.rankIndex = rankFor(G.respect);
    G.mission.index = data.missionIndex || 0;
    for (const w of ['pistol', 'smg', 'shotgun']) {
      if (data.weapons && data.weapons[w]) {
        G.weapons[w].unlocked = !!data.weapons[w].unlocked;
        G.weapons[w].ammo = data.weapons[w].ammo || 0;
      }
    }
    return true;
  } catch (e) { return false; }
}
function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
