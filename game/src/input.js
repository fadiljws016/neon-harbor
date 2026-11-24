// input.js — keyboard + mouse state, pause key, pointer aim.
// Plain listeners writing into shared objects the sim reads each frame.

export const keys = { w: false, a: false, s: false, d: false, e: false, shift: false, mouse: false };
export const mouse = { x: 0, y: 0, down: false, rightDown: false };

const KEYMAP = {
  KeyW: 'w', ArrowUp: 'w',
  KeyA: 'a', ArrowLeft: 'a',
  KeyS: 's', ArrowDown: 's',
  KeyD: 'd', ArrowRight: 'd',
  KeyE: 'e',
  ShiftLeft: 'shift', ShiftRight: 'shift',
};

let pauseHandler = null;
let interactHandler = null;
let mapHandler = null;
let weaponHandler = null;

export function onPause(fn) { pauseHandler = fn; }
export function onInteract(fn) { interactHandler = fn; }
export function onMapToggle(fn) { mapHandler = fn; }
export function onWeaponKey(fn) { weaponHandler = fn; }

export function initInput(canvas) {
  window.addEventListener('keydown', (ev) => {
    const k = KEYMAP[ev.code];
    if (k) { keys[k] = true; if (k === 'e' && !ev.repeat && interactHandler) interactHandler(); }
    if ((ev.code === 'KeyM') && !ev.repeat && mapHandler) mapHandler();
    if (ev.code === 'Digit1' && weaponHandler) weaponHandler(0);
    if (ev.code === 'Digit2' && weaponHandler) weaponHandler(1);
    if (ev.code === 'Digit3' && weaponHandler) weaponHandler(2);
    if (ev.code === 'Digit4' && weaponHandler) weaponHandler(3);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) ev.preventDefault();
  });
  window.addEventListener('keyup', (ev) => {
    const k = KEYMAP[ev.code];
    if (k) keys[k] = false;
  });
  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    mouse.down = false; mouse.rightDown = false;
  });
  canvas.addEventListener('mousemove', (ev) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -(((ev.clientY - r.top) / r.height) * 2 - 1);
  });
  canvas.addEventListener('mousedown', (ev) => {
    if (ev.button === 0) { mouse.down = true; keys.mouse = true; }
    if (ev.button === 2) mouse.rightDown = true;
  });
  window.addEventListener('mouseup', (ev) => {
    if (ev.button === 0) { mouse.down = false; keys.mouse = false; }
    if (ev.button === 2) mouse.rightDown = false;
  });
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
}

export function initPauseKey() {
  window.addEventListener('keydown', (ev) => {
    if ((ev.code === 'Escape' || ev.code === 'KeyP') && pauseHandler) pauseHandler(ev.code);
  });
}
