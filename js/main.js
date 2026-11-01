// ターザン大東京: 進行・入力・カメラ・照準・ミッション・得点・図鑑・HUD
import * as THREE from '../vendor/three.module.min.js';
import { City, ll } from './city.js';
import { ROADS } from './road-data.js';
import { mergeStatic, splitByCell, cullPieces } from './merge.js';
import { Player, P } from './player.js';
import { Sfx, Bgm } from './audio.js';
import { MISSIONS, AREAS, FAMOUS, ONI_BASE_DENSITY, ONI_STEP } from './missions.js';
import { Fireworks } from './fireworks.js';
import { Heli } from './heli.js';
import { addSensoji, addAsahi, addUeno, addOchanomizu, addTokyoStation, addAkasaka, addRailways, addAkibaSigns, addNewOtani, addShibuyaRoppongi, addShinjuku, addYotsuyaKudan, addIkebukuroShinagawa, addUenoAsakusa, addOdaiba, addGinzaNihonbashi } from './landmarks2.js';
import { Oni, CATCH_RADIUS } from './oni.js';
import { CITY } from './city-data.js';
import { WATER } from './water-data.js';
import { LANG, setLang, t, tr, nm, applyStatic } from './i18n.js';
import { addTokyoTower, addDiet, addSkytree, addFuji, addDistant, BAY, addTechGym, addTokyoDome, addBudokan, addImperialPalace, addTogu, addPalaceGates } from './landmarks.js';

const $ = (id) => document.getElementById(id);
applyStatic();
// ステージ名・説明 (英語のときは英語)
const mt = (m) => (LANG === 'en' && m.en ? m.en.title : m.title);
const ms = (m) => (LANG === 'en' && m.en ? m.en.sub : m.sub);
// 結果のシェアに付ける紹介記事の URL
const SHARE_URL = 'https://techgym.jp/column/claude-code-game-tarzan/';
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
// Android アプリ (Capacitor) で動いているか。Web 版では Capacitor がないので何もしない
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const plugin = (name) => (NATIVE && window.Capacitor.Plugins ? window.Capacitor.Plugins[name] : null);
const Ads = window.Ads || { available: false, canReward: false, showing: false, privacyOptionsRequired: false, initDone: Promise.resolve(),
  showInterstitial: async () => {}, showRewarded: async () => 'unavailable', setBanner: () => {}, showPrivacyOptions: async () => {} };
