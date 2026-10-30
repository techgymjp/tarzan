// 打ち上げ花火 (画面の前方に上げる)。清水の舞台から飛び降りるつもり (techgymjp/kiyomizu) の花火を元にしている
// 途中で新しいジオメトリやシェーダーを作るとカクつくので、最初にまとめて用意して使い回す
import * as THREE from '../vendor/three.module.min.js';

export const ROCKET_T = 0.9; // 打ち上げから開くまでの秒数
const COLORS = [0xff5252, 0xffd740, 0x69f0ae, 0x40c4ff, 0xe040fb, 0xffffff, 0xff9100, 0xff80ab];
const MAX = 10, N = 320;
const DIST = 170; // カメラから花火までの距離 (m)

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const c1 = new THREE.Color(), c2 = new THREE.Color();
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

export class Fireworks {
  constructor(scene) {
    const tex = glowTexture();
    this.clock = 0;
    this.pending = [];
    this.rockets = [];
    this.bursts = [];
    for (let i = 0; i < MAX + 2; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xfff3c0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      sp.scale.set(5, 5, 1);
      sp.visible = false;
      scene.add(sp);
      this.rockets.push({ sp, active: false, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, big: false });
    }
    for (let i = 0; i < MAX; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 7, map: tex, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      pts.frustumCulled = false;
      pts.visible = false;
      scene.add(pts);
      const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      flash.scale.set(110, 110, 1);
      flash.visible = false;
      scene.add(flash);
      this.bursts.push({ pts, flash, vel: new Float32Array(N * 3), n: 0, t: 0, life: 2.6, active: false });
    }
  }

  // n 発を gap 秒ずつずらして、camera の前方に打ち上げる。戻り値: それぞれの打ち上げまでの秒数 (音を合わせる)
  show(camera, n = 3, big = false, gap = 0.3) {
    for (let i = 0; i < n; i++) {
      this.pending.push({ at: this.clock + 0.1 + i * gap + Math.random() * 0.15, big, camera });
    }
    return this.pending.slice(-n).map((p) => p.at - this.clock);
  }

  spawnRocket(camera, big) {
    const r = this.rockets.find((q) => !q.active);
    if (!r) return;
    // 打ち上げた瞬間のカメラの向きで、画面の前方 (左右に散らす) に置く
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    right.crossVectors(fwd, UP);
    const base = camera.position.clone().addScaledVector(fwd, DIST + Math.random() * 40).addScaledVector(right, (Math.random() - 0.5) * 160);
    r.from.copy(base).add(new THREE.Vector3(0, -90 - Math.random() * 30, 0));
    r.to.copy(base).add(new THREE.Vector3(0, (big ? 45 : 25) + Math.random() * 35, 0));
    r.t = 0;
    r.big = big;
    r.active = true;
    r.sp.visible = true;
  }

  spawnBurst(p, big) {
    let b = this.bursts.find((q) => !q.active);
    if (!b) b = this.bursts.reduce((a, q) => (q.t > a.t ? q : a));
    const n = big ? N : 220;
    const pos = b.pts.geometry.attributes.position.array, col = b.pts.geometry.attributes.color.array, vel = b.vel;
    c1.setHex(COLORS[(Math.random() * COLORS.length) | 0]);
    c2.setHex(COLORS[(Math.random() * COLORS.length) | 0]);
    const speed = big ? 62 : 48;
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const sv = speed * (0.85 + Math.random() * 0.3);
      vel[i * 3] = r * Math.cos(a) * sv;
      vel[i * 3 + 1] = u * sv;
      vel[i * 3 + 2] = r * Math.sin(a) * sv;
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;
      const c = i % 3 === 0 ? c2 : c1;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    b.pts.geometry.setDrawRange(0, n);
    b.pts.geometry.attributes.position.needsUpdate = true;
    b.pts.geometry.attributes.color.needsUpdate = true;
    b.pts.material.size = big ? 8 : 6.5;
    b.pts.material.opacity = 1;
    b.pts.visible = true;
    b.flash.material.color.copy(c1);
    b.flash.material.opacity = 1;
    b.flash.position.copy(p);
    b.flash.visible = true;
    Object.assign(b, { n, t: 0, active: true });
  }

  update(dt) {
    this.clock += dt;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      if (this.pending[i].at <= this.clock) {
        this.spawnRocket(this.pending[i].camera, this.pending[i].big);
        this.pending.splice(i, 1);
      }
    }
    for (const r of this.rockets) {
      if (!r.active) continue;
      r.t += dt;
      const u = Math.min(1, r.t / ROCKET_T);
      const e = 1 - (1 - u) * (1 - u);
      r.sp.position.lerpVectors(r.from, r.to, e);
      r.sp.position.x += Math.sin(r.t * 20) * 0.6; // ゆらゆら昇る
      if (u >= 1) {
        r.active = false;
        r.sp.visible = false;
        this.spawnBurst(r.to, r.big);
      }
    }
    const drag = Math.exp(-1.6 * dt), g = 6 * dt;
    for (const b of this.bursts) {
      if (!b.active) continue;
      b.t += dt;
      const arr = b.pts.geometry.attributes.position.array, vel = b.vel;
      for (let k = 0; k < b.n * 3; k += 3) {
        vel[k] *= drag;
        vel[k + 1] = vel[k + 1] * drag - g;
        vel[k + 2] *= drag;
        arr[k] += vel[k] * dt;
        arr[k + 1] += vel[k + 1] * dt;
        arr[k + 2] += vel[k + 2] * dt;
      }
      b.pts.geometry.attributes.position.needsUpdate = true;
      const fade = 1 - b.t / b.life;
      // 最後はチカチカと消える
      b.pts.material.opacity = Math.max(0, fade < 0.4 ? (fade / 0.4) * (0.6 + 0.4 * Math.random()) : 1);
      b.flash.material.opacity = Math.max(0, 1 - b.t * 4);
      if (b.t >= b.life) {
        b.active = false;
        b.pts.visible = false;
        b.flash.visible = false;
      }
    }
  }

  // すべて消す (ミッションのやり直しなど)
  clear() {
    this.pending.length = 0;
    for (const r of this.rockets) { r.active = false; r.sp.visible = false; }
    for (const b of this.bursts) { b.active = false; b.pts.visible = false; b.flash.visible = false; }
  }
}
