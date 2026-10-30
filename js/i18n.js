// 日本語 / 英語。ブラウザの言語で自動で切り替え、タイトル画面の「言語 / Language」でも変えられる
const saved = (() => { try { return localStorage.getItem('tarzan.lang'); } catch (e) { return null; } })();
export const LANG = saved || ((navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en');
export function setLang(l) {
  try { localStorage.setItem('tarzan.lang', l); } catch (e) { /* 保存できなくても切り替える */ }
  location.reload();
}

// 画面で使う文字 (ゲーム中に変わるもの)。{x} は値で置き換える
const S = {
  dexCount: ['{n} / {total} 棟', '{n} / {total} buildings'],
  hintPC: ['クリックで視点固定 ・ スペースキー: ロープをつかむ／離す ・ A D: 曲がる ・ Shift: ジャンプ ・ R: やり直し ・ Esc: 一時停止',
    'Click to lock view ・ Space: grab / release rope ・ A D: turn ・ Shift: jump ・ R: retry ・ Esc: pause'],
  oniSpawned: ['鬼が {n} 匹 徘徊している！', '{n} oni are prowling!'],
  oniFound1: ['鬼に見つかった！', 'An oni spotted you!'],
  oniFoundN: ['鬼 {n} 匹に見つかった！', '{n} oni spotted you!'],
  oniChase: ['（追跡 {n}）', ' (chasing {n})'],
  oniDist: ['👹 一番近い鬼 {d}m', '👹 Nearest oni {d}m'],
  caught: ['鬼に捕まった！', 'Caught by an oni!'],
  shareCaughtMission: ['ターザン大東京「{m}」でチェックポイント {i}/{n} まで行ったけど、鬼に捕まった…👹 得点 {s}pt #ターザン大東京',
    'Made it to checkpoint {i}/{n} on "{m}" in Tarzan Dai-Tokyo, then an oni caught me… 👹 Score {s}pt #TarzanDaiTokyo'],
  shareCaughtFree: ['ターザン大東京で東京のビルを {n}/{total} 棟 図鑑に集めたけど、鬼に捕まった…👹 #ターザン大東京',
    'Collected {n}/{total} Tokyo buildings in Tarzan Dai-Tokyo, then an oni caught me… 👹 #TarzanDaiTokyo'],
  resCaughtMission: ['チェックポイント {i} / {n} ・ {t}', 'Checkpoints {i} / {n} ・ {t}'],
  resCaughtFree: ['図鑑 {n} / {total} 棟', 'Collection {n} / {total} buildings'],
  resScore: ['得点 <b>{s}</b> pt', 'Score <b>{s}</b> pt'],
  resCaughtStats: ['最大コンボ {c} ／ 着地成功 {l} 回 ／ 最高速度 {v} km/h', 'Max combo {c} / Landings {l} / Top speed {v} km/h'],
  clear: ['配達完了！', 'Delivered!'],
  newBest: ['ベスト更新！', 'New best!'],
  prevBest: ['（ベスト {t}）', ' (best {t})'],
  resClearStats: ['得点 {s} pt ／ 最大コンボ {c}<br>最高速度 {v} km/h ／ ナイスリリース {n} 回 ／ 着地成功 {l} 回',
    'Score {s} pt / Max combo {c}<br>Top speed {v} km/h / Nice releases {n} / Landings {l}'],
  shareClear: ['ターザン大東京「{m}」を {t} で配達完了！ {stars} 得点 {s}pt #ターザン大東京',
    'Delivered "{m}" in {t} in Tarzan Dai-Tokyo! {stars} Score {s}pt #TarzanDaiTokyo'],
  unlockNext: ['🔓 「{m}」の鍵が開いた！', '🔓 "{m}" unlocked!'],
  unlockFree: ['🔓 全ステージクリア！「ビル図鑑あつめ」の鍵が開いた！', '🔓 All stages cleared! "Building Collection" unlocked!'],
  nextStage: ['次のステージへ ▶ {m}', 'Next stage ▶ {m}'],
  ropeFar: ['ロープに届かない', "Can't reach the rope"],
  nice: ['ナイスリリース！', 'Nice release!'],
  landedOn: ['{b} に着地！', 'Landed on {b}!'],
  landed: ['着地成功！', 'Nice landing!'],
  thud: ['ドスン！', 'Thud!'],
  bonk: ['ゴツン！', 'Bonk!'],
  nearMiss: ['ニアミス！', 'Near miss!'],
  building: ['ビル 高さ {h}m', 'Building {h}m'],
  dexNew: ['📖 {b}（{h}m） {n}/{total}', '📖 {b} ({h}m) {n}/{total}'],
  dexKnown: ['🏢 {b}（{h}m）', '🏢 {b} ({h}m)'],
  combo: ['{n} コンボ！', '{n} combo!'],
  retry: ['やり直し', 'Retry'],
  copied: ['コピーしました', 'Copied'],
  copyFail: ['コピーできませんでした', 'Copy failed'],
  copy: ['結果をコピー', 'Copy result'],
  lockedNeed: ['「{m}」をクリアすると開きます', 'Clear "{m}" to unlock'],
  freeTitle: ['ビル図鑑あつめ', 'Building Collection'],
  freeOpen: ['霞が関ビルの屋上から自由に飛び回る。名前のあるビルの屋上に降りると図鑑に載る（<em id="dexCount">0</em>）',
    'Swing freely from the roof of the Kasumigaseki Building. Land on named buildings to add them to your collection (<em id="dexCount">0</em>)'],
  freeLocked: ['配達ミッションを全部クリアすると開きます（図鑑 <em id="dexCount">0</em>）', 'Clear all delivery missions to unlock (collection <em id="dexCount">0</em>)'],
  cpPassed: ['{b} 通過！', '{b} cleared!'],
  oniMore: ['鬼が増えた！（{n} 匹）', 'More oni! ({n})'],
  grabTouch: ['つかめる！「つかむ」ボタンをタップ', 'In reach! Tap GRAB'],
  grabPC: ['つかめる！ スペースキー', 'In reach! Press Space'],
  grab: ['つかむ', 'GRAB'],
  release: ['はなす', 'LET GO'],
  goal: ['🏁 ゴール ', '🏁 GOAL '],
  unknown: ['？？？', '???'],
  shareTitle: ['ターザン大東京', 'Tarzan Dai-Tokyo'],
};
export function t(key, p = {}) {
  const e = S[key];
  let s = e ? e[LANG === 'en' ? 1 : 0] : key;
  for (const k in p) s = s.split('{' + k + '}').join(p[k]);
  return s;
}

// 関数の中で t という変数を使っている所 (タイムなど) 用の別名
export const tr = t;

// 地名・ビル名・ステージ名の英語。ないもの (PLATEAU の一般のビル名など) は日本語のまま
const EN = {
  // 名所・手作りのモデル
  '東京タワー': 'Tokyo Tower', 'メインデッキ': 'Main Deck', 'フットタウン': 'Foot Town', '国会議事堂': 'National Diet Building', '中央塔': 'Central Tower',
  'テックジム東京本校': 'TECH GYM Tokyo', 'テックジムの鉄塔': 'TECH GYM tower', 'テックジムの看板': 'TECH GYM sign', 'テックジムのアドバルーン': 'TECH GYM balloon',
  '東京ドーム': 'Tokyo Dome', '日本武道館': 'Nippon Budokan', '皇居': 'Imperial Palace', '皇居（宮殿）': 'Imperial Palace', '宮殿': 'Palace',
  '長和殿': 'Chowaden', '正殿': 'Seiden', '豊明殿': 'Homeiden', '表御座所': 'Omote Gozasho', '連翠': 'Rensui',
  '伏見櫓': 'Fushimi Turret', '富士見櫓': 'Fujimi Turret', '桜田巽櫓': 'Sakurada Tatsumi Turret', '二重橋': 'Nijubashi Bridge', '江戸城': 'Edo Castle', '天守台': 'Keep Base',
  '東宮御所': 'Togu Palace', 'レインボーブリッジ': 'Rainbow Bridge', 'レインボーブリッジ 主塔': 'Rainbow Bridge Tower', 'フジテレビ本社ビル': 'Fuji TV Building', '自由の女神像': 'Statue of Liberty (Odaiba)', 'お台場': 'Odaiba', '芝浦': 'Shibaura', '台場': 'Daiba', '国立西洋美術館': 'National Museum of Western Art', '東京文化会館': 'Tokyo Bunka Kaikan', '国立科学博物館': 'National Museum of Nature and Science', 'SL（D51）': 'D51 Steam Locomotive', 'シロナガスクジラ': 'Blue Whale', '上野東照宮': 'Ueno Toshogu', '上野東照宮 唐門': 'Ueno Toshogu Karamon Gate', '清水観音堂': 'Kiyomizu Kannon-do', '上野の森美術館': 'Ueno Royal Museum', '仲見世通り': 'Nakamise Street', '浅草花やしき': 'Asakusa Hanayashiki', '浅草文化観光センター': 'Asakusa Culture Tourist Center', '吾妻橋': 'Azumabashi Bridge', '御徒町駅': 'Okachimachi Sta.', 'アメ横': 'Ameyoko', '山手線・京浜東北線': 'Yamanote / Keihin-Tohoku Line', '隅田公園': 'Sumida Park', '護国寺': 'Gokoku-ji', '護国寺 本堂': 'Gokoku-ji Main Hall', '護国寺 仁王門': 'Gokoku-ji Nio Gate', '雑司が谷 鬼子母神': 'Zoshigaya Kishimojin', '泉岳寺': 'Sengaku-ji', '泉岳寺 本堂': 'Sengaku-ji Main Hall', '泉岳寺 山門': 'Sengaku-ji Gate', '高輪ゲートウェイ駅': 'Takanawa Gateway Sta.', '高田馬場駅': 'Takadanobaba Sta.', '目白駅': 'Mejiro Sta.', '池袋駅': 'Ikebukuro Sta.', '大塚駅': 'Otsuka Sta.', '田町駅': 'Tamachi Sta.', '品川駅': 'Shinagawa Sta.', '山手線': 'Yamanote Line', 'サンシャイン60': 'Sunshine 60', 'サンシャインシティ': 'Sunshine City', '東京芸術劇場': 'Tokyo Metropolitan Theatre', '品川インターシティ': 'Shinagawa Intercity', '品川プリンスホテル': 'Shinagawa Prince Hotel', '池袋': 'Ikebukuro', '東池袋': 'Higashi-Ikebukuro', '目白': 'Mejiro', '雑司が谷': 'Zoshigaya', '高田馬場': 'Takadanobaba', '品川': 'Shinagawa', '高輪': 'Takanawa', '港南': 'Konan', '田町': 'Tamachi', '西早稲田': 'Nishi-Waseda', '芝公園': 'Shiba Park', '三田': 'Mita', '東急歌舞伎町タワー': 'Tokyu Kabukicho Tower', '新宿東宝ビル': 'Shinjuku Toho Bldg', '歌舞伎町一番街': 'Kabukicho Ichibangai', 'ゴールデン街': 'Golden Gai', '花園神社': 'Hanazono Shrine', '思い出横丁': 'Omoide Yokocho', 'NTTドコモ代々木ビル': 'NTT Docomo Yoyogi Bldg', '須賀神社': 'Suga Shrine', '防衛省': 'Ministry of Defense', '靖国神社': 'Yasukuni Shrine', '靖国神社 大鳥居': 'Yasukuni Great Torii', '靖国神社 拝殿': 'Yasukuni Haiden', '靖国神社 本殿': 'Yasukuni Honden', '靖国神社 神門': 'Yasukuni Shinmon Gate', '中央・総武線': 'Chuo-Sobu Line', '水道橋駅': 'Suidobashi Sta.', '飯田橋駅': 'Iidabashi Sta.', '市ケ谷駅': 'Ichigaya Sta.', '四ツ谷駅': 'Yotsuya Sta.', '信濃町駅': 'Shinanomachi Sta.', '千駄ケ谷駅': 'Sendagaya Sta.', '代々木駅': 'Yoyogi Sta.', '新宿駅': 'Shinjuku Sta.', '浅草橋駅': 'Asakusabashi Sta.', '歌舞伎町': 'Kabukicho', '新宿三丁目': 'Shinjuku 3-chome', '四谷': 'Yotsuya', '市ケ谷': 'Ichigaya', '千駄ケ谷': 'Sendagaya', 'SHIBUYA109': 'SHIBUYA109', 'スクランブル交差点': 'Shibuya Scramble Crossing', 'ハチ公像': 'Hachiko Statue', '国立代々木競技場': 'Yoyogi National Gymnasium', '国立新美術館': 'National Art Center, Tokyo', '麻布台ヒルズ 森JPタワー': 'Azabudai Hills Mori JP Tower', '浅草寺': 'Senso-ji', '本堂': 'Main Hall', '五重塔': 'Five-storied Pagoda', '宝蔵門': 'Hozomon Gate', '雷門': 'Kaminarimon Gate',
  'アサヒの金の炎': 'Asahi Golden Flame', 'アサヒ スーパードライホール': 'Asahi Super Dry Hall', 'アサヒビールタワー': 'Asahi Beer Tower', '西郷隆盛像': 'Saigo Takamori Statue',
  '不忍池 弁天堂': 'Shinobazu Pond Bentendo', '上野動物園': 'Ueno Zoo', 'ニコライ堂': 'Nikolai-do Cathedral', '神田明神': 'Kanda Myojin', '随神門': 'Zuishinmon Gate', '聖橋': 'Hijiribashi Bridge',
  '将門塚': 'Masakado-zuka', '東京駅 丸の内駅舎': 'Tokyo Station Marunouchi Building', '日枝神社': 'Hie Shrine', '豊川稲荷': 'Toyokawa Inari', '秋葉原駅': 'Akihabara Sta.', '御茶ノ水駅': 'Ochanomizu Sta.',
  'マーチエキュート神田万世橋': 'mAAch ecute Manseibashi (brick viaduct)', '総武線': 'Sobu Line', '秋葉原 電気街': 'Akihabara Electric Town', 'ホテルニューオータニ ザ・メイン': 'Hotel New Otani The Main',
  '平河町森タワー': 'Hirakawacho Mori Tower', '秋葉原UDX': 'Akihabara UDX', '墨田区役所': 'Sumida City Hall', '上野駅': 'Ueno Sta.', '東京国立博物館': 'Tokyo National Museum', '浅草駅': 'Asakusa Sta.', '御茶ノ水ソラシティ': 'Ochanomizu Sola City',
  '御茶ノ水': 'Ochanomizu', '湯島・神田明神': 'Yushima / Kanda Myojin', '万世橋': 'Manseibashi', '秋葉原': 'Akihabara', '御徒町': 'Okachimachi', '上野': 'Ueno', '上野公園': 'Ueno Park', '浅草': 'Asakusa', '吾妻橋': 'Azumabashi', '桜田門': 'Sakuradamon Gate', '半蔵門': 'Hanzomon Gate', '警視庁本部': 'Tokyo Metropolitan Police HQ', '首相官邸': "Prime Minister's Office", '自由民主党本部': 'LDP Headquarters', '国立国会図書館': 'National Diet Library', '最高裁判所': 'Supreme Court', '東京スカイツリー': 'Tokyo Skytree',
  // 著名なビル
  '東京都庁': 'Tokyo Metropolitan Gov. Building', '新宿パークタワー': 'Shinjuku Park Tower', '新宿NSビル': 'Shinjuku NS Building',
  '渋谷スクランブルスクエア': 'Shibuya Scramble Square', '渋谷ヒカリエ': 'Shibuya Hikarie', 'セルリアンタワー': 'Cerulean Tower', '渋谷ストリーム': 'Shibuya Stream', '渋谷マークシティ': 'Shibuya Mark City', 'マークシティ': 'Shibuya Mark City',
  '六本木ヒルズ森タワー': 'Roppongi Hills Mori Tower', '東京ミッドタウン': 'Tokyo Midtown', '東京ミッドタウン・タワー': 'Tokyo Midtown Tower', '住友不動産六本木グランドタワー': 'Sumitomo Roppongi Grand Tower',
  'アークヒルズ': 'Ark Hills', '泉ガーデンタワー': 'Izumi Garden Tower', '虎ノ門ヒルズ森タワー': 'Toranomon Hills Mori Tower', '霞が関ビルディング': 'Kasumigaseki Building', '山王パークタワー': 'Sanno Park Tower',
  '東京ガーデンテラス紀尾井町': 'Tokyo Garden Terrace Kioicho', 'ホテルニューオータニ': 'Hotel New Otani', '日本テレビタワー': 'Nippon TV Tower', '電通本社ビル': 'Dentsu Building',
  '汐留シティセンター': 'Shiodome City Center', '汐留メディアタワー': 'Shiodome Media Tower', '世界貿易センタービル': 'World Trade Center Building',
  'GINZA SIX': 'GINZA SIX', '銀座 和光': 'Ginza Wako', '帝国ホテル': 'Imperial Hotel', '東京国際フォーラム': 'Tokyo International Forum', '丸ビル': 'Marunouchi Building', '新丸ビル': 'Shin-Marunouchi Building',
  '東京駅 丸の内駅舎': 'Tokyo Station Marunouchi Building', 'グラントウキョウ': 'GranTokyo', 'グラントウキョウ  ノースタワー': 'GranTokyo North Tower', '日本橋三井タワー': 'Nihonbashi Mitsui Tower', '大手町タワー': 'Otemachi Tower', '読売新聞ビル': 'Yomiuri Shimbun Building',
  '東京ドームホテル': 'Tokyo Dome Hotel', '住友不動産飯田橋ファーストタワー': 'Iidabashi First Tower', 'アイガーデンエアタワー': 'I-Garden Air Tower', 'プルデンシャルタワー': 'Prudential Tower',
  '日経ビル': 'Nikkei Building', '金融庁': 'Financial Services Agency', '赤坂インターシティAIR': 'Akasaka Intercity AIR', '虎の門病院': 'Toranomon Hospital', '専修大学': 'Senshu University', '専修大学(神田キャンパス)': 'Senshu University',
  // 地名
  '霞が関': 'Kasumigaseki', '虎ノ門': 'Toranomon', '新橋': 'Shimbashi', '汐留': 'Shiodome', '銀座': 'Ginza', '築地': 'Tsukiji', '京橋': 'Kyobashi', '日本橋': 'Nihonbashi',
  '丸の内・東京駅': 'Marunouchi / Tokyo Sta.', '大手町': 'Otemachi', '神保町': 'Jimbocho', '九段': 'Kudan', '麹町': 'Kojimachi', '永田町': 'Nagatacho', '赤坂': 'Akasaka',
  '六本木': 'Roppongi', '麻布十番': 'Azabu-Juban', '芝公園・東京タワー': 'Shiba Park / Tokyo Tower', '浜松町': 'Hamamatsucho', '三田': 'Mita', '広尾': 'Hiroo', '青山': 'Aoyama',
  '渋谷': 'Shibuya', '代々木': 'Yoyogi', '初台': 'Hatsudai', '西新宿': 'Nishi-Shinjuku', '神宮外苑': 'Jingu Gaien', '信濃町': 'Shinanomachi', '紀尾井町': 'Kioicho',
  '大橋': 'Ohashi', '富ヶ谷': 'Tomigaya', '水道橋': 'Suidobashi', '後楽園・東京ドーム': 'Korakuen / Tokyo Dome', '飯田橋': 'Iidabashi', '赤坂御用地': 'Akasaka Estate',
  // チェックポイントの名前
  '東京タワー フットタウン': 'Tokyo Tower Foot Town', '東京タワー メインデッキ': 'Tokyo Tower Main Deck', '六本木一丁目': 'Roppongi 1-chome', '神谷町': 'Kamiyacho', '芝公園': 'Shiba Park',
  '銀座四丁目': 'Ginza 4-chome', '銀座一丁目': 'Ginza 1-chome', '八重洲 グラントウキョウ': 'Yaesu GranTokyo', '幡ヶ谷・代々木': 'Hatagaya / Yoyogi', '道玄坂上': 'Dogenzaka-ue',
  '千鳥ヶ淵': 'Chidorigafuchi',
};
export function nm(s) {
  if (LANG !== 'en' || !s) return s;
  if (EN[s]) return EN[s];
  return s.split(' ').map((w) => EN[w] || w).join(' ');
}

// 画面の固定の文字 (index.html の data-i18n の要素)。日本語は HTML に書いてある
const STATIC_EN = {
  lead: 'Swing from building to building across real central Tokyo — with just one rope.',
  todLabel: 'Time', day: 'Day', dusk: 'Dusk', night: 'Night', langLabel: 'Language',
  missionsH: 'Delivery missions', freeH: 'Free roam',
  howBtn: 'How to play', dexBtn: 'Building collection',
  credit: 'Building shapes and heights: MLIT Project PLATEAU (Tokyo 23 wards, 2020; partly via plateau-tokyo23ku-building-mvt-2020 by indigo-lab) / Expressway lines: © OpenStreetMap contributors / Water and minimap: GSI vector tiles and tiles (pale map). City data built from <a href="https://github.com/techgymjp/shutoko" target="_blank" rel="noopener">Shutoko GP</a> course data',
  howH: 'How to play',
  keys: `<tr><th>View</th><td>Mouse (click the screen to lock)</td><td>Drag the right side</td></tr>
      <tr><th>Rope</th><td>Space (or left click) to grab / again to let go</td><td>GRAB button (again to let go)</td></tr>
      <tr><th>Jump</th><td>Shift</td><td>JUMP</td></tr>
      <tr><th>Move / swing</th><td>W A S D</td><td>Left stick</td></tr>
      <tr><th>Retry</th><td>R</td><td>↺</td></tr>
      <tr><th>Pause / mute / music</th><td>Esc / M / B</td><td>❚❚</td></tr>
      <tr><th>Big map</th><td>N (or click the minimap)</td><td>Tap the minimap</td></tr>`,
  tips: `<li>The rope hangs from a <b>helicopter</b> flying just ahead. When "In reach!" appears, grab it and get carried forward; let go to fly. Turn left / right anytime</li>
      <li>Let go just as the swing starts rising for a "Nice release!" boost</li>
      <li>The more ropes you grab without touching the ground, the bigger your <b>combo</b>. Rooftops and elevated expressways keep it alive for 1 second</li>
      <li>Fly fast past a wall for a "Near miss" bonus. Hitting walls slows you down</li>
      <li><b>Tag</b>: oni riding clouds prowl the city. Get close and they chase you (and get faster). <b>If one catches you, it's game over</b>. Escape with the helicopter</li>
      <li>Touch a glowing orb (checkpoint) on a rooftop for <b>fireworks</b>. Landing on another rooftop by rope: +500pt</li>
      <li>Keep holding W A S D (stick) to speed up</li>
      <li>Land on the roof of a named building to add it to your collection</li>`,
  back: 'Back', dexH: 'Building collection', pauseH: 'Paused', resume: 'Resume', retryBtn: '<b>Restart</b>', quitBtn: '<b>Title</b>',
  resRetry: '<b>Play again</b>', resQuit: '<b>Title</b>', resShare: 'Share', resCopy: 'Copy result', loadingH: 'Building Tokyo…', loadingP: 'About 99,000 PLATEAU buildings',
  tJump: 'JUMP',
};
export function applyStatic() {
  if (LANG !== 'en') return;
  document.documentElement.lang = 'en';
  document.title = 'Tarzan Dai-Tokyo';
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const v = STATIC_EN[el.dataset.i18n];
    if (v !== undefined) el.innerHTML = v;
  }
}