if (NATIVE) document.body.classList.add('app');
const store = {
  get(k, d) { try { const v = localStorage.getItem('tarzan.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('tarzan.' + k, JSON.stringify(v)); } catch (e) { /* 保存できなくても遊べる */ } },
};

// ---------- 描画の準備 ----------
const renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance', stencil: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.25 : 2));
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
sky.renderOrder = -3;
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
// 描画する範囲 (カメラからの半径 m)。スマホは狭く。もやの終わりもこれに合わせる (境目が見えないように)
const DRAW_R = isTouch ? 1700 : 3400;
city.buildRoads(scene);
const lmStart = scene.children.length;
const tower = addTokyoTower(scene, city);
addDiet(scene, city);
const noMergeFrom = scene.children.length;
const techgym = addTechGym(scene, city);
const dome = addTokyoDome(scene, city);
for (const o of scene.children.slice(noMergeFrom)) o.userData.noMerge = true; // 夜に光る・アドバルーンが揺れる
const budokan = addBudokan(scene, city);
const palace = addImperialPalace(scene, city);
const togu = addTogu(scene, city);
const gates = addPalaceGates(scene, city);
const sensoji = addSensoji(scene, city);
const asahi = addAsahi(scene, city);
const ueno = addUeno(scene, city);
const ocha = addOchanomizu(scene, city);
const tstation = addTokyoStation(scene, city);
const akasaka = addAkasaka(scene, city);
const rails = addRailways(scene, city);
const akiba = addAkibaSigns(scene, city);
const otani = addNewOtani(scene, city);
const sr = addShibuyaRoppongi(scene, city);
const sj = addShinjuku(scene, city);
const yk = addYotsuyaKudan(scene, city);
const ik = addIkebukuroShinagawa(scene, city);
const ua = addUenoAsakusa(scene, city);
const od = addOdaiba(scene, city);
const gn = addGinzaNihonbashi(scene, city);
// 東京タワーは夜に色が変わるのでまとめない
for (const o of scene.children.slice(lmStart, lmStart + 1)) o.userData.noMerge = true;
const merged = mergeStatic(scene, scene.children.slice(lmStart));
const skytreeMat = addSkytree(scene);
const fuji = addFuji(scene);
const distant = addDistant(scene);
const sfx = new Sfx();
const bgm = new Bgm(sfx);
// 広告の表示中や別のアプリに切り替えたときは音を止める (js/ads.js からも呼ぶ)
window.GameAudio = {
  suspend() { if (sfx.ctx && sfx.ctx.state === 'running') sfx.ctx.suspend(); },
  resume() { if (sfx.ctx && sfx.ctx.state === 'suspended') sfx.ctx.resume(); },
};
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
for (const [name, x, y, z] of [['東京タワー', tower.pos[0], 345, tower.pos[1]], ['国会議事堂', dietXZ[0], 75, dietXZ[1]], ['テックジム東京本校', techgym.pos[0], 196, techgym.pos[1]], ['東京ドーム', dome.pos[0], 72, dome.pos[1]], ['日本武道館', budokan.pos[0], 60, budokan.pos[1]], ['皇居（宮殿）', palace.pos[0], 40, palace.pos[1]], ['江戸城 天守台', palace.tenshu[0], 30, palace.tenshu[1]], ['東宮御所', togu.pos[0], 36, togu.pos[1]], ['桜田門', gates.sakurada[0], 30, gates.sakurada[1]], ['半蔵門', gates.hanzo[0], 22, gates.hanzo[1]], ['浅草寺 本堂', sensoji.pos[0], 40, sensoji.pos[1]], ['浅草寺 五重塔', sensoji.pagoda[0], 62, sensoji.pagoda[1]], ['雷門', sensoji.kaminari[0], 20, sensoji.kaminari[1]], ['アサヒの金の炎', asahi.pos[0], 52, asahi.pos[1]], ['アサヒビールタワー', asahi.tower[0], asahi.tower[2] + 16, asahi.tower[1]], ['西郷隆盛像', ueno.saigo[0], 12, ueno.saigo[1]], ['不忍池 弁天堂', ueno.benten[0], 22, ueno.benten[1]], ['上野動物園', ...ll(35.71640, 139.77130).flatMap((v, i) => (i ? [v] : [v, 45]))], ['ニコライ堂', ocha.nikolai[0], 48, ocha.nikolai[1]], ['神田明神', ocha.kanda[0], 28, ocha.kanda[1]], ['聖橋', ocha.hijiri[0], 26, ocha.hijiri[1]], ['将門塚', ocha.masakado[0], 8, ocha.masakado[1]], ['東京駅 丸の内駅舎', tstation.pos[0], 48, tstation.pos[1]], ['日枝神社', akasaka.hie[0], 26, akasaka.hie[1]], ['豊川稲荷', akasaka.toyokawa[0], 22, akasaka.toyokawa[1]], ['秋葉原駅', ...ll(35.69840, 139.77310).flatMap((v, i) => (i ? [v] : [v, 50]))], ['御茶ノ水駅', ...ll(35.69950, 139.76470).flatMap((v, i) => (i ? [v] : [v, 30]))], ['マーチエキュート神田万世橋', rails.manseibashi[0], 18, rails.manseibashi[1]], ['秋葉原 電気街', akiba.pos[0], 72, akiba.pos[1]], ['ホテルニューオータニ ザ・メイン', otani.pos[0], 88, otani.pos[1]], ['SHIBUYA109', sr.s109[0], 66, sr.s109[1]], ['スクランブル交差点', sr.scramble[0], 14, sr.scramble[1]], ['ハチ公像', sr.hachiko[0], 6, sr.hachiko[1]], ['国立代々木競技場', sr.yoyogi[0], 52, sr.yoyogi[1]], ['国立新美術館', sr.nact[0], 34, sr.nact[1]], ['麻布台ヒルズ 森JPタワー', sr.azabudai[0], 345, sr.azabudai[1]], ['東急歌舞伎町タワー', sj.kabukichoTower[0], 240, sj.kabukichoTower[1]], ['新宿東宝ビル', sj.toho[0], 150, sj.toho[1]], ['歌舞伎町一番街', sj.ichibangai[0], 16, sj.ichibangai[1]], ['ゴールデン街', sj.goldenGai[0], 14, sj.goldenGai[1]], ['花園神社', sj.hanazono[0], 22, sj.hanazono[1]], ['思い出横丁', sj.omoide[0], 14, sj.omoide[1]], ['NTTドコモ代々木ビル', sj.docomo[0], 252, sj.docomo[1]], ['須賀神社', yk.suga[0], 20, yk.suga[1]], ['防衛省', yk.mod[0], yk.mod[2] + 100, yk.mod[1]], ['靖国神社', yk.yasukuni[0], 30, yk.yasukuni[1]], ['靖国神社 大鳥居', yk.yasukuniTorii[0], 36, yk.yasukuniTorii[1]], ['護国寺', ik.gokokuji[0], 34, ik.gokokuji[1]], ['銀座 和光', gn.wako[0], 58, gn.wako[1]], ['銀座四丁目交差点', gn.crossing[0], 10, gn.crossing[1]], ['歌舞伎座', gn.kabukiza[0], 30, gn.kabukiza[1]], ['GINZA SIX', gn.six[0], 70, gn.six[1]], ['日本橋', gn.nihonbashi[0], 12, gn.nihonbashi[1]], ['日本橋三越本店', gn.mitsukoshi[0], 46, gn.mitsukoshi[1]], ['三井本館', gn.mitsui[0], 42, gn.mitsui[1]], ['日本銀行本店', gn.boj[0], 38, gn.boj[1]], ['築地本願寺', gn.hongwanji[0], 42, gn.hongwanji[1]], ['レインボーブリッジ', od.rainbow[0], 140, od.rainbow[1]], ['フジテレビ本社ビル', od.fujitv[0], 136, od.fujitv[1]], ['自由の女神像', od.liberty[0], 24, od.liberty[1]], ['国立西洋美術館', ua.nmwa[0], 24, ua.nmwa[1]], ['東京文化会館', ua.bunka[0], 28, ua.bunka[1]], ['国立科学博物館', ua.kahaku[0], 34, ua.kahaku[1]], ['SL（D51）', ua.sl[0], 10, ua.sl[1]], ['シロナガスクジラ', ua.whale[0], 14, ua.whale[1]], ['上野東照宮', ua.toshogu[0], 18, ua.toshogu[1]], ['清水観音堂', ua.kiyomizu[0], 18, ua.kiyomizu[1]], ['上野の森美術館', ua.uenonomori[0], 20, ua.uenonomori[1]], ['東京国立博物館', ua.tnm[0], 36, ua.tnm[1]], ['仲見世通り', ua.nakamise[0], 12, ua.nakamise[1]], ['浅草花やしき', ua.hanayashiki[0], 54, ua.hanayashiki[1]], ['浅草文化観光センター', ua.atic[0], 50, ua.atic[1]], ['吾妻橋', ua.azumabashi[0], 10, ua.azumabashi[1]], ['御徒町駅', rails.stations['御徒町駅'][0], 28, rails.stations['御徒町駅'][1]], ['アメ横', rails.stations['アメ横'][0], 14, rails.stations['アメ横'][1]], ['雑司が谷 鬼子母神', ik.kishimojin[0], 18, ik.kishimojin[1]], ['泉岳寺', ik.sengakuji[0], 24, ik.sengakuji[1]], ['高輪ゲートウェイ駅', ik.takanawa[0], 40, ik.takanawa[1]], ['高田馬場駅', rails.stations['高田馬場駅'][0], 22, rails.stations['高田馬場駅'][1]], ['目白駅', rails.stations['目白駅'][0], 22, rails.stations['目白駅'][1]], ['池袋駅', rails.stations['池袋駅'][0], 22, rails.stations['池袋駅'][1]], ['大塚駅', rails.stations['大塚駅'][0], 22, rails.stations['大塚駅'][1]], ['田町駅', rails.stations['田町駅'][0], 22, rails.stations['田町駅'][1]], ['品川駅', rails.stations['品川駅'][0], 22, rails.stations['品川駅'][1]], ['水道橋駅', rails.stations['水道橋駅'][0], 22, rails.stations['水道橋駅'][1]], ['飯田橋駅', rails.stations['飯田橋駅'][0], 22, rails.stations['飯田橋駅'][1]], ['市ケ谷駅', rails.stations['市ケ谷駅'][0], 22, rails.stations['市ケ谷駅'][1]], ['四ツ谷駅', rails.stations['四ツ谷駅'][0], 22, rails.stations['四ツ谷駅'][1]], ['信濃町駅', rails.stations['信濃町駅'][0], 22, rails.stations['信濃町駅'][1]], ['千駄ケ谷駅', rails.stations['千駄ケ谷駅'][0], 22, rails.stations['千駄ケ谷駅'][1]], ['代々木駅', rails.stations['代々木駅'][0], 22, rails.stations['代々木駅'][1]], ['新宿駅', rails.stations['新宿駅'][0], 22, rails.stations['新宿駅'][1]], ['浅草橋駅', rails.stations['浅草橋駅'][0], 22, rails.stations['浅草橋駅'][1]]]) {
  const sp = labelSprite(nm(name));
  sp.position.set(x, y, z);
  scene.add(sp);
  labels.push({ sp, x, z });
}
for (const bd of city.bld) {
  if (!bd.famous) continue;
  if (labels.some((l) => l.text === bd.name)) continue;
  const sp = labelSprite(nm(bd.name));
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
  // 皇居前広場: 砂利の広場を、砂利道で区切った芝生の区画に
  const [PX0, PZ0] = ll(35.6832, 139.7556), [PX1, PZ1] = ll(35.6784, 139.7604);
  g.fillStyle = '#d3ccba';
  g.fillRect((PX0 - GB.x0) * gsx, (PZ0 - GB.z0) * gsz, (PX1 - PX0) * gsx, (PZ1 - PZ0) * gsz);
  g.fillStyle = '#5f7a4c';
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
    const cw = (PX1 - PX0) / 3, ch = (PZ1 - PZ0) / 4;
    g.fillRect((PX0 + i * cw + 14 - GB.x0) * gsx, (PZ0 + j * ch + 14 - GB.z0) * gsz, (cw - 28) * gsx, (ch - 28) * gsz);
  }
  // 水面 (皇居のお濠・庭園の池・川・運河)。穴 (中島) は抜く
  g.fillStyle = '#3d6f80';
  for (const poly of WATER) {
    g.beginPath();
    for (const ring of poly) {
      for (let i = 0; i < ring.length; i += 2) {
        const x = (ring[i] / 2 - GB.x0) * gsx, z = (ring[i + 1] / 2 - GB.z0) * gsz;
        if (i) g.lineTo(x, z); else g.moveTo(x, z);
      }
      g.closePath();
    }
    g.fill('evenodd');
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
// 東京湾の所は地面に穴をあける (下に描く海が見えるように)
{
  const g = groundCanvas.getContext('2d');
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  BAY.forEach(([la, lo], i) => { const [x, z] = ll(la, lo); const cx = (x - GB.x0) * gsx, cy = (z - GB.z0) * gsz; if (i) g.lineTo(cx, cy); else g.moveTo(cx, cy); });
  g.fill();
  g.globalCompositeOperation = 'source-over';
}
const groundTex = new THREE.CanvasTexture(groundCanvas);
groundTex.colorSpace = THREE.SRGBColorSpace;
groundTex.anisotropy = 8;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(GB.x1 - GB.x0, GB.z1 - GB.z0), new THREE.MeshLambertMaterial({ map: groundTex, alphaTest: 0.5 }));
ground.rotation.x = -Math.PI / 2;
ground.position.set((GB.x0 + GB.x1) / 2, 0, (GB.z0 + GB.z1) / 2);
scene.add(ground);
// 水面: お濠や川は道より低い。水の形の穴を地面にあけ (ステンシル)、沈めた水面と石垣の壁を描く
// 深さ: ふつう 2.5m、皇居のお濠のあたりは約5m、お茶の水の神田川の谷は約10m
const waterDepth = (x, z) => {
  const [ox, oz] = ll(35.70000, 139.76300), [px, pz] = ll(35.68520, 139.75280);
  return 2.5 + 7.5 * Math.exp(-(((x - ox) ** 2 + (z - oz) ** 2) / 600 ** 2)) + 2.5 * Math.exp(-(((x - px) ** 2 + (z - pz) ** 2) / 1300 ** 2));
};
{
  const pos = [], wall = [], mask = [], edges = [];
  const toV = (ring) => { const v = []; for (let i = 0; i < ring.length; i += 2) v.push(new THREE.Vector2(ring[i] / 2, ring[i + 1] / 2)); return v; };
  for (const poly of WATER) {
    const outer = toV(poly[0]);
    const holes = poly.slice(1).map(toV);
    let tris;
    try { tris = THREE.ShapeUtils.triangulateShape(outer, holes); } catch (e) { continue; }
    const all = outer.concat(...holes);
    for (const [a, b, c] of tris) {
      const A = all[a], B = all[b], C = all[c];
      // 上向きの面になるように並べる
      const ny = (B.y - A.y) * (C.x - A.x) - (B.x - A.x) * (C.y - A.y);
      const tri = ny >= 0 ? [A, B, C] : [A, C, B];
      for (const p of tri) { pos.push(p.x, -waterDepth(p.x, p.y) + 0.4, p.y); mask.push(p.x, 0.02, p.y); }
    }
    edges.push(outer, ...holes);
  }
  const geo = (arr) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); return g; };
  // 1) 水の形をステンシルに書く (色も深さも書かない)。地面より先に描く
  splitByCell(scene, geo(mask), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp }), (m) => { m.renderOrder = -1; });
  // 2) 沈めた水面と石垣
  splitByCell(scene, geo(pos), new THREE.MeshPhongMaterial({ color: 0x3e6f84, specular: 0x8899aa, shininess: 60 }));
  const sc = document.createElement('canvas');
  sc.width = 128; sc.height = 64;
  ((c, w, h) => {
    c.fillStyle = '#8f8b80';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(50,45,40,0.45)';
    c.lineWidth = 2;
    for (let y = 0; y < h; y += 16) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
      for (let x = (y / 16) % 2 ? 0 : 16; x < w; x += 32) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 16); c.stroke(); }
    }
  })(sc.getContext('2d'), 128, 64);
  const stoneTex = new THREE.CanvasTexture(sc);
  stoneTex.colorSpace = THREE.SRGBColorSpace;
  stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;
  const stoneMat = new THREE.MeshLambertMaterial({ map: stoneTex, side: THREE.DoubleSide });
  // 3) 地面はステンシルが 1 (水) の所には描かない
  Object.assign(ground.material, { stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilZPass: THREE.KeepStencilOp, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp });
  // 当たり判定: 水の上は床が水面の高さ (お濠や川に落ちられる)
  const WC = 64, wgrid = new Map();
  const rings = WATER.map((poly) => poly.map((r) => { const a = new Float32Array(r.length); for (let i = 0; i < r.length; i++) a[i] = r[i] / 2; return a; }));
  rings.forEach((poly, pi) => {
    const r = poly[0];
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); z0 = Math.min(z0, r[i + 1]); z1 = Math.max(z1, r[i + 1]); }
    for (let gx = Math.floor(x0 / WC); gx <= Math.floor(x1 / WC); gx++) for (let gz = Math.floor(z0 / WC); gz <= Math.floor(z1 / WC); gz++) {
      const k = gx + ',' + gz;
      if (!wgrid.has(k)) wgrid.set(k, []);
      wgrid.get(k).push(pi);
    }
  });
  const inRing = (r, x, z) => {
    let c = false;
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      if ((r[i + 1] > z) !== (r[j + 1] > z) && x < (r[j] - r[i]) * (z - r[i + 1]) / (r[j + 1] - r[i + 1]) + r[i]) c = !c;
    }
    return c;
  };
  city.waterAt = (x, z) => {
    const l = wgrid.get(Math.floor(x / WC) + ',' + Math.floor(z / WC));
    if (l) for (const pi of l) {
      const poly = rings[pi];
      if (inRing(poly[0], x, z) && !poly.slice(1).some((h) => inRing(h, x, z))) return waterDepth(x, z) - 0.4;
    }
    return 0;
  };
  // 岸の壁 (水面から道の高さまで)。タイルの境目で切れた水どうしの継ぎ目 (両側とも水) には立てない
  for (const ring of edges) {
    for (let k = 0; k < ring.length; k++) {
      const A = ring[k], B = ring[(k + 1) % ring.length];
      const L = Math.hypot(B.x - A.x, B.y - A.y);
      if (L < 0.01) continue;
      const mx = (A.x + B.x) / 2, mz = (A.y + B.y) / 2, nx = (B.y - A.y) / L * 1.5, nz = -(B.x - A.x) / L * 1.5;
      if (city.waterAt(mx + nx, mz + nz) > 0 && city.waterAt(mx - nx, mz - nz) > 0) continue;
      const da = -waterDepth(A.x, A.y), db = -waterDepth(B.x, B.y);
      wall.push(A.x, da, A.y, B.x, db, B.y, B.x, 0.02, B.y, A.x, da, A.y, B.x, 0.02, B.y, A.x, 0.02, A.y);
    }
  }
  const wg = geo(wall);
  // 壁の UV: 横は長さ、縦は高さ (石の大きさをそろえる)
  const uv = [];
  for (let i = 0; i < wall.length; i += 18) {
    const L = Math.hypot(wall[i + 3] - wall[i], wall[i + 5] - wall[i + 2]) / 4;
    const ha = wall[i + 1] / 2, hb = wall[i + 4] / 2;
    uv.push(0, ha, L, hb, L, 0, 0, ha, L, 0, 0, 0);
  }
  wg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  splitByCell(scene, wg, stoneMat);
}
// 幹線道路 (国道・都道・幅の広い区道): 地面の上にアスファルトの帯と、広い道には白い中央線
{
  const pos = [], col = [];
  const asphalt = [0.36, 0.37, 0.39], white = [0.92, 0.92, 0.9];
  const strip = (x1, z1, x2, z2, w, y, c) => {
    const L = Math.hypot(x2 - x1, z2 - z1);
    if (L < 0.1) return;
    const ux = (x2 - x1) / L, uz = (z2 - z1) / L;
    const lx = uz * w / 2, lz = -ux * w / 2;
    const ex = ux * w * 0.35, ez = uz * w * 0.35; // 曲がり角の隙間を埋める
    const A = [x1 + lx - ex, y, z1 + lz - ez], B = [x1 - lx - ex, y, z1 - lz - ez], C = [x2 - lx + ex, y, z2 - lz + ez], D = [x2 + lx + ex, y, z2 + lz + ez];
    pos.push(...A, ...B, ...C, ...A, ...C, ...D);
    for (let k = 0; k < 6; k++) col.push(...c);
  };
  for (const r of ROADS) {
    const w = r[0];
    for (let i = 1; i + 3 < r.length; i += 2) {
      const x1 = r[i] / 2, z1 = r[i + 1] / 2, x2 = r[i + 2] / 2, z2 = r[i + 3] / 2;
      // 水の上は描かない (高架の道や海底トンネルが水面に線を引かないように。お濠や川の橋は水面のデータに入っていない)
      if (city.waterAt((x1 + x2) / 2, (z1 + z2) / 2) > 0) continue;
      strip(x1, z1, x2, z2, w, 0.05, asphalt);
      if (w >= 16) strip(x1, z1, x2, z2, 0.45, 0.07, white);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  splitByCell(scene, g, new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
}
const outer = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.MeshLambertMaterial({ color: 0x5f7a4c }));
outer.rotation.x = -Math.PI / 2;
outer.position.y = -0.3;
// 街の外の地面と海は、空のすぐ後に深さを書かずに描く (遠くでちらつかないように)
outer.material.depthWrite = false;
outer.renderOrder = -2;
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
    if (img[i + 1] > img[i] + 12 && city.floorAt(x, z, 1e9).y === 0) pts.push([x, z, rnd()]); // 建物 (宮殿など) の上には植えない
  }
  // 皇居前広場の芝生には黒松をたくさん
  const [QX0, QZ0] = ll(35.6832, 139.7556), [QX1, QZ1] = ll(35.6784, 139.7604);
  const inPlaza = (x, z) => x > QX0 && x < QX1 && z > QZ0 && z < QZ1;
  for (let k = 0; k < 1500; k++) {
    const x = QX0 + rnd() * (QX1 - QX0), z = QZ0 + rnd() * (QZ1 - QZ0);
    const i = (Math.floor((z - GB.z0) * gsz) * GW + Math.floor((x - GB.x0) * gsx)) * 4;
    if (img[i + 1] > img[i] + 12) pts.push([x, z, rnd()]);
  }
  const crown = new THREE.IcosahedronGeometry(1, 0);
  crown.translate(0, 1.6, 0);
  // 木は 1 本ずつ形を作って、500m 四方の区画ごとにまとめる (画面の外や遠くの区画の木は描かない)。スマホは本数を減らす
  const cp = crown.toNonIndexed().attributes.position, cn = crown.toNonIndexed().attributes.normal;
  const keep = isTouch ? 0.6 : 1;
  const P = [], N = [], C = [];
  const m4 = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3(), n = new THREE.Vector3(), col = new THREE.Color();
  pts.forEach(([x, z, r], i) => {
    if (keep < 1 && (i * 0.618) % 1 > keep) return;
    const sc = 4 + r * 5;
    if (inPlaza(x, z)) {
      // 黒松: 平たく横に広がった濃い緑
      m4.makeScale(sc * 0.9, sc * 0.55, sc * 0.9).setPosition(x, 1.5, z);
      col.setHSL(0.33, 0.35, 0.16 + r * 0.05);
    } else {
      m4.makeScale(sc, sc * 1.1, sc).setPosition(x, 0, z);
      if (r < 0.12) col.setHex(0xe0b52a); else if (r < 0.18) col.setHex(0xc4512c); else col.setHSL(0.27 + r * 0.06, 0.45, 0.22 + r * 0.1);
    }
    nm.getNormalMatrix(m4);
    for (let k = 0; k < cp.count; k++) {
      v.fromBufferAttribute(cp, k).applyMatrix4(m4); n.fromBufferAttribute(cn, k).applyMatrix3(nm).normalize();
      P.push(v.x, v.y, v.z); N.push(n.x, n.y, n.z); C.push(col.r, col.g, col.b);
    }
  });
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  tg.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  tg.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  splitByCell(scene, tg, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
}

// 影 (足元の丸)
// 影: 床と重なってちらつかないよう、深さを手前にずらして描く (高く落ちているときはカメラから遠いので特に)
const blob = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
blob.renderOrder = 1;
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
  scene.fog.far = Math.min(t.fogFar, DRAW_R);
  distant.setTod(k, t.fog);
  fuji.setTod(k);
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
  dome.setNight(k);
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
  $('dexCount').textContent = t('dexCount', { n: dex.size, total: DEX_ALL.length });
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
// 点 (x, z) から多角形の辺までの距離
function edgeDist(bd, x, z) {
  const P = bd.pts, n = bd.n;
  let best = 1e9;
  for (let i = 0; i < n; i++) {
    const ax = P[i * 2], az = P[i * 2 + 1], j = (i + 1) % n;
    const ex = P[j * 2] - ax, ez = P[j * 2 + 1] - az;
    const L2 = ex * ex + ez * ez || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L2));
    best = Math.min(best, Math.hypot(x - ax - ex * t, z - az - ez * t));
  }
  return best;
}
// チェックポイントの玉を置く点: 屋上 bd の上で、もっと高い建物 (隣の高層部・塔・屋上の設備) の中でも
// その壁際でもなく、屋上のふちからも離れた所。PLATEAU では1つのビルが高さ違いの建物に分かれて重なっていることがあり、
// 屋上の真ん中が高い方の建物に埋まってしまうため。戻り値: [x, z, 玉の下の屋上の高さ]
function orbSpot(bd) {
  const taller = [];
  const seen = new Set();
  for (let gx = bd.minx - 8; gx <= bd.maxx + 8 + 31; gx += 32) {
    for (let gz = bd.minz - 8; gz <= bd.maxz + 8 + 31; gz += 32) {
      for (const o of city.cell(Math.min(gx, bd.maxx + 8), Math.min(gz, bd.maxz + 8)) || []) {
        if (o === bd || seen.has(o)) continue;
        seen.add(o);
        if (o.y0 <= bd.h + 0.5 && o.h > bd.h + 0.3) taller.push(o);
      }
    }
  }
  const blocked = (x, z) => taller.some((o) => x > o.minx - 4 && x < o.maxx + 4 && z > o.minz - 4 && z < o.maxz + 4 && (city.inside(o, x, z) || edgeDist(o, x, z) < 3.5));
  const w = bd.maxx - bd.minx, d = bd.maxz - bd.minz;
  const step = Math.max(1.5, Math.min(w, d) / 14);
  for (const margin of [3, 1.5]) {
    let best = null, bs = 1e18;
    for (let x = bd.minx + step / 2; x < bd.maxx; x += step) {
      for (let z = bd.minz + step / 2; z < bd.maxz; z += step) {
        if (!city.inside(bd, x, z) || edgeDist(bd, x, z) < margin || blocked(x, z)) continue;
        const sc = (x - bd.cx) ** 2 + (z - bd.cz) ** 2; // 屋上の真ん中に近いほど良い
        if (sc < bs) { bs = sc; best = [x, z, bd.h]; }
      }
    }
    if (best) return best;
  }
  // 見つからなければ、その場所でいちばん高い屋上の上
  const [x, z] = roofPoint(bd);
  return [x, z, city.floorAt(x, z, 1e9).y];
}
// (x, z) の近くで、高くて近い屋上 (PLATEAU のビルか、屋上に立てる名所)。label と同じ名前の屋上があればそれ
function pickRoof(x, z, label) {
  if (label) {
    // 同じ名前の屋上 (複数あれば一番高いもの)
    let named = null;
    for (const bd of city.bld) {
      if (bd.name !== label || Math.hypot(bd.cx - x, bd.cz - z) >= 400) continue;
      if (bd.cpAt) { named = bd; break; } // チェックポイントを置く段が決まっている名所
      if (!named || bd.h > named.h) named = bd;
    }
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
    const [px, pz, top] = bd ? (bd.cpAt ? [...bd.cpAt, bd.h] : orbSpot(bd)) : [x, z, 0];
    const y = top + 3.0; // 屋上に立って手が届く高さ (脈打って大きくなっても床にめり込まない)
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
const FREE = { id: 'free', title: t('freeTitle'), start: [212, 307], rings: [] };

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
  game.maxSpeed = 0; game.nice = 0; game.newDex = 0; game.landings = 0; game.ropedSince = false; game.revives = 0;
  fireworks.clear();
  if (bgmOn) bgm.start();
  const sp = startPoint(m);
  // スタートのまわりの建物は先に組み立てておく (残りは走りながら少しずつ)
  while (city.streamTiles(sp[0], sp[2], 900, 4) > 0);
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
  $('hint').textContent = isTouch ? '' : t('hintPC');
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
      for (let d = 0; d < L; d += 100) homes.push({ x: a.x + (r.pos.x - a.x) * d / L, z: a.z + (r.pos.z - a.z) * d / L });
      a = r.pos;
    }
    // ステージが上がるごとに過密に (霞が関デビューが基準)
    const stage = MISSIONS.indexOf(m);
    count = m.oni || Math.round(ONI_BASE_DENSITY * (1 + ONI_STEP * stage) * routeLength(m) / 1000);
  } else {
    // フリー: ビルのある所が持ち場。数は maintainOni がまわりの密度に合わせて増やす
    for (let i = 0; i < city.bld.length; i += 12) if (city.bld[i].plateau) homes.push({ x: city.bld[i].cx, z: city.bld[i].cz });
    count = 0;
  }
  // スタート地点から離す距離: 短いルートでは短く (ただし見つかる距離 280m より外)
  const safe = game.mode === 'mission' ? THREE.MathUtils.clamp(routeLength(m) * 0.18, 330, 520) : 650;
  oni.reset(homes, count, { x: sp[0], z: sp[2] }, safe, game.mode === 'mission');
  game.chasers = 0; game.alarm = false; game.alarmT = 0; game.heartT = 0;
  maintainT = 0; game.oniFirst = true;
}
// フリーの鬼の密度: 霞が関デビューと同じ (ルート上のどこでも、見つかる距離 280m 以内に平均約3匹)
// → 3匹 / (π × 0.28²km²) ≒ 1km² あたり 12匹 (ビルのある所)
const FREE_RHO = 12, FREE_R = 1200;
const builtSet = new Set();
for (const bd of city.bld) if (bd.plateau) builtSet.add(Math.floor(bd.cx / 100) + ',' + Math.floor(bd.cz / 100));
// 半径 r の中で、ビルのある 100m 四方のマスの面積 (km²)
function builtArea(x, z, r) {
  let n = 0;
  const gx = Math.floor(x / 100), gz = Math.floor(z / 100), k = Math.ceil(r / 100);
  for (let i = -k; i <= k; i++) for (let j = -k; j <= k; j++) if ((i * i + j * j) * 1e4 <= r * r && builtSet.has((gx + i) + ',' + (gz + j))) n++;
  return n * 0.01;
}
let maintainT = 0;
function updateOni(dt) {
  if (game.mode === 'free' && game.countdown <= 0) {
    maintainT -= dt;
    if (maintainT <= 0) { oni.maintain(player, FREE_RHO, FREE_R, builtArea, game.oniFirst ? 400 : undefined); game.oniFirst = false; maintainT = 1; }
  }
  const r = oni.update(dt, player, game.countdown <= 0);
  if (r.spawned) floater(t('oniSpawned', { n: r.spawned.length }), false);
  if (r.found.length) {
    sfx.oniLaugh();
    floater(r.found.length > 1 ? t('oniFoundN', { n: r.found.length }) : t('oniFound1'), true);
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
  $('oni').textContent = `👹 ${oni.list.length}${chased ? t('oniChase', { n: game.chasers }) : ''}`;
  $('oni').classList.toggle('danger', chased);
  // 一番近い鬼までの距離 (左下)。追われていたら赤、近ければオレンジ
  const od = $('oniDist');
  od.classList.toggle('hidden', !(r.nearest < 1e6));
  if (Number.isFinite(r.nearest)) {
    od.textContent = t('oniDist', { d: Math.round(r.nearest) });
    od.classList.toggle('chase', chased);
    od.classList.toggle('near', !chased && r.nearest < 400);
  }
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
  $('resTitle').textContent = t('caught');
  const score = Math.round(game.score).toLocaleString();
  game.shareText = game.mode === 'mission'
    ? t('shareCaughtMission', { m: mt(m), i: game.ringIdx, n: rings.length, s: score })
    : t('shareCaughtFree', { n: dex.size, total: DEX_ALL.length });
  $('resNext').classList.add('hidden');
  $('resStars').textContent = '👹';
  $('resBody').innerHTML = `${mt(m)}<br>${game.mode === 'mission' ? t('resCaughtMission', { i: game.ringIdx, n: rings.length, t: fmt(game.t) }) : t('resCaughtFree', { n: dex.size, total: DEX_ALL.length })}<br>
    ${t('resScore', { s: score })}<br>
    ${t('resCaughtStats', { c: game.maxCombo, l: game.landings, v: Math.round(game.maxSpeed * 3.6) })}${game.revives ? `<br>${t('revivedN', { n: game.revives })}` : ''}`;
  if (game.revives) game.shareText += t('revivedShare', { n: game.revives });
  // アプリ版: 捕まった様子を見届けてから「広告を見て続ける」を出す (1ゲーム REVIVE_MAX 回まで)
  if (Ads.canReward && game.revives < REVIVE_MAX) {
    setTimeout(() => { if (game.state === 'result') offerRevive(); }, REVIVE_DELAY * 1000);
    return;
  }
  setTimeout(showCaughtResult, 1200);
}
function showCaughtResult() {
  if (game.state !== 'result') return;
  showScreen('result');
  $('hud').classList.add('hidden');
  $('touch').classList.add('hidden');
  $('danger').style.opacity = 0;
  buildMenu();
}

// ---------- リワード広告のチート: 鬼に捕まったら、広告を見てその場から続ける (アプリだけ・1ゲーム 3 回まで) ----------
// 見終わると、最後に立っていた屋上 (ミッションなら最後に取ったチェックポイント) から再開し、近くの鬼は遠くへ追い払う
const REVIVE_MAX = 3, REVIVE_DELAY = 2.5, REVIVE_WAIT = 6;
const revive = { active: false, busy: false, timer: 0 };
function offerRevive() {
  Object.assign(revive, { active: true, busy: false });
  $('reviveWatch').disabled = false;
  $('reviveWatch').textContent = t('reviveWatch');
  $('reviveNote').textContent = t('reviveNote', { n: REVIVE_MAX - game.revives, max: REVIVE_MAX });
  $('revive').classList.remove('hidden');
  let left = REVIVE_WAIT;
  const tick = () => {
    if (!revive.active || revive.busy) return;
    $('reviveSkip').textContent = t('reviveSkip', { s: left });
    if (left-- <= 0) { closeRevive(); showCaughtResult(); return; }
    revive.timer = setTimeout(tick, 1000);
  };
  tick();
}
function closeRevive() {
  revive.active = false;
  clearTimeout(revive.timer);
  $('revive').classList.add('hidden');
}
$('reviveSkip').onclick = () => { if (!revive.active) return; closeRevive(); showCaughtResult(); };
$('reviveWatch').onclick = async () => {
  if (!revive.active || revive.busy) return;
  revive.busy = true;
  clearTimeout(revive.timer);
  $('reviveWatch').disabled = true;
  $('reviveWatch').textContent = t('reviveLoading');
  const result = await Ads.showRewarded();
  if (result === 'unavailable') {
    $('reviveNote').textContent = t('reviveFail');
    setTimeout(() => { closeRevive(); showCaughtResult(); }, 2000);
    return;
  }
  closeRevive();
  if (result !== 'rewarded') { showCaughtResult(); return; }
  reviveGame();
};
function reviveGame() {
  game.revives++;
  respawn();
  // 近くの鬼は、プレイヤーから 700m 離れた所へ追い払う
  for (const o of oni.list) {
    const dx = o.pos.x - player.p.x, dz = o.pos.z - player.p.z, d = Math.hypot(dx, dz) || 1;
    if (d < 700) {
      o.pos.x = player.p.x + dx / d * 700;
      o.pos.z = player.p.z + dz / d * 700;
      o.pos.y = oni.heightAt(o.pos.x, o.pos.z) + 60;
    }
    o.state = 'wander';
    if (o.waypoint) o.waypoint.copy(o.pos);
  }
  game.state = 'play';
  showScreen(null);
  $('hud').classList.remove('hidden');
  $('touch').classList.toggle('hidden', !isTouch);
  if (bgmOn) bgm.start();
  floater(t('revived'), true);
  lockPointer();
}

function showScreen(id) {
  for (const s of ['title', 'stages', 'how', 'dexScreen', 'pause', 'result', 'loading']) $(s).classList.toggle('hidden', s !== id);
  currentScreen = id;
  updateBanner();
}
// ---------- 広告 (アプリだけ) ----------
// バナー: トップ・あそびかた・ポーズ・結果画面の下中央だけ (プレイ中は操作ボタンと重なるので出さない)
let currentScreen = 'loading';
function updateBanner() { Ads.setBanner(['title', 'how', 'pause', 'result'].includes(currentScreen)); }
// 全画面広告: プレイを始める・トップに戻る・ポーズからの再開・結果からもう一度 / 次のステージ、のたびに毎回出す
let adBusy = false;
async function withInterstitial(next) {
  if (adBusy) return;
  if (Ads.available) {
    adBusy = true;
    await Ads.showInterstitial(3000);
    adBusy = false;
  }
  next();
}

function finishMission() {
  game.state = 'result';
  bgm.stop();
  sfx.heli(null);
  oni.clear();
  $('danger').style.opacity = 0;
  $('oniDist').classList.add('hidden');
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
  const idx = MISSIONS.indexOf(m);
  const wasFree = freeUnlocked();
  const nextWasOpen = idx + 1 < MISSIONS.length && isUnlocked(idx + 1);
  markCleared(m.id);
  store.set('best', bests);
  $('resTitle').textContent = tr('clear');
  $('resStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('resBody').innerHTML = `${mt(m)}<br><b>${fmt(t)}</b>${isBest ? ` <span style="color:#ffb020">${tr('newBest')}</span>` : tr('prevBest', { t: fmt(prev.t) })}<br>
    ${tr('resClearStats', { s: Math.round(game.score).toLocaleString(), c: game.maxCombo, v: Math.round(game.maxSpeed * 3.6), n: game.nice, l: game.landings })}<br>
    <small>★★★ ${fmt(L / 34)} ／ ★★ ${fmt(L / 24)}</small>`;
  game.shareText = tr('shareClear', { m: mt(m), t: fmt(t), stars: '★'.repeat(stars) + '☆'.repeat(3 - stars), s: Math.round(game.score).toLocaleString() });
  // 鍵が開いたお知らせと「次のステージへ」
  const next = MISSIONS[idx + 1];
  let unlockMsg = '';
  if (next && !nextWasOpen) unlockMsg += `<div class="unlock">${tr('unlockNext', { m: mt(next) })}</div>`;
  if (!wasFree && freeUnlocked()) unlockMsg += `<div class="unlock">${tr('unlockFree')}</div>`;
  $('resBody').innerHTML += unlockMsg;
  $('resNext').classList.toggle('hidden', !next);
  if (next) { $('resNext').innerHTML = `<b>${tr('nextStage', { m: mt(next) })}</b>`; $('resNext').onclick = () => withInterstitial(() => startGame(next)); }
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
  // スペース: ロープをつかむ／離す。Shift: ジャンプ
  if (e.code === 'Space') { e.preventDefault(); sfx.resume(); tryFire(); }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') player.jump();
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
  else { sfx.miss(); floater(t('ropeFar'), false); }
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
    // 画像の展開は描く前に裏ですませる (初めて描くときのカクつきを防ぐ)
    t.decode().then(() => { t.ready = true; }, () => {});
    // 遠くのタイルは捨てて、メモリを使いすぎないようにする (いちばん古いものから)
    if (tileCache.size > 96) {
      const old = tileCache.keys().next().value;
      tileCache.get(old).src = '';
      tileCache.delete(old);
    }
  } else {
    // 使ったタイルは新しい側へ
    tileCache.delete(key);
  }
  tileCache.set(key, t);
  return t.ready ? t : null;
}
function toDetail(x, z) {
  const [lat, lon] = worldToGeo(x, z);
  return [lonToTileX(lon, DETAIL_Z) * 256, latToTileY(lat, DETAIL_Z) * 256];
}
let mmZoom = 0.85, mmT = 0;
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
  // 大きな地図の全体ではなく、見える所だけを切り出して描く (毎フレームの負担を軽く)
  const R = W / 2 / zoom * 1.42 + 256;
  {
    const sx0 = Math.max(0, Math.floor((mex - R) / sc - mapOrigin.x)), sy0 = Math.max(0, Math.floor((mey - R) / sc - mapOrigin.y));
    const sx1 = Math.min(mapCanvas.width, Math.ceil((mex + R) / sc - mapOrigin.x)), sy1 = Math.min(mapCanvas.height, Math.ceil((mey + R) / sc - mapOrigin.y));
    if (sx1 > sx0 && sy1 > sy0) mm.drawImage(mapCanvas, sx0, sy0, sx1 - sx0, sy1 - sy0, (mapOrigin.x + sx0) * sc - mex, (mapOrigin.y + sy0) * sc - mey, (sx1 - sx0) * sc, (sy1 - sy0) * sc);
  }
  // 細かい地図のタイル
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
      floater(t('nice'), true);
    } else if (e.type === 'land') {
      if (e.what === 'ground') { endCombo(); game.standBd = null; }
      // ロープでほかのビルの屋上に着地できたらボーナス (花火はチェックポイントだけ)
      if (e.what === 'roof' && e.bd && e.bd !== game.standBd && game.ropedSince) {
        game.landings++;
        game.score += 500 * mult();
        floater(e.bd.name ? t('landedOn', { b: nm(e.bd.name) }) : t('landed'), true);
      }
      if (e.what === 'roof') { game.standBd = e.bd; game.ropedSince = false; }
      if (e.what === 'roof' && e.bd) collectDex(e.bd);
      if (e.what === 'roof' || e.what === 'road') game.lastSafe = [player.p.x, player.p.y, player.p.z];
      if (e.vy > 45) { cam.shake = 0.6; floater(t('thud'), false); }
    } else if (e.type === 'bump') {
      cam.shake = Math.min(1, e.speed / 40);
      flash(0.25);
      if (e.speed > 30) floater(t('bonk'), false);
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
      floater(t('nearMiss'), true);
    }
  }
}
// 名前のあるビルの屋上に降りると図鑑に載る
function collectDex(bd) {
  if (!bd.name) { if (bd.plateau) toast(t('building', { h: Math.round(bd.h) })); return; }
  const key = dexKey(bd.name);
  if (!dex.has(key)) {
    dex.add(key);
    store.set('dex', [...dex]);
    game.newDex++;
    game.score += 1000;
    sfx.collect();
    toast(t('dexNew', { b: nm(bd.name), h: Math.round(bd.h), n: dex.size, total: DEX_ALL.length }), true);
    updateDexCount();
  } else toast(t('dexKnown', { b: nm(bd.name), h: Math.round(bd.h) }));
}
function launchFireworks(n, big, gap) {
  for (const t of fireworks.show(camera, n, big, gap)) sfx.firework(t);
}
function endCombo() {
  if (game.combo >= 3) floater(t('combo', { n: game.combo }), false);
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
  floater(t('retry'), false);
}

function pause() {
  if (game.state !== 'play') return;
  game.state = 'pause';
  sfx.heli(null);
  bgm.duck(true);
  showScreen('pause');
}
function resumeGame() {
  withInterstitial(() => {
    if (game.state !== 'pause') return;
    game.state = 'play'; bgm.duck(false); showScreen(null); lockPointer();
  });
}
$('resumeBtn').onclick = resumeGame;
$('retryBtn').onclick = () => withInterstitial(() => startGame(game.mission));
$('quitBtn').onclick = () => withInterstitial(toTitle);
$('resRetry').onclick = () => withInterstitial(() => startGame(game.mission));
// 結果のシェア: スマホは端末の共有メニュー、パソコンは X の投稿画面
$('resShare').onclick = async () => {
  if (!game.shareText) return;
  if (plugin('Share')) {
    try { await plugin('Share').share({ title: t('shareTitle'), text: game.shareText, url: SHARE_URL, dialogTitle: t('shareTitle') }); } catch (e) { /* キャンセル */ }
    return;
  }
  if (navigator.share && isTouch) {
    try { await navigator.share({ title: t('shareTitle'), text: game.shareText, url: SHARE_URL }); } catch (e) { /* キャンセル */ }
    return;
  }
  window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(game.shareText) + '&url=' + encodeURIComponent(SHARE_URL), '_blank', 'noopener');
};
$('resCopy').onclick = async () => {
  if (!game.shareText) return;
  try {
    await navigator.clipboard.writeText(game.shareText + ' ' + SHARE_URL);
    $('resCopy').textContent = t('copied');
  } catch (e) {
    $('resCopy').textContent = t('copyFail');
  }
  setTimeout(() => { $('resCopy').textContent = t('copy'); }, 1800);
};
$('resQuit').onclick = () => withInterstitial(toTitle);
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

// ---------- ステージの鍵 ----------
// 首都高グランプリと同じく、最初は1番目のステージだけ。クリアすると次のステージの鍵が開く。
// フリー (ビル図鑑あつめ) は全部のステージをクリアすると開く。テスト用に ?unlock で全部開く
const UNLOCK_ALL = location.search.includes('unlock');
function isCleared(id) { return store.get('cleared', []).includes(id) || !!store.get('best', {})[id]; }
function markCleared(id) {
  const c = store.get('cleared', []);
  if (!c.includes(id)) { c.push(id); store.set('cleared', c); }
}
function isUnlocked(i) { return UNLOCK_ALL || i === 0 || isCleared(MISSIONS[i - 1].id); }
function freeUnlocked() { return UNLOCK_ALL || MISSIONS.every((m) => isCleared(m.id)); }

// ---------- メニュー ----------
function buildMenu() {
  const bests = store.get('best', {});
  const list = $('missionList');
  list.innerHTML = '';
  MISSIONS.forEach((m, i) => {
    const b = document.createElement('button');
    const open = isUnlocked(i);
    b.className = 'mode' + (open ? '' : ' locked');
    const best = bests[m.id];
    b.innerHTML = open
      ? `${best ? `<span class="best">${'★'.repeat(best.stars)} ${fmt(best.t)}</span>` : ''}<b>${i + 1}. ${mt(m)}</b><span>${ms(m)}</span>`
      : `<b>🔒 ${i + 1}. ${mt(m)}</b><span>${t('lockedNeed', { m: mt(MISSIONS[i - 1]) })}</span>`;
    b.onclick = () => { if (open) withInterstitial(() => startGame(m)); else { sfx.resume(); sfx.miss(); } };
    list.appendChild(b);
  });
  const fo = freeUnlocked();
  $('freeBtn').classList.toggle('locked', !fo);
  $('freeBtn').innerHTML = fo
    ? `<b>${t('freeTitle')}</b><span>${t('freeOpen')}</span>`
    : `<b>🔒 ${t('freeTitle')}</b><span>${t('freeLocked')}</span>`;
  updateDexCount();
  const nClear = MISSIONS.filter((m) => isCleared(m.id)).length;
  $('titleBest').textContent = t('titleBest', { c: nClear, n: MISSIONS.length, d: dex.size, total: DEX_ALL.length });
}
buildMenu();
$('freeBtn').onclick = () => { if (freeUnlocked()) withInterstitial(() => startGame(FREE)); else { sfx.resume(); sfx.miss(); } };
$('howBtn').onclick = () => showScreen('how');
$('playBtn').onclick = () => { sfx.resume(); showScreen('stages'); };
$('stagesBack').onclick = () => showScreen('title');
$('dexBtn').onclick = () => {
  $('dexTotal').textContent = t('dexCount', { n: dex.size, total: DEX_ALL.length });
  const l = $('dexList');
  l.innerHTML = '';
  for (const n of [...DEX_ALL].sort((a, b) => dex.has(b) - dex.has(a))) {
    const d = document.createElement('div');
    d.className = dex.has(n) ? '' : 'no';
    d.textContent = dex.has(n) ? nm(n) : t('unknown');
    l.appendChild(d);
  }
  showScreen('dexScreen');
};
// あそびかた → トップ (全画面広告)、ビル図鑑 → ステージをえらぶ
document.querySelectorAll('#how [data-close]').forEach((b) => { b.onclick = () => withInterstitial(() => showScreen('title')); });
document.querySelectorAll('#dexScreen [data-close]').forEach((b) => { b.onclick = () => showScreen('stages'); });

// トップ画面の下に、バージョン (アプリ版)・プライバシーポリシー・広告の設定 (EU など) を出す
if (window.APP_VERSION && window.APP_VERSION !== 'dev') $('buildInfo').textContent = window.APP_VERSION;
if (LANG === 'en') $('privacyLink').href = 'https://techgym.jp/privacy-policy-en/';
Ads.initDone.then(() => { if (Ads.privacyOptionsRequired) $('adPrivacy').hidden = false; });
$('adPrivacyLink').addEventListener('click', (e) => { e.preventDefault(); Ads.showPrivacyOptions(); });

// Android の戻るボタン: プレイ中はポーズ (ポーズ中なら再開)、トップ・結果画面ではアプリを閉じる。ほかの画面は一つ前へ
if (plugin('App')) {
  plugin('App').addListener('backButton', () => {
    if (adBusy || Ads.showing) return;
    if (revive.active) { closeRevive(); showCaughtResult(); return; }
    if (game.state === 'play') { pause(); return; }
    if (game.state === 'pause') { resumeGame(); return; }
    if (currentScreen === 'how') withInterstitial(() => showScreen('title'));
    else if (currentScreen === 'stages') showScreen('title');
    else if (currentScreen === 'dexScreen') showScreen('stages');
    else if (currentScreen === 'title' || currentScreen === 'result') plugin('App').exitApp();
  });
}
// 別のアプリに切り替えたら一時停止して音を止める (広告の表示中は広告側が音を止めている)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pause();
    window.GameAudio.suspend();
  } else if (!Ads.showing) {
    window.GameAudio.resume();
  }
});
document.querySelectorAll('#tod button').forEach((b) => { b.onclick = () => applyTod(b.dataset.v); });
// 言語 (切り替えるとページを読み直す)
document.querySelectorAll('#langSel button').forEach((b) => {
  b.classList.toggle('on', b.dataset.v === LANG);
  b.onclick = () => { if (b.dataset.v !== LANG) setLang(b.dataset.v); };
});

function setBgm(on) {
  bgmOn = on;
  store.set('bgm', on);
  document.querySelectorAll('#bgmSel button').forEach((b) => b.classList.toggle('on', (b.dataset.v === 'on') === on));
  if (game.state === 'play') { if (on) bgm.start(); else bgm.stop(); }
}
document.querySelectorAll('#bgmSel button').forEach((b) => { b.onclick = () => setBgm(b.dataset.v === 'on'); });
setBgm(bgmOn);

// スマホで重いときは、描く解像度を自動で下げる。解像度を変えると描く場所を作り直すので一瞬止まる。
// 何度も上げ下げしないよう、下げるのは 4 秒ごとに少しずつ、一度下げたらそのあとは上げない
const PR_MAX = Math.min(devicePixelRatio, isTouch ? 1.25 : 2), PR_MIN = Math.min(PR_MAX, isTouch ? 0.7 : 1);
let prNow = PR_MAX, prT = 0, prN = 0, prLowered = false;
function adaptResolution(dt) {
  if (game.state !== 'play') { prT = 0; prN = 0; return; }
  prT += dt; prN++;
  if (prT < 4) return;
  const avg = prT / prN;
  prT = 0; prN = 0;
  let next = prNow;
  if (avg > 1 / 45) { next = Math.max(PR_MIN, Math.round((prNow - 0.15) * 100) / 100); prLowered = true; }
  else if (!prLowered && avg < 1 / 58) next = Math.min(PR_MAX, prNow + 0.1);
  if (next !== prNow) { prNow = next; renderer.setPixelRatio(prNow); renderer.setSize(innerWidth, innerHeight); }
}
// ---------- ループ ----------
const clock = new THREE.Clock();
let menuT = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  fireworks.update(dt);
  rails.update(dt);
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
  // 建物のタイル: カメラのまわりだけ (1フレームに組み立てるのは数ミリ秒ぶんまで)
  {
    const t0 = performance.now();
    while (city.streamTiles(camera.position.x, camera.position.z, DRAW_R, 1) > 0 && performance.now() - t0 < (isTouch ? 4 : 6));
  }
  adaptResolution(dt);
  merged.cull(camera, DRAW_R);
  cullPieces(camera, DRAW_R);
  city.cullTiles(camera, DRAW_R);
  sky.position.copy(camera.position);
  distant.follow(camera);
  fuji.follow(camera);
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
        floater(t('cpPassed', { b: nm(cur.label) }), false);
        if (oni.addOne(player)) floater(t('oniMore', { n: oni.list.length }), false);
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
  $('groundTip').classList.toggle('hidden', !canGrab || game.countdown > 0); // カウントダウン中は数字と重なるので出さない
  $('groundTip').textContent = isTouch ? t('grabTouch') : t('grabPC');
  $('tRope').classList.toggle('ready', canGrab);
  $('tRope').textContent = player.rope ? t('release') : t('grab');

  // 影
  const f = city.floorAt(player.p.x, player.p.z, player.p.y + 0.1);
  const hgt = player.p.y - f.y;
  blob.position.set(player.p.x, f.y + 0.06 + Math.min(hgt, 200) * 0.002, player.p.z);
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
      const goal = game.ringIdx === rings.length - 1 ? t('goal') : '';
      $('navText').textContent = `${goal}${nm(cur.label)} ${Math.round(Math.hypot(dx, dz))}m ${dy > 8 ? '▲' : dy < -8 ? '▼' : ''}`;
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
      $('area').textContent = nm(best);
      $('area').classList.add('show');
      areaTimer = 2.5;
    }
  }
  areaTimer -= dt;
  if (areaTimer <= 0) $('area').classList.remove('show');
  // ミニマップ: スマホは 1 秒に 20 回ほどに減らす (地図の描き直しは重い)
  mmT += dt;
  if (!isTouch || mmT >= 0.05) { mmT = 0; drawMinimap(); }
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
if (location.search.includes('debug')) window.dbg = { renderer, scene, camera, tileCache, game, player, city, cam, startGame, MISSIONS, FREE, rings: () => rings, heli, oni, fireworks, launchFireworks, tryFire, applyTod };
