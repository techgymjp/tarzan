// ターザンロープを垂らしたヘリコプター。いつもプレイヤーの前方 (カメラの向き) を飛び回り、
// ロープにつかまると前へ運んでくれる。ビルにぶつからないよう、前方のいちばん高いビルより上を飛ぶ
import * as THREE from '../vendor/three.module.min.js';

const AHEAD = 12;       // つかまっていないとき、プレイヤーのどれだけ前を飛ぶか (m)。ロープの先が手の届く所に来る
const ABOVE = 26;       // プレイヤーよりどれだけ上を飛ぶか
const CLEAR = 22;       // ビルの屋上からの余裕
const CRUISE = 24;      // つかまっているときの速さ (m/s)
const CRUISE_MAX = 42;  // 移動を押し続けたときの速さ

export class Heli {
  constructor(scene, city) {
    this.city = city;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.hook = new THREE.Vector3(); // ロープの付け根 (機体の下)
    this.t = 0;
    this.yaw = 0;
    this.build(scene);
  }

  reset(p, yaw) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    this.pos.set(p.x + fx * AHEAD, p.y + ABOVE, p.z + fz * AHEAD);
    this.pos.y = Math.max(this.pos.y, this.city.maxHeightNear(this.pos.x, this.pos.z, 60) + CLEAR);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.hook.copy(this.pos).y -= 2.2;
  }

  // carrying: プレイヤーがつかまっているか。boost: 0..1 (移動を押し続けている)
  update(dt, player, camYaw, carrying, boost) {
    this.t += dt;
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const target = new THREE.Vector3();
    let maxSp;
    if (carrying) {
      // 前へ運ぶ
      const sp = CRUISE + (CRUISE_MAX - CRUISE) * boost;
      target.set(this.pos.x + fx * sp * 2, 0, this.pos.z + fz * sp * 2);
      target.y = this.pos.y; // 高さを保つ (前のビルが高ければ下で持ち上げる)
      maxSp = sp;
    } else {
      // プレイヤーの前方をゆらゆら徘徊する
      const side = Math.sin(this.t * 0.45) * 5;
      target.set(player.p.x + fx * AHEAD - fz * side, player.p.y + ABOVE + Math.sin(this.t * 0.7) * 4, player.p.z + fz * AHEAD + fx * side);
      maxSp = 60;
    }
    // 前方のビルより上を飛ぶ (少し先まで見る)
    const look = Math.min(80, 20 + this.vel.length() * 2);
    const vl = Math.hypot(this.vel.x, this.vel.z) || 1;
    const ax = this.pos.x + this.vel.x / vl * look, az = this.pos.z + this.vel.z / vl * look;
    const floor = Math.max(this.city.maxHeightNear(this.pos.x, this.pos.z, 45), this.city.maxHeightNear(ax, az, 45)) + CLEAR;
    target.y = Math.max(target.y, floor);
    // 目標へ向かう速度 (速さの上限つき) に、なめらかに近づける
    const want = target.sub(this.pos).multiplyScalar(carrying ? 0.8 : 1.4);
    const wl = want.length();
    if (wl > maxSp) want.multiplyScalar(maxSp / wl);
    this.vel.lerp(want, Math.min(1, dt * (carrying ? 1.2 : 2.2)));
    this.pos.addScaledVector(this.vel, dt);
    if (this.pos.y < floor - 6) this.pos.y = floor - 6;
    this.hook.set(this.pos.x, this.pos.y - 2.2, this.pos.z);
    // 見た目: 進む向きに機首を向けて前に傾ける・ローターを回す
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 2) {
      const ty = Math.atan2(-this.vel.x, -this.vel.z);
      this.yaw += Math.atan2(Math.sin(ty - this.yaw), Math.cos(ty - this.yaw)) * Math.min(1, dt * 2);
    }
    this.model.position.copy(this.pos);
    this.model.rotation.set(-Math.min(0.35, hs / 90), this.yaw, 0, 'YXZ');
    this.rotor.rotation.y += dt * 40;
    this.tailRotor.rotation.x += dt * 50;
    // つかまっていないときは、ロープを下に垂らしておく (揺れる)
    this.dangle.visible = !carrying;
    if (!carrying) {
      const len = THREE.MathUtils.clamp(this.pos.y - player.p.y - 3, 12, 150);
      const sway = new THREE.Vector3(Math.sin(this.t * 1.3) * 0.05 - this.vel.x * 0.006, -1, Math.cos(this.t * 1.1) * 0.05 - this.vel.z * 0.006).normalize();
      this.dangle.position.copy(this.hook);
      this.dangle.scale.set(1, len, 1);
      this.dangle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sway);
      this.tip.position.copy(this.hook).addScaledVector(sway, len);
    }
    this.tip.visible = !carrying;
  }

  // 手 (hand) から垂らしたロープ (付け根〜先) までの距離
  reachDist(hand) {
    const a = this.hook, b = this.tip.position;
    const ab = b.clone().sub(a), ah = hand.clone().sub(a);
    const t = THREE.MathUtils.clamp(ah.dot(ab) / (ab.lengthSq() || 1), 0, 1);
    return a.clone().addScaledVector(ab, t).distanceTo(hand);
  }

  build(scene) {
    const g = this.model = new THREE.Group();
    const red = new THREE.MeshLambertMaterial({ color: 0xff3b30 });
    const white = new THREE.MeshLambertMaterial({ color: 0xf5f5f5 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x222831 });
    const glass = new THREE.MeshLambertMaterial({ color: 0x7fd6ff, emissive: 0x113344 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12), red);
    body.scale.set(1, 0.9, 1.6);
    g.add(body);
    const win = new THREE.Mesh(new THREE.SphereGeometry(1.7, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass);
    win.rotation.x = -Math.PI / 2.4;
    win.position.set(0, 0.5, -2.2);
    g.add(win);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, 6, 8), red);
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0, 0.6, 5.2);
    g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 1.2), white);
    fin.position.set(0, 1.4, 8);
    g.add(fin);
    this.tailRotor = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 0.25), dark);
    this.tailRotor.add(tr);
    this.tailRotor.position.set(0.3, 1.2, 8.1);
    g.add(this.tailRotor);
    this.rotor = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 11), dark);
      b.rotation.y = i * Math.PI / 4;
      this.rotor.add(b);
    }
    this.rotor.position.y = 2.4;
    g.add(this.rotor);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 6), dark);
    mast.position.y = 2.1;
    g.add(mast);
    for (const s of [-1, 1]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 5), white);
      skid.position.set(s * 1.5, -2.3, 0);
      g.add(skid);
    }
    // 夜でも見えるように赤い灯
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    beacon.position.set(0, -1.9, 0);
    g.add(beacon);
    scene.add(g);
    // 垂らしたロープと、先の持ち手
    const rg = new THREE.CylinderGeometry(0.035, 0.035, 1, 5, 1, true);
    rg.translate(0, 0.5, 0);
    this.dangle = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xfff1c8 }));
    this.dangle.frustumCulled = false;
    scene.add(this.dangle);
    this.tip = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.15, 6, 12), new THREE.MeshBasicMaterial({ color: 0xffb020 }));
    scene.add(this.tip);
  }
}
