// 東京ターザン: 進行・入力・カメラ・照準・ミッション・得点・図鑑・HUD
import * as THREE from '../vendor/three.module.min.js';
import { City, ll } from './city.js';
import { Player, P } from './player.js';
import { Sfx } from './audio.js';
import { MISSIONS, AREAS } from './missions.js';
import { addTokyoTower, addDiet, addSkytree, addFuji } from './landmarks.js';

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
  g.fillStyle = lit ? '#000' : (kind === 'glass' ? '#9fb3c8' : '#d8d4cc');
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const on = rnd() < (kind === 'glass' ? 0.45 : 0.35);
    if (lit) {
      if (!on) continue;
      const w = rnd();
      g.fillStyle = w < 0.6 ? '#ffd9a0' : w < 0.85 ? '#fff4dc' : '#bfe0ff';
    } else {
      const t = 0.75 + rnd() * 0.25;
      g.fillStyle = kind === 'glass' ? `rgb(${40 * t},${62 * t},${86 * t})` : `rgb(${70 * t},${82 * t},${96 * t})`;
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
const skytreeMat = addSkytree(scene);
addFuji(scene);
const sfx = new Sfx();
const player = new Player(scene, city, sfx);

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
// 照準の先の印
const marker = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.4, 24), new THREE.MeshBasicMaterial({ color: 0x39ff8a, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthTest: false, fog: false }));
marker.renderOrder = 10;
scene.add(marker);

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
const ringGeo = new THREE.TorusGeometry(11, 0.9, 10, 40);
const beamGeo = new THREE.CylinderGeometry(1.2, 1.2, 600, 8, 1, true);
beamGeo.translate(0, 300, 0);
let rings = [];
function clearRings() {
  for (const r of rings) { scene.remove(r.mesh); scene.remove(r.beam); }
  rings = [];
}
function setupRings(m) {
  clearRings();
  let prev = startPoint(m);
  m.rings.forEach(([x, z, label, hy], i) => {
    let y = hy, px = x, pz = z;
    if (y === undefined) {
      const mh = city.maxHeightNear(x, z, 120);
      y = THREE.MathUtils.clamp(mh * 0.55, 28, 110);
      [px, pz] = city.findOpenSpot(x, z, y);
    }
    const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffc53a, transparent: true, opacity: 0.9, fog: false }));
    mesh.position.set(px, y, pz);
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffc53a, transparent: true, opacity: 0.18, depthWrite: false, fog: false }));
    beam.position.set(px, 0, pz);
    scene.add(mesh); scene.add(beam);
    rings.push({ mesh, beam, label, pos: mesh.position, done: false });
    prev = [px, y, pz];
  });
  // 輪の向き: 前の輪から次の輪へ
  rings.forEach((r, i) => {
    const a = i > 0 ? rings[i - 1].pos : new THREE.Vector3(...startPoint(m));
    const b = rings[i + 1] ? rings[i + 1].pos : r.pos.clone().add(r.pos.clone().sub(a));
    const d = b.clone().sub(a); d.y *= 0.3;
    r.mesh.lookAt(r.pos.clone().add(d));
  });
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
const cam = { yaw: 0, pitch: -0.15, dist: 7, shake: 0, pos: new THREE.Vector3() };

function startGame(m) {
  sfx.resume();
  game.mission = m;
  game.mode = m === FREE ? 'free' : 'mission';
  game.t = 0; game.ringIdx = 0; game.score = 0; game.combo = 0; game.maxCombo = 0; game.groundT = 0;
  game.maxSpeed = 0; game.nice = 0; game.newDex = 0;
  const sp = startPoint(m);
  player.reset(...sp);
  game.lastSafe = sp;
  if (game.mode === 'mission') setupRings(m); else clearRings();
  // 最初の輪 (フリーなら東京タワー) の方を向く
  const tgt = rings[0] ? rings[0].pos : new THREE.Vector3(tower.pos[0], 150, tower.pos[1]);
  cam.yaw = Math.atan2(-(tgt.x - sp[0]), -(tgt.z - sp[2]));
  cam.pitch = -0.1;
  player.facing = cam.yaw;
  game.countdown = game.mode === 'mission' ? 3.5 : 0;
  game.state = 'play';
  showScreen(null);
  $('hud').classList.remove('hidden');
  $('touch').classList.toggle('hidden', !isTouch);
  $('rings').classList.toggle('hidden', game.mode !== 'mission');
  $('timer').classList.toggle('hidden', game.mode !== 'mission');
  $('nav').classList.toggle('hidden', game.mode !== 'mission');
  $('dex').classList.toggle('hidden', game.mode !== 'free');
  $('hint').textContent = isTouch ? '' : 'クリックで視点固定 ・ 左クリック: ロープ ・ Space: ぐいっ/ジャンプ ・ Shift: 巻く ・ R: やり直し ・ Esc: 一時停止';
  lastArea = '';
  lockPointer();
}

