// プレイヤー: ロープの振り子・走る・跳ぶ・壁と床の当たり判定・キャラクターの見た目
import * as THREE from '../vendor/three.module.min.js';

export const P = {
  G: 30,          // 重力 (本物の約3倍。ビルの大きさで振り子が気持ちよく回る速さ)
  DRAG: 0.0032,   // 空気抵抗 (v^2)
  ROPE_MAX: 150,  // ロープが届く距離
  ROPE_SPEED: 650,
  PUMP: 11,       // ぶら下がり中のこぎ
  AIR: 9,         // 空中の操作
  RUN: 13,
  RUN_MAX: 34,    // 押し続けたときの最高速 (約3秒で到達)
  JUMP: 13,
  R: 0.55,
  HAND: 1.3,
};

const V = () => new THREE.Vector3();

export class Player {
  constructor(scene, city, sfx) {
    this.city = city;
    this.sfx = sfx;
    this.p = V(); this.v = V(); this.prev = V();
    this.grounded = false;
    this.groundWhat = 'ground';
    this.rope = null;        // { a: Vector3, L, bd }
    this.shot = null;        // 飛んでいるロープ { from, to, t, dist, hit }
    this.stun = 0;
    this.airTime = 0;
    this.events = [];
    this.contacts = [];
    this.facing = 0;
    this.camYaw = 0;
    this.moveHold = 0; // 移動を押し続けている秒数 (長く押すほど加速)
    this.anim = 0;
    this.buildModel(scene);
  }

  reset(x, y, z, yaw = 0) {
    this.p.set(x, y, z); this.prev.copy(this.p);
    this.v.set(0, 0, 0);
    this.rope = null; this.shot = null;
    this.grounded = false;
    this.stun = 0;
    this.facing = yaw;
    this.scarf.forEach((s) => s.set(x, y + 1.5, z));
  }

  hand() { return this.tmpHand.set(this.p.x, this.p.y + P.HAND, this.p.z); }

  // ロープを撃つ (hit = city.raycast の結果)
  fire(hit) {
    const from = this.hand().clone();
    const to = new THREE.Vector3(hit.x, hit.y, hit.z);
    this.rope = null;
    this.shot = { to, t: 0, dist: from.distanceTo(to), hit };
    this.sfx.shoot();
  }
  // ヘリから垂らしたロープにつかまる (anchor はヘリと一緒に動く)
  grab(anchor) {
    this.shot = null;
    const L = anchor.distanceTo(this.hand());
    this.rope = { a: anchor, L: Math.max(8, L), bd: null, heli: true };
    if (this.grounded || this.p.y < 4) {
      this.grounded = false;
      this.v.y = Math.max(this.v.y, 7);
    }
    // ぶら下がるのにちょうどいい長さ (約16m) まで引き上げる
    this.rope.lift = Math.max(0.3, (this.rope.L - 16) / 45 + 0.3);
    this.sfx.attach();
    this.events.push({ type: 'attach', bd: null, dist: L });
  }
  release() {
    if (this.shot) { this.shot = null; return; }
    if (!this.rope) return;
    this.rope = null;
    const sp = this.v.length();
    const hs = Math.hypot(this.v.x, this.v.z);
    const ang = Math.atan2(this.v.y, hs) * 180 / Math.PI;
    let nice = false;
    if (!this.grounded && sp > 20 && ang > 8 && ang < 65) {
      // いいタイミングで手を離すと加速 (振り子の底を過ぎて上がり始めたところ)
      this.v.multiplyScalar(1.14);
      this.v.y += 4;
      nice = true;
      this.sfx.nice();
    } else this.sfx.release();
    this.events.push({ type: 'release', nice, speed: sp });
  }
  jump() {
    if (this.grounded && this.stun <= 0) {
      this.v.y = P.JUMP;
      this.grounded = false;
      return true;
    }
    return false;
  }

