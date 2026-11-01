// 鬼ごっこの鬼: 雲に乗った鬼が東京の空を徘徊し、プレイヤーを見つけると追いかけてくる。捕まったらアウト
// 清水の舞台から飛び降りるつもり (techgymjp/kiyomizu) の鬼を元に、ビルの街の大きさに合わせている
import * as THREE from '../vendor/three.module.min.js';

export const CATCH_RADIUS = 6;
const SCALE = 2.6;
const DETECT = 150;      // この距離にプレイヤーが入ると見つかる (m)。見失う距離より短くしておく
const LOSE = 200;        // これより離れると見失う (追いかけてくる鬼が全員これより離れると、ふだんの BGM に戻る)
const WANDER_SPEED = 6;
const WANDER_RADIUS = 300; // 持ち場のまわりをうろつく範囲
const SEPARATION = 35;   // 追いかける鬼どうしがこれより近いと離れる
const FIRST_SPAWN = 0.5; // 秒

function tigerTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f6b51e';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#1b1b1f';
  for (let x = -20; x < 140; x += 22) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + 14, 64, x, 128);
    ctx.lineTo(x + 8, 128);
    ctx.quadraticCurveTo(x + 22, 64, x + 8, 0);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeOni(color) {
  const g = new THREE.Group();
  const M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const skin = M(color), white = M(0xffffff), horn = M(0xfff1c4), hair = M(0x1b1b1f), iron = M(0x3a3a44);
  const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const tiger = new THREE.MeshLambertMaterial({ map: tigerTexture() });
  const add = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  // 雲
  const cloud = new THREE.Group();
  const cloudMat = M(0xffffff, { emissive: 0x666666 });
  for (const [x, y, z, r] of [[0, 0, 0, 1.1], [1, 0.1, 0.3, 0.8], [-1, 0.05, -0.2, 0.85], [0.4, 0.2, -0.8, 0.7], [-0.5, 0.15, 0.8, 0.7], [1.6, -0.1, -0.4, 0.55], [-1.6, -0.1, 0.4, 0.55]]) {
    add(cloud, new THREE.SphereGeometry(r, 9, 6), cloudMat, x, y, z).scale.y = 0.7;
  }
  cloud.position.y = -1.0;
  cloud.name = 'cloud';
  g.add(cloud);
  // 体
  add(g, new THREE.CapsuleGeometry(0.55, 0.7, 6, 12), skin, 0, 0.6, 0);
  add(g, new THREE.CylinderGeometry(0.62, 0.66, 0.5, 14), tiger, 0, 0.2, 0);
  for (const sx of [-1, 1]) add(g, new THREE.CapsuleGeometry(0.2, 0.3, 4, 8), skin, sx * 0.3, -0.25, 0);
  // 頭
  const head = new THREE.Group();
  head.name = 'head';
  head.position.y = 1.65;
  g.add(head);
  add(head, new THREE.SphereGeometry(0.55, 12, 9), skin, 0, 0, 0);
  for (const sx of [-1, 1]) {
    add(head, new THREE.ConeGeometry(0.13, 0.55, 10), horn, sx * 0.28, 0.5, 0).rotation.z = -sx * 0.3;
    add(head, new THREE.SphereGeometry(0.15, 10, 8), white, sx * 0.2, 0.08, -0.45);
    add(head, new THREE.SphereGeometry(0.07, 8, 6), black, sx * 0.2, 0.08, -0.59);
    add(head, new THREE.CylinderGeometry(0.035, 0.035, 0.3, 6), black, sx * 0.2, 0.28, -0.48).rotation.z = Math.PI / 2 + sx * 0.4;
    add(head, new THREE.ConeGeometry(0.05, 0.16, 6), white, sx * 0.15, -0.28, -0.46).rotation.x = Math.PI;
  }
  add(head, new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16, 1, false, 0, Math.PI), black, 0, -0.2, -0.5).rotation.x = Math.PI / 2;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    add(head, new THREE.SphereGeometry(0.2, 8, 6), hair, Math.cos(a) * 0.42, 0.3, Math.sin(a) * 0.42 + 0.1);
  }
  // 腕と金棒
  add(g, new THREE.CapsuleGeometry(0.16, 0.6, 4, 8), skin, -0.75, 0.75, 0).rotation.z = 0.5;
  const arm = new THREE.Group();
  arm.name = 'arm';
  arm.position.set(0.7, 1.05, 0);
  g.add(arm);
  add(arm, new THREE.CapsuleGeometry(0.16, 0.6, 4, 8), skin, 0.15, 0.3, 0).rotation.z = -0.5;
  add(arm, new THREE.CylinderGeometry(0.16, 0.09, 2.0, 8), iron, 0.35, 1.1, 0).rotation.z = -0.2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    add(arm, new THREE.ConeGeometry(0.06, 0.14, 5), white, 0.35 + Math.cos(a) * 0.15, 1.5 - (i % 3) * 0.3, Math.sin(a) * 0.15).rotation.z = -Math.PI / 2;
  }
  // 描画を軽くするため、部位ごとに1つのメッシュにまとめる
  for (const part of [g, cloud, head, arm]) flatten(part);
  g.scale.setScalar(SCALE);
  return g;
}

const flatMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
// group の直下にある単色のメッシュを、頂点カラー付きの1つのメッシュにまとめる
function flatten(group) {
  const pos = [], nor = [], col = [];
  for (const child of [...group.children]) {
    if (!child.isMesh || child.material.map) continue;
    child.updateMatrix();
    const geo = child.geometry.clone().applyMatrix4(child.matrix).toNonIndexed();
    const c = child.material.color;
    const p = geo.attributes.position.array, n = geo.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
    for (let i = 0; i < p.length / 3; i++) col.push(c.r, c.g, c.b);
    group.remove(child);
  }
  if (!pos.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  group.add(new THREE.Mesh(g, flatMaterial));
}

// 色ごとにひな形を作っておき、複製して使う (ジオメトリは共有)
const templates = new Map();
function buildOni(color) {
  if (!templates.has(color)) templates.set(color, makeOni(color));
  const g = templates.get(color).clone();
  g.userData.arm = g.getObjectByName('arm');
  g.userData.head = g.getObjectByName('head');
  g.userData.cloud = g.getObjectByName('cloud');
  return g;
}
const COLORS = [0xd83a2e, 0x2f5fd8, 0x2fa84f, 0x8a3fd8, 0xf0a020, 0x222222];
const tmp = new THREE.Vector3();

export class Oni {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.list = [];
    this.time = 0;
    this.pendingCount = 0;
    this.homes = [];
    // 最初に一度作っておく (ゲーム中にシェーダーを作ってカクつかないように)
    for (const c of COLORS) buildOni(c);
  }

  // 鬼のいてよい高さ: ビルの屋上より上
  heightAt(x, z) { return this.city.maxHeightNear(x, z, 40); }

  // homes: 持ち場の候補 [{x, z}]、count: 最初の数、safe: スタート地点からこの距離以内には置かない
  // ordered: homes がルートの順に並んでいる (ルートに沿って均等に置く)
  reset(homes, count, start, safe, ordered = false) {
    this.ordered = ordered;
    for (const o of this.list) this.scene.remove(o.obj);
    this.list = [];
    this.time = 0;
    this.homes = homes;
    this.pendingCount = count;
    this.start = start;
    this.safe = safe;
  }
  clear() { this.reset([], 0, null, 0); }

  spawnAt(home) {
    const n = this.list.length;
    const obj = buildOni(COLORS[n % COLORS.length]);
    const pos = new THREE.Vector3(home.x, 0, home.z);
    const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 160;
    pos.x += Math.cos(a) * r;
    pos.z += Math.sin(a) * r;
    // スタート地点に近づきすぎたら持ち場に戻す
    if (this.start && Math.hypot(pos.x - this.start.x, pos.z - this.start.z) < this.safe * 0.85) { pos.x = home.x; pos.z = home.z; }
    pos.y = this.heightAt(pos.x, pos.z) + 25 + Math.random() * 70;
    obj.position.copy(pos);
    this.scene.add(obj);
    const o = {
      obj, pos, vel: new THREE.Vector3(), phase: Math.random() * 6, n,
      home: new THREE.Vector3(home.x, 0, home.z), state: 'wander', waypoint: pos.clone(),
      flank: Math.random() * Math.PI * 2, // 回り込む方向 (鬼ごとに違う)
    };
    this.pickWaypoint(o);
    this.list.push(o);
    return o;
  }
  pickWaypoint(o) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * WANDER_RADIUS;
    const x = o.home.x + Math.cos(a) * r, z = o.home.z + Math.sin(a) * r;
    o.waypoint.set(x, this.heightAt(x, z) + 20 + Math.random() * 90, z);
  }
  // プレイヤーから離れた持ち場を、なるべくばらけるように選ぶ
  chooseHomes(count, from, minDist) {
    const list = this.homes.filter((h) => Math.hypot(h.x - from.x, h.z - from.z) > minDist);
    if (this.ordered && list.length) {
      // ルートに沿って均等に (かたまらないように)
      const out = [];
      for (let i = 0; i < count; i++) {
        const f = (i + 0.2 + Math.random() * 0.6) * list.length / count;
        out.push(list[Math.min(list.length - 1, Math.floor(f))]);
      }
      return out;
    }
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    const out = [];
    for (let i = 0; i < count && list.length; i++) out.push(list[i % list.length]);
    return out;
  }
  // フリー: プレイヤーのまわり (半径 R) で、ビルのある所 1km² あたり rho 匹の密度を保つ。
  // 遠くへ離れた (追いかけていない) 鬼は消し、足りなければ進む先の外側 (0.65R〜R) に出す
  // inner: これより近くには出さない (省略すると 0.65R。開始時は見つかる距離の外 400m から)
  maintain(player, rho, R, builtCells, inner = R * 0.65) {
    const px = player.p.x, pz = player.p.z;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const o = this.list[i];
      if (o.state !== 'chase' && Math.hypot(o.pos.x - px, o.pos.z - pz) > R * 1.3) {
        this.scene.remove(o.obj);
        this.list.splice(i, 1);
      }
    }
    const target = Math.round(rho * builtCells(px, pz, R));
    const ring = this.homes.filter((h) => { const d = Math.hypot(h.x - px, h.z - pz); return d > inner && d < R; });
    let near = this.list.filter((o) => Math.hypot(o.pos.x - px, o.pos.z - pz) < R).length;
    while (near < target && ring.length) {
      this.spawnAt(ring[Math.floor(Math.random() * ring.length)]);
      near++;
    }
  }
  // 1匹増やす (プレイヤーから離れた持ち場に)
  addOne(player) {
    const far = this.homes.filter((h) => Math.hypot(h.x - player.p.x, h.z - player.p.z) > 500);
    const pool = far.length ? far : this.homes;
    return pool.length ? this.spawnAt(pool[Math.floor(Math.random() * pool.length)]) : null;
  }

  // 戻り値: { spawned, found (見つけた鬼), nearest, nearestChase, caught }
  update(dt, player, active) {
    const out = { spawned: null, found: [], nearest: Infinity, nearestChase: Infinity, caught: false };
    if (active) {
      this.time += dt;
      if (this.pendingCount && this.time >= FIRST_SPAWN) {
        out.spawned = this.chooseHomes(this.pendingCount, this.start, this.safe).map((h) => this.spawnAt(h));
        this.pendingCount = 0;
      }
    }
    const chaseSpeed = Math.min(31, 13 + this.time * 0.05); // だんだん速くなる
    const p = tmp.set(player.p.x, player.p.y + 1, player.p.z).clone();
    for (const o of this.list) {
      o.phase += dt;
      if (active) {
        const d = o.pos.distanceTo(p);
        const desired = new THREE.Vector3();
        if (o.state === 'chase') {
          if (d > LOSE) {
            // 見失ったら持ち場に戻る
            o.state = 'wander';
            o.waypoint.set(o.home.x, this.heightAt(o.home.x, o.home.z) + 60, o.home.z);
          }
          // 少し先を、鬼ごとに違う方向から回り込むように狙う (近づくほど本体を直接狙う)
          const flankR = Math.min(50, d * 0.35);
          desired.copy(player.v).multiplyScalar(Math.min(3, d / 40)).add(p);
          desired.x += Math.cos(o.flank) * flankR;
          desired.z += Math.sin(o.flank) * flankR;
          desired.sub(o.pos).normalize().multiplyScalar(chaseSpeed + (o.n % 5) * 0.6);
          // 団子にならないよう、近くの追いかけ役から離れる
          for (const q of this.list) {
            if (q === o || q.state !== 'chase') continue;
            const dx = o.pos.x - q.pos.x, dy = o.pos.y - q.pos.y, dz = o.pos.z - q.pos.z;
            const dd = Math.hypot(dx, dy, dz);
            if (dd > 0.1 && dd < SEPARATION) {
              const k = ((SEPARATION - dd) / SEPARATION) * chaseSpeed * 0.8;
              desired.x += (dx / dd) * k; desired.y += (dy / dd) * k; desired.z += (dz / dd) * k;
            }
          }
          o.vel.lerp(desired, Math.min(1, dt * 0.9));
          out.nearestChase = Math.min(out.nearestChase, d);
        } else {
          if (d < DETECT) {
            o.state = 'chase'; // 見つけた！
            out.found.push(o);
          }
          if (o.pos.distanceTo(o.waypoint) < 20) this.pickWaypoint(o);
          desired.copy(o.waypoint).sub(o.pos).normalize().multiplyScalar(WANDER_SPEED);
          o.vel.lerp(desired, Math.min(1, dt * 0.6));
        }
        o.pos.addScaledVector(o.vel, dt);
        // ビルにはもぐらない (高さを調べるのは重いので 0.5 秒に1回、鬼ごとにずらして)
        o.groundTimer = (o.groundTimer ?? Math.random() * 0.5) - dt;
        if (o.groundTimer <= 0 || o.ground === undefined) {
          o.ground = this.heightAt(o.pos.x, o.pos.z);
          o.groundTimer = 0.5;
        }
        // 追いかけているときは、プレイヤーが低ければ下りてくる (ビルのすき間は通れる)
        const minY = o.state === 'chase' && d < 60 ? 4 : o.ground + 8;
        if (o.pos.y < minY) o.pos.y = minY;
        if (d < out.nearest) out.nearest = d;
        if (d < CATCH_RADIUS) out.caught = true;
      }
      // 遠くの鬼は描かない (数が多いステージでも重くならないように)
      o.obj.visible = Math.hypot(o.pos.x - p.x, o.pos.z - p.z) < 1500;
      if (!o.obj.visible) continue;
      // 見た目: ふわふわ浮いて、進む方向を向き、金棒を振る (追いかけるときは激しく)
      const chasing = o.state === 'chase';
      o.obj.position.copy(o.pos);
      o.obj.position.y += Math.sin(o.phase * 2) * 0.8;
      if (o.vel.lengthSq() > 0.1) o.obj.rotation.y = Math.atan2(-o.vel.x, -o.vel.z);
      o.obj.userData.arm.rotation.z = Math.sin(o.phase * (chasing ? 9 : 3)) * (chasing ? 0.8 : 0.3);
      o.obj.userData.head.rotation.z = Math.sin(o.phase * (chasing ? 3 : 1)) * (chasing ? 0.15 : 0.35);
      o.obj.userData.cloud.rotation.y += dt * 1.5;
    }
    return out;
  }
}
