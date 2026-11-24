// world.js — renderer, night sky painting, moon + lights, fog, the rain
// drizzle, sea. Bahía Noche is permanently after dark: the staged hours
// (21.0-23.5) only nudge the palette, the regime never changes.

const NIGHT_SKY = { sky: 0x16224d, skyTop: 0x050914, band: 0x27356e };

let skyMesh = null, skyTex = null, rainPts = null, rainData = null;
let moonLight = null;

function paintSky() {
  const c = makeCanvas(1024, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    const top = '#' + NIGHT_SKY.skyTop.toString(16).padStart(6, '0');
    const band = '#' + NIGHT_SKY.band.toString(16).padStart(6, '0');
    const sky = '#' + NIGHT_SKY.sky.toString(16).padStart(6, '0');
    grad.addColorStop(0, top);
    grad.addColorStop(0.34, band);
    grad.addColorStop(0.55, sky);
    grad.addColorStop(0.62, sky);
    grad.addColorStop(1, sky);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    // stars
    for (let i = 0; i < 420; i++) {
      const y = rng() * h * 0.6;
      g.fillStyle = `rgba(255,255,255,${rand(0.25, 0.95) * (1 - y / (h * 0.75))})`;
      const s = chance(0.12) ? 2.2 : 1.2;
      g.fillRect(rng() * w, y, s, s);
    }
    // moon glow, upper right
    const mg = g.createRadialGradient(w * 0.78, h * 0.16, 4, w * 0.78, h * 0.16, 90);
    mg.addColorStop(0, 'rgba(230,238,255,0.95)');
    mg.addColorStop(0.18, 'rgba(185,204,255,0.5)');
    mg.addColorStop(1, 'rgba(185,204,255,0)');
    g.fillStyle = mg;
    g.fillRect(w * 0.78 - 90, h * 0.16 - 90, 180, 180);
    g.fillStyle = '#eef3ff';
    g.beginPath(); g.arc(w * 0.78, h * 0.16, 15, 0, Math.PI * 2); g.fill();
    // horizon neon haze — the city's glow on the skyline band
    const haze = g.createLinearGradient(0, h * 0.52, 0, h * 0.72);
    haze.addColorStop(0, 'rgba(255,79,163,0)');
    haze.addColorStop(0.55, 'rgba(255,79,163,0.13)');
    haze.addColorStop(0.75, 'rgba(87,215,232,0.10)');
    haze.addColorStop(1, 'rgba(87,215,232,0)');
    g.fillStyle = haze;
    g.fillRect(0, h * 0.52, w, h * 0.2);
    // flat cloud smudges
    g.fillStyle = 'rgba(20,28,58,0.5)';
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.ellipse(rng() * w, rng() * h * 0.4, rand(60, 150), rand(7, 14), 0, 0, Math.PI * 2);
      g.fill();
    }
  });
  if (skyTex) skyTex.image = c, skyTex.needsUpdate = true;
  else skyTex = texFromCanvas(c, false);
  return skyTex;
}

function initWorld(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  container.appendChild(renderer.domElement);
  G.renderer = renderer;
  G.canvas = renderer.domElement;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x131f3d, 150, 760);
  G.scene = scene;
  G.isDusk = true; // night reads as dusk for the heli beam logic

  const camera = new THREE.PerspectiveCamera(58, container.clientWidth / container.clientHeight, 0.1, 1600);
  camera.position.set(-140, 30, 60);
  camera.lookAt(-100, 0, 0);
  G.camera = camera;

  // sky dome
  skyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1200, 24, 14),
    new THREE.MeshBasicMaterial({ map: paintSky(), side: THREE.BackSide, fog: false }));
  scene.add(skyMesh);

  // lights — moon key light + hemisphere + ambient floor (brightness carriers)
  moonLight = new THREE.DirectionalLight(0xb9ccff, 0.5);
  moonLight.position.set(180, 260, -120);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  moonLight.shadow.camera.left = -160; moonLight.shadow.camera.right = 160;
  moonLight.shadow.camera.top = 160; moonLight.shadow.camera.bottom = -160;
  moonLight.shadow.camera.far = 700;
  scene.add(moonLight);
  scene.add(moonLight.target);
  const hemi = new THREE.HemisphereLight(0x7a8fc9, 0x1a2233, 0.55);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight(0x2c3a5e, 0.5));

  buildCity(scene);
  initRain(scene);
  window.addEventListener('resize', () => {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  return { renderer, scene, camera };
}

// ---------- rain: one Points pool of short streaks around the camera ----------
function initRain(scene) {
  const N = 900;
  const pos = new Float32Array(N * 3);
  rainData = new Float32Array(N * 2); // speed, sway phase
  for (let i = 0; i < N; i++) {
    pos[i * 3] = rand(-60, 60); pos[i * 3 + 1] = rand(0, 45); pos[i * 3 + 2] = rand(-60, 60);
    rainData[i * 2] = rand(26, 40); rainData[i * 2 + 1] = rng() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x9fc4e8, size: 0.55, transparent: true, opacity: 0.34,
    map: softDotTexture(32, 'rgba(200,225,255,1)', 'rgba(200,225,255,0)'),
    depthWrite: false, sizeAttenuation: true,
  });
  rainPts = new THREE.Points(geo, mat);
  rainPts.frustumCulled = false;
  scene.add(rainPts);
}
function updateWorld(dt) {
  if (skyMesh && G.camera) {
    skyMesh.position.copy(G.camera.position);
  }
  if (moonLight && G.player) {
    const p = G.player.fig ? G.player.fig.position : { x: 0, z: 0 };
    moonLight.position.set(p.x + 180, 260, p.z - 120);
    moonLight.target.position.set(p.x, 0, p.z);
  }
  if (rainPts && G.camera) {
    const cp = G.camera.position;
    rainPts.position.set(cp.x, 0, cp.z);
    const pos = rainPts.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - rainData[i * 2] * dt;
      if (y < 0) y = 45;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(G.elapsed * 2 + rainData[i * 2 + 1]) * dt * 0.7);
    }
    pos.needsUpdate = true;
  }
  updateCity(dt);
}
