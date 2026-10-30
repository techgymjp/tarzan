// ターザン大東京: 進行・入力・カメラ・照準・ミッション・得点・図鑑・HUD
import * as THREE from '../vendor/three.module.min.js';
import { City, ll } from './city.js';
import { Player, P } from './player.js';
import { Sfx, Bgm } from './audio.js';
import { MISSIONS, AREAS, FAMOUS } from './missions.js';
import { Fireworks } from './fireworks.js';
import { Heli } from './heli.js';
import { Oni, CATCH_RADIUS } from './oni.js';
import { CITY } from './city-data.js';
import { addTokyoTower, addDiet, addSkytree, addFuji, addTechGym } from './landmarks.js';

const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
const store = {
  get(k, d) { try { const v = localStorage.getItem('tarzan.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('tarzan.' + k, JSON.stringify(v)); } catch (e) { /* 保存できなくても遊べる */ } },
};

// ---------- 描画の準備 ----------
const renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
$('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.3, 16000);
scene.fog = new THREE.Fog(0xbfd2e6, 400, 3200);
const hemi = new THREE.HemisphereLight(0xdfeeff, 0x6a6458, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
scene.add(sun);

const TOD = {
  day: { top: 0x3f86d6, hor: 0xcfe0ee, fog: 0xc6d8ea, sun: 0xffffff, sunI: 1.7, hemi: 0.95, sunDir: [-0.4, 0.8, 0.45], emi: 0, fogFar: 3400, tower: 0 },
  dusk: { top: 0x2b3f7a, hor: 0xffa66b, fog: 0xd9a587, sun: 0xffb27a, sunI: 1.5, hemi: 0.6, sunDir: [-0.85, 0.18, 0.35], emi: 0.12, fogFar: 3000, tower: 1.5 },
  night: { top: 0x050a1c, hor: 0x1d2a4a, fog: 0x141c33, sun: 0x8ea6ff, sunI: 0.35, hemi: 0.28, sunDir: [0.3, 0.7, -0.5], emi: 1.0, fogFar: 2600, tower: 4 },
};

// 空 (上下のグラデーションと太陽)
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, night: { value: 0 } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night; varying vec3 vP;
    float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
    void main(){ float y = max(vP.y, 0.0); vec3 c = mix(hor, top, pow(y, 0.55));
      float s = max(dot(vP, normalize(sunDir)), 0.0);
      c += sunCol * (pow(s, 600.0) * 2.0 + pow(s, 8.0) * 0.35 * (1.0 - night));
      if (night > 0.5 && vP.y > 0.05) { vec3 q = floor(vP * 400.0); float st = step(0.9985, h(q)); c += vec3(st) * 0.8; }
      if (vP.y < 0.0) c = hor * 0.9;
      gl_FragColor = vec4(c, 1.0); }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(15000, 32, 16), skyMat);
scene.add(sky);

// 窓のテクスチャ (8×8 の窓が1枚)。lit = 夜に明かりがつく窓
function windowTex(kind, lit) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  let s = kind === 'glass' ? 7 : 3;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = lit ? '#000' : (kind === 'glass' ? '#e8eef4' : '#ffffff');
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const on = rnd() < (kind === 'glass' ? 0.45 : 0.35);
    if (lit) {
      if (!on) continue;
      const w = rnd();
      g.fillStyle = w < 0.6 ? '#ffd9a0' : w < 0.85 ? '#fff4dc' : '#bfe0ff';
    } else {
      const t = 0.75 + rnd() * 0.25;
      g.fillStyle = kind === 'glass' ? `rgb(${120 * t},${140 * t},${165 * t})` : `rgb(${80 * t},${92 * t},${110 * t})`;
    }
    if (kind === 'glass') g.fillRect(x * 32 + 1, y * 32 + 3, 30, 27);
    else g.fillRect(x * 32 + 6, y * 32 + 8, 20, 17);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const mats = {
  glass: new THREE.MeshLambertMaterial({ map: windowTex('glass'), vertexColors: true, emissiveMap: windowTex('glass', true), emissive: 0xffffff, emissiveIntensity: 0 }),
  office: new THREE.MeshLambertMaterial({ map: windowTex('office'), vertexColors: true, emissiveMap: windowTex('office', true), emissive: 0xffffff, emissiveIntensity: 0 }),
  roof: new THREE.MeshLambertMaterial({ vertexColors: true }),
};

// ---------- 街 ----------
const city = new City();
city.buildMeshes(scene, mats);
city.buildRoads(scene);
const tower = addTokyoTower(scene, city);
addDiet(scene, city);
const techgym = addTechGym(scene, city);
const skytreeMat = addSkytree(scene);
addFuji(scene);
const sfx = new Sfx();
const bgm = new Bgm(sfx);
let bgmOn = store.get('bgm', true);
const player = new Player(scene, city, sfx);
const fireworks = new Fireworks(scene);
const heli = new Heli(scene, city);
const oni = new Oni(scene, city);

// 著名なビルに名前を付けて、屋上の上にラベルを浮かべる
const labels = [];
function labelSprite(text) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = 'bold 44px "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 40;
  c.width = w; c.height = 72;
  g.font = font;
  g.fillStyle = 'rgba(10,16,30,0.72)';
  g.beginPath(); g.roundRect(0, 0, w, 60, 18); g.fill();
  g.beginPath(); g.moveTo(w / 2 - 12, 58); g.lineTo(w / 2 + 12, 58); g.lineTo(w / 2, 72); g.fill();
  g.fillStyle = '#fff';
  g.textBaseline = 'middle';
  g.fillText(text, 20, 31);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthWrite: false, transparent: true, fog: false }));
  sp.center.set(0.5, 0);
  sp.userData.aspect = w / 72;
  return sp;
}
for (const [name, lat, lon] of FAMOUS) {
  const [x, z] = ll(lat, lon);
  let best = null;
  for (let gx = -2; gx <= 2; gx++) for (let gz = -2; gz <= 2; gz++) {
    for (const bd of city.cell(x + gx * 30, z + gz * 30) || []) {
      if (!bd.plateau || (bd.cx - x) ** 2 + (bd.cz - z) ** 2 > 70 * 70) continue;
      if (!best || bd.h > best.h) best = bd;
    }
  }
  if (!best) continue;
  best.name = name;
  best.famous = true;
}
// 東京タワー・国会議事堂も
const dietXZ = ll(35.6759, 139.7448);
for (const [name, x, y, z] of [['東京タワー', tower.pos[0], 345, tower.pos[1]], ['国会議事堂', dietXZ[0], 75, dietXZ[1]], ['テックジム東京本校', techgym.pos[0], 196, techgym.pos[1]]]) {
  const sp = labelSprite(name);
  sp.position.set(x, y, z);
  scene.add(sp);
  labels.push({ sp, x, z });
}
for (const bd of city.bld) {
  if (!bd.famous) continue;
  if (labels.some((l) => l.text === bd.name)) continue;
  const sp = labelSprite(bd.name);
  sp.position.set(bd.cx, bd.h + 12, bd.cz);
  scene.add(sp);
  labels.push({ sp, x: bd.cx, z: bd.cz, text: bd.name });
}
function updateLabels() {
  const cp = camera.position;
  for (const l of labels) {
    const d = Math.hypot(l.x - cp.x, l.z - cp.z);
    const vis = d < 1600 && game.state === 'play';
    l.sp.visible = vis;
    if (!vis) continue;
    const s = 0.06 * THREE.MathUtils.clamp(1.2 - d / 2000, 0.55, 1);
    l.sp.scale.set(s * l.sp.userData.aspect, s, 1);
    l.sp.material.opacity = THREE.MathUtils.clamp((1600 - d) / 300, 0, 1);
  }
}

