// missions.js — the eight jobs of Neon Harbor and the stage engine that
// runs them: goto / steal / deliverCar / timed / escape / fight / race /
// fare / takedown. missionPanelInfo() is the HUD's single source of truth.

import { G, addCash, addRespect } from './state.js';
import { dist2d } from './util.js';
import { PLACES } from './city.js';
import { spawnHostile, clearHostiles, hostiles } from './combat.js';
import { makeCar, placeCar } from './vehicles.js';
import { dialogueFor } from './story.js';
import { sfxCash } from './audio.js';
import { saveGame } from './save.js';

// Display names for the map hub's mission card + job list (the engine
// itself keys givers by id).
export const GIVER_NAMES = { volt: 'Madame Volt', ines: 'Inés "La Red" Mora' };

export const MISSIONS = [
  {
    id: 'cargo', title: 'Midnight Cargo', giver: 'volt', district: 'La Franja', dialogue: 'intro', endDialogue: 'cargo_done',
    reward: { cash: 600, respect: 60 },
    stages: [
      { kind: 'goto', at: 'club', objective: 'Head to Club Sirena on La Franja', next: 'Madame Volt is waiting under the sign' },
      { kind: 'goto', at: 'marina', objective: 'Reach the marina docks', next: 'The container sleeps by the third finger pier' },
      { kind: 'steal', at: 'marina', objective: 'Take the marked Mulo truck', next: 'Cargo first, questions later', carType: 'truck' },
      { kind: 'deliverCar', at: 'garage', objective: 'Deliver the cargo to Taller Noche', next: 'Lose any tail before you park it' },
    ],
  },
  {
    id: 'strip', title: 'Strip Run', giver: 'volt', district: 'La Franja', dialogue: 'cargo_done', endDialogue: 'strip_done',
    reward: { cash: 850, respect: 80 },
    stages: [
      { kind: 'goto', at: 'race', objective: 'Reach the Strip start in Mercado Nocturno', next: 'Three checkpoints, one legend' },
      { kind: 'race', objective: 'Win the Strip Run', next: 'Follow the gold route — no shortcuts through shops' },
      { kind: 'escape', objective: 'Shake the PDP heat', next: 'Break line of sight and keep it broken' },
    ],
  },
  {
    id: 'ambush', title: 'Shipyard Ambush', giver: 'ines', district: 'El Astillero', dialogue: 'strip_done', endDialogue: 'ambush_done',
    reward: { cash: 1100, respect: 110 },
    stages: [
      { kind: 'goto', at: 'shipyard', objective: 'Enter El Astillero\'s container yard', next: 'It is quiet. Too quiet' },
      { kind: 'fight', objective: 'Survive the ambush in the yard', next: 'Shake any heat from the docks', hostiles: 5 },
      { kind: 'escape', objective: 'Shake any heat from the docks', next: 'The Franja is safer. Marginally' },
    ],
  },
  {
    id: 'rain', title: 'Rain Check', giver: 'volt', district: 'Mercado Nocturno', dialogue: 'ambush_done', endDialogue: 'rain_done',
    reward: { cash: 950, respect: 90 },
    stages: [
      { kind: 'fare', at: 'hospital', objective: 'Pick up Inés at Hospital Faro', next: 'She hates waiting in the rain' },
      { kind: 'timed', at: 'casino', seconds: 95, objective: 'Get Inés to Casino Faro before the meet ends', next: 'Fast, but do not bend the car' },
    ],
  },
  {
    id: 'kings', title: 'Warehouse Kings', giver: 'volt', district: 'El Astillero', dialogue: 'rain_done', endDialogue: 'kings_done',
    reward: { cash: 1400, respect: 120 },
    stages: [
      { kind: 'goto', at: 'shipyard', objective: 'Roll into the kings\' warehouse row', next: 'Take down the Kings\' captain' },
      { kind: 'fight', at: 'shipyard', objective: 'Take down the Kings\' captain', next: 'Take the captain\'s Volt GT', hostiles: 6 },
      { kind: 'steal', at: 'shipyard', objective: 'Take the captain\'s Volt GT', next: 'Deliver it to Taller Noche', carType: 'sport' },
      { kind: 'deliverCar', at: 'garage', objective: 'Deliver the GT to Taller Noche', next: 'Job done', carType: 'sport' },
    ],
  },
  {
    id: 'debt', title: 'Sirena\'s Debt', giver: 'volt', district: 'La Franja', dialogue: 'kings_done', endDialogue: 'debt_done',
    reward: { cash: 1800, respect: 170 },
    stages: [
      { kind: 'goto', at: 'club', objective: 'Meet Volt at Club Sirena', next: 'She is smiling. That is new' },
      { kind: 'takedown', objective: 'Take down the collector\'s crew at the market', next: 'Send the receipt in bruises', hostiles: 4, at: 'market' },
      { kind: 'escape', objective: 'Vanish before the PDP arrive', next: 'The blackout is coming. Use it' },
    ],
  },
  {
    id: 'blackout', title: 'Blackout', giver: 'volt', district: 'Isla Faro', dialogue: 'debt_done', endDialogue: 'blackout_done',
    reward: { cash: 2200, respect: 200 },
    stages: [
      { kind: 'timed', at: 'lighthouse', seconds: 120, objective: 'Reach El Faro while the grid is down', next: 'No lights. No witnesses' },
      { kind: 'steal', at: 'pdp', objective: 'Lift the impounded PDP Interceptor', next: 'They will notice. Eventually', carType: 'cruiser' },
      { kind: 'escape', objective: 'Lose LUCERO-1\'s eye', next: 'Stay off the boulevard' },
    ],
  },
  {
    id: 'lucero', title: 'Lucero Down', giver: 'ines', district: 'Alto Mirador', dialogue: 'blackout_done', endDialogue: 'finale',
    reward: { cash: 3000, respect: 300 },
    stages: [
      { kind: 'goto', at: 'marina', objective: 'Bait LUCERO-1 over the marina', next: 'Wave at the light. Then run' },
      { kind: 'takedown', objective: 'Ground the air unit\'s ground crew', next: 'No crew, no hunt', hostiles: 6, at: 'marina' },
      { kind: 'goto', at: 'club', objective: 'Return to Club Sirena', next: 'The sign is still burning' },
    ],
  },
];

