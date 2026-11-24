// shots.js — the four staged frames. Each one resets the world, pins the
// clock, places every actor by number, and freezes the camera with
// stageCamera. The capture tool loads index.html?shot=<name>; the game
// itself stays fully playable without the parameter.

function resetStage() {
  for (let i = G.cars.length - 1; i >= 0; i--) removeCar(G.cars[i]);
  clearAllPeds();
  clearOfficers();
  clearRoadblock();
  G.wanted = 0; G.volley = false; G.dialogue = null; G.mapOpen = false;
  G.health = 100; G.armor = 25; G.dead = false;
  G.heliState.forcedOrbit = null; G.heliState.forcedAltitude = null;
  G.weapons = {
    fists: { unlocked: true, ammo: Infinity },
    pistol: { unlocked: true, ammo: 60 },
    smg: { unlocked: false, ammo: 0 },
    shotgun: { unlocked: false, ammo: 0 },
  };
  G.weapon = 'pistol';
  clearStageCam();
}
function stagedTraffic() {
  spawnCar('sedan', -215.5, 48, Math.PI, 0xe8e3d5, { parked: true });
  spawnCar('taxi', -208.5, -34, 0, 0xffb340, { parked: true });
  spawnCar('sport', -215.5, -58, Math.PI, 0xffcf3f, { parked: true });
}
function stageCover() {
  G.timeHours = 21.6;
  G.cash = 250; G.respect = 40; G.rankIndex = rankFor(40);
  const player = spawnPlayer(-108.6, -13.2, { heading: 1.15, pose: 'chat', weapon: 'pistol' });
  player.pose = 'chat';
  // Madame Volt, magenta, facing Rocco under the SIRENA sign
  spawnPedAt(-106.7, -15.7, 'stand', { name: 'volt', color: 0xff4fa3, heading: -1.95, pose: 'chat' });
  // chat pairs on the sidewalk
  spawnPedAt(-110.6, -24.5, 'chat', { heading: 0.2 });
  spawnPedAt(-110.2, -22.8, 'chat', { heading: -2.9 });
  spawnPedAt(-101.5, -27.5, 'chat', { heading: 2.6 });
  spawnPedAt(-103.2, -27.9, 'chat', { heading: -0.6 });
  // browsers at a stall west of the pair
  const stall = new THREE.Group();
  stall.add(box(2.8, 1.1, 1.5, 0x6e5636, 0, 0.55, 0));
  const canopy = box(3.4, 0.1, 2.4, 0xff4fa3, 0, 2.2, 0);
  canopy.rotation.z = 0.07;
  stall.add(canopy);
  stall.position.set(-113.5, 0, -30);
  G.scene.add(stall);
  spawnPedAt(-112, -28.6, 'stand', { heading: -1.4 });
  spawnPedAt(-115, -31, 'walk', { heading: 2.4 });
  // sitter on the quay edge + crowds both ways
  spawnPedAt(-119, -36, 'sit', { heading: -Math.PI / 2 });
  crowd(-118, 4, 6, 11);
  crowd(-99, -38, 4, 13, ['walk', 'idle']);
  stagedTraffic();
  spawnCar('sedan', -222.6, 14, 0, 0x8a9db5, { parked: true });
  spawnCar('truck', -201.4, 34, Math.PI, undefined, { parked: true });
  fakeMission(0, 0);
  G.dialogue = { lines: MISSIONS[0].intro, index: 1, onDone: null };
  stageCamera(-117.5, 1.9, -7.5, -105.5, 2.2, -15.8);
}
function stageDrive() {
  G.timeHours = 21.9;
  G.cash = 1450; G.respect = 640; G.rankIndex = rankFor(640);
  G.weapons.smg.unlocked = true; G.weapons.smg.ammo = 80;
  G.weapons.pistol.ammo = 42;
  spawnPlayer(-100.5, 30, { heading: Math.PI });
  const car = putPlayerInCar('sport', -100.5, 30, Math.PI, 0xff5347);
  car.speed = 15;
  G.speedKmh = 54;
  spawnCar('sedan', -107.5, -6, 0, 0xe8e3d5, { parked: true });
  spawnCar('taxi', -140, 49.5, Math.PI / 2, undefined, { parked: true });
  spawnCar('truck', -30, 42.5, Math.PI, undefined, { parked: true });
  spawnCar('sedan', -66, 26.5, -Math.PI / 2, 0x35b06f, { parked: true });
  crowd(-88, 16, 5, 23);
  crowd(-120, 48, 4, 29);
  fakeMission(1, 1);
  G.mission.timerLeft = 87;
  G.mapOpen = true;
  stageCamera(-112, 4.2, 44, -100, 1.1, 10);
}