  // input: { mx, mz (カメラ基準の移動 -1..1), yaw }
  update(dt, input) {
    const SUB = 4;
    const h = dt / SUB;
    this.stun = Math.max(0, this.stun - dt);
    // 飛んでいるロープ
    if (this.shot) {
      this.shot.t += dt * P.ROPE_SPEED;
      if (this.shot.t >= this.shot.dist) {
        const hit = this.shot.hit;
        const a = this.shot.to;
        const L = a.distanceTo(this.hand());
        this.rope = { a, L: Math.max(2, L * 0.96), bd: hit.bd, n: new THREE.Vector3(hit.nx, hit.ny, hit.nz) };
        this.shot = null;
        // アンカーへ引き上げる。地面や遅いときは長く (上に上がれる)、速く飛んでいるときは少しだけ (振りが速くなる)
        const sp = this.v.length();
        const up = a.y - this.p.y;
        if (this.grounded || this.p.y < 4) {
          this.grounded = false;
          this.v.y = Math.max(this.v.y, 7);
          this.rope.lift = 1.4;
        } else if (up > 10) this.rope.lift = sp < 20 ? 0.9 : 0.35;
        this.sfx.attach();
        this.events.push({ type: 'attach', bd: hit.bd, dist: L });
      }
    }
    // カメラの向きを基準にした入力の向き
    const cy = Math.cos(input.yaw), sy = Math.sin(input.yaw);
    // 前 = (-sin yaw, 0, -cos yaw)
    const fx = -sy, fz = -cy, rx = cy, rz = -sy;
    const wx = fx * input.mz + rx * input.mx, wz = fz * input.mz + rz * input.mx;
    const wl = Math.hypot(wx, wz);
    this.moveHold = wl > 0.3 ? this.moveHold + dt : 0;
    for (let s = 0; s < SUB; s++) this.step(h, input, wx, wz, wl);
    this.airTime = this.grounded ? 0 : this.airTime + dt;
    this.animate(dt);
  }