// 地面: ビルのある所は舗装、ない所は緑 (公園・皇居・住宅地の木々)
const GB = { x0: city.minX - 2500, x1: city.maxX + 2500, z0: city.minZ - 2500, z1: city.maxZ + 2500 };
const groundCanvas = document.createElement('canvas');
const GW = 2048, GH = Math.round(2048 * (GB.z1 - GB.z0) / (GB.x1 - GB.x0));
groundCanvas.width = GW; groundCanvas.height = GH;
const gsx = GW / (GB.x1 - GB.x0), gsz = GH / (GB.z1 - GB.z0);
{
  const g = groundCanvas.getContext('2d');
  g.fillStyle = '#5f7a4c';
  g.fillRect(0, 0, GW, GH);
  g.fillStyle = '#7d7c78';
  g.strokeStyle = '#7d7c78';
  g.lineJoin = 'round';
  g.lineWidth = 34 * gsx;
  for (const bd of city.bld) {
    if (!bd.plateau) continue;
    g.beginPath();
    for (let i = 0; i < bd.n; i++) {
      const x = (bd.pts[i * 2] - GB.x0) * gsx, z = (bd.pts[i * 2 + 1] - GB.z0) * gsz;
      if (i) g.lineTo(x, z); else g.moveTo(x, z);
    }
    g.closePath();
    g.fill(); g.stroke();
  }
  // 道路っぽい暗い線
  g.strokeStyle = '#55565a';
  g.lineWidth = 14 * gsx;
  for (const s of city.roadSegs) {
    g.beginPath();
    g.moveTo((s.x1 - GB.x0) * gsx, (s.z1 - GB.z0) * gsz);
    g.lineTo((s.x2 - GB.x0) * gsx, (s.z2 - GB.z0) * gsz);
    g.stroke();
  }
}
const groundTex = new THREE.CanvasTexture(groundCanvas);
groundTex.colorSpace = THREE.SRGBColorSpace;
groundTex.anisotropy = 8;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(GB.x1 - GB.x0, GB.z1 - GB.z0), new THREE.MeshLambertMaterial({ map: groundTex }));
ground.rotation.x = -Math.PI / 2;
ground.position.set((GB.x0 + GB.x1) / 2, 0, (GB.z0 + GB.z1) / 2);
scene.add(ground);
const outer = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.MeshLambertMaterial({ color: 0x5f7a4c }));
outer.rotation.x = -Math.PI / 2;
outer.position.y = -0.3;
scene.add(outer);

// 木 (緑の所に。10月なので銀杏の黄色と紅葉を混ぜる)
{
  const img = groundCanvas.getContext('2d').getImageData(0, 0, GW, GH).data;
  const pts = [];
  let s = 99;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 60000 && pts.length < 9000; k++) {
    const x = city.minX - 400 + rnd() * (city.maxX - city.minX + 800);
    const z = city.minZ - 400 + rnd() * (city.maxZ - city.minZ + 800);
    const px = Math.floor((x - GB.x0) * gsx), pz = Math.floor((z - GB.z0) * gsz);
    const i = (pz * GW + px) * 4;
    if (img[i + 1] > img[i] + 12) pts.push([x, z, rnd()]);
  }
  const crown = new THREE.IcosahedronGeometry(1, 0);
  crown.translate(0, 1.6, 0);
  const im = new THREE.InstancedMesh(crown, new THREE.MeshLambertMaterial({ color: 0xffffff }), pts.length);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  pts.forEach(([x, z, r], i) => {
    const sc = 4 + r * 5;
    m4.makeScale(sc, sc * 1.1, sc).setPosition(x, 0, z);
    im.setMatrixAt(i, m4);
    if (r < 0.12) col.setHex(0xe0b52a); else if (r < 0.18) col.setHex(0xc4512c); else col.setHSL(0.27 + r * 0.06, 0.45, 0.22 + r * 0.1);
    im.setColorAt(i, col);
  });
  scene.add(im);
}

// 影 (足元の丸)
const blob = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
blob.rotation.x = -Math.PI / 2;
scene.add(blob);

// ---------- 時間帯 ----------
let tod = store.get('tod', 'dusk');
function applyTod(k) {
  tod = k;
  const t = TOD[k];
  skyMat.uniforms.top.value.setHex(t.top);
  skyMat.uniforms.hor.value.setHex(t.hor);
  skyMat.uniforms.sunCol.value.setHex(t.sun);
  skyMat.uniforms.sunDir.value.set(...t.sunDir).normalize();
  skyMat.uniforms.night.value = k === 'night' ? 1 : 0;
  scene.fog.color.setHex(t.fog);
  scene.fog.far = t.fogFar;
  sun.color.setHex(t.sun);
  sun.intensity = t.sunI;
  sun.position.set(...t.sunDir).multiplyScalar(1000);
  hemi.intensity = t.hemi;
  mats.glass.emissiveIntensity = t.emi;
  mats.office.emissiveIntensity = t.emi * 0.9;
  tower.light.intensity = k === 'night' ? 60000 : 0;
  tower.mats[0].emissive.setHex(k === 'day' ? 0x000000 : 0xffd59a);
  tower.mats[0].emissiveIntensity = k === 'night' ? 0.8 : 0.3;
  // 夜はタワーがオレンジに光る (ランドマークライト)
  techgym.setNight(k);
  for (const m of tower.glow) m.emissive.setHex(k === 'night' ? 0xc0480c : k === 'dusk' ? 0x2a0e04 : 0x000000);
  skytreeMat.color.setHex(k === 'night' ? 0x6a86b8 : 0xd8e2ea);
  document.querySelectorAll('#tod button').forEach((b) => b.classList.toggle('on', b.dataset.v === k));
  store.set('tod', k);
}
applyTod(tod);

// ---------- ビル図鑑 ----------
const dexKey = (n) => n.split(' ')[0];
const DEX_ALL = [...new Set(city.bld.filter((b) => b.name).map((b) => dexKey(b.name)))];
let dex = new Set(store.get('dex', []));
function updateDexCount() {
  $('dexCount').textContent = `${dex.size} / ${DEX_ALL.length} 棟`;
}
updateDexCount();

