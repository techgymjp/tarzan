// 下町・お茶の水・赤坂の名所 (手作り): 浅草寺・アサヒの炎・西郷隆盛像・弁天堂・ニコライ堂・神田明神・将門塚・
// 東京駅 丸の内駅舎・聖橋・日枝神社・豊川稲荷、総武線と中央線 (万世橋のレンガ高架) の電車、秋葉原 電気街の看板
import * as THREE from '../vendor/three.module.min.js';
import { ll } from './city.js';
import { hipGeo, hallBuilding, canvasTex, JP } from './landmarks.js';

const M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const VERM = 0xc8352a; // 朱色
function mesh(geo, mat, x, y, z, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
// 回転した長方形の当たり判定用の点
function rectPts(X, Z, rot, lx, lz, w, d) {
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const c = (ax, az) => [X + (lx + ax) * cs + (lz + az) * sn, Z - (lx + ax) * sn + (lz + az) * cs];
  return [...c(-w / 2, -d / 2), ...c(w / 2, -d / 2), ...c(w / 2, d / 2), ...c(-w / 2, d / 2)];
}
// 鳥居
function torii(parent, x, z, rot, w, h, mat) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(0.45, 0.55, h, 10), mat, s * w / 2, h / 2, 0, g);
  mesh(new THREE.BoxGeometry(w + 3, 0.9, 1.1), mat, 0, h, 0, g);
  mesh(new THREE.BoxGeometry(w + 1, 0.6, 0.7), mat, 0, h - 1.6, 0, g);
  mesh(new THREE.BoxGeometry(w + 3.6, 0.35, 1.3), M(0x222222), 0, h + 0.6, 0, g);
  parent.add(g);
}
// 塔 (五重塔) の1層
function pagodaTier(parent, y, w, h, wallMat, roofMat) {
  mesh(new THREE.BoxGeometry(w, h, w), wallMat, 0, y + h / 2, 0, parent);
  const roof = mesh(hipGeo, roofMat, 0, y + h + 0.9, 0, parent);
  roof.scale.set(w + 5, 1.8, w + 5);
}

