// audio.js — a tiny WebAudio synth: engine hum, sirens, gunshots,
// pickups and UI blips. No audio files; everything is oscillators and
// filtered noise. The context is created lazily on the first user
// gesture so browsers never block it.

export class AudioEngine {
  constructor(save) {
    this.ctx = null;
    this.master = null;
    this.muted = !!(save && save.muted);
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenPhase = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(muted ? 0 : 0.5, this.ctx.currentTime);
    }
  }

  blip(freq = 660, dur = 0.07, type = 'square', vol = 0.15) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  pickup() {
    this.blip(880, 0.09, 'sine', 0.2);
    setTimeout(() => this.blip(1320, 0.12, 'sine', 0.18), 60);
  }

  cash() {
    this.blip(1175, 0.08, 'triangle', 0.22);
    setTimeout(() => this.blip(1568, 0.14, 'triangle', 0.2), 70);
  }

  shot() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.09);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.25;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  crash(intensity = 0.3) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.25);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len) * intensity;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.6;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  // Continuous engine note while driving; speed 0..1.
  engine(on, speed) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    if (on && !this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineGain.gain.value = 0.0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start(t);
    }
    if (this.engineOsc) {
      const target = on ? 0.05 + speed * 0.05 : 0;
      this.engineGain.gain.setTargetAtTime(target, t, 0.08);
      this.engineOsc.frequency.setTargetAtTime(55 + speed * 130, t, 0.08);
      if (!on && target === 0) {
        const osc = this.engineOsc;
        this.engineOsc = null;
        this.engineGain = null;
        setTimeout(() => {
          try { osc.stop(); } catch { /* already stopped */ }
        }, 250);
      }
    }
  }

  // Two-tone siren while police are close; level 0..1.
  siren(on, dt) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();
      this.sirenOsc.type = 'triangle';
      this.sirenGain.gain.value = 0.035;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start(t);
    }
    if (this.sirenOsc) {
      if (!on) {
        const osc = this.sirenOsc;
        this.sirenOsc = null;
        this.sirenGain = null;
        try { osc.stop(); } catch { /* already stopped */ }
        return;
      }
      this.sirenPhase += dt * 2.4;
      const f = Math.sin(this.sirenPhase * Math.PI * 2) > 0 ? 720 : 540;
      this.sirenOsc.frequency.setValueAtTime(f, t);
    }
  }
}
