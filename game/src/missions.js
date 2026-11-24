// missions.js — the stage engine. One mission at a time, stages in order;
// completion is distance/type driven, dialogue gates the start, rewards
// pay out at the end. fakeMission() is the staging hook the shots use.

function stagePoint(stage) {
  const p = PLACES[stage.at];
  return p ? { x: p.x, z: p.z } : { x: 0, z: 0 };
}
function objectivePoint() {
  const m = MISSIONS[G.mission.index];
  if (!m) return null;
  const stage = m.stages[Math.min(G.mission.stage, m.stages.length - 1)];
  return stagePoint(stage);
}
function missionPanelInfo() {
  const m = MISSIONS[G.mission.index];
  if (!m) return { title: '', stage: '', objective: '', next: '', timer: null };
  const s = m.stages[Math.min(G.mission.stage, m.stages.length - 1)];
  return {
    title: m.title,
    stage: 'STAGE ' + (Math.min(G.mission.stage, m.stages.length - 1) + 1) + ' OF ' + m.stages.length,
    objective: s.objective,
    next: s.next,
    timer: G.mission.timerLeft,
  };
}
function startMission(i) {
  G.mission.index = i;
  G.mission.stage = 0;
  G.mission.active = true;
  G.mission.done = false;
  G.mission.timerLeft = null;
  const m = MISSIONS[i];
  showDialogue(m.intro.map(l => ({
    name: CHARACTERS[l.who].name, color: CHARACTERS[l.who].color, text: l.text,
  })), null);
  armStageTimer();
}
function fakeMission(i, stageIdx) {
  G.mission.index = i;
  G.mission.stage = stageIdx;
  G.mission.active = true;
  G.mission.done = false;
  armStageTimer();
}
function armStageTimer() {
  const m = MISSIONS[G.mission.index];
  const s = m.stages[G.mission.stage];
  if (s && (s.type === 'timed' || s.type === 'race')) G.mission.timerLeft = 95;
  else if (G.mission.timerLeft === null) G.mission.timerLeft = null;
}
function restartCurrentJob() {
  if (G.mission.active) startMission(G.mission.index);
}
function completeMission() {
  const m = MISSIONS[G.mission.index];
  G.mission.active = false;
  G.mission.done = true;
  G.cash += m.reward.cash;
  G.respect += m.reward.respect;
  G.rankIndex = rankFor(G.respect);
  // unlocks drip with progress
  if (G.mission.index >= 1) { G.weapons.smg.unlocked = true; G.weapons.smg.ammo = Math.max(G.weapons.smg.ammo, 120); }
  if (G.mission.index >= 2) { G.weapons.shotgun.unlocked = true; G.weapons.shotgun.ammo = Math.max(G.weapons.shotgun.ammo, 24); }
  saveGame();
  showDialogue([{ name: CHARACTERS[m.giver].name, color: CHARACTERS[m.giver].color, text: 'Done, and done clean. The Noche provides, Rocco.' }], () => {
    if (G.mission.index + 1 < MISSIONS.length) startMission(G.mission.index + 1);
  });
}
function advanceStage() {
  const m = MISSIONS[G.mission.index];
  G.mission.stage++;
  G.mission.timerLeft = null;
  if (G.mission.stage >= m.stages.length) completeMission();
  else armStageTimer();
}
// E-key interaction with the objective point (steal / pickup stages)
function interactMissionPoint() {
  if (!G.mission.active || G.dialogue) return;
  const m = MISSIONS[G.mission.index];
  const s = m.stages[G.mission.stage];
  const pt = stagePoint(s);
  const pp = G.player.fig.position;
  if (dist2(pp.x, pp.z, pt.x, pt.z) > 6) return;
  if (s.type === 'goto' || s.type === 'fare') advanceStage();
}
let fightCheckT = 0;
function updateMissions(dt) {
  if (!G.mission.active || G.shotMode || G.dialogue || G.dead) return;
  const m = MISSIONS[G.mission.index];
  const s = m.stages[G.mission.stage];
  if (!s) return;
  const pt = stagePoint(s);
  const pp = G.player.fig.position;
  const d = dist2(pp.x, pp.z, pt.x, pt.z);
  if (G.mission.timerLeft !== null) {
    G.mission.timerLeft -= dt;
    if (G.mission.timerLeft <= 0) {
      G.mission.timerLeft = null;
      showDialogue([{ name: 'Madame Volt', color: 0xff4fa3, text: 'Too slow, cariño. The job resets — do it again, faster.' }], null);
      G.mission.stage = Math.max(0, G.mission.stage - 1);
      armStageTimer();
      return;
    }
  }
  switch (s.type) {
    case 'goto': case 'fare':
      if (d < 5.5) advanceStage();
      break;
    case 'steal':
      if (G.player.car && d < 26) advanceStage();
      break;
    case 'deliverCar':
      if (G.player.car && d < 9) { exitCar(); advanceStage(); }
      break;
    case 'timed': case 'race':
      if (d < 8) advanceStage();
      break;
    case 'escape':
      if (G.wanted < 0.6 && d < 30) advanceStage();
      else if (d < 7 && G.wanted < 1.6) advanceStage();
      break;
    case 'fight': case 'takedown': {
      fightCheckT -= dt;
      if (fightCheckT <= 0) {
        fightCheckT = 0.5;
        const alive = G.officers.some(o => !o.dead && dist2(o.fig.position.x, o.fig.position.z, pt.x, pt.z) < 42);
        if (!alive && d < 42) advanceStage();
      }
      break;
    }
  }
}
