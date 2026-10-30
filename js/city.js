// 街: PLATEAU のビルの描画・当たり判定・ロープを掛ける所の探索 (レイキャスト)
import * as THREE from '../vendor/three.module.min.js';
import { CITY } from './city-data.js';

export const KX = 111320 * Math.cos(CITY.origin[0] * Math.PI / 180);
export const KZ = 110574;
// 緯度経度 → 街の座標 (x: 東, z: 南, m)
export function ll(lat, lon) {
  return [(lon - CITY.origin[1]) * KX, -(lat - CITY.origin[0]) * KZ];
}

const CELL = 32;
const ckey = (cx, cz) => (cx + 1024) * 2048 + (cz + 1024);

// PLATEAU では「〇〇郵便局」のようにテナントの名前が付いている塔があるので、見せる名前を直す
const ALIAS = {
  '森美術館': '六本木ヒルズ森タワー',
  '東京ミッドタウン郵便局': '東京ミッドタウン・タワー',
  '特許庁六本木仮庁舎': '住友不動産六本木グランドタワー',
  '鉄鋼ビル郵便局': '鉄鋼ビルディング',
  '京橋二郵便局': '京橋エドグラン',
  '日本橋室町三井タワー内郵便局': '日本橋室町三井タワー',
  'ＫＤＤＩ大手町ビル内郵便局': 'KDDI大手町ビル',
  'シーバンスＮ館内郵便局': 'シーバンスN館',
  '石橋財団ブリヂストン美術館': 'ミュージアムタワー京橋',
  '芝公園郵便局': '芝公園のビル',
};
export const displayName = (n) => ALIAS[n] || n;

export class City {
  constructor() {
    this.bld = [];
    this.grid = new Map();
    this.stamp = 0;
    this.minX = 1e9; this.maxX = -1e9; this.minZ = 1e9; this.maxZ = -1e9;
    this.parse();
    this.roadSegs = [];
    this.roadGrid = new Map();
    this.parseRoads();
  }

  parse() {
    const b = CITY.b;
    const names = new Map(CITY.names.map(([i, n]) => [i, n]));
    let i = 0, k = 0;
    while (i < b.length) {
      const h = b[i] / 2, n = b[i + 1];
      let x = b[i + 2], z = b[i + 3];
      const pts = [x / 2, z / 2];
      for (let j = 0; j < n - 1; j++) {
        x += b[i + 4 + 2 * j]; z += b[i + 5 + 2 * j];
        pts.push(x / 2, z / 2);
      }
      i += 2 + 2 * n;
      const nm = names.get(k);
      k++;
      this.addPrism(pts, 0, h, nm ? displayName(nm) : null, { plateau: true });
    }
  }

  // 多角形の柱 (pts = [x0,z0,x1,z1,…]) を当たり判定に加える。描画はしない (PLATEAU の建物は buildMeshes で描く)
  addPrism(pts, y0, h, name = null, opt = {}) {
    let n = pts.length / 2;
    // 反時計回り (面積 > 0) にそろえる → 辺 (a→b) の外向きの法線は (ez, -ex)
    let A = 0;
    for (let j = 0; j < n; j++) {
      const a = j * 2, c = ((j + 1) % n) * 2;
      A += pts[a] * pts[c + 1] - pts[c] * pts[a + 1];
    }
    if (A < 0) {
      const r = [];
      for (let j = n - 1; j >= 0; j--) r.push(pts[j * 2], pts[j * 2 + 1]);
      pts = r;
    }
    let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9, cx = 0, cz = 0;
    for (let j = 0; j < n; j++) {
      const x = pts[j * 2], z = pts[j * 2 + 1];
      minx = Math.min(minx, x); maxx = Math.max(maxx, x);
      minz = Math.min(minz, z); maxz = Math.max(maxz, z);
      cx += x; cz += z;
    }
    const bd = {
      id: this.bld.length, pts: new Float64Array(pts), n, y0, h, name,
      minx, maxx, minz, maxz, cx: cx / n, cz: cz / n, area: Math.abs(A) / 2, mark: 0, ...opt,
    };
    this.bld.push(bd);
    if (opt.plateau) {
      this.minX = Math.min(this.minX, minx); this.maxX = Math.max(this.maxX, maxx);
      this.minZ = Math.min(this.minZ, minz); this.maxZ = Math.max(this.maxZ, maxz);
    }
    for (let gx = Math.floor(minx / CELL); gx <= Math.floor(maxx / CELL); gx++) {
      for (let gz = Math.floor(minz / CELL); gz <= Math.floor(maxz / CELL); gz++) {
        const key = ckey(gx, gz);
        let l = this.grid.get(key);
        if (!l) this.grid.set(key, l = []);
        l.push(bd);
      }
    }
    return bd;
  }
  addBox(cx, cz, w, d, y0, h, name = null) {
    return this.addPrism([cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2, cx + w / 2, cz + d / 2, cx - w / 2, cz + d / 2], y0, h, name);
  }

