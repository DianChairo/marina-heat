// audio.js — every sound is synthesized with WebAudio; there are no audio files.
// Engine hum and the police siren are continuous nodes whose parameters follow game state;
// everything else is a short one-shot built from oscillators and filtered noise.
export class AudioSys {
  constructor() {
    this.ctx = null; this.muted = false; this.master = null;
    this.engineOsc = null; this.engineGain = null; this.engineFilter = null;
    this.sirenOsc = null; this.sirenGain = null; this.sirenTimer = 0;
    this.padTimer = 0;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(ctx.destination);
    // Engine: a detuned saw pair through a lowpass, gain driven by speed each frame.
    this.engineOsc = ctx.createOscillator(); this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 55;
    const sub = ctx.createOscillator(); sub.type = 'square'; sub.frequency.value = 28;
    this.engineFilter = ctx.createBiquadFilter(); this.engineFilter.type = 'lowpass'; this.engineFilter.frequency.value = 320;
    this.engineGain = ctx.createGain(); this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter); sub.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start(); sub.start(); this.subOsc = sub;
    // Siren: a triangle whose frequency update() wobbles between two tones.
    this.sirenOsc = ctx.createOscillator(); this.sirenOsc.type = 'triangle'; this.sirenOsc.frequency.value = 700;
    this.sirenGain = ctx.createGain(); this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.5; return this.muted; }
  tone(freq, dur, type = 'sine', vol = 0.2, slideTo = 0, delay = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  noise(dur, vol, freq = 1200, q = 0.8, delay = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, (dur * this.ctx.sampleRate) | 0);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t0);
  }
  shoot() { this.noise(0.14, 0.5, 900, 0.4); this.tone(150, 0.1, 'square', 0.25, 40); }
  dryFire() { this.tone(1200, 0.03, 'square', 0.08); }
  crash(big) { this.noise(0.28, big ? 0.6 : 0.35, 300, 0.5); this.tone(70, 0.25, 'sine', 0.4, 30); }
  honk() { this.tone(370, 0.18, 'square', 0.12); this.tone(466, 0.18, 'square', 0.1, 0, 0.01); }
  cash() { this.tone(880, 0.09, 'sine', 0.2); this.tone(1318, 0.14, 'sine', 0.2, 0, 0.08); }
  sting(good) { if (good) { this.tone(523, 0.12, 'triangle', 0.22); this.tone(659, 0.12, 'triangle', 0.22, 0, 0.1); this.tone(784, 0.22, 'triangle', 0.24, 0, 0.2); } else { this.tone(220, 0.3, 'sawtooth', 0.18, 110); } }
  phone() { this.tone(1046, 0.07, 'sine', 0.15); this.tone(1046, 0.07, 'sine', 0.15, 0, 0.12); }
  door() { this.tone(180, 0.08, 'sine', 0.2, 90); this.noise(0.05, 0.12, 500); }
  step() { this.noise(0.03, 0.03, 700); }
  update(dt, driving, speedRatio, policeActive) {
    if (!this.ctx) return;
    if (this.engineGain) {
      const target = driving ? 0.05 + speedRatio * 0.11 : 0;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
      const f = 50 + speedRatio * 130;
      this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
      if (this.subOsc) this.subOsc.frequency.setTargetAtTime(f * 0.5, this.ctx.currentTime, 0.05);
      this.engineFilter.frequency.setTargetAtTime(280 + speedRatio * 900, this.ctx.currentTime, 0.1);
    }
    if (this.sirenGain) {
      this.sirenTimer += dt;
      const on = policeActive && !this.muted;
      this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.2);
      if (on) this.sirenOsc.frequency.setTargetAtTime((Math.sin(this.sirenTimer * 5.2) > 0 ? 950 : 700), this.ctx.currentTime, 0.03);
    }
    // Ambient pad: a slow warm chord drifts in every few seconds at very low volume.
    this.padTimer -= dt;
    if (this.padTimer <= 0) {
      this.padTimer = 6.5;
      this.tone(196, 5.5, 'triangle', 0.028);
      this.tone(294, 5.5, 'triangle', 0.02, 0, 0.4);
      this.tone(392, 5.5, 'sine', 0.014, 0, 0.9);
    }
  }
}
