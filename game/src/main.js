// main.js — boot + the frame loop. Two modes: live play (default) and
// shot mode (?shot=cover|drive|chase|combat) where the clock freezes and
// shots.js stages the frame for the capture tool.

let lastT = 0, mapRefreshT = 0, shotFrames = 0;
// The capture tool waits for this flag: staging is settled and the staged
// volley has been trading fire long enough to catch an exchange.
window.__shotReady = false;
function boot() {
  const container = document.getElementById('game');
  initWorld(container);
  initEffects(G.scene);
  initHeli(G.scene);
  initCamera();
  initInput();
  initHUD();
  initMinimap();

  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const splash = document.getElementById('splash');
  if (shot && SHOT_STAGES[shot]) {
    G.started = true;
    setupShot(shot);
    if (splash) splash.style.display = 'none';
  } else {
    // live game
    if (!loadSave()) {
      G.cash = 120; G.respect = 0; G.mission.index = 0;
    }
    G.rankIndex = rankFor(G.respect);
    spawnPlayer(-112, -6, { heading: 1.4, weapon: 'pistol' });
    populateAmbient();
    initTraffic(14);
    if (splash) {
      splash.addEventListener('click', () => {
        splash.style.display = 'none';
        G.started = true;
        initAudioOnce();
        startMission(G.mission.index || 0);
      });
    } else {
      G.started = true;
      startMission(G.mission.index || 0);
    }
    // keyboard start as well
    window.addEventListener('keydown', function kick() {
      if (!G.started && splash && splash.style.display !== 'none') {
        splash.style.display = 'none';
        G.started = true;
        startMission(G.mission.index || 0);
      }
      window.removeEventListener('keydown', kick);
    });
  }
  requestAnimationFrame(frame);
}
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, lastT ? (t - lastT) / 1000 : 0.016);
  lastT = t;
  G.elapsed += dt;
  if (!G.shotMode) {
    // the night deepens very slowly in live play, 21.0 -> 23.5 and back
    G.timeHours = 22.25 + Math.sin(G.elapsed * 0.01) * 1.2;
    updatePlayer(dt);
    playerShoot(dt, isMouseDown());
    updateTraffic(dt);
    updatePolice(dt);
    updateMissions(dt);
  } else {
    // staged frames still breathe: crowd walks, the volley trades fire,
    // wheels spin — but nobody leaves their mark
    playerFireTimer = 0;
    shotFrames++;
    if (shotFrames % 20 === 0) refreshDispatch();
    if (shotFrames > 45) window.__shotReady = true;
  }
  updatePeds(dt);
  updateOfficers(dt);
  updateCombat(dt);
  updateEffects(dt);
  updateCarsFx(dt);
  updateHeli(dt);
  updateWorld(dt);
  updateCamera(dt);
  refreshHUD();
  drawCornerMap();
  if (G.mapOpen) {
    mapRefreshT -= dt;
    if (mapRefreshT <= 0) { drawFullMap(); mapRefreshT = 0.2; }
    const ov = document.getElementById('mapOverlay');
    if (ov) ov.style.display = 'flex';
  } else {
    const ov = document.getElementById('mapOverlay');
    if (ov) ov.style.display = 'none';
  }
  G.renderer.render(G.scene, G.camera);
}
document.addEventListener('DOMContentLoaded', boot);
