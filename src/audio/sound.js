// Tiny procedural WebAudio SFX — no assets. Sounds attenuate with distance
// from the listener (the camera's focus ship).
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.listener = null; // Vector3 updated by game
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  gainFor(pos) {
    if (!pos || !this.listener) return 1;
    const d = this.listener.distanceTo(pos);
    return 1 / (1 + d / 90);
  }

  env(gainNode, peak, dur) {
    const t = this.ctx.currentTime;
    gainNode.gain.setValueAtTime(peak, t);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + dur);
  }

  noiseBuffer(dur) {
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  ready() {
    return this.ctx && !this.muted;
  }

  boom(pos) {
    if (!this.ready()) return;
    const g = this.gainFor(pos);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.5);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const gain = this.ctx.createGain();
    this.env(gain, 0.9 * g, 0.5);
    src.connect(lp).connect(gain).connect(this.master);
    src.start();

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55;
    const og = this.ctx.createGain();
    this.env(og, 0.5 * g, 0.35);
    osc.connect(og).connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  splash(pos) {
    if (!this.ready()) return;
    const g = this.gainFor(pos);
    if (g < 0.15) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.25);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1000;
    const gain = this.ctx.createGain();
    this.env(gain, 0.25 * g, 0.25);
    src.connect(bp).connect(gain).connect(this.master);
    src.start();
  }

  thud(pos) {
    if (!this.ready()) return;
    const g = this.gainFor(pos);
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    const t = this.ctx.currentTime;
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.18);
    const gain = this.ctx.createGain();
    this.env(gain, 0.6 * g, 0.2);
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(t + 0.22);
  }

  blip(freq, delay, dur = 0.09, vol = 0.3, type = 'square') {
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  coin() {
    if (!this.ready()) return;
    this.blip(1320, 0, 0.07, 0.18);
    this.blip(1760, 0.06, 0.1, 0.18);
  }

  fanfare() {
    if (!this.ready()) return;
    this.blip(523, 0, 0.14, 0.22, 'triangle');
    this.blip(659, 0.13, 0.14, 0.22, 'triangle');
    this.blip(784, 0.26, 0.3, 0.25, 'triangle');
  }

  knell() {
    if (!this.ready()) return;
    this.blip(220, 0, 0.5, 0.3, 'triangle');
    this.blip(147, 0.4, 0.9, 0.3, 'triangle');
  }

  // harsh two-note parrot screech
  squawk() {
    if (!this.ready()) return;
    const t0 = this.ctx.currentTime;
    for (const [start, f0, f1, dur] of [[0, 1500, 750, 0.16], [0.15, 1900, 950, 0.2]]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f0, t0 + start);
      osc.frequency.exponentialRampToValueAtTime(f1, t0 + start + dur);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.22, t0 + start);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + start + dur);
      osc.connect(gain).connect(this.master);
      osc.start(t0 + start);
      osc.stop(t0 + start + dur + 0.02);
    }
  }
}
