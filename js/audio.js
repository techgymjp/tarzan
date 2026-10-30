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
  // ヘリのローター音 (ノイズを羽根の回転で「バタバタ」と揺らす)。dist: カメラからの距離
  heli(dist) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (!this.heliG) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420;
      const am = ctx.createGain();
      am.gain.value = 0.5;
      // 羽根の回転 (約17回/秒) で音量を揺らす
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 17;
      const depth = ctx.createGain();
      depth.gain.value = 0.5;
      lfo.connect(depth).connect(am.gain);
      // 低い唸り (エンジン)
      const hum = ctx.createOscillator();
      hum.type = 'sawtooth';
      hum.frequency.value = 68;
      const humG = ctx.createGain();
      humG.gain.value = 0.05;
      const hf = ctx.createBiquadFilter();
      hf.type = 'lowpass';
      hf.frequency.value = 300;
      this.heliG = ctx.createGain();
      this.heliG.gain.value = 0;
      src.connect(f).connect(am).connect(this.heliG);
      hum.connect(hf).connect(humG).connect(this.heliG);
      this.heliG.connect(this.master);
      src.start(); lfo.start(); hum.start();
    }
    const v = dist === null ? 0 : Math.min(0.9, 30 / Math.max(15, dist));
    this.heliG.gain.setTargetAtTime(v, ctx.currentTime, 0.15);
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
  land(power) { this.tone(90, 0.2, Math.min(0.6, 0.15 + power * 0.01), 'sine', 0.5); this.burst(0.12, 800, 100, Math.min(0.5, power * 0.01), 'lowpass'); }
  bump(power) { this.tone(70, 0.25, Math.min(0.7, power * 0.02), 'square', 0.6); this.burst(0.2, 1200, 200, Math.min(0.6, power * 0.015), 'lowpass'); }
  ring() { [0, 0.08, 0.16].forEach((d, i) => this.tone([784, 988, 1319][i], 0.3, 0.14, 'triangle', 1, d)); }
  collect() { [0, 0.07, 0.14, 0.21].forEach((d, i) => this.tone([659, 784, 988, 1319][i], 0.35, 0.12, 'sine', 1, d)); }
  combo(n) { this.tone(440 * Math.pow(2, Math.min(n, 24) / 12), 0.12, 0.1, 'triangle'); }
  near() { this.burst(0.35, 300, 1800, 0.3, 'bandpass', 3); }
  count(go) { this.tone(go ? 1046 : 523, go ? 0.5 : 0.2, 0.18, 'square'); }
  // 花火 (打ち上げの笛 → ドーン → パチパチ)。清水の舞台から飛び降りるつもり (techgymjp/kiyomizu) の音を元にしている
  firework(delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const whistle = (f0, f1, d, vol, at) => {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(f0, at);
      o.frequency.exponentialRampToValueAtTime(f1, at + d);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, at + d);
      o.connect(g).connect(this.master);
      o.start(at); o.stop(at + d + 0.05);
    };
    const nz = (at, d, vol, type, f0, f1) => {
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      const fl = ctx.createBiquadFilter();
      fl.type = type;
      fl.frequency.setValueAtTime(f0, at);
      if (f1) fl.frequency.exponentialRampToValueAtTime(f1, at + d);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + d);
      s.connect(fl).connect(g).connect(this.master);
      s.start(at, Math.random()); s.stop(at + d + 0.05);
    };
    whistle(700, 1800, 0.9, 0.08, t);
    nz(t + 0.9, 1.5, 1.0, 'lowpass', 900, 80);
    whistle(90, 40, 0.8, 0.5, t + 0.9);
    for (let i = 0; i < 14; i++) nz(t + 1.1 + Math.random() * 0.9, 0.05, 0.25 * Math.random() + 0.1, 'highpass', 4000);
  }
  // 鬼が見つけたときの笑い声
  oniLaugh() {
    for (let i = 0; i < 4; i++) {
      this.tone(150 - i * 8, 0.18, 0.22, 'sawtooth', 0.63, i * 0.22);
      setTimeout(() => this.burst(0.15, 700, 500, 0.3, 'bandpass', 2), i * 220);
    }
    this.tone(70, 1.2, 0.5, 'sine', 0.57);
  }
  // 追いかけられている間の警報 (ブブー)
  alarm() {
    this.tone(220, 0.3, 0.13, 'square', 1);
    this.tone(220, 0.3, 0.13, 'square', 1, 0.42);
  }
  heartbeat() { this.tone(60, 0.18, 0.6, 'sine', 0.67); this.tone(55, 0.2, 0.45, 'sine', 0.7, 0.16); }
  caught() {
    this.burst(1.2, 500, 60, 0.9, 'lowpass');
    this.tone(160, 0.6, 0.25, 'square', 0.25);
    [0, 0.14, 0.28, 0.42].forEach((d, i) => this.tone(1500 + (i % 2) * 300, 0.12, 0.08, 'sine', 1, 0.6 + d));
  }
  finish() { [0, 0.12, 0.24, 0.36, 0.6].forEach((d, i) => this.tone([523, 659, 784, 1046, 1319][i], 0.4, 0.14, 'triangle', 1, d)); }
}