// ---------- 浅草寺 ----------
export function addSensoji(scene, city) {
  const g = new THREE.Group();
  const verm = M(VERM), roofM = M(0x4a4f55), white = M(0xf2efe6);
  // 本堂
  const [HX, HZ] = ll(35.71480, 139.79670);
  hallBuilding(g, city, HX, HZ, 0, 0, 0, 34, 40, 12, 18, verm, roofM, '浅草寺 本堂');
  // 五重塔 (約53m)
  const [PX, PZ] = ll(35.71445, 139.79590);
  const pg = new THREE.Group();
  pg.position.set(PX, 0, PZ);
  mesh(new THREE.BoxGeometry(14, 3, 14), M(0x8d8a82), 0, 1.5, 0, pg);
  let y = 3, w = 10;
  for (let i = 0; i < 5; i++) {
    pagodaTier(pg, y, w, 5.5, verm, roofM);
    city.addBox(PX, PZ, w + 2, w + 2, 0, y + 7.3, '浅草寺 五重塔');
    y += 7.3;
    w *= 0.9;
  }
  mesh(new THREE.CylinderGeometry(0.35, 0.6, 12, 8), M(0xd4a62a, { emissive: 0x2a1c00 }), 0, y + 6, 0, pg);
  g.add(pg);
  // 宝蔵門 (2階建ての門)
  const [BX, BZ] = ll(35.71330, 139.79650);
  hallBuilding(g, city, BX, BZ, 0, 0, 0, 22, 10, 14, 7, verm, roofM, '浅草寺 宝蔵門');
  // 雷門 (門と大提灯)
  const [KX, KZ] = ll(35.71110, 139.79630);
  hallBuilding(g, city, KX, KZ, 0, 0, 0, 14, 7, 8, 4, verm, roofM, '雷門');
  const lanternTex = canvasTex(256, 256, (c, w2, h2) => {
    c.fillStyle = '#c4161c';
    c.fillRect(0, 0, w2, h2);
    c.fillStyle = '#111';
    c.fillRect(0, 0, w2, 22);
    c.fillRect(0, h2 - 22, w2, 22);
    c.font = `900 120px ${JP}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('雷門', w2 * 0.25, h2 / 2);
    c.fillText('雷門', w2 * 0.75, h2 / 2);
  });
  // 門の口 (黒) と大提灯
  const opening = mesh(new THREE.BoxGeometry(6, 7.5, 7.2), M(0x2a2420), KX, 3.75, KZ, g);
  opening.renderOrder = 1;
  const lantern = mesh(new THREE.CylinderGeometry(1.7, 1.7, 3.9, 20), new THREE.MeshLambertMaterial({ map: lanternTex }), KX, 4.2, KZ + 3.8, g);
  lantern.rotation.y = Math.PI / 2;
  scene.add(g);
  return { pos: [HX, HZ], pagoda: [PX, PZ], kaminari: [KX, KZ] };
}

// ---------- アサヒ: スーパードライホールの金の炎のオブジェと、ビアタワーの白い泡 ----------
export function addAsahi(scene, city) {
  const g = new THREE.Group();
  const [AX, AZ] = ll(35.70983, 139.80032);
  // ホール: 黒い逆台形 (上が広い)
  const hall = mesh(new THREE.CylinderGeometry(22 * Math.SQRT2, 18 * Math.SQRT2, 22, 4), M(0x1b1b1f), AX, 11, AZ, g);
  hall.rotation.y = Math.PI / 4;
  const h1 = city.addBox(AX, AZ, 40, 40, 0, 22, 'アサヒ スーパードライホール');
  h1.roof = true;
  // 金の炎: 横に寝かせたしずく形
  const prof = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    prof.push(new THREE.Vector2(Math.sin(Math.PI * Math.pow(t, 0.7)) * 7 * (1 - t * 0.6), t * 40));
  }
  const flame = mesh(new THREE.LatheGeometry(prof, 24), M(0xe8b030, { emissive: 0x3a2400 }), AX - 12, 30, AZ, g);
  flame.rotation.z = -Math.PI / 2 + 0.25;
  flame.scale.set(1, 1, 0.75);
  // ビアタワー (PLATEAU の 95m のビル) の上に白い泡
  const [TX, TZ] = ll(35.71012, 139.80080);
  let tower = null;
  for (const bd of city.cell(TX, TZ) || []) if (bd.plateau && city.inside(bd, TX, TZ) && (!tower || bd.h > tower.h)) tower = bd;
  if (tower) {
    const w = (tower.maxx - tower.minx) * 0.7, d = (tower.maxz - tower.minz) * 0.7;
    mesh(new THREE.BoxGeometry(w, 7, d), M(0xfbfbf5), tower.cx, tower.h + 3.5, tower.cz, g);
    city.addBox(tower.cx, tower.cz, w, d, tower.h - 0.5, tower.h + 7, 'アサヒビールタワー').roof = true;
  }
  scene.add(g);
  return { pos: [AX, AZ], tower: tower ? [tower.cx, tower.cz, tower.h] : [TX, TZ, 95] };
}

// ---------- 上野: 西郷隆盛像・不忍池の弁天堂 ----------
export function addUeno(scene, city) {
  const g = new THREE.Group();
  // 西郷隆盛像 (台座 + 銅像 + 犬)
  const [SX, SZ] = ll(35.71150, 139.77400);
  mesh(new THREE.BoxGeometry(6, 3.5, 6), M(0xb8b2a6), SX, 1.75, SZ, g);
  const bronze = M(0x3b3a33);
  mesh(new THREE.BoxGeometry(1.4, 2.2, 1), bronze, SX, 4.6, SZ, g);
  mesh(new THREE.SphereGeometry(0.45, 10, 8), bronze, SX, 6.1, SZ, g);
  mesh(new THREE.BoxGeometry(0.5, 0.6, 1.2), bronze, SX + 1, 3.8, SZ, g);
  const ped = city.addBox(SX, SZ, 6, 6, 0, 3.5, '西郷隆盛像');
  ped.roof = true;
  ped.cpAt = [SX + 2.1, SZ + 2.1];
  // 弁天堂 (池の中島の八角形のお堂) と、南の舞台
  const [BX, BZ] = ll(35.71230, 139.77030);
  const hall = mesh(new THREE.CylinderGeometry(8, 8, 6, 8), M(VERM), BX, 3, BZ, g);
  hall.rotation.y = Math.PI / 8;
  const roof = mesh(new THREE.ConeGeometry(11, 6, 8), M(0x3e4448), BX, 9, BZ, g);
  roof.rotation.y = Math.PI / 8;
  mesh(new THREE.SphereGeometry(0.7, 8, 6), M(0xd4a62a), BX, 12.3, BZ, g);
  mesh(new THREE.CylinderGeometry(24, 24, 0.6, 24), M(0xcfc8b6), BX, 0.3, BZ, g); // 中島
  mesh(new THREE.BoxGeometry(8, 1.2, 8), M(0x8a6a4a), BX, 0.6, BZ + 15, g); // 舞台
  city.addBox(BX, BZ, 15, 15, 0, 8, '不忍池 弁天堂');
  const deck = city.addBox(BX, BZ + 15, 8, 8, 0, 1.2, '不忍池 弁天堂');
  deck.roof = true;
  deck.cpAt = [BX, BZ + 15];
  scene.add(g);
  return { saigo: [SX, SZ], benten: [BX, BZ] };
}

// ---------- お茶の水・神田: ニコライ堂・神田明神・聖橋・将門塚 ----------
export function addOchanomizu(scene, city) {
  const g = new THREE.Group();
  // ニコライ堂: 石造りの本体 + 緑のドーム + 西の鐘楼
  const [NX, NZ] = ll(35.69780, 139.76510);
  const stone = M(0xd9cdb8), green = M(0x4f8f73);
  mesh(new THREE.BoxGeometry(30, 18, 40), stone, NX, 9, NZ, g);
  mesh(new THREE.CylinderGeometry(10, 10, 8, 16), stone, NX, 22, NZ, g);
  mesh(new THREE.SphereGeometry(11, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), green, NX, 26, NZ, g);
  mesh(new THREE.BoxGeometry(0.6, 5, 0.6), M(0xd4a62a), NX, 39.5, NZ, g);
  mesh(new THREE.BoxGeometry(3, 0.6, 0.6), M(0xd4a62a), NX, 40.5, NZ, g);
  mesh(new THREE.BoxGeometry(9, 30, 9), stone, NX - 22, 15, NZ, g);
  mesh(new THREE.SphereGeometry(5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), green, NX - 22, 30, NZ, g);
  city.addBox(NX, NZ, 30, 40, 0, 18, 'ニコライ堂').roof = true;
  city.addBox(NX, NZ, 20, 20, 18, 34, 'ニコライ堂');
  city.addBox(NX - 22, NZ, 9, 9, 0, 33, 'ニコライ堂');
  // 神田明神: 朱色の御社殿 (緑青の屋根) と随神門
  const [KX, KZ] = ll(35.70200, 139.76790);
  hallBuilding(g, city, KX, KZ, 0.2, 0, 0, 24, 18, 9, 9, M(VERM), M(0x4f7f6f), '神田明神');
  hallBuilding(g, city, KX, KZ, 0.2, 0, 42, 16, 8, 7, 5, M(VERM), M(0x4f7f6f), '神田明神 随神門');
  // 聖橋: 神田川の谷にかかる白いアーチ橋 (南北)
  const [HX, HZ] = ll(35.70040, 139.76550);
  const conc = M(0xd8d6cf);
  mesh(new THREE.BoxGeometry(22, 2, 90), conc, HX, 15, HZ, g);
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(1, 1.2, 90), conc, HX + s * 10.5, 16.6, HZ, g);
  const arch = mesh(new THREE.TorusGeometry(26, 2.2, 8, 24, Math.PI), conc, HX, -11, HZ, g);
  arch.rotation.y = Math.PI / 2;
  city.addBox(HX, HZ, 22, 90, 13, 16, '聖橋').roof = true;
  // 将門塚: 石碑
  const [MX, MZ] = ll(35.68680, 139.76320);
  mesh(new THREE.BoxGeometry(5, 0.8, 5), M(0x9a958b), MX, 0.4, MZ, g);
  mesh(new THREE.BoxGeometry(1.4, 2.6, 0.5), M(0x4a4a46), MX, 2.1, MZ, g);
  city.addBox(MX, MZ, 5, 5, 0, 0.8, '将門塚').roof = true;
  scene.add(g);
  return { nikolai: [NX, NZ], kanda: [KX, KZ], hijiri: [HX, HZ], masakado: [MX, MZ] };
}

// ---------- 東京駅 丸の内駅舎: 赤レンガの3階建て (約335m) と南北のドーム ----------
export function addTokyoStation(scene, city) {
  const [AX, AZ] = ll(35.67960, 139.76630), [BX, BZ] = ll(35.68280, 139.76790);
  const X = (AX + BX) / 2, Z = (AZ + BZ) / 2;
  const L = 335, rot = Math.atan2(BX - AX, BZ - AZ);
  const brick = canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = '#a8442e';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#efe7d8';
    c.fillRect(0, h * 0.3, w, 6);
    c.fillRect(0, h * 0.62, w, 6);
    c.fillStyle = '#2f3a44';
    for (let x = 0; x < w; x += 32) for (const y of [h * 0.08, h * 0.38, h * 0.7]) c.fillRect(x + 10, y, 12, h * 0.18);
  });
  brick.wrapS = THREE.RepeatWrapping;
  brick.repeat.set(20, 1);
  const g = new THREE.Group();
  g.position.set(X, 0, Z);
  g.rotation.y = rot;
  const body = new THREE.MeshLambertMaterial({ map: brick });
  mesh(new THREE.BoxGeometry(22, 20, L), body, 0, 10, 0, g);
  const roofM = M(0x4c4f52);
  const r = mesh(hipGeo, roofM, 0, 22, 0, g);
  r.scale.set(24, 4, L + 2);
  // 中央と南北のドーム
  for (const t of [-L / 2 + 20, L / 2 - 20]) {
    mesh(new THREE.CylinderGeometry(13, 13, 24, 8), body, 0, 12, t, g);
    mesh(new THREE.SphereGeometry(13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0x5a5752), 0, 24, t, g);
    mesh(new THREE.ConeGeometry(1.5, 6, 8), roofM, 0, 39, t, g);
  }
  mesh(new THREE.BoxGeometry(26, 26, 30), body, 0, 13, 0, g);
  scene.add(g);
  const pts = rectPts(X, Z, rot, 0, 0, 22, L);
  city.addPrism(pts, 0, 21, '東京駅 丸の内駅舎').roof = true;
  return { pos: [X, Z] };
}

// ---------- 赤坂: 日枝神社 (山王鳥居) と豊川稲荷 ----------
export function addAkasaka(scene, city) {
  const g = new THREE.Group();
  const verm = M(VERM);
  // 日枝神社: 社殿と、三角の破風がのった山王鳥居
  const [HX, HZ] = ll(35.67480, 139.73970);
  hallBuilding(g, city, HX, HZ, 0, 0, 0, 22, 16, 8, 7, verm, M(0x4f7f6f), '日枝神社');
  torii(g, HX, HZ + 40, 0, 8, 9, verm);
  const gable = mesh(new THREE.ConeGeometry(2.6, 2.4, 3), verm, HX, 11.3, HZ + 40, g);
  gable.rotation.z = Math.PI;
  gable.rotation.y = Math.PI / 2;
  gable.scale.set(1, 1, 0.3);
  // 豊川稲荷 東京別院: 本殿と朱色の鳥居・のぼり
  const [TX, TZ] = ll(35.67670, 139.73130);
  hallBuilding(g, city, TX, TZ, 0.3, 0, 0, 20, 16, 7, 6, M(0xe8e2d4), M(0x3e4448), '豊川稲荷');
  torii(g, TX + 6, TZ + 26, 0.3, 6, 6.5, verm);
  for (let i = 0; i < 8; i++) {
    const flag = mesh(new THREE.PlaneGeometry(0.8, 4), new THREE.MeshLambertMaterial({ color: 0xd8282a, side: THREE.DoubleSide }), TX - 10 + i * 2.6, 3, TZ + 18, g);
    flag.rotation.y = 0.3;
  }
  scene.add(g);
  return { hie: [HX, HZ], toyokawa: [TX, TZ] };
}

// ---------- 電車: 総武線 (黄色) と中央線 (オレンジ、万世橋のレンガ高架) ----------
function railLine(scene, city, pts, h, deckMat, sideMat, brickTex, name) {
  // pts: [[緯度, 経度], ...] → 街の座標
  const P = pts.map(([la, lo]) => ll(la, lo));
  const seg = [];
  let L = 0;
  for (let i = 0; i + 1 < P.length; i++) {
    const [x1, z1] = P[i], [x2, z2] = P[i + 1];
    const len = Math.hypot(x2 - x1, z2 - z1);
    seg.push({ x1, z1, x2, z2, len, s: L, rot: Math.atan2(x2 - x1, z2 - z1) });
    L += len;
  }
  const g = new THREE.Group();
  for (const s of seg) {
    const cx = (s.x1 + s.x2) / 2, cz = (s.z1 + s.z2) / 2;
    const deck = mesh(new THREE.BoxGeometry(10, 1.6, s.len + 1), deckMat, cx, h - 0.8, cz, g);
    deck.rotation.y = s.rot;
    if (brickTex) {
      // レンガのアーチの高架: 地面から桁まで
      const t = brickTex.clone();
      t.needsUpdate = true;
      t.repeat.set(s.len / 12, 1);
      const wall = mesh(new THREE.BoxGeometry(10, h - 1.6, s.len + 0.5), new THREE.MeshLambertMaterial({ map: t }), cx, (h - 1.6) / 2, cz, g);
      wall.rotation.y = s.rot;
      city.addPrism(rectPts(cx, cz, s.rot, 0, 0, 10, s.len), 0, h, name).roof = true;
    } else {
      for (const sd of [-1, 1]) {
        const w = mesh(new THREE.BoxGeometry(0.5, 1.2, s.len + 1), sideMat, 0, 0, 0, g);
        w.position.set(cx + Math.cos(s.rot) * 5 * sd, h + 0.6, cz - Math.sin(s.rot) * 5 * sd);
        w.rotation.y = s.rot;
      }
      // 橋脚
      for (let d = 0; d < s.len; d += 25) {
        const t = d / s.len;
        mesh(new THREE.BoxGeometry(3, h - 1.6, 3), sideMat, s.x1 + (s.x2 - s.x1) * t, (h - 1.6) / 2, s.z1 + (s.z2 - s.z1) * t, g);
      }
      city.addPrism(rectPts(cx, cz, s.rot, 0, 0, 10, s.len), h - 1.6, h, name).roof = true;
    }
  }
  scene.add(g);
  const at = (d) => {
    d = Math.max(0, Math.min(L, d));
    for (const s of seg) if (d <= s.s + s.len) { const t = (d - s.s) / s.len; return [s.x1 + (s.x2 - s.x1) * t, s.z1 + (s.z2 - s.z1) * t, s.rot]; }
    const s = seg[seg.length - 1];
    return [s.x2, s.z2, s.rot];
  };
  return { L, at, h };
}
function train(scene, color, cars) {
  const g = [];
  const body = M(color), silver = M(0xd8dde2), glass = M(0x2d3a48);
  for (let i = 0; i < cars; i++) {
    const c = new THREE.Group();
    mesh(new THREE.BoxGeometry(2.9, 3.4, 19.5), silver, 0, 1.9, 0, c);
    mesh(new THREE.BoxGeometry(3.0, 0.7, 19.6), body, 0, 2.2, 0, c);
    mesh(new THREE.BoxGeometry(3.0, 0.9, 18), glass, 0, 3.0, 0, c);
    scene.add(c);
    g.push(c);
  }
  return g;
}
export function addRailways(scene, city) {
  const deckMat = M(0x8f8f8c), sideMat = M(0xa9a9a4);
  const brick = canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#9a3b2a';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(60,20,10,0.35)';
    for (let y = 0; y < h; y += 8) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.fillStyle = '#2b2522';
    c.beginPath();
    c.moveTo(w * 0.2, h); c.lineTo(w * 0.2, h * 0.45); c.arc(w * 0.5, h * 0.45, w * 0.3, Math.PI, 0); c.lineTo(w * 0.8, h);
    c.fill();
  });
  brick.wrapS = THREE.RepeatWrapping;
  // 総武線: お茶の水 → 秋葉原 (山手線の上の3階) → 浅草橋
  const sobu = railLine(scene, city, [[35.69995, 139.76530], [35.69930, 139.76800], [35.69880, 139.77100], [35.69845, 139.77400], [35.69820, 139.77800], [35.69780, 139.78300], [35.69745, 139.78650]], 14, deckMat, sideMat, null, '総武線');
  // 中央線: 神田 → 万世橋のレンガ高架 (マーチエキュート) → 昌平橋 → お茶の水
  const chuo = railLine(scene, city, [[35.69190, 139.77090], [35.69500, 139.77080], [35.69760, 139.77060], [35.69850, 139.76950], [35.69905, 139.76820], [35.69960, 139.76600]], 9, deckMat, sideMat, brick, 'マーチエキュート神田万世橋');
  const lines = [
    { line: sobu, cars: train(scene, 0xf5c400, 10), speed: 14, d: 0, dir: 1 },
    { line: chuo, cars: train(scene, 0xf15a22, 10), speed: 12, d: chuo.L * 0.6, dir: -1 },
  ];
  return {
    sobu: sobu.at(sobu.L * 0.42), manseibashi: chuo.at(chuo.L * 0.62),
    // 電車を行ったり来たりさせる
    update(dt) {
      for (const t of lines) {
        t.d += t.speed * t.dir * dt;
        if (t.d > t.line.L - 20) { t.d = t.line.L - 20; t.dir = -1; }
        if (t.d < 200) { t.d = 200; t.dir = 1; }
        t.cars.forEach((c, i) => {
          const [x, z, rot] = t.line.at(t.d - i * 20 * t.dir);
          c.position.set(x, t.line.h, z);
          c.rotation.y = rot;
        });
      }
    },
  };
}

// ---------- 秋葉原 電気街: 中央通りに面したビルの壁に、色とりどりの縦看板 (架空の店) ----------
export function addAkibaSigns(scene, city) {
  const [RX] = ll(35.70100, 139.77120); // 中央通り
  const [, ZN] = ll(35.70350, 139.77120), [, ZS] = ll(35.69850, 139.77120);
  const words = ['電気', 'PC', 'ゲーム', 'アニメ', 'ホビー', 'カメラ', 'パーツ', 'フィギュア', 'ラジオ', 'GAME', 'ANIME', 'DUTY FREE', 'カード', 'ドール', 'メイド'];
  const colors = ['#ff2d55', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2', '#ff9f0a', '#64d2ff', '#ff375f'];
  let k = 0;
  const group = new THREE.Group();
  for (const bd of city.bld) {
    if (!bd.plateau || bd.h < 15 || bd.cz > ZS || bd.cz < ZN || Math.abs(bd.cx - RX) > 45) continue;
    const east = bd.cx < RX; // 道の西側のビルは東向きの壁に
    const word = words[k % words.length], color = colors[k % colors.length];
    k++;
    const hgt = Math.min(24, bd.h * 0.6);
    const tex = canvasTex(64, 256, (c, w, h) => {
      c.fillStyle = color;
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#fff';
      c.font = `900 40px ${JP}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const chars = [...word];
      const step = h / (chars.length + 1);
      chars.forEach((ch, i) => c.fillText(ch, w / 2, step * (i + 1)));
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, hgt), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    const x = east ? bd.maxx + 0.6 : bd.minx - 0.6;
    sign.position.set(x, bd.h - hgt / 2 - 2, bd.cz);
    sign.rotation.y = Math.PI / 2;
    group.add(sign);
    if (k > 60) break;
  }
  scene.add(group);
  return { pos: [RX, (ZN + ZS) / 2], count: k };
}