// ---------- Engine ----------

let stageCar = null;

export function stageTarget(stage) {
  if (!stage) return null;
  if (stage.at && PLACES[stage.at]) return PLACES[stage.at];
  return null;
}

export function objectivePoint() {
  if (!G.mission) return null;
  const stage = G.mission.stages[G.stageIndex];
  if (!stage) return null;
  if (stage.kind === 'race' && G.raceCheckpoints) {
    const cp = G.raceCheckpoints[G.raceCpIndex];
    return cp || null;
  }
  const t = stageTarget(stage);
  if (t) return { x: t.x, z: t.z, name: t.name };
  if (stage.kind === 'escape') {
    // No fixed target: the map routes you home to Volt's door to cool off.
    const c = PLACES.club;
    return { x: c.x, z: c.z, name: 'Cool off at Club Sirena' };
  }
  if (stage.kind === 'fight' || stage.kind === 'takedown') {
    const alive = hostiles.find((h) => !h.dead);
    if (alive) return { x: alive.group.position.x, z: alive.group.position.z, name: 'Target' };
  }
  return null;
}

export function missionPanelInfo() {
  if (!G.mission) return null;
  const stage = G.mission.stages[G.stageIndex];
  if (!stage) return null;
  return {
    title: G.mission.title,
    stage: 'STAGE ' + (G.stageIndex + 1) + ' OF ' + G.mission.stages.length,
    objective: stage.objective,
    next: stage.next || '',
    timer: (stage.kind === 'timed' || G.timerLeft > 0) ? G.timerLeft : null,
    reward: G.mission.reward,
    giver: GIVER_NAMES[G.mission.giver] || G.mission.giver,
    district: G.mission.district || '',
  };
}

// Status of every mission for the full-map job list: done / active /
// available, with the map marker anchored at each job's first stage.
export function missionStatusList() {
  return MISSIONS.map((m, i) => ({
    title: m.title,
    giver: GIVER_NAMES[m.giver] || m.giver,
    district: m.district || '',
    status: G.completed.includes(i) ? 'done' : (G.mission && i === G.missionIndex ? 'active' : 'available'),
    at: stageTarget(m.stages[0]),
    reward: m.reward,
  }));
}

export function startMission(index) {
  const m = MISSIONS[index];
  if (!m) return;
  G.mission = m;
  G.missionIndex = index;
  G.stageIndex = 0;
  beginStage();
  const dlg = dialogueFor(m.dialogue);
  if (dlg) { G.dialogue = dlg; G.dialogueIndex = 0; G.dialogueDone = false; }
}

