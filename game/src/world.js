// world.js — renderer, scene, the pinned Bahía Noche night: gradient sky
// dome, moonlight, fog, drizzle. Lighting values are locked by the art
// bible; do not retune them per-frame.

import { G } from './state.js';
import { clamp, lerp } from './util.js';

export const SKY = { sky: 0x16224d, top: 0x050914, band: 0x27356e };
export const FOG_COLOR = 0x131f3d;

let skyMat = null;
let moonLight = null;
let hemiLight = null;
let ambLight = null;
let rain = null;
let rainVel = null;
const RAIN_COUNT = 900;

function makeSkyTexture() {
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = 512;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#' + SKY.top.toString(16).padStart(6, '0'));
  grad.addColorStop(0.34, '#' + SKY.band.toString(16).padStart(6, '0'));
  grad.addColorStop(0.55, '#' + SKY.sky.toString(16).padStart(6, '0'));
  grad.addColorStop(0.62, '#' + SKY.sky.toString(16).padStart(6, '0'));
  grad.addColorStop(1.0, '#' + SKY.sky.toString(16).padStart(6, '0'));
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 512);
  // A smear of sodium glow low over the port.
  const glow = g.createLinearGradient(0, 300, 0, 512);
  glow.addColorStop(0, 'rgba(255,120,80,0)');
  glow.addColorStop(1, 'rgba(255,120,80,0.13)');
  g.fillStyle = glow;
  g.fillRect(0, 300, 4, 212);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildSky(scene) {
  const geo = new THREE.SphereGeometry(1500, 24, 16);
  skyMat = new THREE.MeshBasicMaterial({
    map: makeSkyTexture(), side: THREE.BackSide, fog: false, depthWrite: false,
  });
  const dome = new THREE.Mesh(geo, skyMat);
  dome.renderOrder = -10;
  scene.add(dome);
  // The moon: a pale disc hung over the harbour.
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(38, 24),
    new THREE.MeshBasicMaterial({ color: 0xdfe9ff, fog: false })
  );
  moon.position.set(-420, 520, -980);
  moon.lookAt(0, 0, 0);
  scene.add(moon);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(74, 24),
    new THREE.MeshBasicMaterial({ color: 0x8fb0e8, transparent: true, opacity: 0.16, fog: false })
  );
  halo.position.copy(moon.position).multiplyScalar(1.01);
  halo.lookAt(0, 0, 0);
  scene.add(halo);
}

function buildRain(scene) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(RAIN_COUNT * 3);
  rainVel = new Float32Array(RAIN_COUNT);
  for (let i = 0; i < RAIN_COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 90;
    pos[i * 3 + 1] = Math.random() * 42;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 90;
    rainVel[i] = 26 + Math.random() * 12;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = 16;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 16);
  grad.addColorStop(0, 'rgba(170,200,255,0)');
  grad.addColorStop(0.5, 'rgba(170,200,255,0.55)');
  grad.addColorStop(1, 'rgba(170,200,255,0)');
  g.fillStyle = grad;
  g.fillRect(1, 0, 2, 16);
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.PointsMaterial({
    size: 1.5, map: tex, transparent: true, opacity: 0.5,
    depthWrite: false, color: 0xaac4e8, sizeAttenuation: true,
  });
  rain = new THREE.Points(geo, mat);
  rain.frustumCulled = false;
  scene.add(rain);
}

export function initWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  G.renderer = renderer;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG_COLOR, 150, 760);
  G.scene = scene;

  const camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 2600);
  camera.position.set(-66, 1.5, -18);
  G.camera = camera;

  buildSky(scene);

  moonLight = new THREE.DirectionalLight(0xb9ccff, 0.5);
  moonLight.position.set(-260, 420, -520);
  scene.add(moonLight);
  hemiLight = new THREE.HemisphereLight(0x7a8fc9, 0x1a2233, 0.55);
  scene.add(hemiLight);
  ambLight = new THREE.AmbientLight(0x2c3a5e, 0.5);
  scene.add(ambLight);

  buildRain(scene);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  G.isDusk = true;
  return { renderer, scene, camera };
}

// The staged night is nearly frozen: hours creep from 21.0 toward 23.5 over
// a full session so the light never leaves the neon band. In shot mode the
// clock is pinned outright by the staging code.
export function updateWorld(dt) {
  G.t += dt;
  if (!G.shotMode) {
    G.hour = 21.0 + Math.min(2.5, G.t / 2400);
  }
  G.isDusk = G.hour >= 20.0 || G.hour < 5.0;

  // Drizzle follows the camera, wrapping inside a 90 m box.
  if (rain && G.camera) {
    const p = rain.geometry.attributes.position;
    const cx = G.camera.position.x, cz = G.camera.position.z;
    for (let i = 0; i < RAIN_COUNT; i++) {
      let y = p.getY(i) - rainVel[i] * dt;
      if (y < 0) {
        y = 38 + Math.random() * 6;
        p.setX(i, cx + (Math.random() - 0.5) * 90);
        p.setZ(i, cz + (Math.random() - 0.5) * 90);
      }
      p.setY(i, y);
    }
    rain.position.set(cx - rain.position.x * 0, 0, cz - rain.position.z * 0);
    rain.position.x = 0; rain.position.z = 0;
    p.needsUpdate = true;
  }

  // Fog breathes a touch with the harbour mist, never leaving the band.
  if (G.scene && G.scene.fog) {
    const mist = 0.5 + 0.5 * Math.sin(G.t * 0.05);
    G.scene.fog.far = lerp(720, 790, mist);
  }
  if (moonLight) moonLight.intensity = clamp(0.5 + Math.sin(G.t * 0.11) * 0.03, 0.44, 0.56);
}
