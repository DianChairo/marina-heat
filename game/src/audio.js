// Tiny WebAudio synth for gunshots, pickups and busts. Everything is
// guarded: no audio context exists until the first user gesture, and a
// missing or suspended context is a silent no-op, never an error.
export function makeAudio() {
  const audio = {
    ctx: null,
    enabled: false,
    ensure() {
      try {
        if (!audio.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return null;
          audio.ctx = new AC();
        }
        if (audio.ctx.state === 'suspended') void audio.ctx.resume();
        audio.enabled = true;
        return audio.ctx;
      } catch {
        return null;
      }
    },
    blip(freq, dur, type, gain) {
      const ctx = audio.ensure();
      if (!ctx) return;
      try {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type || 'square';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(gain || 0.05, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + dur);
      } catch {
        // Audio is cosmetic; never break the game.
      }
    },
    shoot() {
      audio.blip(160, 0.09, 'square', 0.06);
    },
    pickup() {
      audio.blip(660, 0.12, 'sine', 0.07);
      setTimeout(() => audio.blip(880, 0.14, 'sine', 0.07), 90);
    },
    busted() {
      audio.blip(220, 0.3, 'sawtooth', 0.06);
    },
    hit() {
      audio.blip(110, 0.08, 'triangle', 0.05);
    },
  };
  return audio;
}
