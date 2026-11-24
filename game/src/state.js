// state.js — the single global game state object G, world bounds, ranks.
// Every module reads/writes through G so the staged shots, the HUD and the
// live game all see the same world.

const WORLD = { minX: -300, maxX: 320, minZ: -340, maxZ: 340 };
const LAND = { minX: -252, maxX: 300, minZ: -340, maxZ: 340 };

const RANKS = [
  { name: 'Nobody', respect: 0 },
  { name: 'Runner', respect: 40 },
  { name: 'Courier', respect: 150 },
  { name: 'Fixer', respect: 400 },
  { name: 'Baron', respect: 800 },
  { name: 'King of the Noche', respect: 1500 },
];

const G = {
  // three.js handles (set by world.js / camera.js)
  scene: null, camera: null, renderer: null, canvas: null,
  // clock
  elapsed: 0, timeHours: 21.6, isDusk: true, night: true,
  // run mode
  shotMode: false, shotName: null, started: false, paused: false,
  stageCam: null, camShake: 0,
  // player vitals + economy
  cash: 0, respect: 0, rankIndex: 0, health: 100, armor: 25,
  wanted: 0, dead: false,
  // weapons: unlocked + ammo live here; defs live in combat.js
  weapons: {
    fists: { unlocked: true, ammo: Infinity },
    pistol: { unlocked: true, ammo: 60 },
    smg: { unlocked: false, ammo: 0 },
    shotgun: { unlocked: false, ammo: 0 },
  },
  weapon: 'pistol',
  // entities
  player: null, heli: null,
  heliState: { orbitAngle: 0, forcedOrbit: null, forcedAltitude: null, active: false },
  cars: [], peds: [], officers: [],
  city: null, roadblock: null, heliSeesPlayer: false,
  // mission + dialogue
  mission: { index: 0, stage: 0, active: false, timerLeft: null, done: false },
  dialogue: null,
  // ui state
  mapOpen: false, keys: {}, dispatch: [], district: '',
  speedKmh: 0, radioOn: true,
  // staging helpers
  volley: false,
};

function rankFor(respect) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (respect >= RANKS[i].respect) idx = i;
  return idx;
}
function districtAt(x, z) {
  if (!G.city) return '';
  for (const d of G.city.districts) {
    if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) return d.name;
  }
  return '';
}