// ---------- ミッション ----------
// チェックポイント: 屋上に置いた光の玉 (指定地点の近くで高い屋上を選ぶ)
const orbGeo = new THREE.SphereGeometry(2.6, 24, 16);
const haloTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,240,180,1)');
  gr.addColorStop(0.3, 'rgba(255,200,80,0.6)');
  gr.addColorStop(1, 'rgba(255,160,40,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
let rings = [];
function clearRings() {
  for (const r of rings) scene.remove(r.mesh);
  rings = [];
}
// 屋上の内側の点
function roofPoint(bd) {
  for (let k = 0; k <= 10; k++) {
    const t = k / 10;
    for (let i = 0; i < bd.n; i++) {
      const qx = bd.cx * (1 - t) + bd.pts[i * 2] * t, qz = bd.cz * (1 - t) + bd.pts[i * 2 + 1] * t;
      if (city.inside(bd, qx, qz)) return [qx, qz];
    }
  }
  return [bd.cx, bd.cz];
}
// (x, z) の近くで、高くて近い屋上 (PLATEAU のビルか、屋上に立てる名所)。label と同じ名前の屋上があればそれ
function pickRoof(x, z, label) {
  if (label) {
    // 同じ名前の屋上 (複数あれば一番高いもの)
    let named = null;
    for (const bd of city.bld) if (bd.name === label && Math.hypot(bd.cx - x, bd.cz - z) < 400 && (!named || bd.h > named.h)) named = bd;
    if (named) return named;
  }
  for (const rad of [100, 220]) {
    let best = null, bs = -1e9;
    const r = Math.ceil(rad / 30);
    for (let gx = -r; gx <= r; gx++) for (let gz = -r; gz <= r; gz++) {
      for (const bd of city.cell(x + gx * 30, z + gz * 30) || []) {
        if (!(bd.plateau || bd.roof) || bd.area < 60) continue;
        const d = Math.hypot(bd.cx - x, bd.cz - z);
        if (d > rad) continue;
        const sc = Math.min(bd.h, 200) - d * 0.6;
        if (sc > bs) { bs = sc; best = bd; }
      }
    }
    if (best) return best;
  }
  return null;
}
function setupRings(m) {
  clearRings();
  for (const [x, z, label] of m.rings) {
    const bd = pickRoof(x, z, label);
    const [px, pz] = bd ? roofPoint(bd) : [x, z];
    const y = (bd ? bd.h : 0) + 2.2; // 屋上に立って手が届く高さ
    const mesh = new THREE.Group();
    const orb = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: 0xfff0b0, fog: false }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    halo.scale.set(16, 16, 1);
    mesh.add(orb, halo);
    mesh.position.set(px, y, pz);
    mesh.userData = { orb, halo };
    scene.add(mesh);
    rings.push({ mesh, label, pos: mesh.position, base: y, bd, done: false });
  }
}

// スタートする屋上: 指定点を含む建物 (なければ近くで高い建物)
function startPoint(m) {
  const [x, z] = m.start;
  let best = null;
  const l = city.cell(x, z) || [];
  for (const bd of l) if (city.inside(bd, x, z) && (!best || bd.h > best.h)) best = bd;
  if (!best) best = city.findBuildingNear(x, z);
  // 屋上の内側の点
  for (let k = 0; k <= 10; k++) {
    const t = k / 10;
    for (let i = 0; i < best.n; i++) {
      const qx = best.cx * (1 - t) + best.pts[i * 2] * t, qz = best.cz * (1 - t) + best.pts[i * 2 + 1] * t;
      if (city.inside(best, qx, qz)) return [qx, best.h + 0.05, qz];
    }
  }
  return [x, best.h + 0.05, z];
}
const FREE = { id: 'free', title: 'ビル図鑑あつめ', start: [212, 307], rings: [] };

// ---------- 状態 ----------
const game = {
  state: 'title', mode: null, mission: null,
  t: 0, ringIdx: 0, score: 0, combo: 0, maxCombo: 0, groundT: 0, nearCd: 0,
  countdown: 0, maxSpeed: 0, nice: 0, newDex: 0, lastSafe: null,
};
const cam = { yaw: 0, pitch: -0.15, dist: 7, shake: 0, pos: new THREE.Vector3(), lookIdle: 0 };

function startGame(m) {
  sfx.resume();
  game.mission = m;
  game.mode = m === FREE ? 'free' : 'mission';
  game.t = 0; game.ringIdx = 0; game.score = 0; game.combo = 0; game.maxCombo = 0; game.groundT = 0;
  game.maxSpeed = 0; game.nice = 0; game.newDex = 0; game.landings = 0; game.ropedSince = false;
  fireworks.clear();
  if (bgmOn) bgm.start();
  const sp = startPoint(m);
  player.reset(...sp);
  game.lastSafe = sp;
  game.standBd = city.floorAt(sp[0], sp[2], sp[1] + 1).bd;
  if (game.mode === 'mission') setupRings(m); else clearRings();
  // 最初の輪 (フリーなら東京タワー) の方を向く
  const tgt = rings[0] ? rings[0].pos : new THREE.Vector3(tower.pos[0], 150, tower.pos[1]);
  cam.yaw = Math.atan2(-(tgt.x - sp[0]), -(tgt.z - sp[2]));
  cam.pitch = -0.1;
  player.facing = cam.yaw;
  heli.reset(player.p, cam.yaw);
  setupOni(m, sp);
  game.countdown = game.mode === 'mission' ? 3.5 : 0;
  game.state = 'play';
  showScreen(null);
  $('hud').classList.remove('hidden');
  $('touch').classList.toggle('hidden', !isTouch);
  $('rings').classList.toggle('hidden', game.mode !== 'mission');
  $('timer').classList.toggle('hidden', game.mode !== 'mission');
  $('nav').classList.toggle('hidden', game.mode !== 'mission');
  $('dex').classList.toggle('hidden', game.mode !== 'free');
  $('hint').textContent = isTouch ? '' : 'クリックで視点固定 ・ 左クリック: ロープをつかむ／離す ・ A D: 曲がる ・ Space: ジャンプ ・ R: やり直し ・ Esc: 一時停止';
  lastArea = '';
  lockPointer();
}

// 鬼の数と持ち場: ミッションはルートの長さに応じて (ルート沿いに)、フリーは街じゅうに20匹
function setupOni(m, sp) {
  const homes = [];
  let count;
  if (game.mode === 'mission') {
    let a = new THREE.Vector3(...sp);
    for (const r of rings) {
      const L = a.distanceTo(r.pos);
      for (let d = 0; d < L; d += 200) homes.push({ x: a.x + (r.pos.x - a.x) * d / L, z: a.z + (r.pos.z - a.z) * d / L });
      a = r.pos;
    }
    count = m.oni || THREE.MathUtils.clamp(Math.round(routeLength(m) / 350) + 2, 4, 16);
  } else {
    for (const [, x, z] of AREA_XY) homes.push({ x, z });
    for (const t of dexTargets) homes.push({ x: t.x, z: t.z });
    count = 20;
  }
  oni.reset(homes, count, { x: sp[0], z: sp[2] }, game.mode === 'mission' ? 520 : 650);
  game.chasers = 0; game.alarm = false; game.alarmT = 0; game.heartT = 0;
}
function updateOni(dt) {
  const r = oni.update(dt, player, game.countdown <= 0);
  if (r.spawned) floater(`鬼が ${r.spawned.length} 匹 徘徊している！`, false);
  if (r.found.length) {
    sfx.oniLaugh();
    floater(r.found.length > 1 ? `鬼 ${r.found.length} 匹に見つかった！` : '鬼に見つかった！', true);
  }
  game.chasers = oni.list.filter((o) => o.state === 'chase').length;
  // 追いかけられている間は BGM を止めて警報を鳴らす
  const chased = game.chasers > 0;
  if (chased !== game.alarm) {
    game.alarm = chased;
    game.alarmT = 0;
    if (chased) bgm.stop(); else if (bgmOn) bgm.start();
  }
  if (chased) {
    game.alarmT -= dt;
    if (game.alarmT <= 0) { sfx.alarm(); game.alarmT = 1.5; }
  }
  // 追いかけてくる鬼が近いほど速くなる心臓の音
  game.heartT -= dt;
  if (r.nearestChase < 150 && game.heartT <= 0) {
    sfx.heartbeat();
    game.heartT = 0.35 + (r.nearestChase / 150) * 0.8;
  }
  $('danger').style.opacity = Number.isFinite(r.nearestChase) ? Math.max(0, Math.min(1, (180 - r.nearestChase) / 140)) : 0;
  $('danger').classList.toggle('alarm', chased);
  $('oni').textContent = `👹 ${oni.list.length}${chased ? `（追跡 ${game.chasers}）` : ''}`;
  $('oni').classList.toggle('danger', chased);
  if (r.caught) gameOver();
}
// 鬼に捕まったらアウト
function gameOver() {
  game.state = 'result';
  bgm.stop();
  sfx.heli(null);
  sfx.caught();
  cam.shake = 1;
  flash(0.6);
  unlockPointer();
  const m = game.mission;
  $('resTitle').textContent = '鬼に捕まった！';
  $('resStars').textContent = '👹';
  $('resBody').innerHTML = `${m.title}<br>${game.mode === 'mission' ? `チェックポイント ${game.ringIdx} / ${rings.length} ・ ${fmt(game.t)}` : `図鑑 ${dex.size} / ${DEX_ALL.length} 棟`}<br>
    得点 <b>${Math.round(game.score).toLocaleString()}</b> pt<br>
    最大コンボ ${game.maxCombo} ／ 着地成功 ${game.landings} 回 ／ 最高速度 ${Math.round(game.maxSpeed * 3.6)} km/h`;
  setTimeout(() => {
    if (game.state !== 'result') return;
    showScreen('result');
    $('hud').classList.add('hidden');
    $('touch').classList.add('hidden');
    $('danger').style.opacity = 0;
    buildMenu();
  }, 1200);
}

