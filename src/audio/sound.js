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
      // iOS suspends the context on lock/background — wake it on any tap
      window.addEventListener('pointerdown', () => {
        if (this.ctx.state === 'suspended') this.ctx.resume();
      });
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  // endless rolling-sea bed: looped noise through a lowpass, swelling on a slow LFO
  startAmbience() {
    if (this.ambienceOn || !this.ctx) return;
    this.ambienceOn = true;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(6);
    src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    lp.Q.value = 0.5;
    const g = this.ctx.createGain();
    g.gain.value = 0.1;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 0.055;
    lfo.connect(lfoG).connect(g.gain);
    src.connect(lp).connect(g).connect(this.master);
    src.start();
    lfo.start();

    // faint high spray
    const spray = this.ctx.createBufferSource();
    spray.buffer = this.noiseBuffer(4);
    spray.loop = true;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    const sg = this.ctx.createGain();
    sg.gain.value = 0.012;
    spray.connect(hp).connect(sg).connect(this.master);
    spray.start();
  }

  gull(pos) {
    if (!this.ready()) return;
    const g = this.gainFor(pos);
    if (g < 0.12) return;
    const t0 = this.ctx.currentTime;
    for (const [d, f0] of [[0, 1350], [0.4, 1550]]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f0, t0 + d);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.55, t0 + d + 0.3);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.1 * g, t0 + d);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + d + 0.32);
      osc.connect(gain).connect(this.master);
      osc.start(t0 + d);
      osc.stop(t0 + d + 0.35);
    }
  }

  creak(pos) {
    if (!this.ready()) return;
    const g = this.gainFor(pos);
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, t0);
    osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.4);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 240;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12 * g, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.42);
    osc.connect(lp).connect(gain).connect(this.master);
    osc.start();
    osc.stop(t0 + 0.45);
  }

  // steel on steel during a boarding melee
  clank(pos) {
    if (!this.ready()) return;
    const g = this.gainFor(pos);
    if (g < 0.1) return;
    const t0 = this.ctx.currentTime;
    for (const f of [2500 + Math.random() * 600, 3400 + Math.random() * 500]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.06 * g, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07);
      osc.connect(gain).connect(this.master);
      osc.start();
      osc.stop(t0 + 0.09);
    }
  }

  // ---------------------------------------------------------------- shanty
  // An original 6/8 tavern jig, scheduled loop by loop: plucky squarewave
  // lead, walking triangle bass, foot-stomps and a tick on the offbeats.

  midiHz(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  shantyNote(freq, t, dur, vol, type = 'square', filterHz = 1900) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = filterHz;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(lp).connect(gain).connect(this.shantyGain);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  scheduleShantyLoop(t0) {
    const e = 0.21; // one eighth note in a brisk 6/8
    // melody in A dorian, two answering phrases (0 = rest, negative = hold)
    const lead = [
      69, 72, 76, 74, 72, 71, 69, 71, 72, 71, 69, 67,
      69, 72, 76, 79, 76, 74, 72, 74, 71, 69, -1, -1,
      76, 79, 81, 79, 76, 74, 76, 74, 72, 74, 72, 71,
      72, 74, 76, 74, 72, 71, 69, 71, 71, 69, -1, -1,
    ];
    const bass = [45, 45, 43, 43, 41, 43, 40, 45, 48, 47, 45, 43, 41, 43, 40, 45];
    for (let i = 0; i < lead.length; i++) {
      const n = lead[i];
      if (n > 0) {
        const hold = lead[i + 1] === -1 ? (lead[i + 2] === -1 ? 3 : 2) : 1;
        this.shantyNote(this.midiHz(n), t0 + i * e, e * hold * 0.92, 0.085);
      }
    }
    for (let i = 0; i < bass.length; i++) {
      this.shantyNote(this.midiHz(bass[i]), t0 + i * e * 3, e * 2.6, 0.11, 'triangle', 500);
    }
    // stomps on the downbeats, tick on the lift
    for (let bar = 0; bar < 16; bar++) {
      const bt = t0 + bar * e * 3;
      const stomp = this.ctx.createOscillator();
      stomp.type = 'sine';
      stomp.frequency.setValueAtTime(85, bt);
      stomp.frequency.exponentialRampToValueAtTime(45, bt + 0.09);
      const sg = this.ctx.createGain();
      sg.gain.setValueAtTime(0.35, bt);
      sg.gain.exponentialRampToValueAtTime(0.001, bt + 0.1);
      stomp.connect(sg).connect(this.shantyGain);
      stomp.start(bt);
      stomp.stop(bt + 0.12);
      const tick = this.ctx.createBufferSource();
      tick.buffer = this.noiseBuffer(0.03);
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 4000;
      const tg = this.ctx.createGain();
      tg.gain.setValueAtTime(0.05, bt + e * 2);
      tg.gain.exponentialRampToValueAtTime(0.001, bt + e * 2 + 0.03);
      tick.connect(hp).connect(tg).connect(this.shantyGain);
      tick.start(bt + e * 2);
    }
    return 48 * e; // loop length in seconds
  }

  startShanty() {
    if (this.shantyOn || !this.ctx) return;
    this.shantyOn = true;
    if (!this.shantyGain) {
      this.shantyGain = this.ctx.createGain();
      this.shantyGain.connect(this.master);
    }
    this.shantyGain.gain.value = 0.5;
    const loop = () => {
      if (!this.shantyOn) return;
      const dur = this.scheduleShantyLoop(this.ctx.currentTime + 0.08);
      this.shantyTimer = setTimeout(loop, (dur - 0.05) * 1000);
    };
    loop();
  }

  stopShanty() {
    this.shantyOn = false;
    clearTimeout(this.shantyTimer);
    // let scheduled notes ring out quietly rather than cutting hard
    if (this.shantyGain && this.ctx) {
      this.shantyGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    }
  }

  dolphin() {
    if (!this.ready()) return;
    this.blip(950, 0, 0.12, 0.12, 'sine');
    this.blip(1450, 0.1, 0.14, 0.12, 'sine');
  }

  dig() {
    if (!this.ready()) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, t0);
    osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.12);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(t0 + 0.16);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.1);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    const ng = this.ctx.createGain();
    this.env(ng, 0.2, 0.1);
    src.connect(lp).connect(ng).connect(this.master);
    src.start();
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

  // the parrot's voice: real recordings, one picked at random per tap
  async loadParrotClips() {
    if (this._parrotClips) return this._parrotClips;
    const files = [
      './sounds/parrot-pieces-of-eight.wav',
      './sounds/parrot-pretty-boy.wav',
      './sounds/parrot-inquisitive.wav',
    ];
    this._parrotClips = await Promise.all(
      files.map(async (url) => {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        return this.ctx.decodeAudioData(buf);
      })
    );
    return this._parrotClips;
  }

  async parrotClip() {
    if (!this.ready()) return;
    try {
      const clips = await this.loadParrotClips();
      let i;
      do {
        i = Math.floor(Math.random() * clips.length);
      } while (i === this._lastClip && clips.length > 1);
      this._lastClip = i;
      const src = this.ctx.createBufferSource();
      src.buffer = clips[i];
      const gain = this.ctx.createGain();
      gain.gain.value = 0.9;
      src.connect(gain).connect(this.master);
      src.start();
    } catch {
      this.squawk(); // couldn't fetch/decode — screech instead
    }
  }
}
