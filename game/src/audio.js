// audio.js — tiny WebAudio synth: gunshots, cash, horns, rain bed.
// Everything is generated; no audio assets ship with the game.

import { G } from './state.js';

let ctx = null;
let master = null;
let rainGain = null;
let engineOsc = null;
let engineGain = null;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch (e) { ctx = null; }
}

function noiseBuffer(dur) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export function sfxShot(kind = 'pistol') {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.16);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(kind === 'shotgun' ? 900 : 2400, t);
  filter.frequency.exponentialRampToValueAtTime(220, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(kind === 'shotgun' ? 0.5 : 0.32, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'shotgun' ? 0.3 : 0.16));
  src.connect(filter); filter.connect(g); g.connect(master);
  src.start(t); src.stop(t + 0.32);
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.09);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.16, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(og); og.connect(master);
  osc.start(t); osc.stop(t + 0.11);
}

export function sfxCash() {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const [i, f] of [1320, 1760].entries()) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t + i * 0.07);
    g.gain.exponentialRampToValueAtTime(0.14, t + i * 0.07 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.22);
    osc.connect(g); g.connect(master);
    osc.start(t + i * 0.07); osc.stop(t + i * 0.07 + 0.24);
  }
}

export function sfxHorn() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 370;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.07, t);
  g.gain.setValueAtTime(0.07, t + 0.16);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  osc.connect(g); g.connect(master);
  osc.start(t); osc.stop(t + 0.24);
}

export function startRainAmbience() {
  if (!ctx || rainGain) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(2.2);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2600;
  filter.Q.value = 0.4;
  rainGain = ctx.createGain();
  rainGain.gain.value = 0.05;
  src.connect(filter); filter.connect(rainGain); rainGain.connect(master);
  src.start();
  // Engine voice, woken when the player drives.
  engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 55;
  const ef = ctx.createBiquadFilter();
  ef.type = 'lowpass'; ef.frequency.value = 320;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  engineOsc.connect(ef); ef.connect(engineGain); engineGain.connect(master);
  engineOsc.start();
}

export function updateAudio() {
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  if (engineGain && engineOsc) {
    const driving = G.playerCar && !G.paused;
    const sp = driving ? Math.abs(G.playerCar.speed) : 0;
    engineGain.gain.value += ((driving ? 0.05 + sp * 0.0012 : 0) - engineGain.gain.value) * 0.12;
    engineOsc.frequency.value = 55 + sp * 2.6;
  }
  if (rainGain) rainGain.gain.value = G.mapOpen ? 0.025 : 0.05;
}