function showScreen(id) {
  for (const s of ['title', 'how', 'dexScreen', 'pause', 'result', 'loading']) $(s).classList.toggle('hidden', s !== id);
}

function finishMission() {
  game.state = 'result';
  bgm.stop();
  sfx.heli(null);
  oni.clear();
  $('danger').style.opacity = 0;
  sfx.finish();
  launchFireworks(8, true, 0.35);
  unlockPointer();
  const m = game.mission;
  const L = routeLength(m);
  const t = game.t;
  const stars = t < L / 34 ? 3 : t < L / 24 ? 2 : 1;
  const bests = store.get('best', {});
  const prev = bests[m.id];
  const isBest = !prev || t < prev.t;
  if (isBest) bests[m.id] = { t, stars, score: game.score };
  store.set('best', bests);
  $('resTitle').textContent = '配達完了！';
  $('resStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('resBody').innerHTML = `${m.title}<br><b>${fmt(t)}</b>${isBest ? ' <span style="color:#ffb020">ベスト更新！</span>' : `（ベスト ${fmt(prev.t)}）`}<br>
    得点 ${Math.round(game.score).toLocaleString()} pt ／ 最大コンボ ${game.maxCombo}<br>
    最高速度 ${Math.round(game.maxSpeed * 3.6)} km/h ／ ナイスリリース ${game.nice} 回 ／ 着地成功 ${game.landings} 回<br>
    <small>★★★ ${fmt(L / 34)} ／ ★★ ${fmt(L / 24)}</small>`;
  showScreen('result');
  $('hud').classList.add('hidden');
  $('touch').classList.add('hidden');
  buildMenu();
}
function routeLength(m) {
  let a = new THREE.Vector3(...startPoint(m)), L = 0;
  for (const r of rings) { L += a.distanceTo(r.pos); a = r.pos; }
  return L;
}
const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;

// ---------- 入力 ----------
const keys = {};
const input = { mx: 0, mz: 0, yaw: 0 };
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (game.state !== 'play') return;
  if (e.code === 'Space') { e.preventDefault(); player.jump(); }
  if (e.code === 'KeyR') respawn();
  if (e.code === 'KeyM') sfx.setMuted(!sfx.muted);
  if (e.code === 'KeyB') setBgm(!bgmOn);
  if (e.code === 'KeyN') mmEl.classList.toggle('big');
  if (e.code === 'KeyP') pause();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
const canvas = renderer.domElement;
function lockPointer() { if (!isTouch && canvas.requestPointerLock) try { canvas.requestPointerLock(); } catch (e) { /* 失敗してもドラッグで操作できる */ } }
function unlockPointer() { if (document.pointerLockElement) document.exitPointerLock(); }
canvas.addEventListener('mousedown', (e) => {
  if (game.state !== 'play') return;
  sfx.resume();
  if (!document.pointerLockElement) { lockPointer(); if (e.button !== 0) return; }
  if (e.button === 0) tryFire();
});
addEventListener('mouseup', (e) => {
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousemove', (e) => {
  if (game.state !== 'play') return;
  if (document.pointerLockElement === canvas || e.buttons) {
    cam.yaw -= e.movementX * 0.0024;
    if (Math.abs(e.movementX) > 1) cam.lookIdle = 0;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch - e.movementY * 0.0024, -1.45, 1.35);
  }
});
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && game.state === 'play' && !isTouch && !lockReleasedByUs) pause();
  lockReleasedByUs = false;
});
let lockReleasedByUs = false;

// スマホ
const touchLook = { id: null, x: 0, y: 0 };
const stick = { id: null, cx: 0, cy: 0, x: 0, y: 0 };
canvas.addEventListener('touchstart', (e) => {
  for (const t of e.changedTouches) {
    if (t.clientX > innerWidth * 0.35 && touchLook.id === null) { touchLook.id = t.identifier; touchLook.x = t.clientX; touchLook.y = t.clientY; }
  }
}, { passive: true });
addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === touchLook.id) {
      cam.yaw -= (t.clientX - touchLook.x) * 0.006;
      cam.lookIdle = 0;
      cam.pitch = THREE.MathUtils.clamp(cam.pitch - (t.clientY - touchLook.y) * 0.006, -1.45, 1.35);
      touchLook.x = t.clientX; touchLook.y = t.clientY;
    }
    if (t.identifier === stick.id) {
      const dx = t.clientX - stick.cx, dy = t.clientY - stick.cy;
      const l = Math.min(1, Math.hypot(dx, dy) / 50) / (Math.hypot(dx, dy) || 1);
      stick.x = dx * l; stick.y = dy * l;
      $('knob').style.transform = `translate(${stick.x * 40}px, ${stick.y * 40}px)`;
    }
  }
}, { passive: true });
addEventListener('touchend', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === touchLook.id) touchLook.id = null;
    if (t.identifier === stick.id) { stick.id = null; stick.x = stick.y = 0; $('knob').style.transform = ''; }
  }
});
addEventListener('touchcancel', () => { touchLook.id = null; stick.id = null; stick.x = stick.y = 0; });
$('stick').addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  const r = $('stick').getBoundingClientRect();
  stick.id = t.identifier; stick.cx = r.left + r.width / 2; stick.cy = r.top + r.height / 2;
});
const holdBtn = (id, down, up) => {
  const el = $(id);
  el.addEventListener('touchstart', (e) => { e.preventDefault(); sfx.resume(); el.classList.add('on'); down(); });
  el.addEventListener('touchend', (e) => { e.preventDefault(); el.classList.remove('on'); if (up) up(); });
  el.addEventListener('touchcancel', () => { el.classList.remove('on'); if (up) up(); });
};
holdBtn('tRope', () => tryFire());
holdBtn('tJump', () => player.jump());
$('tPause').addEventListener('click', () => pause());
$('tRetry').addEventListener('click', () => { if (game.state === 'play') respawn(); });

// ---------- ロープ (ヘリ) ----------
const tmpD = new THREE.Vector3();
function camForward(out) {
  const cp = Math.cos(cam.pitch);
  return out.set(-Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), -Math.cos(cam.yaw) * cp);
}
// タップ (クリック) でつかむ。つかまっているときにもう一度タップすると離す
const REACH = 22; // ロープまでこの距離 (m) 以内ならつかめる
function tryFire() {
  if (game.state !== 'play' || game.countdown > 0) return;
  if (player.rope) { player.release(); return; }
  if (heli.reachDist(player.hand()) <= REACH) player.grab(heli.hook);
  else { sfx.miss(); floater('ロープに届かない', false); }
}

// ---------- HUD ----------
function floater(text, big) {
  const el = document.createElement('div');
  el.className = 'floater' + (big ? ' big' : '');
  el.textContent = text;
  el.style.top = (Math.random() * 40 - 20) + 'px';
  $('floaters').appendChild(el);
  setTimeout(() => el.remove(), 1300);
}
let toastTimer = 0;
function toast(text, gold) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  el.classList.toggle('gold', !!gold);
  toastTimer = gold ? 3 : 2;
}
let lastArea = '', areaTimer = 0, areaCheck = 0;
const AREA_XY = AREAS.map(([n, la, lo]) => [n, ...ll(la, lo)]);

// ミニマップ: 国土地理院の淡色地図 (地理院タイル) を進行方向が上になるように回して表示する
// (清水の舞台から飛び降りるつもり techgymjp/kiyomizu と同じ作り)。地図が読めないときは PLATEAU のビルの形で描く
const MAP_Z = 15;
const lonToTileX = (lon, z) => (lon + 180) / 360 * 2 ** z;
const latToTileY = (lat, z) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z; };
const KX = 111320 * Math.cos(CITY.origin[0] * Math.PI / 180), KZ = 110574;
const worldToGeo = (x, z) => [CITY.origin[0] - z / KZ, CITY.origin[1] + x / KX];
const mapCanvas = document.createElement('canvas');
let mapOrigin = { x: 0, y: 0 };
function toMap(x, z) {
  const [lat, lon] = worldToGeo(x, z);
  return [lonToTileX(lon, MAP_Z) * 256 - mapOrigin.x, latToTileY(lat, MAP_Z) * 256 - mapOrigin.y];
}
{
  const [north, west] = worldToGeo(city.minX - 600, city.minZ - 600);
  const [south, east] = worldToGeo(city.maxX + 600, city.maxZ + 600);
  const x0 = Math.floor(lonToTileX(west, MAP_Z)), x1 = Math.floor(lonToTileX(east, MAP_Z));
  const y0 = Math.floor(latToTileY(north, MAP_Z)), y1 = Math.floor(latToTileY(south, MAP_Z));
  mapOrigin = { x: x0 * 256, y: y0 * 256 };
  mapCanvas.width = (x1 - x0 + 1) * 256;
  mapCanvas.height = (y1 - y0 + 1) * 256;
  const g = mapCanvas.getContext('2d');
  g.fillStyle = '#e8e4d8';
  g.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
  // 地図が届くまでの代わり (ビルの形)
  g.fillStyle = '#c9c4b8';
  for (const bd of city.bld) {
    if (!bd.plateau || bd.h < 4) continue;
    g.beginPath();
    for (let i = 0; i < bd.n; i++) {
      const [mx, my] = toMap(bd.pts[i * 2], bd.pts[i * 2 + 1]);
      if (i) g.lineTo(mx, my); else g.moveTo(mx, my);
    }
    g.fill();
  }
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => g.drawImage(img, (x - x0) * 256, (y - y0) * 256);
      img.src = `https://cyberjapandata.gsi.go.jp/xyz/pale/${MAP_Z}/${x}/${y}.png`;
    }
  }
}
const mmEl = $('minimap');
const mm = mmEl.getContext('2d');
// 拡大地図: プレイヤーのまわりだけ、細かい地図 (ズーム16) のタイルを読み込んで描く。読み込むまではズーム15の地図を拡大して出す
const DETAIL_Z = 16;
const tileCache = new Map();
function detailTile(x, y) {
  const key = x + '/' + y;
  let t = tileCache.get(key);
  if (!t) {
    t = new Image();
    t.crossOrigin = 'anonymous';
    t.src = `https://cyberjapandata.gsi.go.jp/xyz/pale/${DETAIL_Z}/${x}/${y}.png`;
    tileCache.set(key, t);
  }
  return t.complete && t.naturalWidth ? t : null;
}
function toDetail(x, z) {
  const [lat, lon] = worldToGeo(x, z);
  return [lonToTileX(lon, DETAIL_Z) * 256, latToTileY(lat, DETAIL_Z) * 256];
}
let mmZoom = 0.85;
// ミニマップをタップ (クリック) すると大きく広げる。もう一度で戻す
mmEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); mmEl.classList.toggle('big'); });
function drawMinimap() {
  // キャンバスの解像度によらず 220px 相当の座標で描く
  const k = mmEl.width / 220, W = 220;
  mm.setTransform(1, 0, 0, 1, 0, 0);
  mm.clearRect(0, 0, mmEl.width, mmEl.height);
  mm.setTransform(k, 0, 0, k, 0, 0);
  const [mex, mey] = toDetail(player.p.x, player.p.z);
  // 半径 約250m。速いときは広く (約500m)、大きく広げたときはさらに広く
  const want = THREE.MathUtils.clamp(0.85 - player.v.length() / 160, 0.42, 0.85) * (mmEl.classList.contains('big') ? 0.55 : 1);
  mmZoom += (want - mmZoom) * 0.05;
  const zoom = mmZoom, ms = 1 / zoom;
  mm.save();
  mm.beginPath(); mm.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2); mm.clip();
  mm.fillStyle = '#e8e4d8';
  mm.fillRect(0, 0, W, W);
  mm.translate(W / 2, W / 2);
  mm.rotate(cam.yaw); // 進行方向 (カメラの向き) を上に
  mm.scale(zoom, zoom);
  // 下地: ズーム15の地図を2倍に (座標はプレイヤーからの相対)
  const sc = 2 ** (DETAIL_Z - MAP_Z);
  mm.drawImage(mapCanvas, mapOrigin.x * sc - mex, mapOrigin.y * sc - mey, mapCanvas.width * sc, mapCanvas.height * sc);
  // 細かい地図のタイル
  const R = W / 2 / zoom * 1.42 + 256;
  for (let ty = Math.floor((mey - R) / 256); ty <= Math.floor((mey + R) / 256); ty++) {
    for (let tx = Math.floor((mex - R) / 256); tx <= Math.floor((mex + R) / 256); tx++) {
      const img = detailTile(tx, ty);
      if (img) mm.drawImage(img, tx * 256 - mex, ty * 256 - mey);
    }
  }
  mm.restore();
  // 地図を少し薄くして、印を目立たせる
  mm.save();
  mm.beginPath(); mm.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2); mm.clip();
  mm.fillStyle = 'rgba(255,255,255,0.28)';
  mm.fillRect(0, 0, W, W);
  // 街の座標 → ミニマップ上の位置 (中心からの相対、回転・拡大ずみ)
  const cs = Math.cos(cam.yaw), sn = Math.sin(cam.yaw);
  const toScreen = (x, z) => {
    const [px, py] = toDetail(x, z);
    const dx = px - mex, dy = py - mey;
    return [(dx * cs - dy * sn) * zoom, (dx * sn + dy * cs) * zoom];
  };
  const C = W / 2, EDGE = W / 2 - 14;
  const tt = performance.now() / 1000;
  const dot = (x, z, r, fill) => {
    const [sx, sy] = toScreen(x, z);
    if (Math.hypot(sx, sy) > EDGE + 10) return;
    mm.beginPath();
    mm.arc(C + sx, C + sy, r, 0, Math.PI * 2);
    mm.fillStyle = fill;
    mm.fill();
    mm.lineWidth = 2;
    mm.strokeStyle = '#fff';
    mm.stroke();
  };
  // 地図の外にあるものは、ふちに置いて向きを矢印で示す
  const pin = (x, z, draw, arrowColor) => {
    let [sx, sy] = toScreen(x, z);
    const d = Math.hypot(sx, sy);
    const out = d > EDGE;
    if (out) { sx *= EDGE / d; sy *= EDGE / d; }
    if (out) {
      const a = Math.atan2(sy, sx);
      mm.save();
      mm.translate(C + sx, C + sy);
      mm.rotate(a);
      mm.beginPath();
      mm.moveTo(15, 0); mm.lineTo(6, -7); mm.lineTo(6, 7); mm.closePath();
      mm.fillStyle = arrowColor;
      mm.fill();
      mm.lineWidth = 1.5;
      mm.strokeStyle = '#fff';
      mm.stroke();
      mm.restore();
    }
    draw(C + sx, C + sy, out);
  };
  // ほかの目印 (小さく)
  dot(tower.pos[0], tower.pos[1], 4, '#ff6a00');
  if (game.mode === 'mission') {
    for (let i = rings.length - 1; i > game.ringIdx; i--) dot(rings[i].pos.x, rings[i].pos.z, 3.5, 'rgba(255,150,60,0.9)');
  } else for (const t of dexTargets) if (!dex.has(t.key)) dot(t.x, t.z, 3, '#e040fb');
  dot(heli.pos.x, heli.pos.z, 3.5, '#ffd400');
  // 鬼: 赤い丸の上に👹 (追いかけてくる鬼は点滅して、地図の外でもふちに出す)
  mm.textAlign = 'center';
  mm.textBaseline = 'middle';
  for (const o of oni.list) {
    const chase = o.state === 'chase';
    const [sx, sy] = toScreen(o.pos.x, o.pos.z);
    if (!chase && Math.hypot(sx, sy) > EDGE + 6) continue;
    pin(o.pos.x, o.pos.z, (X, Y) => {
      const r = chase ? 11 + Math.sin(tt * 10) * 2 : 9;
      mm.beginPath();
      mm.arc(X, Y, r, 0, Math.PI * 2);
      mm.fillStyle = chase ? 'rgba(230,20,30,0.9)' : 'rgba(120,20,30,0.75)';
      mm.fill();
      mm.lineWidth = 2;
      mm.strokeStyle = '#fff';
      mm.stroke();
      mm.font = '15px sans-serif';
      mm.fillText('👹', X, Y + 1);
    }, '#e8141e');
  }
  // 次のチェックポイント: 大きな赤い印 (脈打つ輪つき)
  if (game.mode === 'mission' && rings[game.ringIdx]) {
    const r = rings[game.ringIdx];
    pin(r.pos.x, r.pos.z, (X, Y) => {
      const k = (tt * 1.2) % 1;
      mm.beginPath();
      mm.arc(X, Y, 10 + k * 14, 0, Math.PI * 2);
      mm.strokeStyle = `rgba(255,60,80,${1 - k})`;
      mm.lineWidth = 3;
      mm.stroke();
      mm.beginPath();
      mm.arc(X, Y, 10, 0, Math.PI * 2);
      mm.fillStyle = '#ff2d55';
      mm.fill();
      mm.lineWidth = 3;
      mm.strokeStyle = '#fff';
      mm.stroke();
      mm.fillStyle = '#fff';
      mm.font = 'bold 13px sans-serif';
      mm.fillText('✦', X, Y + 1);
    }, '#ff2d55');
  }
  mm.restore();
  // 自分: 大きな青い矢印 (進行方向が上) と脈打つ輪
  mm.save();
  mm.translate(C, C);
  const k2 = (tt * 0.9) % 1;
  mm.beginPath();
  mm.arc(0, 0, 12 + k2 * 12, 0, Math.PI * 2);
  mm.strokeStyle = `rgba(30,136,255,${0.8 * (1 - k2)})`;
  mm.lineWidth = 3;
  mm.stroke();
  mm.beginPath();
  mm.moveTo(0, -18); mm.lineTo(13, 13); mm.lineTo(0, 6); mm.lineTo(-13, 13);
  mm.closePath();
  mm.fillStyle = '#1e88ff';
  mm.fill();
  mm.lineWidth = 3;
  mm.strokeStyle = '#fff';
  mm.stroke();
  mm.restore();
}
const dexTargets = [];
{
  const seen = new Set();
  for (const bd of city.bld) {
    if (!bd.name) continue;
    const key = dexKey(bd.name);
    if (seen.has(key)) continue;
    seen.add(key);
    dexTargets.push({ key, x: bd.cx, z: bd.cz });
  }
}