export function fakeMission(missionIndex, stageIndex) {
  // Staging helper: dress the HUD with a mission without running it.
  // Every earlier job reads as done on the full-map list.
  const m = MISSIONS[missionIndex];
  if (!m) return;
  G.completed = [];
  for (let i = 0; i < missionIndex; i++) G.completed.push(i);
  G.mission = m;
  G.missionIndex = missionIndex;
  G.stageIndex = Math.min(stageIndex, m.stages.length - 1);
  const stage = m.stages[G.stageIndex];
  if (stage.kind === 'timed') G.timerLeft = stage.seconds;
}

function beginStage() {
  const stage = G.mission.stages[G.stageIndex];
  if (!stage) { completeMission(); return; }
  G.stageKind = stage.kind;
  G.timerLeft = stage.kind === 'timed' ? stage.seconds : 0;
  if (stageCar) { G.scene.remove(stageCar.group); stageCar = null; }
  if (stage.kind === 'steal' || stage.kind === 'deliverCar') {
    const t = stageTarget(stage);
    if (t && stage.carType) {
      // detail: the steal/deliver car gets mirrors + grille like traffic.
      stageCar = makeCar(stage.carType, undefined, { detail: true });
      placeCar(stageCar, t.x + 4, t.z + 3, 0.6);
      G.scene.add(stageCar.group);
      G.stageCar = stageCar;
    }
  }
  if (stage.kind === 'fight' || stage.kind === 'takedown') {
    const t = stageTarget(stage) || { x: G.player.group.position.x + 14, z: G.player.group.position.z + 10 };
    const n = stage.hostiles || 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      // Spiral ring: each hostile steps 1.7 m further out than the last,
      // so the ring never stacks two bodies on the same spot.
      const ringR = 6 + i * 1.7;
      spawnHostile(t.x + Math.cos(a) * ringR, t.z + Math.sin(a) * ringR,
        { gun: i % 3 === 2 ? 'smg' : 'pistol' });
    }
  }
  if (stage.kind === 'race') {
    G.raceCheckpoints = [
      { x: 192, z: -160, name: 'Checkpoint 1' },
      { x: 64, z: -224, name: 'Checkpoint 2' },
      { x: -64, z: -160, name: 'Checkpoint 3' },
      { x: -188, z: -224, name: 'Finish' },
    ];
    G.raceCpIndex = 0;
  }
}

function completeStage() {
  G.stageIndex++;
  if (G.stageIndex >= G.mission.stages.length) completeMission();
  else beginStage();
}

function completeMission() {
  const m = G.mission;
  if (!m) return;
  if (G.missionIndex >= 0 && !G.completed.includes(G.missionIndex)) G.completed.push(G.missionIndex);
  addCash(m.reward.cash);
  addRespect(m.reward.respect);
  sfxCash();
  clearHostiles();
  const dlg = dialogueFor(m.endDialogue);
  if (dlg) { G.dialogue = dlg; G.dialogueIndex = 0; G.dialogueDone = false; }
  G.mission = null;
  G.stageKind = '';
  saveGame();
}

function failStage(reason) {
  clearHostiles();
  G.mission = null;
  G.stageKind = '';
  G.timerLeft = 0;
  if (G.toastQueue) G.toastQueue.push(reason || 'Job blown. Volt is not pleased.');
}

export function updateMissions(dt) {
  if (!G.mission || G.dialogue || G.over) return;
  const stage = G.mission.stages[G.stageIndex];
  if (!stage) return;
  const pp = G.playerCar ? G.playerCar.group.position : G.player.group.position;
  if (stage.kind === 'timed') {
    G.timerLeft -= dt;
    if (G.timerLeft <= 0) { failStage('Out of time.'); return; }
  }
  const t = objectivePoint();
  switch (stage.kind) {
    case 'goto': case 'fare': case 'timed': {
      if (t && dist2d(pp.x, pp.z, t.x, t.z) < 7) completeStage();
      break;
    }
    case 'steal': {
      if (G.playerCar && G.stageCar && G.playerCar === G.stageCar) completeStage();
      break;
    }
    case 'deliverCar': {
      if (t && G.playerCar && dist2d(pp.x, pp.z, t.x, t.z) < 8) completeStage();
      break;
    }
    case 'fight': case 'takedown': {
      if (hostiles.length && hostiles.every((h) => h.dead)) completeStage();
      break;
    }
    case 'escape': {
      if (G.wanted <= 0.4) completeStage();
      break;
    }
    case 'race': {
      if (t && dist2d(pp.x, pp.z, t.x, t.z) < 9) {
        G.raceCpIndex++;
        if (G.raceCpIndex >= G.raceCheckpoints.length) { G.racesWon++; completeStage(); }
      }
      break;
    }
  }
}
