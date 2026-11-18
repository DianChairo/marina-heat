// audio.js — fully synthesized WebAudio: engine, siren, shots, crashes, stings, ambient pad.
export class AudioSys {
  constructor() { this.ctx = null; this.muted = false; this.sirenNodes = null; this.engineNodes = null; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
      this.startPad();
    } catch { this.ctx = null; }
  }
  tone(freq, dur, type = 'sine', vol = 0.2, slideTo = 0, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  noise(dur, vol = 0.3, freq = 800, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay, len = Math.max(1, (dur * this.ctx.sampleRate) | 0);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t0);
  }
  shot() { this.noise(0.12, 0.5, 2400); this.tone(160, 0.09, 'square', 0.25, 60); }
  crash(v = 1) { this.noise(0.28, 0.4 * v, 500); this.tone(90, 0.25, 'triangle', 0.35 * v, 40); }
  honk() { this.tone(370, 0.16, 'square', 0.12); this.tone(466, 0.16, 'square', 0.1); }
  cash() { this.tone(880, 0.09, 'sine', 0.22); this.tone(1320, 0.14, 'sine', 0.22, 0, 0.08); }
  sting(win = true) { const n = win ? [523, 659, 784, 1046] : [392, 330, 262, 196]; n.forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.22, 0, i * 0.11)); }
  phone() { this.tone(1046, 0.08, 'sine', 0.15); this.tone(1046, 0.08, 'sine', 0.15, 0, 0.13); }
  startPad() {
    if (!this.ctx) return;
    const g = this.ctx.createGain(); g.gain.value = 0.035; g.connect(this.master);
    [110, 164.8, 220].forEach((f) => { const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(g); o.start(); });
    const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
    lfo.frequency.value = 0.07; lg.gain.value = 0.015; lfo.connect(lg); lg.connect(g.gain); lfo.start();
  }
  engine(speedRatio, driving) {
    if (!this.ctx) return;
    if (driving && !this.muted) {
      if (!this.engineNodes) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'sawtooth'; g.gain.value = 0; o.connect(g);
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; g.disconnect(); g.connect(f); f.connect(this.master);
        o.start(); this.engineNodes = { o, g };
      }
      const t = this.ctx.currentTime;
      this.engineNodes.o.frequency.setTargetAtTime(55 + speedRatio * 165, t, 0.08);
      this.engineNodes.g.gain.setTargetAtTime(0.05 + speedRatio * 0.05, t, 0.1);
    } else if (this.engineNodes) {
      this.engineNodes.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    }
  }
  siren(active) {
    if (!this.ctx) return;
    if (active && !this.muted) {
      if (!this.sirenNodes) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain(), lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
        o.type = 'triangle'; o.frequency.value = 800; g.gain.value = 0.045;
        lfo.type = 'square'; lfo.frequency.value = 0.7; lg.gain.value = 140;
        lfo.connect(lg); lg.connect(o.frequency); o.connect(g); g.connect(this.master);
        o.start(); lfo.start(); this.sirenNodes = { o, g, lfo };
      }
    } else if (this.sirenNodes) {
      try { this.sirenNodes.o.stop(); this.sirenNodes.lfo.stop(); } catch { /* done */ }
      this.sirenNodes = null;
    }
  }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.5; if (this.muted) this.siren(false); return this.muted; }
}