// スピード線
const sl = $('speedlines');
function drawSpeedLines() {
  sl.width = innerWidth; sl.height = innerHeight;
  const g = sl.getContext('2d');
  const cx = sl.width / 2, cy = sl.height / 2, R = Math.hypot(cx, cy);
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2, r0 = R * (0.45 + Math.random() * 0.3);
    g.lineWidth = 1 + Math.random() * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    g.stroke();
  }
}
drawSpeedLines();

// ---------- 得点 ----------
function handleEvents(dt) {
  const mult = () => 1 + Math.min(game.combo, 30) * 0.25;
  for (const e of player.events) {
    if (e.type === 'attach') {
      game.ropedSince = true;
      game.combo++;
      game.maxCombo = Math.max(game.maxCombo, game.combo);
      const pts = 50 * game.combo;
      game.score += pts;
      if (game.combo >= 2) sfx.combo(game.combo);
    } else if (e.type === 'release' && e.nice) {
      game.nice++;
      game.score += 200 * mult();
      floater('ナイスリリース！', true);
    } else if (e.type === 'land') {
      if (e.what === 'ground') { endCombo(); game.standBd = null; }
      // ロープでほかのビルの屋上に着地できたらボーナス (花火はチェックポイントだけ)
      if (e.what === 'roof' && e.bd && e.bd !== game.standBd && game.ropedSince) {
        game.landings++;
        game.score += 500 * mult();
        floater(e.bd.name ? `${e.bd.name} に着地！` : '着地成功！', true);
      }
      if (e.what === 'roof') { game.standBd = e.bd; game.ropedSince = false; }
      if (e.what === 'roof' && e.bd) collectDex(e.bd);
      if (e.what === 'roof' || e.what === 'road') game.lastSafe = [player.p.x, player.p.y, player.p.z];
      if (e.vy > 45) { cam.shake = 0.6; floater('ドスン！', false); }
    } else if (e.type === 'bump') {
      cam.shake = Math.min(1, e.speed / 40);
      flash(0.25);
      if (e.speed > 30) floater('ゴツン！', false);
    }
  }
  player.events.length = 0;
  if (player.grounded && !player.rope) {
    game.groundT += dt;
    if (game.groundT > 1.0) endCombo();
  } else game.groundT = 0;
  // 空中にいる間、速さに応じて加点
  const sp = player.v.length();
  if (!player.grounded) game.score += sp * 0.4 * mult() * dt;
  // ニアミス
  game.nearCd -= dt;
  if (sp > 32 && !player.grounded && game.nearCd <= 0) {
    const wd = city.wallDist(player.p, 3.2);
    if (wd < 3.2 && wd > P.R + 0.05) {
      game.nearCd = 1.2;
      game.score += 300 * mult();
      sfx.near();
      floater('ニアミス！', true);
    }
  }
}
// 名前のあるビルの屋上に降りると図鑑に載る
function collectDex(bd) {
  if (!bd.name) { if (bd.plateau) toast(`ビル 高さ ${Math.round(bd.h)}m`); return; }
  const key = dexKey(bd.name);
  if (!dex.has(key)) {
    dex.add(key);
    store.set('dex', [...dex]);
    game.newDex++;
    game.score += 1000;
    sfx.collect();
    toast(`📖 図鑑に登録！ ${bd.name}（${Math.round(bd.h)}m） ${dex.size}/${DEX_ALL.length}`, true);
    if (game.mode === 'free' && oni.list.length < 40) oni.addOne(player);
    updateDexCount();
  } else toast(`🏢 ${bd.name}（${Math.round(bd.h)}m）`);
}
function launchFireworks(n, big, gap) {
  for (const t of fireworks.show(camera, n, big, gap)) sfx.firework(t);
}
function endCombo() {
  if (game.combo >= 3) floater(`${game.combo} コンボ！`, false);
  game.combo = 0;
}
function flash(a) {
  const f = $('flash');
  f.style.transition = 'none';
  f.style.opacity = a;
  requestAnimationFrame(() => { f.style.transition = 'opacity 0.25s'; f.style.opacity = 0; });
}