  step(h, input, wx, wz, wl) {
    const v = this.v, p = this.p;
    this.prev.copy(p);
    if (this.grounded && !this.rope) {
      // 走る
      const boost = Math.min(1, this.moveHold / 3);
      const run = this.stun > 0 ? 0 : P.RUN + (P.RUN_MAX - P.RUN) * boost;
      const tx = wl > 0.01 ? wx / Math.max(1, wl) * run : 0;
      const tz = wl > 0.01 ? wz / Math.max(1, wl) * run : 0;
      const k = Math.min(1, h * (wl > 0.01 ? 4 + 4 * (1 - boost) : 6));
      v.x += (tx - v.x) * k;
      v.z += (tz - v.z) * k;
      v.y = 0;
    } else {
      v.y -= P.G * h;
      const sp = v.length();
      v.multiplyScalar(Math.max(0, 1 - P.DRAG * sp * h));
      if (wl > 0.01) {
        const acc = (this.rope ? P.PUMP : P.AIR) * (1 + Math.min(1, this.moveHold / 2) * 1.5);
        v.x += wx / Math.max(1, wl) * acc * h;
        v.z += wz / Math.max(1, wl) * acc * h;
      }
    }
    if (this.rope && this.rope.lift > 0) {
      this.rope.lift -= h;
      this.rope.L = Math.max(this.rope.heli ? 16 : 6, this.rope.L - 45 * h);
    }
    // 振り子のいちばん下が地面 (床) にぶつかりそうなら少しずつ巻き取る (地面すれすれを抜けるアシスト)
    if (this.rope && !this.grounded && v.y < 0) {
      const floor = this.floorY || 0;
      const target = this.rope.a.y - P.HAND - floor - 2.5;
      if (target > 4 && this.rope.L > target) this.rope.L = Math.max(target, this.rope.L - 45 * h);
    }
    p.addScaledVector(v, h);
    // ロープ: 張っているときは球面に戻し、外向きの速度を消す
    if (this.rope) {
      const a = this.rope.a;
      const dx = p.x - a.x, dy = p.y + P.HAND - a.y, dz = p.z - a.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > this.rope.L) {
        const nx = dx / d, ny = dy / d, nz = dz / d;
        p.x = a.x + nx * this.rope.L;
        p.y = a.y + ny * this.rope.L - P.HAND;
        p.z = a.z + nz * this.rope.L;
        const vr = v.x * nx + v.y * ny + v.z * nz;
        if (vr > 0) { v.x -= vr * nx; v.y -= vr * ny; v.z -= vr * nz; }
        if (this.grounded && ny < -0.2) this.grounded = false;
      }
    }
    // 壁
    const cs = this.city.collide(p, P.R, this.contacts);
    for (const c of cs) {
      const vn = v.x * c.nx + v.z * c.nz + (c.ny ? v.y * c.ny : 0);
      if (vn < 0) {
        v.x -= vn * c.nx * 1.05; v.z -= vn * c.nz * 1.05;
        if (c.ny) v.y -= vn * c.ny * 1.05;
        // 壁をこする摩擦
        v.multiplyScalar(1 - 0.8 * h);
        if (-vn > 18) {
          this.events.push({ type: 'bump', speed: -vn });
          this.sfx.bump(-vn);
        }
      }
    }
    // 床 (屋上・首都高・地面)
    const f = this.city.floorAt(p.x, p.z, Math.max(p.y, this.prev.y));
    this.floorY = f.y;
    if (p.y <= f.y) {
      if (!this.grounded) {
        const vy = -v.y;
        if (vy > 4) this.sfx.land(vy);
        this.events.push({ type: 'land', what: f.what, vy, bd: f.bd });
        if (vy > 45) this.stun = 0.7;
      }
      p.y = f.y;
      if (v.y < 0) v.y = 0;
      this.grounded = true;
      this.groundWhat = f.what;
    } else if (p.y > f.y + 0.08) {
      if (this.grounded && !this.rope && p.y - f.y < 0.8) {
        p.y = f.y; // 段差・下り坂に吸い付く
      } else this.grounded = false;
    }
    // 街の外へ出すぎない
    const c = this.city;
    const m = 300;
    if (p.x < c.minX - m) { p.x = c.minX - m; v.x = Math.max(0, v.x); }
    if (p.x > c.maxX + m) { p.x = c.maxX + m; v.x = Math.min(0, v.x); }
    if (p.z < c.minZ - m) { p.z = c.minZ - m; v.z = Math.max(0, v.z); }
    if (p.z > c.maxZ + m) { p.z = c.maxZ + m; v.z = Math.min(0, v.z); }
    if (p.y > 1200) { p.y = 1200; v.y = Math.min(0, v.y); }
  }

  // ---------- 見た目 ----------
  buildModel(scene) {
    this.tmpHand = V();
    const g = this.model = new THREE.Group();
    const suit = new THREE.MeshLambertMaterial({ color: 0x2b6cff });
    const suit2 = new THREE.MeshLambertMaterial({ color: 0xffb020 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xf1c7a0 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x1d2333 });
    const body = this.body = new THREE.Group();
    g.add(body);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.68, 0.3), suit);
    torso.position.y = 1.12;
    body.add(torso);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.1, 0.32), suit2);
    belt.position.y = 0.82;
    body.add(belt);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin);
    head.position.y = 1.62;
    body.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), dark);
    hair.position.y = 1.65;
    body.add(hair);
    const goggle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.08), suit2);
    goggle.position.set(0, 1.64, -0.15);
    body.add(goggle);
    const limb = (w, l, m, x, y) => {
      const piv = new THREE.Group();
      piv.position.set(x, y, 0);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, l, w), m);
      mesh.position.y = -l / 2;
      piv.add(mesh);
      body.add(piv);
      return piv;
    };
    this.armR = limb(0.12, 0.62, suit, 0.32, 1.42);
    this.armL = limb(0.12, 0.62, suit, -0.32, 1.42);
    const handR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), suit2);
    handR.position.y = -0.64;
    this.armR.add(handR);
    this.legR = limb(0.16, 0.78, dark, 0.13, 0.78);
    this.legL = limb(0.16, 0.78, dark, -0.13, 0.78);
    scene.add(g);
    // マフラー
    this.scarf = [];
    for (let i = 0; i < 9; i++) this.scarf.push(V());
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9 * 2 * 3), 3));
    const idx = [];
    for (let i = 0; i < 8; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    sg.setIndex(idx);
    this.scarfMesh = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0xff2d3d, side: THREE.DoubleSide }));
    this.scarfMesh.frustumCulled = false;
    scene.add(this.scarfMesh);
    // ロープ
    const rg = new THREE.CylinderGeometry(0.05, 0.05, 1, 5, 1, true);
    rg.translate(0, 0.5, 0);
    this.ropeMesh = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xfff1c8 }));
    this.ropeMesh.frustumCulled = false;
    this.ropeMesh.visible = false;
    scene.add(this.ropeMesh);
  }

  animate(dt) {
    const v = this.v, g = this.model;
    g.position.copy(this.p);
    const hs = Math.hypot(v.x, v.z);
    if (!this.grounded || hs > 1.5) {
      // 空中ではいつもカメラに背中を向ける (向こうへ飛んでいくのが分かるように)
      const target = this.grounded ? Math.atan2(-v.x, -v.z) : this.camYaw;
      let d = target - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 10);
    }
    g.rotation.set(0, this.facing, 0);
    this.anim += dt * (this.grounded ? Math.min(hs, 18) * 0.9 : 6);
    const body = this.body;
    if (this.rope) {
      // ロープの向きに体を傾ける
      const a = this.rope.a;
      const d = new THREE.Vector3(a.x - this.p.x, a.y - this.p.y - P.HAND, a.z - this.p.z).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      const inv = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -this.facing, 0));
      body.quaternion.slerp(inv.multiply(q), Math.min(1, dt * 12));
      body.position.y = 0;
      this.armR.rotation.set(Math.PI, 0, 0);
      this.armL.rotation.set(Math.PI * 0.85, 0, -0.2);
      const sw = Math.sin(this.anim) * 0.3;
      this.legR.rotation.set(0.3 + sw, 0, 0);
      this.legL.rotation.set(0.1 - sw, 0, 0);
    } else if (this.grounded) {
      body.quaternion.slerp(new THREE.Quaternion(), Math.min(1, dt * 12));
      const k = Math.min(1, hs / P.RUN);
      const s = Math.sin(this.anim * 1.2) * 0.9 * k;
      this.legR.rotation.set(s, 0, 0);
      this.legL.rotation.set(-s, 0, 0);
      this.armR.rotation.set(-s * 0.8, 0, 0);
      this.armL.rotation.set(s * 0.8, 0, 0);
      if (this.stun > 0) { this.legR.rotation.x = -1.2; this.legL.rotation.x = -1.2; }
    } else {
      // 空中: 速さで前のめり
      const pitch = THREE.MathUtils.clamp(-v.y / 40, -0.6, 0.9);
      body.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch * 0.6 - Math.min(0.5, hs / 120), 0, 0)), Math.min(1, dt * 6));
      const s = Math.sin(this.anim) * 0.25;
      this.armR.rotation.set(-2.6 + s, 0, 0.3);
      this.armL.rotation.set(-2.4 - s, 0, -0.3);
      this.legR.rotation.set(0.5 + s, 0, 0);
      this.legL.rotation.set(-0.3 - s, 0, 0);
    }
    // マフラー (首から後ろへなびく)
    const neck = new THREE.Vector3(0, 1.45, 0.1).applyQuaternion(body.quaternion).applyEuler(g.rotation).add(this.p);
    const sc = this.scarf;
    sc[0].copy(neck);
    for (let i = 1; i < sc.length; i++) {
      const s = sc[i];
      s.y -= 6 * dt * 0.3;
      s.x += Math.sin(this.anim * 3 + i) * 0.02;
      const d = s.clone().sub(sc[i - 1]);
      const l = d.length() || 1;
      s.copy(sc[i - 1]).addScaledVector(d, 0.22 / l);
    }
    const pos = this.scarfMesh.geometry.attributes.position;
    for (let i = 0; i < sc.length; i++) {
      const w = 0.09 * (1 - i / sc.length * 0.5);
      pos.setXYZ(i * 2, sc[i].x, sc[i].y + w, sc[i].z);
      pos.setXYZ(i * 2 + 1, sc[i].x, sc[i].y - w, sc[i].z);
    }
    pos.needsUpdate = true;
    // ロープ
    const rm = this.ropeMesh;
    let to = null;
    if (this.rope) to = this.rope.a;
    else if (this.shot) {
      const h = this.hand();
      to = h.clone().lerp(this.shot.to, Math.min(1, this.shot.t / this.shot.dist));
    }
    if (to) {
      const h = this.hand().clone();
      const d = to.clone().sub(h);
      const L = d.length();
      rm.visible = L > 0.1;
      rm.position.copy(h);
      rm.scale.set(1, L, 1);
      rm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    } else rm.visible = false;
  }
}