// BGM: 都会を飛び回るアップテンポの曲 (WebAudio で合成。外部音源なし)
// Am - F - C - G の4小節をくり返す。速く飛ぶほどフィルターが開いてハイハットが細かくなる
const BPM = 132;
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G (MIDI)
const BASS = [45, 41, 36, 43];
// メロディー (16分音符の位置 → MIDI)。8小節で1周
const MELODY = [
  [0, 76], [3, 74], [6, 72], [8, 74], [12, 76],
  [16, 77], [19, 76], [22, 74], [24, 72], [28, 69],
  [32, 72], [35, 74], [38, 76], [40, 79], [44, 76],
  [48, 74], [51, 72], [54, 71], [56, 74], [60, 79],
  [64, 81], [67, 79], [70, 76], [72, 77], [76, 76],
  [80, 77], [83, 76], [86, 74], [88, 72], [92, 74],
  [96, 72], [99, 74], [102, 76], [104, 72], [108, 69],
  [112, 71], [115, 72], [118, 74], [120, 71], [124, 67],
];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Bgm {
  constructor(sfx) {
    this.sfx = sfx;
    this.on = false;
    this.step = 0;
    this.next = 0;
    this.timer = null;
    this.energy = 0;
  }
  setup() {
    const ctx = this.sfx.ctx;
    if (!ctx || this.bus) return;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 2500;
    this.bus.connect(this.filter).connect(this.sfx.master);
  }
  start() {
    this.sfx.resume();
    if (!this.sfx.ctx) return;
    this.setup();
    const ctx = this.sfx.ctx;
    this.bus.gain.cancelScheduledValues(ctx.currentTime);
    this.bus.gain.setTargetAtTime(0.32, ctx.currentTime, 0.3);
    if (this.on) return;
    this.on = true;
    this.step = 0;
    this.next = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }
  stop() {
    if (!this.on) return;
    this.on = false;
    clearInterval(this.timer);
    const ctx = this.sfx.ctx;
    this.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
  }
  duck(on) { if (this.bus) this.bus.gain.setTargetAtTime(on ? 0.1 : 0.32, this.sfx.ctx.currentTime, 0.2); }
  // 0..1 (速さ)
  setEnergy(e) {
    this.energy = e;
    if (this.filter) this.filter.frequency.setTargetAtTime(1600 + e * 9000, this.sfx.ctx.currentTime, 0.3);
  }
  schedule() {
    const ctx = this.sfx.ctx;
    const dur = 60 / BPM / 4; // 16分音符
    while (this.next < ctx.currentTime + 0.12) {
      this.play(this.step, this.next, dur);
      this.next += dur;
      this.step = (this.step + 1) % 128;
    }
  }
  play(s, t, dur) {
    const bar = Math.floor(s / 16) % 4, pos = s % 16;
    const ch = CHORDS[bar];
    // ドラム
    if (pos % 4 === 0) this.kick(t);
    if (pos === 4 || pos === 12) this.snare(t);
    if (pos % 2 === 0 || this.energy > 0.5) this.hat(t, pos % 4 === 2 ? 0.09 : 0.045);
    // ベース (8分でオクターブを行き来)
    if (pos % 2 === 0) this.note(mtof(BASS[bar] + (pos % 4 === 2 ? 12 : 0)), t, dur * 1.8, 0.22, 'sawtooth', 600);
    // アルペジオ
    const arp = ch[(pos + (pos >> 2)) % 3] + 12;
    this.note(mtof(arp), t, dur * 0.9, 0.05, 'square', 2600);
    // 和音のパッド (小節の頭)
    if (pos === 0) for (const m of ch) this.note(mtof(m), t, dur * 15, 0.035, 'triangle', 1800, 0.08);
    // メロディー
    for (const [p, m] of MELODY) if (p === s) this.note(mtof(m), t, dur * 2.6, 0.09, 'triangle', 5000);
  }
  note(f, t, d, vol, type, cut, att = 0.005) {
    const ctx = this.sfx.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = cut;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(fl).connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + d + 0.05);
  }
  kick(t) {
    const ctx = this.sfx.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.3);
  }
  noise(t, d, vol, type, f) {
    const ctx = this.sfx.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.sfx.noise;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(fl).connect(g).connect(this.bus);
    s.start(t, Math.random());
    s.stop(t + d + 0.02);
  }
  snare(t) { this.noise(t, 0.18, 0.35, 'bandpass', 1800); this.note(190, t, 0.08, 0.15, 'triangle', 2000); }
  hat(t, v) { this.noise(t, 0.04, v, 'highpass', 7000); }
}