function respawn() {
  let p = game.lastSafe;
  if (game.mode === 'mission' && game.ringIdx > 0) {
    const r = rings[game.ringIdx - 1].pos;
    p = [r.x, r.y, r.z];
  }
  player.reset(...p, cam.yaw);
  heli.reset(player.p, cam.yaw);
  endCombo();
  floater('やり直し', false);
}

function pause() {
  if (game.state !== 'play') return;
  game.state = 'pause';
  sfx.heli(null);
  bgm.duck(true);
  showScreen('pause');
}
$('resumeBtn').onclick = () => { game.state = 'play'; bgm.duck(false); showScreen(null); lockPointer(); };
$('retryBtn').onclick = () => startGame(game.mission);
$('quitBtn').onclick = () => toTitle();
$('resRetry').onclick = () => startGame(game.mission);
$('resQuit').onclick = () => toTitle();
function toTitle() {
  game.state = 'title';
  bgm.stop();
  sfx.heli(null);
  fireworks.clear();
  oni.clear();
  $('danger').style.opacity = 0;
  clearRings();
  $('hud').classList.add('hidden');
  $('touch').classList.add('hidden');
  buildMenu();
  showScreen('title');
  lockReleasedByUs = true;
  unlockPointer();
}

// ---------- メニュー ----------
function buildMenu() {
  const bests = store.get('best', {});
  const list = $('missionList');
  list.innerHTML = '';
  for (const m of MISSIONS) {
    const b = document.createElement('button');
    b.className = 'mode';
    const best = bests[m.id];
    b.innerHTML = `${best ? `<span class="best">${'★'.repeat(best.stars)} ${fmt(best.t)}</span>` : ''}<b>${m.title}</b><span>${m.sub}</span>`;
    b.onclick = () => startGame(m);
    list.appendChild(b);
  }
  updateDexCount();
}
buildMenu();
$('freeBtn').onclick = () => startGame(FREE);
$('howBtn').onclick = () => showScreen('how');
$('dexBtn').onclick = () => {
  $('dexTotal').textContent = `${dex.size} / ${DEX_ALL.length} 棟`;
  const l = $('dexList');
  l.innerHTML = '';
  for (const n of [...DEX_ALL].sort((a, b) => dex.has(b) - dex.has(a))) {
    const d = document.createElement('div');
    d.className = dex.has(n) ? '' : 'no';
    d.textContent = dex.has(n) ? n : '？？？';
    l.appendChild(d);
  }
  showScreen('dexScreen');
};
document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => showScreen('title'); });
document.querySelectorAll('#tod button').forEach((b) => { b.onclick = () => applyTod(b.dataset.v); });

