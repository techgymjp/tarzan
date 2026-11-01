// 動かない手作りのモデル (名所の建物など) を、材料の見た目が同じものどうし・500m 四方の区画ごとに 1 つのメッシュにまとめる。
// 小さな部品が何百もあると描く回数 (ドローコール) が増えて、スマホで重くなるため。
// 区画ごとに分けるのは、画面の外や遠くの区画を描かずにすませるため
import * as THREE from '../vendor/three.module.min.js';

const CELL = 500;
const hex = (c) => (c ? c.getHex() : -1);
function signature(m) {
  return [m.type, hex(m.color), hex(m.emissive), m.emissiveIntensity, m.map ? m.map.uuid : '', m.emissiveMap ? m.emissiveMap.uuid : '',
    m.side, m.transparent, m.opacity, m.vertexColors, m.fog, m.depthWrite, m.depthTest, m.polygonOffset, m.alphaTest].join('|');
}

// roots: まとめる候補の一番上のオブジェクト。userData.noMerge が付いたもの (動く・色が変わるもの) は除く
export function mergeStatic(scene, roots) {
  const groups = new Map();
  const box = new THREE.Box3(), c = new THREE.Vector3();
  const victims = [];
  for (const root of roots) {
    if (root.userData.noMerge) continue;
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.renderOrder !== 0) return;
      for (let p = o; p; p = p.parent) if (p.userData.noMerge) return;
      const g = o.geometry;
      if (!g.attributes.position || g.morphAttributes.position) return;
      box.setFromObject(o).getCenter(c);
      const key = Math.floor(c.x / CELL) + ',' + Math.floor(c.z / CELL) + '|' + signature(o.material);
      if (!groups.has(key)) groups.set(key, { mat: o.material, list: [], cx: (Math.floor(c.x / CELL) + 0.5) * CELL, cz: (Math.floor(c.z / CELL) + 0.5) * CELL });
      groups.get(key).list.push(o);
      victims.push(o);
    });
  }
  const out = new THREE.Group();
  const nm = new THREE.Matrix3();
  for (const grp of groups.values()) {
    const m = grp.mat;
    const wantUV = !!(m.map || m.emissiveMap), wantColor = !!m.vertexColors;
    const P = [], N = [], U = [], C = [];
    for (const o of grp.list) {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      if (!g.attributes.normal) { if (g === o.geometry) g = g.clone(); g.computeVertexNormals(); }
      const mw = o.matrixWorld;
      nm.getNormalMatrix(mw);
      const flip = mw.determinant() < 0; // 鏡うつしのときは三角形の向きを戻す
      const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv, ca = g.attributes.color;
      const v = new THREE.Vector3(), n = new THREE.Vector3();
      const n3 = pa.count - (pa.count % 3);
      for (let i = 0; i < n3; i++) {
        const k = flip ? i - (i % 3) + (2 - (i % 3)) : i;
        v.fromBufferAttribute(pa, k).applyMatrix4(mw);
        n.fromBufferAttribute(na, k).applyMatrix3(nm).normalize();
        P.push(v.x, v.y, v.z); N.push(n.x, n.y, n.z);
        if (wantUV) U.push(ua ? ua.getX(k) : 0, ua ? ua.getY(k) : 0);
        if (wantColor) C.push(ca ? ca.getX(k) : 1, ca ? ca.getY(k) : 1, ca ? ca.getZ(k) : 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    if (wantUV) geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    if (wantColor) geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, m);
    mesh.matrixAutoUpdate = false;
    mesh.userData.cell = [grp.cx, grp.cz];
    out.add(mesh);
  }
  // 元の部品は外す (当たり判定は city にあるので消えない)
  for (const o of victims) { o.parent.remove(o); if (o.geometry) o.geometry.dispose(); }
  scene.add(out);
  return {
    group: out, before: victims.length, after: out.children.length,
    // 描く範囲 (カメラから R) より遠い区画は描かない
    cull(cam, R) {
      const x = cam.position.x, z = cam.position.z, r2 = (R + CELL) * (R + CELL);
      for (const mesh of out.children) { const [cx, cz] = mesh.userData.cell; mesh.visible = (cx - x) ** 2 + (cz - z) ** 2 < r2; }
    },
  };
}

// 街じゅうに広がる 1 つのメッシュ (道路・水面・石垣など) を、500m 四方の区画ごとのメッシュに分ける。
// 画面の外や描く範囲より遠い区画を描かずにすませるため。geo は index なし (三角形ごとに 3 頂点) のもの
const pieces = [];
export function splitByCell(scene, geo, mat, setup = () => {}) {
  const attrs = Object.keys(geo.attributes);
  const pa = geo.attributes.position.array;
  const cells = new Map();
  for (let t = 0; t < pa.length / 9; t++) {
    const cx = (pa[t * 9] + pa[t * 9 + 3] + pa[t * 9 + 6]) / 3, cz = (pa[t * 9 + 2] + pa[t * 9 + 5] + pa[t * 9 + 8]) / 3;
    const key = Math.floor(cx / CELL) + ',' + Math.floor(cz / CELL);
    let c = cells.get(key);
    if (!c) cells.set(key, c = { tris: [], cx: (Math.floor(cx / CELL) + 0.5) * CELL, cz: (Math.floor(cz / CELL) + 0.5) * CELL });
    c.tris.push(t);
  }
  const group = new THREE.Group();
  for (const c of cells.values()) {
    const g = new THREE.BufferGeometry();
    for (const a of attrs) {
      const src = geo.attributes[a], n = src.itemSize, arr = new Float32Array(c.tris.length * 3 * n);
      let k = 0;
      for (const t of c.tris) for (let i = t * 3 * n; i < (t + 1) * 3 * n; i++) arr[k++] = src.array[i];
      g.setAttribute(a, new THREE.BufferAttribute(arr, n));
    }
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.matrixAutoUpdate = false;
    m.userData.cell = [c.cx, c.cz];
    setup(m);
    group.add(m);
    pieces.push(m);
  }
  geo.dispose();
  scene.add(group);
  return group;
}
// 分けた区画のうち、カメラから R より遠いものは描かない
export function cullPieces(cam, R) {
  const x = cam.position.x, z = cam.position.z, r2 = (R + CELL) * (R + CELL);
  for (const m of pieces) { const [cx, cz] = m.userData.cell; m.visible = (cx - x) ** 2 + (cz - z) ** 2 < r2; }
}