function stageChase() {
  G.timeHours = 22.4;
  G.cash = 2320; G.respect = 905; G.rankIndex = rankFor(905);
  G.weapons.smg.unlocked = true; G.weapons.smg.ammo = 55;
  G.weapons.shotgun.unlocked = true; G.weapons.shotgun.ammo = 12;
  G.weapons.pistol.ammo = 31;
  spawnPlayer(BOULEVARD_X + 3.5, 16, { heading: Math.PI });
  const car = putPlayerInCar('sedan', BOULEVARD_X + 3.5, 16, Math.PI, 0xd8402e);
  car.speed = 23;
  G.speedKmh = 83;
  const rb = buildRoadblockMeshes(BOULEVARD_X, -26);
  spawnOfficerAt(rb.x - 2.2, rb.z + 2.8, { phase: 'crouch', homeCar: rb.cars[0], heading: Math.PI });
  spawnOfficerAt(rb.x + 5.4, rb.z + 2.8, { phase: 'fire', homeCar: rb.cars[1], heading: Math.PI });
  spawnCar('sedan', BOULEVARD_X + 3.5, 8, Math.PI, 0xe8e3d5, { parked: true });
  spawnCar('taxi', BOULEVARD_X - 3.5, 10, 0, undefined, { parked: true });
  // foreground pursuit cruisers flanking the camera
  const p1 = spawnCar('cruiser', BOULEVARD_X - 4.5, 27, Math.PI, 0xf2f2f2, { ai: 'pursue' });
  p1.unit = 'UNIT-168';
  const p2 = spawnCar('cruiser', BOULEVARD_X + 8.5, 29, Math.PI, 0xf2f2f2, { ai: 'pursue' });
  p2.unit = 'UNIT-166';
  clearPedsNear(BOULEVARD_X, 0, 46);
  crowd(-196, 60, 4, 41, ['idle']);
  G.wanted = 4.4;
  G.heliSeesPlayer = true;
  setHeliAltitude(22);
  setHeliOrbit(-3.53);
  fakeMission(1, 1);
  stageCamera(BOULEVARD_X + 6.5, 3.8, 36.5, BOULEVARD_X + 2.5, 1.0, -4);
}
function stageCombat() {
  G.timeHours = 22.1;
  G.cash = 1980; G.respect = 780; G.rankIndex = rankFor(780);
  G.weapons.smg.unlocked = true; G.weapons.smg.ammo = 64;
  G.weapons.shotgun.unlocked = true; G.weapons.shotgun.ammo = 7;
  G.weapons.pistol.ammo = 26;
  G.weapon = 'shotgun';
  const at = PLACES.containerYard;
  const player = spawnPlayer(at.x - 5.6, at.z - 5.4, { heading: 0.62, weapon: 'shotgun' });
  applyPose(player.fig, 'fire');
  player.pose = 'fire';
  // the red-shirt ally beside Rocco, trading fire with the yard crew
  const ally = spawnPedAt(at.x - 4.0, at.z - 3.2, 'ally', {
    name: 'tito', color: 0xd8402e, heading: 0.9, pose: 'fire', weapon: 'smg',
  });
  // staged PDP cruiser the officers deployed from
  const copCar = spawnCar('cruiser', at.x + 2.5, at.z + 7, 0.4, 0xf2f2f2, { parked: true });
  copCar.unit = 'UNIT-166';
  // four standing officers firing + one downed in the foreground
  spawnOfficerAt(at.x - 0.8, at.z + 1.8, { phase: 'fire', homeCar: copCar, heading: -2.2 });
  spawnOfficerAt(at.x - 3.6, at.z + 13.6, { phase: 'fire', homeCar: copCar, heading: -2.6 });
  spawnOfficerAt(at.x - 7.2, at.z + 7.8, { phase: 'fire', homeCar: copCar, heading: -1.8, target: ally });
  const offCiv = spawnOfficerAt(at.x + 4.4, at.z - 5.0, { phase: 'fire', homeCar: copCar, heading: 2.6, target: ally });
  spawnOfficerAt(at.x - 6.4, at.z - 1.0, { phase: 'down', homeCar: copCar, heading: 1.25 });
  // surrendering civilian by the crates + a downed hostile in the open
  spawnPedAt(at.x + 5.8, at.z - 6.4, 'stand', { pose: 'surrender', color: 0xb98cff });
  spawnPedAt(at.x + 1.8, at.z + 4.6, 'stand', { pose: 'down', color: 0x7a4a8f });
  G.volley = true;
  G.wanted = 2.4;
  fakeMission(2, 1);
  stageCamera(at.x - 9.5, 2.7, at.z - 8.5, at.x + 1.2, 1.0, at.z + 2.8);
}
const SHOT_STAGES = { cover: stageCover, drive: stageDrive, chase: stageChase, combat: stageCombat };
function setupShot(name) {
  resetStage();
  G.shotMode = true;
  G.shotName = name;
  const fn = SHOT_STAGES[name] || stageCover;
  fn();
  refreshRoute();
}