function showScreen(id) {
  for (const s of ['title', 'how', 'dexScreen', 'pause', 'result', 'loading']) $(s).classList.toggle('hidden', s !== id);
}

function finishMission() {
  game.state = 'result';
  sfx.finish();
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
    最高速度 ${Math.round(game.maxSpeed * 3.6)} km/h ／ ナイスリリース ${game.nice} 回<br>
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
const input = { mx: 0, mz: 0, reel: false, extend: false, yaw: 0 };
let ropeHeld = false;
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (game.state !== 'play') return;
  if (e.code === 'Space') { e.preventDefault(); actionJumpZip(); }
  if (e.code === 'KeyE') player.zip();
  if (e.code === 'KeyR') respawn();
  if (e.code === 'KeyM') sfx.setMuted(!sfx.muted);
  if (e.code === 'KeyP') pause();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
function actionJumpZip() {
  if (player.rope) player.zip();
  else player.jump();
}
const canvas = renderer.domElement;
function lockPointer() { if (!isTouch && canvas.requestPointerLock) try { canvas.requestPointerLock(); } catch (e) { /* 失敗してもドラッグで操作できる */ } }
function unlockPointer() { if (document.pointerLockElement) document.exitPointerLock(); }
let rightHeld = false;
canvas.addEventListener('mousedown', (e) => {
  if (game.state !== 'play') return;
  sfx.resume();
  if (!document.pointerLockElement) { lockPointer(); if (e.button !== 0) return; }
  if (e.button === 0) { ropeHeld = true; tryFire(); }
  if (e.button === 2) rightHeld = true;
});
addEventListener('mouseup', (e) => {
  if (e.button === 0 && ropeHeld) { ropeHeld = false; player.release(); }
  if (e.button === 2) rightHeld = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousemove', (e) => {
  if (game.state !== 'play') return;
  if (document.pointerLockElement === canvas || e.buttons) {
    cam.yaw -= e.movementX * 0.0024;
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
let touchReel = false;
holdBtn('tRope', () => { ropeHeld = true; tryFire(); }, () => { ropeHeld = false; player.release(); });
holdBtn('tZip', () => player.zip());
holdBtn('tJump', () => player.jump());
holdBtn('tReel', () => { touchReel = true; }, () => { touchReel = false; });
$('tPause').addEventListener('click', () => pause());

// ---------- 照準 ----------
const tmpO = new THREE.Vector3(), tmpD = new THREE.Vector3();
let aimHit = null;
function camForward(out) {
  const cp = Math.cos(cam.pitch);
  return out.set(-Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), -Math.cos(cam.yaw) * cp);
}
function castFrom(dir) {
  const hand = player.hand();
  const h = city.raycast(cam.pos, dir, cam.dist + P.ROPE_MAX + 20);
  if (!h) return null;
  const d = Math.hypot(h.x - hand.x, h.y - hand.y, h.z - hand.z);
  if (d > P.ROPE_MAX || d < 3) return null;
  return h;
}
// 照準の真ん中で当たらなければ、周りを少しずつ探す (上寄り)
const ASSIST = [];
for (const r of [0.05, 0.1, 0.16, 0.24]) for (let a = 0; a < 8; a++) {
  const ang = a / 8 * Math.PI * 2 + 0.3;
  ASSIST.push([Math.cos(ang) * r, Math.sin(ang) * r * 0.8 + r * 0.4]);
}
function findAim() {
  camForward(tmpD);
  let h = castFrom(tmpD);
  if (h) return h;
  const maxR = isTouch ? 0.24 : 0.16;
  const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
  const up = new THREE.Vector3().crossVectors(right, tmpD).normalize();
  for (const [ox, oy] of ASSIST) {
    if (Math.hypot(ox, oy) > maxR + 0.1) continue;
    const d = camForward(new THREE.Vector3()).addScaledVector(right, ox).addScaledVector(up, oy).normalize();
    h = castFrom(d);
    if (h) return h;
  }
  return null;
}
function tryFire() {
  if (game.state !== 'play' || game.countdown > 0) return;
  const h = aimHit;
  if (h) player.fire(h);
  else { sfx.miss(); floater('とどかない', false); }
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

// ミニマップ (街全体を一度だけ描いておき、回して切り出す)
const MM_SCALE = 0.25; // px / m
const mmBase = document.createElement('canvas');
mmBase.width = Math.ceil((city.maxX - city.minX + 800) * MM_SCALE);
mmBase.height = Math.ceil((city.maxZ - city.minZ + 800) * MM_SCALE);
const MMX = city.minX - 400, MMZ = city.minZ - 400;
{
  const g = mmBase.getContext('2d');
  g.fillStyle = '#2c3b2a';
  g.fillRect(0, 0, mmBase.width, mmBase.height);
  g.strokeStyle = '#d08a3a';
  g.lineWidth = 3;
  for (const s of city.roadSegs) {
    g.beginPath();
    g.moveTo((s.x1 - MMX) * MM_SCALE, (s.z1 - MMZ) * MM_SCALE);
    g.lineTo((s.x2 - MMX) * MM_SCALE, (s.z2 - MMZ) * MM_SCALE);
    g.stroke();
  }
  for (const bd of city.bld) {
    if (bd.h < 4) continue;
    const c = Math.min(255, 110 + bd.h * 0.8);
    g.fillStyle = `rgb(${c},${c},${Math.min(255, c + 20)})`;
    g.beginPath();
    for (let i = 0; i < bd.n; i++) {
      const x = (bd.pts[i * 2] - MMX) * MM_SCALE, z = (bd.pts[i * 2 + 1] - MMZ) * MM_SCALE;
      if (i) g.lineTo(x, z); else g.moveTo(x, z);
    }
    g.fill();
  }
}
const mm = $('minimap').getContext('2d');
function drawMinimap() {
  const W = 200, R = 100;
  mm.save();
  mm.clearRect(0, 0, W, W);
  mm.beginPath(); mm.arc(R, R, R, 0, Math.PI * 2); mm.clip();
  mm.fillStyle = '#2c3b2a'; mm.fillRect(0, 0, W, W);
  mm.translate(R, R);
  mm.rotate(cam.yaw);
  const z = 1.3; // 拡大
  mm.scale(z, z);
  const px = (player.p.x - MMX) * MM_SCALE, pz = (player.p.z - MMZ) * MM_SCALE;
  mm.drawImage(mmBase, -px, -pz);
  const dot = (x, zz, c, r) => { mm.fillStyle = c; mm.beginPath(); mm.arc((x - MMX) * MM_SCALE - px, (zz - MMZ) * MM_SCALE - pz, r, 0, Math.PI * 2); mm.fill(); };
  if (game.mode === 'mission') rings.forEach((r, i) => { if (!r.done) dot(r.pos.x, r.pos.z, i === game.ringIdx ? '#ffc53a' : 'rgba(255,197,58,0.45)', i === game.ringIdx ? 5 : 3); });
  else for (const k of dexTargets) if (!dex.has(k.key)) dot(k.x, k.z, '#ff5ad1', 2.5);
  dot(tower.pos[0], tower.pos[1], '#ff4b14', 3);
  mm.restore();
  // 自分 (上向きの三角)
  mm.fillStyle = '#39ff8a';
  mm.beginPath(); mm.moveTo(R, R - 8); mm.lineTo(R - 6, R + 6); mm.lineTo(R + 6, R + 6); mm.fill();
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
      game.combo++;
      game.maxCombo = Math.max(game.maxCombo, game.combo);
      const pts = 50 * game.combo;
      game.score += pts;
      if (game.combo >= 2) sfx.combo(game.combo);
      const bd = e.bd;
      if (bd && bd.name) {
        const key = dexKey(bd.name);
        if (!dex.has(key)) {
          dex.add(key);
          store.set('dex', [...dex]);
          game.newDex++;
          game.score += 1000;
          sfx.collect();
          toast(`📖 図鑑に登録！ ${bd.name}（${Math.round(bd.h)}m） ${dex.size}/${DEX_ALL.length}`, true);
          updateDexCount();
        } else toast(`🏢 ${bd.name}（${Math.round(bd.h)}m）`);
      } else if (bd && bd.plateau) toast(`ビル 高さ ${Math.round(bd.h)}m`);
    } else if (e.type === 'release' && e.nice) {
      game.nice++;
      game.score += 200 * mult();
      floater('ナイスリリース！', true);
    } else if (e.type === 'zip') {
      // 何もしない (音だけ)
    } else if (e.type === 'land') {
      if (e.what === 'ground') endCombo();
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
  endCombo();
  floater('やり直し', false);
}

function pause() {
  if (game.state !== 'play') return;
  game.state = 'pause';
  ropeHeld = false;
  player.release();
  showScreen('pause');
}
$('resumeBtn').onclick = () => { game.state = 'play'; showScreen(null); lockPointer(); };
$('retryBtn').onclick = () => startGame(game.mission);
$('quitBtn').onclick = () => toTitle();
$('resRetry').onclick = () => startGame(game.mission);
$('resQuit').onclick = () => toTitle();
function toTitle() {
  game.state = 'title';
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

// ---------- ループ ----------
const clock = new THREE.Clock();
let menuT = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
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
  input.reel = keys.ShiftLeft || keys.ShiftRight || rightHeld || touchReel;
  input.extend = keys.KeyQ || keys.ControlLeft;
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
  player.update(dt, input);
  if (ropeHeld === false && player.rope) player.release();
  handleEvents(dt);

  // 輪
  if (game.mode === 'mission') {
    const cur = rings[game.ringIdx];
    rings.forEach((r, i) => {
      r.mesh.visible = !r.done && i <= game.ringIdx + 2;
      r.beam.visible = i === game.ringIdx;
      r.mesh.material.opacity = i === game.ringIdx ? 0.95 : 0.4;
      if (i === game.ringIdx) r.mesh.rotation.z += dt * 0.8;
    });
    if (cur) {
      const c = player.p.clone(); c.y += 1;
      if (c.distanceTo(cur.pos) < 13) {
        cur.done = true;
        game.ringIdx++;
        game.score += 500;
        sfx.ring();
        flash(0.15);
        if (game.ringIdx >= rings.length) { finishMission(); return; }
        floater(`${cur.label} 通過！`, false);
      }
    }
  }

  // カメラ
  const sp = player.v.length();
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
  aimHit = player.shot ? null : findAim();
  $('crosshair').classList.toggle('ok', !!aimHit && !player.rope);
  if (aimHit && !player.rope) {
    marker.visible = true;
    marker.position.set(aimHit.x, aimHit.y, aimHit.z).addScaledVector(new THREE.Vector3(aimHit.nx, aimHit.ny, aimHit.nz), 0.3);
    marker.lookAt(marker.position.clone().add(new THREE.Vector3(aimHit.nx, aimHit.ny, aimHit.nz)));
    const s = Math.max(1, cam.pos.distanceTo(marker.position) / 25);
    marker.scale.setScalar(s);
  } else if (player.rope) {
    marker.visible = true;
    marker.position.copy(player.rope.a);
  } else marker.visible = false;

  // 影
  const f = city.floorAt(player.p.x, player.p.z, player.p.y + 0.1);
  blob.position.set(player.p.x, f.y + 0.06, player.p.z);
  const hgt = player.p.y - f.y;
  blob.scale.setScalar(Math.max(0.4, 1 - hgt / 60));
  blob.material.opacity = Math.max(0.08, 0.4 - hgt / 150);

  // 効果
  sfx.wind(sp);
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
    $('rings').textContent = `◎ ${game.ringIdx} / ${rings.length}`;
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
if (location.search.includes('debug')) window.dbg = { game, player, city, cam, startGame, MISSIONS, FREE, rings: () => rings, hold: (v) => { ropeHeld = v; }, applyTod };