  cell(x, z) { return this.grid.get(ckey(Math.floor(x / CELL), Math.floor(z / CELL))); }

  // 首都高 (高架) の床
  parseRoads() {
    for (const r of CITY.roads) {
      for (let i = 0; i + 1 < r.x.length; i++) {
        if (r.t[i] || r.t[i + 1]) continue;
        const s = { x1: r.x[i], z1: r.z[i], h1: r.h[i], x2: r.x[i + 1], z2: r.z[i + 1], h2: r.h[i + 1] };
        if (Math.max(s.h1, s.h2) < 3) continue;
        this.roadSegs.push(s);
        const gx0 = Math.floor((Math.min(s.x1, s.x2) - 10) / CELL), gx1 = Math.floor((Math.max(s.x1, s.x2) + 10) / CELL);
        const gz0 = Math.floor((Math.min(s.z1, s.z2) - 10) / CELL), gz1 = Math.floor((Math.max(s.z1, s.z2) + 10) / CELL);
        for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) {
          const key = ckey(gx, gz);
          let l = this.roadGrid.get(key);
          if (!l) this.roadGrid.set(key, l = []);
          l.push(s);
        }
      }
    }
  }

  inside(bd, x, z) {
    if (x < bd.minx || x > bd.maxx || z < bd.minz || z > bd.maxz) return false;
    const p = bd.pts, n = bd.n;
    let c = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = p[i * 2], zi = p[i * 2 + 1], xj = p[j * 2], zj = p[j * 2 + 1];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
    }
    return c;
  }

  // 立てる床の高さ (yRef より 0.7m 以上高い所には乗らない)
  floorAt(x, z, yRef) {
    let f = 0, what = 'ground', bdHit = null;
    const l = this.cell(x, z);
    if (l) for (const bd of l) {
      if (bd.h <= yRef + 0.7 && bd.h > f && this.inside(bd, x, z)) { f = bd.h; what = 'roof'; bdHit = bd; }
    }
    const rl = this.roadGrid.get(ckey(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (rl) for (const s of rl) {
      const ex = s.x2 - s.x1, ez = s.z2 - s.z1;
      const L2 = ex * ex + ez * ez || 1;
      let t = ((x - s.x1) * ex + (z - s.z1) * ez) / L2;
      if (t < -0.05 || t > 1.05) continue;
      t = Math.max(0, Math.min(1, t));
      const dx = x - (s.x1 + ex * t), dz = z - (s.z1 + ez * t);
      if (dx * dx + dz * dz > 8.5 * 8.5) continue;
      const hd = s.h1 + (s.h2 - s.h1) * t;
      if (hd <= yRef + 0.7 && hd > f) { f = hd; what = 'road'; bdHit = null; }
    }
    return { y: f, what, bd: bdHit };
  }

  // 壁から押し出す。戻り値: 押し出した向きの配列 [{nx, nz, bd}]
  collide(p, r, out) {
    out.length = 0;
    const seen = ++this.stamp;
    for (let gx = Math.floor((p.x - r) / CELL); gx <= Math.floor((p.x + r) / CELL); gx++) {
      for (let gz = Math.floor((p.z - r) / CELL); gz <= Math.floor((p.z + r) / CELL); gz++) {
        const l = this.grid.get(ckey(gx, gz));
        if (!l) continue;
        for (const bd of l) {
          if (bd.mark === seen) continue;
          bd.mark = seen;
          if (p.y >= bd.h - 0.05 || p.y < bd.y0 - 1.6) continue;
          if (p.x < bd.minx - r || p.x > bd.maxx + r || p.z < bd.minz - r || p.z > bd.maxz + r) continue;
          // いちばん近い辺
          const P = bd.pts, n = bd.n;
          let best = 1e18, bx = 0, bz = 0, bnx = 0, bnz = 0;
          for (let i = 0; i < n; i++) {
            const ax = P[i * 2], az = P[i * 2 + 1];
            const j = (i + 1) % n;
            const ex = P[j * 2] - ax, ez = P[j * 2 + 1] - az;
            const L2 = ex * ex + ez * ez || 1e-9;
            let t = ((p.x - ax) * ex + (p.z - az) * ez) / L2;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const qx = ax + ex * t, qz = az + ez * t;
            const d = (p.x - qx) ** 2 + (p.z - qz) ** 2;
            if (d < best) {
              best = d; bx = qx; bz = qz;
              const l2 = Math.sqrt(L2);
              bnx = ez / l2; bnz = -ex / l2;
            }
          }
          const ins = this.inside(bd, p.x, p.z);
          const d = Math.sqrt(best);
          if (!ins && d >= r) continue;
          // 下から天井にぶつかる (浮いている展望台など)
          if (bd.y0 > 0 && p.y < bd.y0 && ins) {
            p.y = bd.y0 - 1.6;
            out.push({ nx: 0, nz: 0, ny: -1, bd });
            continue;
          }
          let nx, nz;
          if (d > 1e-4) {
            nx = (p.x - bx) / d; nz = (p.z - bz) / d;
            if (ins) { nx = -nx; nz = -nz; }
          } else { nx = bnx; nz = bnz; }
          p.x = bx + nx * r;
          p.z = bz + nz * r;
          out.push({ nx, nz, ny: 0, bd });
        }
      }
    }
    return out;
  }

  // 近くの壁までの距離 (ニアミスの判定用。r より遠ければ r)
  wallDist(p, r) {
    let best = r;
    const l = this.cell(p.x, p.z);
    for (let gx = Math.floor((p.x - r) / CELL); gx <= Math.floor((p.x + r) / CELL); gx++) {
      for (let gz = Math.floor((p.z - r) / CELL); gz <= Math.floor((p.z + r) / CELL); gz++) {
        const l = this.grid.get(ckey(gx, gz));
        if (!l) continue;
        for (const bd of l) {
          if (p.y >= bd.h || p.y < bd.y0) continue;
          if (p.x < bd.minx - r || p.x > bd.maxx + r || p.z < bd.minz - r || p.z > bd.maxz + r) continue;
          const P = bd.pts, n = bd.n;
          for (let i = 0; i < n; i++) {
            const ax = P[i * 2], az = P[i * 2 + 1], j = (i + 1) % n;
            const ex = P[j * 2] - ax, ez = P[j * 2 + 1] - az;
            const L2 = ex * ex + ez * ez || 1e-9;
            let t = ((p.x - ax) * ex + (p.z - az) * ez) / L2;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const d = Math.hypot(p.x - ax - ex * t, p.z - az - ez * t);
            if (d < best) best = d;
          }
        }
      }
    }
    return best;
  }

  // レイ (o + d t) が最初に当たる建物の面。d は単位ベクトル
  raycast(o, d, maxT) {
    const hit = { t: maxT, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, bd: null };
    const seen = ++this.stamp;
    const hl = Math.hypot(d.x, d.z);
    let gx = Math.floor(o.x / CELL), gz = Math.floor(o.z / CELL);
    if (hl < 1e-6) {
      const l = this.grid.get(ckey(gx, gz));
      if (l) for (const bd of l) this.rayBld(bd, o, d, hit);
      return hit.bd ? hit : null;
    }
    // セルを順にたどる (Amanatides & Woo)
    const sx = d.x > 0 ? 1 : -1, sz = d.z > 0 ? 1 : -1;
    const tdx = Math.abs(d.x) > 1e-9 ? CELL / Math.abs(d.x) : 1e18;
    const tdz = Math.abs(d.z) > 1e-9 ? CELL / Math.abs(d.z) : 1e18;
    let tmx = Math.abs(d.x) > 1e-9 ? ((d.x > 0 ? (gx + 1) * CELL - o.x : o.x - gx * CELL) / Math.abs(d.x)) : 1e18;
    let tmz = Math.abs(d.z) > 1e-9 ? ((d.z > 0 ? (gz + 1) * CELL - o.z : o.z - gz * CELL) / Math.abs(d.z)) : 1e18;
    let tEnter = 0;
    for (let iter = 0; iter < 400; iter++) {
      const l = this.grid.get(ckey(gx, gz));
      if (l) for (const bd of l) {
        if (bd.mark === seen) continue;
        bd.mark = seen;
        this.rayBld(bd, o, d, hit);
      }
      const tExit = Math.min(tmx, tmz);
      if (hit.t <= tExit || tExit > maxT) break;
      tEnter = tExit;
      if (tmx < tmz) { gx += sx; tmx += tdx; } else { gz += sz; tmz += tdz; }
    }
    return hit.bd ? hit : null;
  }

  rayBld(bd, o, d, hit) {
    // 箱で先にふるい落とす
    let t0 = 0, t1 = hit.t;
    const slab = (oo, dd, lo, hi) => {
      if (Math.abs(dd) < 1e-12) return oo >= lo && oo <= hi;
      let a = (lo - oo) / dd, b = (hi - oo) / dd;
      if (a > b) { const c = a; a = b; b = c; }
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
      return t0 <= t1;
    };
    if (!slab(o.x, d.x, bd.minx, bd.maxx) || !slab(o.z, d.z, bd.minz, bd.maxz) || !slab(o.y, d.y, bd.y0, bd.h)) return;
    const P = bd.pts, n = bd.n;
    for (let i = 0; i < n; i++) {
      const ax = P[i * 2], az = P[i * 2 + 1], j = (i + 1) % n;
      const ex = P[j * 2] - ax, ez = P[j * 2 + 1] - az;
      // 外から当たる面だけ
      if (d.x * ez - d.z * ex >= 0) continue;
      const den = d.x * ez - d.z * ex;
      const wx = ax - o.x, wz = az - o.z;
      const t = (wx * ez - wz * ex) / den;
      if (t <= 1e-4 || t >= hit.t) continue;
      const s = (wx * d.z - wz * d.x) / den;
      if (s < 0 || s > 1) continue;
      const y = o.y + d.y * t;
      if (y < bd.y0 || y > bd.h) continue;
      const l = Math.hypot(ex, ez);
      Object.assign(hit, { t, x: o.x + d.x * t, y, z: o.z + d.z * t, nx: ez / l, ny: 0, nz: -ex / l, bd });
    }
    if (d.y < 0 && o.y > bd.h) {
      const t = (bd.h - o.y) / d.y;
      if (t < hit.t) {
        const x = o.x + d.x * t, z = o.z + d.z * t;
        if (this.inside(bd, x, z)) Object.assign(hit, { t, x, y: bd.h, z, nx: 0, ny: 1, nz: 0, bd });
      }
    }
    if (d.y > 0 && o.y < bd.y0 && bd.y0 > 0) {
      const t = (bd.y0 - o.y) / d.y;
      if (t < hit.t) {
        const x = o.x + d.x * t, z = o.z + d.z * t;
        if (this.inside(bd, x, z)) Object.assign(hit, { t, x, y: bd.y0, z, nx: 0, ny: -1, nz: 0, bd });
      }
    }
  }

  // (x, z) の近く (rad m 以内) でいちばん高いビルの高さ
  maxHeightNear(x, z, rad) {
    let m = 0;
    for (let gx = Math.floor((x - rad) / CELL); gx <= Math.floor((x + rad) / CELL); gx++) {
      for (let gz = Math.floor((z - rad) / CELL); gz <= Math.floor((z + rad) / CELL); gz++) {
        const l = this.grid.get(ckey(gx, gz));
        if (l) for (const bd of l) if ((bd.cx - x) ** 2 + (bd.cz - z) ** 2 < rad * rad) m = Math.max(m, bd.h);
      }
    }
    return m;
  }

  // 空中で建物に埋まっていない所 (チェックポイントの輪を置く)
  isFree(x, y, z, clr) {
    for (let a = 0; a < 9; a++) {
      const px = a === 8 ? x : x + Math.cos(a * Math.PI / 4) * clr;
      const pz = a === 8 ? z : z + Math.sin(a * Math.PI / 4) * clr;
      const l = this.cell(px, pz);
      if (l) for (const bd of l) if (y < bd.h + clr * 0.5 && y > bd.y0 - clr * 0.5 && this.inside(bd, px, pz)) return false;
    }
    return true;
  }
  findOpenSpot(x, z, y, clr = 14) {
    for (let r = 0; r < 160; r += 6) {
      const steps = Math.max(1, Math.round(r / 4));
      for (let k = 0; k < steps; k++) {
        const a = k / steps * Math.PI * 2;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (this.isFree(px, y, pz, clr)) return [px, pz];
      }
    }
    return [x, z];
  }

  // 一番高い屋上 (スタート地点)
  roofTop(bd) { return [bd.cx, bd.h, bd.cz]; }
  findBuildingNear(x, z) {
    let best = null, bd2 = 1e18;
    for (const bd of this.bld) {
      const d = (bd.cx - x) ** 2 + (bd.cz - z) ** 2 - bd.h * bd.h * 0.3;
      if (d < bd2 && this.inside(bd, bd.cx, bd.cz)) { bd2 = d; best = bd; }
    }
    return best;
  }

  // ---------- 描画 ----------
  buildMeshes(scene, mats) {
    const TILE = 480;
    const tiles = new Map();
    const tile = (bd) => {
      const key = Math.floor(bd.cx / TILE) + ',' + Math.floor(bd.cz / TILE);
      let t = tiles.get(key);
      if (!t) tiles.set(key, t = { glass: newBuf(), office: newBuf(), roof: newBuf() });
      return t;
    };
    function newBuf() { return { p: [], n: [], uv: [], c: [] }; }
    const col = new THREE.Color();
    let seed = 12345;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // カラフルな街: 高いビルは色ガラス、低いビルはパステルやビビッドな外壁
    const GLASS = [[0.35, 0.65, 1.0], [0.2, 0.85, 0.85], [0.6, 0.45, 1.0], [1.0, 0.45, 0.7], [0.4, 0.95, 0.55],
      [1.0, 0.75, 0.3], [0.95, 0.35, 0.35], [0.55, 0.8, 1.0], [0.9, 0.9, 0.35], [0.3, 0.5, 0.95]];
    const OFFICE = [[1.0, 0.6, 0.55], [1.0, 0.82, 0.45], [0.6, 0.85, 0.6], [0.55, 0.75, 1.0], [0.85, 0.65, 1.0],
      [1.0, 0.7, 0.85], [0.5, 0.9, 0.85], [1.0, 0.95, 0.6], [0.95, 0.55, 0.35], [0.7, 0.95, 0.45], [0.95, 0.95, 0.95]];
    for (const bd of this.bld) {
      if (!bd.plateau) continue;
      const t = tile(bd);
      const glass = bd.h > 55 || (bd.h > 30 && rnd() < 0.35);
      const B = glass ? t.glass : t.office;
      const pal = glass ? GLASS : OFFICE;
      const c = pal[Math.floor(rnd() * pal.length)];
      const sh = 0.85 + rnd() * 0.2;
      col.setRGB(c[0] * sh, c[1] * sh, c[2] * sh);
      // 窓の模様をビルごとにずらす
      const uo = Math.floor(rnd() * 8) / 8, vo = Math.floor(rnd() * 8) / 8;
      const P = bd.pts, n = bd.n, h = bd.h;
      let per = 0;
      const UW = glass ? 2.6 * 8 : 3.4 * 8, VH = glass ? 3.6 * 8 : 3.4 * 8;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = P[i * 2], az = P[i * 2 + 1], bx = P[j * 2], bz = P[j * 2 + 1];
        const L = Math.hypot(bx - ax, bz - az);
        if (L < 0.01) continue;
        const nx = (bz - az) / L, nz = -(bx - ax) / L;
        const u0 = per / UW + uo, u1 = (per + L) / UW + uo;
        per += L;
        const v1 = h / VH + vo;
        // (a0, b1, b0), (a0, a1, b1)
        B.p.push(ax, 0, az, bx, h, bz, bx, 0, bz, ax, 0, az, ax, h, az, bx, h, bz);
        for (let k = 0; k < 6; k++) { B.n.push(nx, 0, nz); B.c.push(col.r, col.g, col.b); }
        B.uv.push(u0, vo, u1, v1, u1, vo, u0, vo, u0, v1, u1, v1);
      }
      // 屋上
      const shape = [];
      for (let i = 0; i < n; i++) shape.push(new THREE.Vector2(P[i * 2], P[i * 2 + 1]));
      let tris;
      try { tris = THREE.ShapeUtils.triangulateShape(shape, []); } catch (e) { tris = []; }
      const rc = 0.55 + rnd() * 0.2;
      const rr = rc * (0.8 + col.r * 0.25), rg = rc * (0.8 + col.g * 0.25), rb = rc * (0.8 + col.b * 0.25);
      for (const tr of tris) {
        const [a, b2, c2] = tr;
        const ax = P[a * 2], az = P[a * 2 + 1], bx = P[b2 * 2], bz = P[b2 * 2 + 1], cx = P[c2 * 2], cz = P[c2 * 2 + 1];
        const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
        if (ny >= 0) t.roof.p.push(ax, h, az, bx, h, bz, cx, h, cz);
        else t.roof.p.push(ax, h, az, cx, h, cz, bx, h, bz);
        for (let k = 0; k < 3; k++) { t.roof.n.push(0, 1, 0); t.roof.c.push(rr, rg, rb); }
        t.roof.uv.push(ax / 8, az / 8, bx / 8, bz / 8, cx / 8, cz / 8);
      }
    }
    // 屋上の設備 (空調機・給水塔・塔屋)
    const boxes = [];
    for (const bd of this.bld) {
      if (!bd.plateau || bd.area < 250) continue;
      const k = Math.min(4, 1 + Math.floor(bd.area / 900));
      for (let j = 0; j < k; j++) {
        const s = Math.sqrt(bd.area) * (0.12 + rnd() * 0.18);
        const x = bd.cx + (rnd() - 0.5) * (bd.maxx - bd.minx) * 0.5;
        const z = bd.cz + (rnd() - 0.5) * (bd.maxz - bd.minz) * 0.5;
        if (!this.inside(bd, x - s / 2, z - s / 2) || !this.inside(bd, x + s / 2, z + s / 2)) continue;
        boxes.push([x, bd.h, z, s, 1.5 + rnd() * (bd.h > 60 ? 5 : 2.5), rnd()]);
      }
    }
    const bg = new THREE.BoxGeometry(1, 1, 1);
    bg.translate(0, 0.5, 0);
    const bm = new THREE.InstancedMesh(bg, new THREE.MeshLambertMaterial({ color: 0xffffff }), boxes.length);
    const m4 = new THREE.Matrix4();
    boxes.forEach(([x, y, z, s, hh, r], i) => {
      m4.makeScale(s * (0.7 + r * 0.6), hh, s).setPosition(x, y, z);
      bm.setMatrixAt(i, m4);
      // 屋上の設備にも当たる (中に入り込まないように)
      this.addBox(x, z, s * (0.7 + r * 0.6), s, y - 0.5, y + hh);
      bm.setColorAt(i, col.setRGB(0.62 + r * 0.25, 0.63 + r * 0.25, 0.64 + r * 0.25));
    });
    scene.add(bm);
    const group = new THREE.Group();
    for (const t of tiles.values()) {
      for (const [k, m] of [['glass', mats.glass], ['office', mats.office], ['roof', mats.roof]]) {
        const B = t[k];
        if (!B.p.length) continue;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3));
        g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, m);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        group.add(mesh);
      }
    }
    scene.add(group);
    return group;
  }

  // 首都高の高架
  buildRoads(scene) {
    const deck = { p: [], n: [], c: [] };
    const push = (B, a, b, c, n, col) => {
      B.p.push(...a, ...b, ...c);
      for (let k = 0; k < 3; k++) { B.n.push(...n); B.c.push(...col); }
    };
    const quad = (B, a, b, c, d, n, col) => { push(B, a, b, c, n, col); push(B, a, c, d, n, col); };
    const W = 8.5;
    const piers = [];
    for (const r of CITY.roads) {
      let acc = 0;
      for (let i = 0; i + 1 < r.x.length; i++) {
        if (r.t[i] || r.t[i + 1]) continue;
        const x1 = r.x[i], z1 = r.z[i], x2 = r.x[i + 1], z2 = r.z[i + 1];
        let h1 = r.h[i], h2 = r.h[i + 1];
        const L = Math.hypot(x2 - x1, z2 - z1);
        if (L < 0.1) continue;
        const ground = Math.max(h1, h2) < 3;
        if (ground) { h1 = h2 = 0.08; }
        const lx = (z2 - z1) / L * W, lz = -(x2 - x1) / L * W;
        const ex = (x2 - x1) / L * 0.6, ez = (z2 - z1) / L * 0.6; // 継ぎ目の隙間を埋める
        const A = [x1 + lx - ex, h1, z1 + lz - ez], B = [x1 - lx - ex, h1, z1 - lz - ez];
        const C = [x2 - lx + ex, h2, z2 - lz + ez], D = [x2 + lx + ex, h2, z2 + lz + ez];
        const asphalt = [0.32, 0.32, 0.34];
        quad(deck, A, D, C, B, [0, 1, 0], asphalt);
        if (ground) continue;
        const wall = [0.72, 0.72, 0.7];
        // 壁高欄 (両側 1.1m) と桁の側面
        for (const [P0, P1, s] of [[A, D, 1], [B, C, -1]]) {
          const nn = [lx / W * s, 0, lz / W * s];
          const top0 = [P0[0], P0[1] + 1.1, P0[2]], top1 = [P1[0], P1[1] + 1.1, P1[2]];
          const bot0 = [P0[0], P0[1] - 2.2, P0[2]], bot1 = [P1[0], P1[1] - 2.2, P1[2]];
          if (s > 0) quad(deck, bot0, bot1, top1, top0, nn, wall);
          else quad(deck, bot1, bot0, top0, top1, nn, wall);
        }
        // 桁の裏
        quad(deck, [B[0], h1 - 2.2, B[2]], [C[0], h2 - 2.2, C[2]], [D[0], h2 - 2.2, D[2]], [A[0], h1 - 2.2, A[2]], [0, -1, 0], [0.5, 0.5, 0.5]);
        acc += L;
        if (acc > 36) { acc = 0; piers.push([x1, z1, h1 - 2.2, Math.atan2(x2 - x1, z2 - z1)]); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(deck.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(deck.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(deck.c, 3));
    const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    scene.add(mesh);
    // 橋脚
    const pg = new THREE.BoxGeometry(3, 1, 3);
    pg.translate(0, 0.5, 0);
    const pm = new THREE.InstancedMesh(pg, new THREE.MeshLambertMaterial({ color: 0x9a9a96 }), piers.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    piers.forEach(([x, z, h, a], i) => {
      e.set(0, a, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, Math.max(0.5, h), 1));
      pm.setMatrixAt(i, m4);
      // 橋脚の当たり判定
      this.addBox(x, z, 3, 3, 0, Math.max(0.5, h) - 0.3);
    });
    scene.add(pm);
  }
}
