// state.js — the single game-state object G plus the weapon / rank tables.
// Everything mutable lives here so saves, HUD and staging all read one truth.

export const WEAPONS = [
  { id: 'fists',  name: 'Fists',       damage: 9,  pellets: 1, range: 2.4, rate: 0.34, auto: false, spread: 0.0,   kick: 0.1 },
  { id: 'p9',     name: 'P-9 Pistol',  damage: 17, pellets: 1, range: 62,  rate: 0.27, auto: false, spread: 0.012, kick: 0.35 },
  { id: 'kobra',  name: 'Kobra SMG',   damage: 11, pellets: 1, range: 56,  rate: 0.09, auto: true,  spread: 0.032, kick: 0.22 },
  { id: 'muelle', name: 'Muelle 12ga', damage: 9,  pellets: 6, range: 27,  rate: 0.85, auto: false, spread: 0.06,  kick: 0.9 },
];

export const RANKS = ['Runner', 'Courier', 'Wheelman', 'Fixer', 'Capo', 'Baron', 'Kingpin'];
export const RANK_RESPECT = [0, 150, 350, 640, 1000, 1500, 2200];

export const G = {
  scene: null, camera: null, renderer: null, canvas: null,
  t: 0, hour: 21.6, isDusk: true, started: false, paused: false, over: false,
  shotMode: false, shotName: '',
  player: null, playerCar: null,
  cash: 250, respect: 40, rankIndex: 0, pendingRankUp: false,
  wanted: 0, wantedTimer: 0,
  health: 100, armor: 0,
  weaponIndex: 1,
  unlocked: { fists: true, p9: true, kobra: false, muelle: false },
  ammo: { p9: 60, kobra: 0, muelle: 0 },
  speedKmh: 0, district: 'La Franja',
  mapOpen: false, minimapPulse: 0,
  mission: null, missionIndex: -1, stageIndex: 0, stageKind: '',
  completed: [],
  timerLeft: 0, objective: null, raceCheckpoints: null, raceCpIndex: 0,
  dialogue: null, dialogueIndex: 0, dialogueDone: false,
  heliSeesPlayer: false, heliActive: false,
  toastQueue: [], camShake: 0,
  kills: 0, faresDone: 0, racesWon: 0,
  radio: 'Radio Noche 101.7', radioTrack: 'Neón Mojado — Costa Gris',
  garageCars: ['voltgt'],
  settings: { quality: 1 },
};

export function currentWeapon() { return WEAPONS[G.weaponIndex]; }

export function rankForRespect(respect) {
  let r = 0;
  for (let i = 0; i < RANK_RESPECT.length; i++) if (respect >= RANK_RESPECT[i]) r = i;
  return r;
}

export function addRespect(n) {
  G.respect += n;
  const r = rankForRespect(G.respect);
  if (r > G.rankIndex) { G.rankIndex = r; G.pendingRankUp = true; }
}
export function addCash(n) { G.cash = Math.max(0, G.cash + n); }
