// 効果音 (すべて WebAudio で合成)
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(ctx.destination);
    // ノイズ
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // 風切り音 (ずっと鳴らして音量で調整)
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    this.windF = ctx.createBiquadFilter();
    this.windF.type = 'bandpass';
    this.windF.frequency.value = 500;
    this.windF.Q.value = 0.7;
    this.windG = ctx.createGain();
    this.windG.gain.value = 0;
    src.connect(this.windF).connect(this.windG).connect(this.master);
    src.start();
  }
  resume() { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.7; }
  wind(speed) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const v = Math.min(1, speed / 90);
    this.windG.gain.setTargetAtTime(v * v * 0.55, t, 0.1);
    this.windF.frequency.setTargetAtTime(300 + v * 1400, t, 0.1);
  }
  burst(dur, f0, f1, vol, type = 'bandpass', q = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }
  tone(freq, dur, vol, type = 'sine', slide = 0, delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  shoot() { this.burst(0.18, 3500, 900, 0.35, 'bandpass', 2); this.tone(900, 0.12, 0.08, 'triangle', 0.4); }
  attach() { this.tone(160, 0.12, 0.35, 'sine', 0.5); this.burst(0.06, 2000, 400, 0.25, 'lowpass'); }
  miss() { this.tone(300, 0.15, 0.08, 'square', 0.5); }
  release() { this.burst(0.25, 600, 2400, 0.2, 'bandpass', 1.5); }
  nice() { this.tone(880, 0.12, 0.12, 'triangle'); this.tone(1320, 0.18, 0.12, 'triangle', 1, 0.07); }
  zip() { this.burst(0.3, 400, 3000, 0.3, 'bandpass', 2); this.tone(220, 0.25, 0.1, 'sawtooth', 3); }
  land(power) { this.tone(90, 0.2, Math.min(0.6, 0.15 + power * 0.01), 'sine', 0.5); this.burst(0.12, 800, 100, Math.min(0.5, power * 0.01), 'lowpass'); }
  bump(power) { this.tone(70, 0.25, Math.min(0.7, power * 0.02), 'square', 0.6); this.burst(0.2, 1200, 200, Math.min(0.6, power * 0.015), 'lowpass'); }
  ring() { [0, 0.08, 0.16].forEach((d, i) => this.tone([784, 988, 1319][i], 0.3, 0.14, 'triangle', 1, d)); }
  collect() { [0, 0.07, 0.14, 0.21].forEach((d, i) => this.tone([659, 784, 988, 1319][i], 0.35, 0.12, 'sine', 1, d)); }
  combo(n) { this.tone(440 * Math.pow(2, Math.min(n, 24) / 12), 0.12, 0.1, 'triangle'); }
  near() { this.burst(0.35, 300, 1800, 0.3, 'bandpass', 3); }
  count(go) { this.tone(go ? 1046 : 523, go ? 0.5 : 0.2, 0.18, 'square'); }
  finish() { [0, 0.12, 0.24, 0.36, 0.6].forEach((d, i) => this.tone([523, 659, 784, 1046, 1319][i], 0.4, 0.14, 'triangle', 1, d)); }
}
