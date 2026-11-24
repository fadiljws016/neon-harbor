// input.js — keyboard + mouse. WASD move/drive, E interact (dialogue,
// car entry, mission points), M/ESC the map, 1-4 weapon slots, click fire.

let mouseDown = false;
function initInput() {
  window.addEventListener('keydown', (ev) => {
    G.keys[ev.code] = true;
    if (ev.code === 'KeyE') onInteractKey();
    if (ev.code === 'KeyM') { if (!G.shotMode) { G.mapOpen = !G.mapOpen; if (G.mapOpen) drawFullMap(); } }
    if (ev.code === 'Escape') G.mapOpen = false;
    if (ev.code === 'Digit1') selectWeapon('fists');
    if (ev.code === 'Digit2') selectWeapon('pistol');
    if (ev.code === 'Digit3') selectWeapon('smg');
    if (ev.code === 'Digit4') selectWeapon('shotgun');
    if (['ArrowUp', 'ArrowDown', 'Space'].includes(ev.code)) ev.preventDefault();
    initAudioOnce();
  });
  window.addEventListener('keyup', (ev) => { G.keys[ev.code] = false; });
  window.addEventListener('mousedown', (ev) => {
    if (ev.target === G.canvas) { mouseDown = true; initAudioOnce(); }
  });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  window.addEventListener('blur', () => { G.keys = {}; mouseDown = false; });
}
function isMouseDown() { return mouseDown; }
function selectWeapon(w) {
  if (G.weapons[w] && G.weapons[w].unlocked) {
    G.weapon = w;
    if (G.player && !G.player.car) {
      setFigureWeapon(G.player.fig, w === 'fists' ? null : w);
    }
  }
}
function onInteractKey() {
  if (G.dialogue) { advanceDialogue(); return; }
  if (G.shotMode || !G.started || G.dead) return;
  const player = G.player;
  if (!player) return;
  if (player.car) { exitCar(); return; }
  if (tryEnterNearestCar()) return;
  interactMissionPoint();
}
