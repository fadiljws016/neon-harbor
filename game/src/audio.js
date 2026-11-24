// audio.js — all-synth WebAudio: engine hum, Radio Noche 101.7 chord loop,
// gunshots, hits, explosions, the PDP siren. No audio files, works offline,
// starts on the first user gesture.

let AC = null, engineOsc = null, engineGain = null, radioTimer = null;
function initAudioOnce() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    // engine: two detuned saws through a lowpass, gain follows speed
    engineOsc = AC.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const engineFilter = AC.createBiquadFilter();
    engineFilter.type = 'lowpass'; engineFilter.frequency.value = 320;
    engineGain = AC.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(AC.destination);
    engineOsc.start();
    startRadioLoop();
  } catch (e) { AC = null; }
}
function setEngineLevel(v) {
  if (!AC || !engineGain) return;
  const target = G.player && G.player.car ? 0.015 + v * 0.05 : 0;
  engineGain.gain.setTargetAtTime(target, AC.currentTime, 0.12);
  if (engineOsc) engineOsc.frequency.setTargetAtTime(50 + v * 130, AC.currentTime, 0.1);
}
function blip(freq, dur, type, gain, slideTo) {
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'square';
  o.frequency.value = freq;
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, AC.currentTime + dur);
  g.gain.setValueAtTime(gain, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
  o.connect(g); g.connect(AC.destination);
  o.start(); o.stop(AC.currentTime + dur);
}
function noiseBurst(dur, gain, filterFreq) {
  if (!AC) return;
  const len = Math.floor(AC.sampleRate * dur);
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = AC.createBufferSource(); src.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq || 1800;
  const g = AC.createGain(); g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(AC.destination);
  src.start();
}
function audioShot(kind) {
  noiseBurst(0.11, kind === 'player' ? 0.16 : 0.07, 2600);
  blip(160, 0.07, 'square', 0.05, 60);
}
function audioHit() { blip(220, 0.08, 'triangle', 0.08, 90); }
function audioExplosion() {
  noiseBurst(0.7, 0.3, 500);
  blip(70, 0.6, 'sine', 0.22, 30);
}
function audioSiren() { blip(660, 0.22, 'sine', 0.03, 990); }
// Radio Noche 101.7: a slow synthwave chord pad, Am – F – C – G
function startRadioLoop() {
  if (!AC || radioTimer) return;
  const chords = [
    [110, 164.8, 261.6], [87.3, 130.8, 220], [130.8, 196, 329.6], [98, 146.8, 246.9],
  ];
  let ci = 0;
  function pad() {
    if (!AC || !G.radioOn) return;
    const chord = chords[ci % chords.length]; ci++;
    for (const f of chord) {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0, AC.currentTime);
      g.gain.linearRampToValueAtTime(0.016, AC.currentTime + 0.7);
      g.gain.linearRampToValueAtTime(0, AC.currentTime + 3.4);
      o.connect(g); g.connect(AC.destination);
      o.start(); o.stop(AC.currentTime + 3.5);
    }
  }
  pad();
  radioTimer = setInterval(pad, 3400);
}
