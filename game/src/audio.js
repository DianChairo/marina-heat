// Fully synthesized WebAudio: engine, siren, gunshot, crash, blips, pad. No files.
let ctx = null, master, engineOsc, engineGain, sirenOsc, sirenGain, padTimer = 0;
let muted = false;
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
    const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 400;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engineOsc.connect(ef); ef.connect(engineGain); engineGain.connect(master); engineOsc.start();
    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
  } catch { ctx = null; }
}
export function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; }
export function isMuted() { return muted; }
function env(node, t0, a, peak, d) { node.gain.setValueAtTime(0, t0); node.gain.linearRampToValueAtTime(peak, t0 + a); node.gain.exponentialRampToValueAtTime(0.001, t0 + a + d); }
export function sfx(name, opt = {}) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  if (name === 'shot') {
    const src = ctx.createBufferSource(); const buf = ctx.createBuffer(1, 2205, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    src.buffer = buf; const g = ctx.createGain(); env(g, t, 0.002, 0.5, 0.09);
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 500;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  } else if (name === 'crash') {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.25);
    const g = ctx.createGain(); env(g, t, 0.005, Math.min(0.7, 0.2 + (opt.force || 0.3)), 0.3);
    o.connect(g); g.connect(master); o.start(); o.stop(t + 0.4);
  } else if (name === 'cash' || name === 'sting' || name === 'honk' || name === 'blip') {
    const notes = name === 'cash' ? [880, 1320] : name === 'sting' ? [523, 659, 784] : name === 'honk' ? [370] : [660];
    notes.forEach((fr, i) => {
      const o = ctx.createOscillator(); o.type = name === 'honk' ? 'square' : 'sine'; o.frequency.value = fr;
      const g = ctx.createGain(); env(g, t + i * 0.09, 0.01, name === 'honk' ? 0.12 : 0.22, name === 'honk' ? 0.25 : 0.18);
      o.connect(g); g.connect(master); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.3);
    });
  } else if (name === 'door') {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 90;
    const g = ctx.createGain(); env(g, t, 0.005, 0.3, 0.12); o.connect(g); g.connect(master); o.start(); o.stop(t + 0.2);
  }
}
export function updateAudio(dt, speedRatio, policeActive, driving) {
  if (!ctx) return;
  padTimer -= dt;
  if (padTimer <= 0) { // ambient pad chord
    padTimer = 4;
    if (!muted) {
      const t = ctx.currentTime;
      [220, 277, 330].forEach((fr) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 1.2); g.gain.linearRampToValueAtTime(0, t + 3.8);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + 4);
      });
    }
  }
  if (engineGain) {
    const target = driving && !muted ? 0.05 + Math.abs(speedRatio) * 0.06 : 0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(55 + Math.abs(speedRatio) * 130, ctx.currentTime, 0.08);
  }
  if (sirenGain) {
    sirenGain.gain.setTargetAtTime(policeActive && !muted ? 0.045 : 0, ctx.currentTime, 0.2);
    if (policeActive) sirenOsc.frequency.value = (performance.now() % 900) < 450 ? 720 : 960;
  }
}
