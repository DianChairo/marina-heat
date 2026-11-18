// audio.js — synthesized WebAudio SFX for Marina Heat. No audio files:
// engine hum, police siren, gunshots, crashes and pickup chimes are all
// built from oscillators and filtered noise. M toggles mute.
export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noiseBuffer(dur) {
    const c = ensure(); if (!c) return null;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function burst(dur, freq, type, vol, slideTo) {
    const c = ensure(); if (!c || muted) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  }

  function noise(dur, vol, filterFreq) {
    const c = ensure(); if (!c || muted) return;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start();
  }

  return {
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      if (sirenGain) sirenGain.gain.value = 0;
      return muted;
    },
    shot() { noise(0.12, 0.5, 3200); burst(0.08, 220, 'square', 0.18, 60); },
    crash() { noise(0.35, 0.6, 700); burst(0.2, 90, 'sawtooth', 0.25, 40); },
    pickup() { burst(0.12, 660, 'sine', 0.22); setTimeout(() => burst(0.18, 990, 'sine', 0.22), 90); },
    phone() { burst(0.15, 880, 'sine', 0.2); setTimeout(() => burst(0.15, 880, 'sine', 0.2), 200); },
    busted() { burst(0.5, 440, 'sawtooth', 0.25, 110); },
    setEngine(on, speed01) {
      const c = ensure(); if (!c) return;
      if (!on) { if (engineGain) engineGain.gain.value = 0; return; }
      if (!engineOsc) {
        engineOsc = c.createOscillator();
        engineGain = c.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 70;
        engineGain.gain.value = 0;
        const f = c.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 420;
        engineOsc.connect(f).connect(engineGain).connect(c.destination);
        engineOsc.start();
      }
      engineOsc.frequency.value = 60 + speed01 * 160;
      engineGain.gain.value = muted ? 0 : 0.05 + speed01 * 0.05;
    },
    setSiren(on) {
      const c = ensure(); if (!c) return;
      if (!on) { if (sirenGain) sirenGain.gain.value = 0; return; }
      if (!sirenOsc) {
        sirenOsc = c.createOscillator();
        sirenGain = c.createGain();
        sirenOsc.type = 'triangle';
        sirenOsc.frequency.value = 700;
        sirenGain.gain.value = 0;
        const lfo = c.createOscillator();
        const lfoGain = c.createGain();
        lfo.frequency.value = 0.9;
        lfoGain.gain.value = 260;
        lfo.connect(lfoGain).connect(sirenOsc.frequency);
        lfo.start();
        sirenOsc.connect(sirenGain).connect(c.destination);
        sirenOsc.start();
      }
      sirenGain.gain.value = muted ? 0 : 0.045;
    },
  };
}
