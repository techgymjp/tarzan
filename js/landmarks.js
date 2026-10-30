// PLATEAU では箱になってしまう (または首都高グランプリで手作りモデルに置き換えて除いた) 名所を手作りする
import * as THREE from '../vendor/three.module.min.js';
import { ll } from './city.js';

function latticeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = '#fff';
  g.lineWidth = 14;
  g.strokeRect(0, 0, 128, 128);
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(128, 128);
  g.moveTo(128, 0); g.lineTo(0, 128);
  g.moveTo(0, 64); g.lineTo(128, 64);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// 東京タワー (333m)。外から見えるトラスの4面 + 展望台。当たり判定は脚・胴・展望台の柱で近似
export function addTokyoTower(scene, city) {
  const [X, Z] = ll(35.65860, 139.74540);
  const w = (y) => 92 * Math.pow(1 - y / 345, 2.1) + 2.2;
  const group = new THREE.Group();
  group.position.set(X, 0, Z);
  const tex = latticeTexture();
  const pos = [], uv = [], col = [];
  const orange = new THREE.Color(0xff4b14), white = new THREE.Color(0xf4f1ea);
  const STEP = 8;
  for (let y = 0; y < 300; y += STEP) {
    const y2 = y + STEP;
    const a = w(y) / 2, b = w(y2) / 2;
    const band = Math.floor(y / 27.5) % 2 === 0 ? orange : white;
    for (let s = 0; s < 4; s++) {
      const ang = s * Math.PI / 2;
      const cs = Math.cos(ang), sn = Math.sin(ang);
      const P = (x, yy, z) => [x * cs - z * sn, yy, x * sn + z * cs];
      const p0 = P(-a, y, a), p1 = P(a, y, a), p2 = P(b, y2, b), p3 = P(-b, y2, b);
      pos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
      const ua = a / 8, ub = b / 8, v0 = y / 10, v1 = y2 / 10;
      uv.push(-ua, v0, ua, v0, ub, v1, -ua, v0, ub, v1, -ub, v1);
      for (let k = 0; k < 6; k++) col.push(band.r, band.g, band.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, alphaTest: 0.5, transparent: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, mat);
  group.add(mesh);
  // 4隅の主柱 (遠くからでも形が分かるように)
  const beamMat = new THREE.MeshLambertMaterial({ color: 0xff4b14 });
  const beamWhite = new THREE.MeshLambertMaterial({ color: 0xf4f1ea });
  const up = new THREE.Vector3(0, 1, 0);
  for (let y = 0; y < 300; y += STEP) {
    const y2 = y + STEP, a = w(y) / 2, b = w(y2) / 2;
    const m = Math.floor(y / 27.5) % 2 === 0 ? beamMat : beamWhite;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p0 = new THREE.Vector3(sx * a, y, sz * a), p1 = new THREE.Vector3(sx * b, y2, sz * b);
      const len = p0.distanceTo(p1);
      const r = Math.max(0.6, a * 0.06);
      const c = new THREE.Mesh(new THREE.BoxGeometry(r * 2, len, r * 2), m);
      c.position.copy(p0).add(p1).multiplyScalar(0.5);
      c.quaternion.setFromUnitVectors(up, p1.clone().sub(p0).normalize());
      group.add(c);
    }
  }
  // 脚のアーチの下の白い梁
  const deckMat = new THREE.MeshLambertMaterial({ color: 0xdedbd4 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x334455, emissive: 0x000000 });
  const main = new THREE.Mesh(new THREE.CylinderGeometry(22, 24, 12, 8), glassMat);
  main.position.y = 150; main.rotation.y = Math.PI / 8;
  group.add(main);
  const mainRoof = new THREE.Mesh(new THREE.CylinderGeometry(20, 22, 3, 8), deckMat);
  mainRoof.position.y = 157.5; mainRoof.rotation.y = Math.PI / 8;
  group.add(mainRoof);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 7, 8), glassMat);
  top.position.y = 250; top.rotation.y = Math.PI / 8;
  group.add(top);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 2.2, 45, 6), new THREE.MeshLambertMaterial({ color: 0xff4b14 }));
  ant.position.y = 300 + 22;
  group.add(ant);
  // フットタウン (足元のビル)
  const ft = new THREE.Mesh(new THREE.BoxGeometry(90, 18, 70), deckMat);
  ft.position.set(0, 9, 55);
  group.add(ft);
  scene.add(group);
  // 夜のライトアップ
  const light = new THREE.PointLight(0xff8a3c, 0, 450, 2);
  light.position.set(X, 120, Z);
  scene.add(light);

  // 当たり判定
  city.addBox(X, Z + 55, 90, 70, 0, 18, '東京タワー フットタウン').roof = true;
  const leg = 10;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    for (let y = 0; y < 60; y += 15) {
      const off = w(y + 7) / 2 - leg / 2;
      city.addBox(X + sx * off, Z + sz * off, leg, leg, y, y + 15, '東京タワー');
    }
  }
  for (let y = 60; y < 300; y += 12) {
    const s = w(y + 6);
    city.addBox(X, Z, s, s, y, y + 12, '東京タワー');
  }
  city.addBox(X, Z, 46, 46, 144, 159, '東京タワー メインデッキ').roof = true;
  city.addBox(X, Z, 3, 3, 300, 345, '東京タワー');
  return { light, mats: [glassMat], glow: [beamMat, beamWhite, mat], pos: [X, Z] };
}

