// audio.js — synthesized WebAudio sound effects, no audio files.
// Engine hum, police siren, gunshots, crashes, phone blips and cash
// register chirps are all built from oscillators and filtered noise.
export function createAudio() {
  const audio = {
    ctx: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenOn: false,
    init() {
      if (audio.ctx) {
        if (audio.ctx.state === 'suspended') audio.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio.ctx = new AC();
      // Engine: low sawtooth through a lowpass, gain follows speed.
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 60;
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engineOsc.connect(filter);
      filter.connect(audio.engineGain);
      audio.engineGain.connect(audio.ctx.destination);
      audio.engineOsc.start();
      // Siren: triangle that wails up and down.
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = 'triangle';
      audio.sirenOsc.frequency.value = 700;
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0;
      audio.sirenOsc.connect(audio.sirenGain);
      audio.sirenGain.connect(audio.ctx.destination);
      audio.sirenOsc.start();
    },
    setMuted(m) {
      audio.muted = m;
      if (audio.ctx) audio.ctx.destination.gain?.value !== undefined;
      if (audio.engineGain) audio.engineGain.gain.value = m ? 0 : audio.engineGain.gain.value;
    },
    engine(speedNorm) {
      if (!audio.ctx || audio.muted) {
        if (audio.engineGain) audio.engineGain.gain.value = 0;
        return;
      }
      audio.engineOsc.frequency.value = 55 + speedNorm * 160;
      audio.engineGain.gain.setTargetAtTime(0.02 + speedNorm * 0.05, audio.ctx.currentTime, 0.1);
    },
    siren(on, t) {
      audio.sirenOn = on;
      if (!audio.ctx) return;
      if (!on || audio.muted) {
        audio.sirenGain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.1);
        return;
      }
      audio.sirenOsc.frequency.value = 650 + Math.sin(t * 4) * 260;
      audio.sirenGain.gain.setTargetAtTime(0.035, audio.ctx.currentTime, 0.1);
    },
    blip(freq, dur, type, vol) {
      if (!audio.ctx || audio.muted) return;
      const o = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.08, audio.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + dur);
      o.connect(g);
      g.connect(audio.ctx.destination);
      o.start();
      o.stop(audio.ctx.currentTime + dur);
    },
    noise(dur, vol, freq) {
      if (!audio.ctx || audio.muted) return;
      const len = Math.floor(audio.ctx.sampleRate * dur);
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq || 1200;
      const g = audio.ctx.createGain();
      g.gain.value = vol || 0.15;
      src.connect(filter);
      filter.connect(g);
      g.connect(audio.ctx.destination);
      src.start();
    },
    shot() {
      audio.noise(0.12, 0.22, 2400);
      audio.blip(180, 0.08, 'square', 0.1);
    },
    crash() {
      audio.noise(0.3, 0.25, 500);
    },
    cash() {
      audio.blip(880, 0.09, 'sine', 0.1);
      setTimeout(() => audio.blip(1320, 0.12, 'sine', 0.1), 90);
    },
    phone() {
      audio.blip(660, 0.12, 'sine', 0.09);
      setTimeout(() => audio.blip(660, 0.12, 'sine', 0.09), 160);
    },
    busted() {
      audio.blip(220, 0.4, 'sawtooth', 0.12);
      setTimeout(() => audio.blip(165, 0.5, 'sawtooth', 0.12), 300);
    },
  };
  return audio;
}
