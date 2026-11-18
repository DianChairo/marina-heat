// audio.js — WebAudio synthesized sound effects. No audio files: every
// sound is built from oscillators and filtered noise at play time.
// The context is created lazily on the first user gesture.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
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

  setMuted(m) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(m ? 0 : 0.5, this.ctx.currentTime);
    }
  }

  tone(freq, dur, type = 'square', vol = 0.2, slideTo = null, delay = 0) {
    if (!this.ensure()) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, vol = 0.25, freq = 1800, delay = 0) {
    if (!this.ensure()) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  }

  shot() {
    this.noise(0.09, 0.32, 900);
    this.tone(160, 0.08, 'square', 0.16, 55);
  }

  hit() {
    this.noise(0.05, 0.18, 2600);
  }

  crash(intensity = 1) {
    this.noise(0.22, 0.3 * intensity, 420);
    this.tone(90, 0.2, 'triangle', 0.22 * intensity, 40);
  }

  pickup() {
    this.tone(660, 0.09, 'sine', 0.22);
    this.tone(990, 0.14, 'sine', 0.22, null, 0.08);
  }

  success() {
    this.tone(523, 0.12, 'triangle', 0.24);
    this.tone(659, 0.12, 'triangle', 0.24, null, 0.11);
    this.tone(784, 0.22, 'triangle', 0.26, null, 0.22);
  }

  fail() {
    this.tone(320, 0.16, 'sawtooth', 0.18, 240);
    this.tone(210, 0.3, 'sawtooth', 0.18, 130, 0.14);
  }

  phone() {
    this.tone(1244, 0.09, 'sine', 0.16);
    this.tone(1244, 0.09, 'sine', 0.16, null, 0.14);
  }

  door() {
    this.tone(140, 0.07, 'square', 0.14, 90);
  }

  setEngine(on, speedRatio = 0) {
    if (!this.ensure()) return;
    if (on && !this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineGain.gain.value = 0.0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      this.engineOsc.connect(filter).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
    }
    if (this.engineOsc) {
      const t = this.ctx.currentTime;
      this.engineOsc.frequency.setTargetAtTime(55 + speedRatio * 130, t, 0.08);
      this.engineGain.gain.setTargetAtTime(on ? 0.05 + speedRatio * 0.05 : 0, t, 0.1);
      if (!on) {
        const osc = this.engineOsc;
        const gain = this.engineGain;
        this.engineOsc = null;
        this.engineGain = null;
        setTimeout(() => {
          try { osc.stop(); } catch { /* already stopped */ }
          try { gain.disconnect(); } catch { /* already gone */ }
        }, 300);
      }
    }
  }

  setSiren(on, dt = 0) {
    if (!this.ensure()) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();
      this.sirenOsc.type = 'triangle';
      this.sirenGain.gain.value = 0.035;
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
    }
    if (this.sirenOsc) {
      if (on) {
        this.sirenPhase += dt * 2.4;
        const f = 720 + Math.sin(this.sirenPhase * Math.PI * 2) * 190;
        this.sirenOsc.frequency.setValueAtTime(f, this.ctx.currentTime);
      } else {
        const osc = this.sirenOsc;
        this.sirenOsc = null;
        this.sirenGain = null;
        try { osc.stop(); } catch { /* already stopped */ }
      }
    }
  }
}