// 国会議事堂: 左右対称の本体 + 中央塔 (ピラミッド屋根)
export function addDiet(scene, city) {
  const [X, Z] = ll(35.67590, 139.74480);
  const g = new THREE.Group();
  g.position.set(X, 0, Z);
  const stone = new THREE.MeshLambertMaterial({ color: 0xe6dfcf });
  const roof = new THREE.MeshLambertMaterial({ color: 0x7f9a86 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  add(new THREE.BoxGeometry(206, 21, 70), stone, 0, 10.5, 0);
  add(new THREE.BoxGeometry(60, 6, 88), stone, -70, 24, 0);
  add(new THREE.BoxGeometry(60, 6, 88), stone, 70, 24, 0);
  add(new THREE.BoxGeometry(34, 26, 34), stone, 0, 34, 0);
  add(new THREE.BoxGeometry(26, 10, 26), stone, 0, 52, 0);
  const pyr = add(new THREE.ConeGeometry(17, 14, 4), roof, 0, 64, 0);
  pyr.rotation.y = Math.PI / 4;
  scene.add(g);
  city.addBox(X, Z, 206, 70, 0, 21, '国会議事堂').roof = true;
  city.addBox(X, Z, 34, 34, 0, 47, '国会議事堂 中央塔');
  city.addBox(X, Z, 26, 26, 47, 57, '国会議事堂 中央塔');
  city.addBox(X, Z, 12, 12, 57, 70, '国会議事堂 中央塔');
}

// 遠くに見える東京スカイツリー (634m)
export function addSkytree(scene) {
  const [X, Z] = ll(35.71010, 139.81070);
  const g = new THREE.Group();
  g.position.set(X, 0, Z);
  const m = new THREE.MeshLambertMaterial({ color: 0xd8e2ea, fog: false });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(5, 34, 500, 12), m);
  body.position.y = 250;
  g.add(body);
  const d1 = new THREE.Mesh(new THREE.CylinderGeometry(19, 19, 14, 16), m);
  d1.position.y = 350;
  g.add(d1);
  const d2 = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 8, 16), m);
  d2.position.y = 448;
  g.add(d2);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 4, 134, 8), m);
  ant.position.y = 567;
  g.add(ant);
  scene.add(g);
  return m;
}

// 富士山 (西南西の地平線)
export function addFuji(scene) {
  const [X, Z] = ll(35.3606, 138.7274);
  const d = Math.hypot(X, Z);
  // 本当は約 95km 先。描画の都合で 14km 先に縮めて置く (見える角度は同じ)
  const k = 14000 / d;
  const geo = new THREE.ConeGeometry(3776 * k * 3.1, 3776 * k, 48, 1, true);
  const c = geo.attributes.position;
  const cols = [];
  for (let i = 0; i < c.count; i++) {
    const y = c.getY(i) / (3776 * k) + 0.5;
    if (y > 0.8) cols.push(0.95, 0.96, 1); else cols.push(0.42, 0.5, 0.66);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.8 });
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(X * k, 3776 * k / 2 - 40, Z * k);
  scene.add(mesh);
  return m;
}