function setBgm(on) {
  bgmOn = on;
  store.set('bgm', on);
  document.querySelectorAll('#bgmSel button').forEach((b) => b.classList.toggle('on', (b.dataset.v === 'on') === on));
  if (game.state === 'play') { if (on) bgm.start(); else bgm.stop(); }
}
document.querySelectorAll('#bgmSel button').forEach((b) => { b.onclick = () => setBgm(b.dataset.v === 'on'); });
setBgm(bgmOn);

// ---------- ループ ----------
const clock = new THREE.Clock();
let menuT = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  fireworks.update(dt);
  techgym.update(clock.elapsedTime);
  if (game.state === 'play') update(dt);
  else if (game.state === 'title') {
    // タイトルの背景: 都心の上空をゆっくり回る
    menuT += dt * 0.04;
    const cx = 600, cz = 600;
    camera.position.set(cx + Math.cos(menuT) * 1300, 420, cz + Math.sin(menuT) * 1300);
    camera.lookAt(cx, 60, cz);
    camera.fov = 60; camera.updateProjectionMatrix();
    player.model.visible = false;
  }
  updateLabels();
  sky.position.copy(camera.position);
  renderer.render(scene, camera);
}

function update(dt) {
  player.model.visible = true;
  // 入力
  let mx = 0, mz = 0;
  if (keys.KeyW || keys.ArrowUp) mz += 1;
  if (keys.KeyS || keys.ArrowDown) mz -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (stick.id !== null) { mx = stick.x; mz = -stick.y; }
  input.mx = mx; input.mz = mz;
  // 空中 (飛んでいる間・ロープにつかまっている間) は、左右で向きを変えて曲がる。つかまっているとヘリも曲がる
  if (!player.grounded && Math.abs(mx) > 0.05 && game.countdown <= 0) {
    const turn = -mx * 1.9 * dt;
    cam.yaw += turn;
    if (!player.rope) {
      const c = Math.cos(turn), sn = Math.sin(turn), v = player.v;
      const vx = v.x * c + v.z * sn, vz = -v.x * sn + v.z * c;
      v.x = vx; v.z = vz;
    }
    cam.lookIdle = 0.6; // 自動で回り込むのと取り合わない
    input.mx = 0;
  }
  input.yaw = cam.yaw;

  if (game.countdown > 0) {
    const before = Math.ceil(game.countdown - 0.5);
    game.countdown -= dt;
    const now = Math.ceil(game.countdown - 0.5);
    $('countdown').textContent = game.countdown > 0.5 ? now : 'GO!';
    if (now !== before) sfx.count(now <= 0);
    if (game.countdown <= 0) $('countdown').textContent = '';
    input.mx = input.mz = 0;
  } else {
    game.t += game.mode === 'mission' ? dt : 0;
  }
  heli.update(dt, player, cam.yaw, !!player.rope, Math.min(1, player.moveHold / 3));
  player.update(dt, input);
  updateOni(dt);
  if (game.state !== 'play') return;
  handleEvents(dt);

  // 輪
  if (game.mode === 'mission') {
    const cur = rings[game.ringIdx];
    const tt = clock.elapsedTime;
    rings.forEach((r, i) => {
      r.mesh.visible = !r.done && i <= game.ringIdx + 2;
      const now = i === game.ringIdx;
      // 次の玉は大きく脈打ち、ふわふわ上下する
      const pulse = now ? 1 + Math.sin(tt * 4) * 0.15 : 0.6;
      r.mesh.userData.orb.scale.setScalar(pulse);
      // 遠くからも見つけやすいよう、次の玉の光は離れるほど大きく
      const far = now ? Math.max(18, camera.position.distanceTo(r.pos) * 0.07) : 9;
      r.mesh.userData.halo.scale.setScalar(far * pulse);
      r.mesh.userData.halo.material.opacity = now ? 1 : 0.5;
      r.pos.y = r.base + Math.sin(tt * 2 + i) * 0.4;
    });
    if (cur) {
      // 玉にちゃんと触れたら通過 (体の上下2か所で、玉の半径 + 体の太さ以内)
      const touch = 2.6 * cur.mesh.userData.orb.scale.x + 0.7;
      const lo = player.p.clone(); lo.y += 0.5;
      const hi = player.p.clone(); hi.y += 1.6;
      if (lo.distanceTo(cur.pos) < touch || hi.distanceTo(cur.pos) < touch) {
        cur.done = true;
        game.ringIdx++;
        game.score += 500;
        sfx.ring();
        launchFireworks(5, true, 0.3); // 花火はチェックポイントを通過したときだけ
        flash(0.15);
        if (game.ringIdx >= rings.length) { finishMission(); return; }
        floater(`${cur.label} 通過！`, false);
        if (game.ringIdx % 2 === 0 && oni.addOne(player)) floater(`鬼が増えた！（${oni.list.length} 匹）`, false);
      }
    }
  }

  // カメラ: いつもプレイヤーの後ろから。動いている向きへ自動で回り込む (視点を動かした直後は少し待つ)
  const sp = player.v.length();
  const hsp = Math.hypot(player.v.x, player.v.z);
  cam.lookIdle += dt;
  if (hsp > 4 && cam.lookIdle > 0.6) {
    const ty = Math.atan2(-player.v.x, -player.v.z);
    const dyaw = Math.atan2(Math.sin(ty - cam.yaw), Math.cos(ty - cam.yaw));
    // 振り子の折り返しで真後ろに戻るときは追わない
    if (Math.abs(dyaw) < 2.4 || player.grounded) cam.yaw += dyaw * Math.min(1, dt * Math.min(4, hsp / 8));
  }
  player.camYaw = cam.yaw;
  game.maxSpeed = Math.max(game.maxSpeed, sp);
  const target = player.p.clone(); target.y += 1.7;
  const want = 6.5 + Math.min(4, sp * 0.05);
  cam.dist += (want - cam.dist) * Math.min(1, dt * 3);
  camForward(tmpD);
  const back = tmpD.clone().negate();
  const hit = city.raycast(target, back, cam.dist + 0.5);
  const d = hit ? Math.max(1.2, hit.t - 0.5) : cam.dist;
  cam.pos.copy(target).addScaledVector(back, d);
  cam.pos.y += 0.6;
  if (cam.pos.y < 0.5) cam.pos.y = 0.5;
  cam.shake = Math.max(0, cam.shake - dt * 2);
  if (cam.shake > 0) cam.pos.add(new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(cam.shake * 0.8));
  camera.position.copy(cam.pos);
  camera.lookAt(cam.pos.clone().add(tmpD));
  const fov = 72 + Math.min(26, Math.max(0, sp - 15) * 0.32);
  camera.fov += (fov - camera.fov) * Math.min(1, dt * 4);
  camera.updateProjectionMatrix();

  // 照準
  // つかめる位置にいたら知らせる
  const canGrab = !player.rope && heli.reachDist(player.hand()) <= REACH;
  $('groundTip').classList.toggle('hidden', !canGrab);
  $('groundTip').textContent = isTouch ? 'つかめる！ ロープ ボタンをタップ' : 'つかめる！ クリック';
  $('tRope').classList.toggle('ready', canGrab);
  $('tRope').textContent = player.rope ? 'はなす' : 'つかむ';

  // 影
  const f = city.floorAt(player.p.x, player.p.z, player.p.y + 0.1);
  blob.position.set(player.p.x, f.y + 0.06, player.p.z);
  const hgt = player.p.y - f.y;
  blob.scale.setScalar(Math.max(0.4, 1 - hgt / 60));
  blob.material.opacity = Math.max(0.08, 0.4 - hgt / 150);

  // 効果
  sfx.wind(sp);
  sfx.heli(heli.pos.distanceTo(camera.position));
  bgm.setEnergy(Math.min(1, sp / 70));
  const sv = Math.max(0, Math.min(1, (sp - 35) / 40));
  sl.style.opacity = sv * 0.6;
  sl.style.transform = `rotate(${Math.random() * 6}deg) scale(${1 + Math.random() * 0.05})`;

  // HUD
  $('spd').textContent = Math.round(sp * 3.6);
  $('alt').textContent = Math.round(player.p.y);
  $('score').textContent = Math.round(game.score).toLocaleString();
  $('combo').innerHTML = game.combo >= 2 ? `${game.combo}<small>COMBO ×${(1 + Math.min(game.combo, 30) * 0.25).toFixed(2)}</small>` : '';
  if (game.mode === 'mission') {
    $('timer').textContent = fmt(game.t);
    $('rings').textContent = `✦ ${game.ringIdx} / ${rings.length}`;
    const cur = rings[game.ringIdx];
    if (cur) {
      const dx = cur.pos.x - player.p.x, dz = cur.pos.z - player.p.z;
      const ang = Math.atan2(-dx, -dz) - cam.yaw;
      $('navArrow').style.transform = `rotate(${-ang}rad)`;
      const dy = cur.pos.y - player.p.y;
      $('navText').textContent = `${cur.label} ${Math.round(Math.hypot(dx, dz))}m ${dy > 8 ? '▲' : dy < -8 ? '▼' : ''}`;
    }
  } else {
    $('dex').textContent = `📖 ${dex.size} / ${DEX_ALL.length}`;
  }
  toastTimer -= dt;
  if (toastTimer <= 0) $('toast').classList.remove('show');
  areaCheck -= dt;
  if (areaCheck <= 0) {
    areaCheck = 0.5;
    let best = '', bd = 1100 * 1100;
    for (const [n, x, z] of AREA_XY) {
      const d = (x - player.p.x) ** 2 + (z - player.p.z) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    if (best && best !== lastArea) {
      lastArea = best;
      $('area').textContent = best;
      $('area').classList.add('show');
      areaTimer = 2.5;
    }
  }
  areaTimer -= dt;
  if (areaTimer <= 0) $('area').classList.remove('show');
  drawMinimap();
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  drawSpeedLines();
});

showScreen('title');
frame();
// テスト用 (コンソールから)
if (location.search.includes('debug')) window.dbg = { tileCache, game, player, city, cam, startGame, MISSIONS, FREE, rings: () => rings, heli, oni, fireworks, launchFireworks, tryFire, applyTod };