// ---------- ホテルニューオータニ 本館 (ザ・メイン): 3方向に伸びる高層棟と、屋上の青い円形ラウンジ ----------
export function addNewOtani(scene, city) {
  const [X, Z] = ll(35.68000, 139.73420);
  const g = new THREE.Group();
  const wall = M(0xe4e0d6), blue = M(0x2f6fd8, { emissive: 0x0a1c40 });
  const H = 70;
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    const wx = X + Math.sin(a) * 16, wz = Z + Math.cos(a) * 16;
    const wing = mesh(new THREE.BoxGeometry(14, H, 34), wall, wx, H / 2, wz, g);
    wing.rotation.y = a;
    city.addPrism(rectPts(wx, wz, a, 0, 0, 14, 34), 0, H, 'ホテルニューオータニ ザ・メイン').roof = true;
  }
  mesh(new THREE.CylinderGeometry(13, 13, 6, 32), blue, X, H + 3, Z, g);
  mesh(new THREE.CylinderGeometry(14, 13, 1, 32), M(0xdadfe4), X, H + 6.5, Z, g);
  city.addPrism(rectPts(X, Z, 0, 0, 0, 24, 24), 0, H + 7, 'ホテルニューオータニ ザ・メイン');
  scene.add(g);
  return { pos: [X, Z] };
}