// テックジム東京本校 (千代田区平河町2-7-2 VORT永田町 6F)。首都高グランプリ (techgymjp/shutoko) のモデルを元にしている
// 10階建てのビル・6階のオレンジの帯・屋上の紅白の鉄塔と看板・高さ約520mのアドバルーンと垂れ幕
const JP = '"Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif';
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function addTechGym(scene, city) {
  const [X, Z] = ll(35.68022, 139.74014);
  const [FX, FZ] = ll(35.68010, 139.73300); // 正面 (+z) を向ける方向
  const rot = Math.atan2(FX - X, FZ - Z);
  const g = new THREE.Group();
  g.position.set(X, 0, Z);
  g.rotation.y = rot;
  const W = 24, D = 20, H = 36.5;
  const M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  // ビル本体 (窓)
  const winTex = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#d8dde2';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#3d4f63';
    for (let y = 0; y < 10; y++) for (let x = 0; x < 6; x++) c.fillRect(x * 42 + 6, y * 50 + 10, 32, 32);
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), new THREE.MeshLambertMaterial({ map: winTex }));
  body.position.y = H / 2;
  g.add(body);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(W + 1, 1.2, D + 1), M(0x5c646b));
  crown.position.y = H + 0.6;
  g.add(crown);
  // 6階: オレンジに光る窓の帯と「TECH GYM 6F」
  const band = canvasTex(1024, 128, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#ffb347');
    gr.addColorStop(1, '#ff7a00');
    c.fillStyle = gr;
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    for (let x = 0; x < w; x += 64) c.fillRect(x, 0, 4, h);
    c.fillStyle = '#0b1a2e';
    c.font = `900 84px ${JP}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('TECH GYM  6F', w / 2, h / 2 + 4);
  });
  const bandMat = new THREE.MeshBasicMaterial({ map: band });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(W, 3.5), bandMat);
  front.position.set(0, 20.25, D / 2 + 0.06);
  g.add(front);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(D, 3.5), bandMat);
    side.position.set(sx * (W / 2 + 0.06), 20.25, 0);
    side.rotation.y = sx * Math.PI / 2;
    g.add(side);
  }
  // 正面の角に縦の看板
  const vt = canvasTex(160, 640, (c, w, h) => {
    c.fillStyle = '#ff7a00';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff';
    c.font = `900 96px ${JP}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    ['テ', 'ッ', 'ク', 'ジ', 'ム'].forEach((ch, i) => c.fillText(ch, w / 2, 70 + i * 122));
  });
  const v = new THREE.Mesh(new THREE.PlaneGeometry(3, 12), new THREE.MeshBasicMaterial({ map: vt }));
  v.position.set(W / 2 - 2, 29, D / 2 + 0.08);
  g.add(v);
  // 屋上から紅白の鉄塔を立て、まわりの高層ビルの上に看板を掲げる
  const TOP = 182;
  const red = M(0xd8341f, { side: THREE.DoubleSide }), white = M(0xf2f2f2, { side: THREE.DoubleSide });
  const segs = 10;
  for (let i = 0; i < segs; i++) {
    const y0 = H + ((TOP - 12 - H) * i) / segs, y1 = H + ((TOP - 12 - H) * (i + 1)) / segs;
    const r0 = 5 - 3 * (i / segs), r1 = 5 - 3 * ((i + 1) / segs);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0, 4, 1, true), i % 2 ? white : red);
    m.rotation.y = Math.PI / 4;
    m.position.y = (y0 + y1) / 2;
    g.add(m);
  }
  const signTex = canvasTex(1024, 320, (c, w, h) => {
    c.fillStyle = '#0b1a2e';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#ff7a00';
    c.fillRect(0, 0, w, 16);
    c.fillRect(0, h - 16, w, 16);
    c.fillStyle = '#ffffff';
    c.font = `900 150px ${JP}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('TECH GYM', w / 2, h * 0.42);
    c.fillStyle = '#ffb347';
    c.font = `900 56px ${JP}`;
    c.fillText('テックジム東京本校  永田町4番出口', w / 2, h * 0.8);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(40, 12.5), new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide }));
  sign.position.set(0, TOP - 6, 0);
  g.add(sign);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(41, 13.5, 0.6), M(0x2a2f35));
  frame.position.set(0, TOP - 6, -0.4);
  g.add(frame);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  beacon.position.y = TOP + 1;
  g.add(beacon);
  // アドバルーン: 遠くからも見えるよう大きく高く上げ、霧で消えないようにする (高さ約520m・直径約140m。ゲームの演出)
  const balloon = new THREE.Group();
  const BY = 520, BR = 70;
  const ballTex = canvasTex(1024, 512, (c, w, h) => {
    c.fillStyle = '#ff6a00';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff';
    c.fillRect(0, h * 0.38, w, h * 0.24);
    c.fillStyle = '#0b1a2e';
    c.font = `900 ${h * 0.17}px ${JP}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    // 球の周りに2回書く (どこから見ても読める)
    c.fillText('TECH GYM', w * 0.25, h / 2 + 4);
    c.fillText('TECH GYM', w * 0.75, h / 2 + 4);
  });
  const ballMat = new THREE.MeshLambertMaterial({ map: ballTex, emissive: 0x2a1000, fog: false });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BR, 32, 20), ballMat);
  ball.position.y = BY;
  balloon.add(ball);
  // 垂れ幕 (縦書き)
  const bannerTex = canvasTex(192, 1024, (c, w, h) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#ff6a00';
    c.fillRect(0, 0, 14, h);
    c.fillRect(w - 14, 0, 14, h);
    c.fillStyle = '#0b1a2e';
    const txt = [...'テックジム東京本校'];
    const step = (h - 60) / txt.length;
    c.font = `900 ${Math.min(108, step * 0.9)}px ${JP}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    txt.forEach((ch, i) => c.fillText(ch, w / 2, 30 + step * (i + 0.5)));
  });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(42, 226), new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide, fog: false }));
  banner.position.y = BY - BR - 117;
  balloon.add(banner);
  // ロープ (屋上の看板の上から)
  const ropeLen = BY - BR - 230 - (TOP + 2);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, ropeLen, 4), new THREE.MeshBasicMaterial({ color: 0x555555, fog: false }));
  rope.position.y = TOP + 2 + ropeLen / 2;
  g.add(rope);
  g.add(balloon);
  scene.add(g);

  // 当たり判定 (ビル・鉄塔・看板・アドバルーン)。ビルの屋上に降りると図鑑に載る
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const corner = (lx, lz) => [X + lx * cs + lz * sn, Z - lx * sn + lz * cs];
  const rect = (w, d) => [...corner(-w / 2, -d / 2), ...corner(w / 2, -d / 2), ...corner(w / 2, d / 2), ...corner(-w / 2, d / 2)];
  city.addPrism(rect(W, D), 0, H + 1.2, 'テックジム東京本校').roof = true;
  city.addPrism(rect(6, 6), H + 1.2, TOP - 12, 'テックジムの鉄塔');
  city.addPrism(rect(41, 1.2), TOP - 12.75, TOP + 0.75, 'テックジムの看板');
  city.addBox(X, Z, BR * 1.6, BR * 1.6, BY - BR * 0.8, BY + BR * 0.8, 'テックジムのアドバルーン');
  return {
    pos: [X, Z],
    // 風でゆっくり揺れる
    update(t) {
      balloon.rotation.z = Math.sin(t * 0.5) * 0.03;
      balloon.rotation.x = Math.sin(t * 0.37 + 1) * 0.025;
      balloon.rotation.y = t * 0.05;
    },
    setNight(k) { ballMat.emissive.setHex(k === 'night' ? 0x803000 : k === 'dusk' ? 0x4a1c00 : 0x2a1000); },
  };
}

// 東京ドーム (文京区後楽1-3-61)。PLATEAU では円柱の箱なので、白い膜屋根がふくらんだドームに作り直す
// 直径 約200m・高さ 約56m。屋根の上に降りられる (段々の柱で当たり判定)
export function addTokyoDome(scene, city) {
  const [X, Z] = ll(35.70563, 139.75192);
  const RW = 100, WALL = 28, TOP = 56;
  const R = (RW * RW + (TOP - WALL) ** 2) / (2 * (TOP - WALL)); // 屋根の球の半径
  const YC = TOP - R; // 球の中心の高さ
  const g = new THREE.Group();
  g.position.set(X, 0, Z);
  // 膜屋根: 白地にケーブルの線
  const roofTex = canvasTex(1024, 256, (c, w, h) => {
    c.fillStyle = '#f4f6f8';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(150,160,175,0.7)';
    c.lineWidth = 3;
    for (let i = 0; i <= 32; i++) { c.beginPath(); c.moveTo(i * w / 32, 0); c.lineTo(i * w / 32, h); c.stroke(); }
    for (let j = 1; j < 4; j++) { c.beginPath(); c.moveTo(0, j * h / 4); c.lineTo(w, j * h / 4); c.stroke(); }
  });
  const roofMat = new THREE.MeshLambertMaterial({ map: roofTex, emissive: 0x000000 });
  const roof = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 12, 0, Math.PI * 2, 0, Math.asin(RW / R)), roofMat);
  roof.position.y = YC;
  g.add(roof);
  // 外壁 (ガラスと白い柱) と、屋根との境の輪
  const wallTex = canvasTex(1024, 128, (c, w, h) => {
    c.fillStyle = '#9fb4c4';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#eef1f4';
    for (let x = 0; x < w; x += 32) c.fillRect(x, 0, 8, h);
    c.fillRect(0, 0, w, 14);
    c.fillRect(0, h * 0.55, w, 10);
  });
  wallTex.wrapS = THREE.RepeatWrapping;
  wallTex.repeat.set(4, 1);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(RW, RW + 3, WALL, 64, 1, true), new THREE.MeshLambertMaterial({ map: wallTex }));
  wall.position.y = WALL / 2;
  g.add(wall);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(RW, 1.6, 8, 64), new THREE.MeshLambertMaterial({ color: 0xdadfe4 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = WALL;
  g.add(rim);
  // まわりの広場
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(RW + 25, 48), new THREE.MeshLambertMaterial({ color: 0xc9c4ba }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.1;
  g.add(plaza);
  scene.add(g);
  // 当たり判定: 外壁の円柱 + 屋根を段々の柱で近似 (屋根の上に降りられる)
  const ngon = (r) => {
    const pts = [];
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; pts.push(X + Math.cos(a) * r, Z + Math.sin(a) * r); }
    return pts;
  };
  city.addPrism(ngon(RW + 1), 0, WALL, '東京ドーム').roof = true;
  for (let y = WALL + 4; y <= TOP - 1; y += 4) {
    const r = Math.sqrt(R * R - (y - YC) ** 2);
    city.addPrism(ngon(r), 0, y, '東京ドーム').roof = true;
  }
  return {
    pos: [X, Z],
    // 夜はナイターで膜屋根がほんのり光る
    setNight(k) { roofMat.emissive.setHex(k === 'night' ? 0x6a7280 : k === 'dusk' ? 0x2a2c30 : 0x000000); },
  };
}

// 日本武道館 (千代田区北の丸公園2-3)。PLATEAU では八角形の箱なので、反りのある八角形の大屋根と
// 金色の擬宝珠 (ぎぼし) を作る。幅 約110m・高さ 約45m。屋根の段に降りられる
export function addBudokan(scene, city) {
  const [X, Z] = ll(35.69332, 139.74983);
  const g = new THREE.Group();
  g.position.set(X, 0, Z);
  g.rotation.y = Math.PI / 8; // 八角形の辺を東西南北に向ける
  const oct = (profile) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 8);
  // 本体 (白い壁と窓の帯)
  const wallTex = canvasTex(512, 64, (c, w, h) => {
    c.fillStyle = '#ece6d8';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#5a5246';
    for (let x = 0; x < w; x += 32) c.fillRect(x + 6, h * 0.35, 20, h * 0.4);
  });
  wallTex.wrapS = THREE.RepeatWrapping;
  wallTex.repeat.set(4, 1);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(55, 56, 14, 8, 1, true), new THREE.MeshLambertMaterial({ map: wallTex, side: THREE.DoubleSide }));
  body.position.y = 7;
  g.add(body);
  // 大屋根: 富士山のように反った八角形 (下ほどゆるい)
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5f6c66, side: THREE.DoubleSide });
  g.add(new THREE.Mesh(oct([[60, 13.5], [48, 16.5], [38, 20.5], [30, 25], [23, 30]]), roofMat));
  // 上の段 (白い胴と小屋根)
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(21, 21, 3.5, 8, 1, true), new THREE.MeshLambertMaterial({ color: 0xf2eee4, side: THREE.DoubleSide }));
  drum.position.y = 31.6;
  g.add(drum);
  g.add(new THREE.Mesh(oct([[25, 33], [16, 36], [8, 39], [2.5, 40.6]]), roofMat));
  // 金色の擬宝珠
  const gold = new THREE.MeshLambertMaterial({ color: 0xe0b030, emissive: 0x3a2800 });
  g.add(new THREE.Mesh(new THREE.LatheGeometry([[0, 40.4], [2.4, 41.2], [3.3, 42.4], [2.6, 43.8], [1.1, 44.9], [0.35, 45.6], [0, 46.3]].map(([r, y]) => new THREE.Vector2(r, y)), 16), gold));
  scene.add(g);
  // 当たり判定: 八角形の柱を段々に (屋根の段に降りられる)
  const octPts = (r) => {
    const pts = [];
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; pts.push(X + Math.cos(a) * r, Z - Math.sin(a) * r); }
    return pts;
  };
  for (const [r, y] of [[57, 14], [48, 16.5], [38, 20.5], [30, 25], [23, 30], [21, 33], [16, 36], [8, 39]]) {
    const bd = city.addPrism(octPts(r), 0, y, '日本武道館');
    bd.roof = true;
    // チェックポイントの玉は大屋根の段 (高さ25m) の東側に置く
    if (y === 25) bd.cpAt = [X + 26, Z];
  }
  return { pos: [X, Z] };
}
