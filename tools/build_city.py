#!/usr/bin/env python3
"""ターザン大東京の街のデータ (js/city-data.js) を作る。

首都高グランプリ (https://github.com/techgymjp/shutoko) のコースデータ js/course-*-data.js には、
首都高に沿った PLATEAU の建物 (輪郭・高さ・名前) と OpenStreetMap の首都高の線が入っている。
これを全部読み、都心の範囲 (BOX) にある建物を1つの座標系にまとめて重複を除く。

出典:
  © OpenStreetMap contributors (ODbL)
  国土交通省 Project PLATEAU 3D都市モデル 東京都23区 (2020年度)

さらに、コースデータに入っていない所 (永田町・霞が関・皇居まわりなど。首都高がトンネルで帯から外れる所) の建物を
tools/fetch_plateau_mvt.py で PLATEAU のベクトルタイル (plateau-tokyo23ku-building-mvt-2020 by indigo-lab) から取り出した
data/plateau-extra.json で補う (重なる建物は1つにする)。

使い方:
  python3 tools/fetch_plateau_mvt.py 35.669 35.695 139.735 139.763 > data/plateau-extra.json
  python3 tools/fetch_plateau_mvt.py 35.693 35.722 139.762 139.804 > data/plateau-akiba-ueno-asakusa.json
  python3 tools/fetch_plateau_mvt.py 35.668 35.686 139.722 139.7352 > data/plateau-akasaka.json
  python3 tools/fetch_plateau_mvt.py 35.645 35.712 139.690 139.785 25 > data/plateau-tall.json   # 街の中の抜け (高さ25m以上)
  python3 tools/build_city.py <shutoko の js ディレクトリ> data/plateau-extra.json data/plateau-akasaka.json:10 data/plateau-akiba-ueno-asakusa.json:15 data/plateau-tall.json > js/city-data.js
"""
import glob, json, math, sys

src = sys.argv[1]
# 補う建物のファイル。「ファイル:高さ」と書くと、その高さ未満の小さな建物 (600m² 未満) は省く
EXTRAS = []
for a in sys.argv[2:]:
    path, _, mh = a.partition(':')
    EXTRAS.append((path, float(mh) if mh else 0))
# 都心: 新宿・渋谷 〜 六本木・霞が関 〜 銀座・汐留・東京タワー、北は水道橋・後楽園 (東京ドーム)、上野・浅草まで
LAT_MIN, LAT_MAX = 35.645, 35.722
LON_MIN, LON_MAX = 139.690, 139.804
# 街の範囲は2つの長方形を合わせた形: 都心 (北は水道橋まで) と、秋葉原〜上野〜浅草
BOXES = [(35.645, 35.712, 139.690, 139.785), (35.693, 35.722, 139.762, 139.804),
         (35.711, 35.740, 139.695, 139.735),   # 目白・雑司が谷・護国寺・池袋
         (35.615, 35.646, 139.715, 139.760),   # 高輪・品川・港南
         (35.618, 35.642, 139.758, 139.795)]   # 芝浦・お台場
def in_city(lat, lon, m=0.0):
    return any(a - m < lat < b + m and c - m < lon < d + m for a, b, c, d in BOXES)
LAT0, LON0 = 35.6740, 139.7450  # 原点 (霞が関・国会議事堂のあたり)
KX = 111320 * math.cos(math.radians(LAT0))
KZ = 110574

def load(f):
    s = open(f, encoding='utf-8').read()
    return json.loads(s[s.index('{'):s.rindex('}') + 1])

# 手作りのモデルに置き換える所 (緯度, 経度, 半径m) … ここの PLATEAU の建物は除く
REPLACE = [
    (35.70563, 139.75192, 105),  # 東京ドーム (PLATEAU では円柱の箱)
    (35.69332, 139.74983, 62),   # 日本武道館 (PLATEAU では八角形の箱)
    # 補う建物 (data/plateau-extra.json) のうち、手作りのモデルと重なる所
    (35.67590, 139.74480, 110),  # 国会議事堂
    (35.68022, 139.74014, 24),   # テックジム (PLATEAU 2020年度は建て替え前)
    (35.68380, 139.75280, 175),  # 皇居 宮殿
    (35.68155, 139.75335, 20),   # 伏見櫓
    (35.68290, 139.75580, 20),   # 富士見櫓
    (35.67880, 139.75560, 20),   # 桜田巽櫓
    (35.68060, 139.75420, 40),   # 二重橋
    (35.68800, 139.75570, 40),   # 江戸城 天守台
    (35.71480, 139.79670, 70),   # 浅草寺 本堂・五重塔 (手作り)
    (35.71110, 139.79630, 16),   # 雷門
    (35.71330, 139.79650, 20),   # 宝蔵門
    (35.71150, 139.77400, 10),   # 西郷隆盛像
    (35.71230, 139.77030, 25),   # 不忍池 弁天堂
    (35.70983, 139.80032, 26),   # アサヒ スーパードライホール (金の炎のオブジェ)
    (35.69780, 139.76510, 32),   # ニコライ堂
    (35.70200, 139.76790, 45),   # 神田明神
    (35.68680, 139.76320, 10),   # 将門塚
    # 東京駅 丸の内駅舎 (南北に長い。いくつかの点で除く)
    (35.67960, 139.76630, 30), (35.68040, 139.76670, 30), (35.68120, 139.76710, 30), (35.68200, 139.76750, 30), (35.68280, 139.76790, 30),
    (35.67480, 139.73970, 28),   # 日枝神社 社殿
    (35.67670, 139.73130, 26),   # 豊川稲荷
    (35.65860, 139.74540, 75),   # 東京タワー (手作り)
    (35.67870, 139.72630, 70),   # 東宮御所 (手作り)
    (35.68000, 139.73420, 30),   # ホテルニューオータニ本館 (手作り)
    (35.65950, 139.69870, 18),   # SHIBUYA109 (手作り)
    (35.66760, 139.70010, 75),   # 国立代々木競技場 第一体育館 (手作り)
    (35.66530, 139.72630, 80),   # 国立新美術館 (手作り)
    (35.66042, 139.74049, 45),   # 麻布台ヒルズ 森JPタワー (2023年完成。PLATEAU 2020年度は建て替え前)
    (35.62700, 139.77410, 55),   # フジテレビ本社ビル (手作り)
    (35.71540, 139.77580, 28),   # 国立西洋美術館 (手作り)
    (35.71290, 139.77480, 55),   # 東京文化会館 (手作り)
    (35.71630, 139.77640, 35),   # 国立科学博物館 日本館 (手作り)
    (35.71460, 139.77070, 16),   # 上野東照宮 (手作り)
    (35.71180, 139.77250, 10),   # 清水観音堂 (手作り)
    (35.71250, 139.77400, 22),   # 上野の森美術館 (手作り)
    (35.71890, 139.77630, 70),   # 東京国立博物館 本館 (手作り)
    (35.71070, 139.79680, 14),   # 浅草文化観光センター (手作り)
    (35.63550, 139.74070, 40), (35.63750, 139.74120, 40),  # 高輪ゲートウェイ駅 (2020年開業。屋根は手作り)
    (35.71820, 139.72720, 30),   # 護国寺 本堂
    (35.72000, 139.71350, 14),   # 雑司が谷 鬼子母神
    (35.63850, 139.73850, 16),   # 泉岳寺 本堂
    (35.69565, 139.70060, 34),   # 東急歌舞伎町タワー (2023年完成。PLATEAU 2020年度は工事中)
    (35.68450, 139.70290, 30),   # NTTドコモ代々木ビル (手作り)
    (35.69395, 139.70490, 16),   # 花園神社 社殿
    (35.68570, 139.72330, 14),   # 須賀神社 社殿
    (35.69425, 139.74300, 22), (35.69420, 139.74235, 14), (35.69440, 139.74440, 12),  # 靖国神社 拝殿・本殿・神門
]
rep_xy = [((lo - LON0) * KX, -(la - LAT0) * KZ, r) for la, lo, r in REPLACE]

seen = {}
out, names, roads = [], [], []
for f in sorted(glob.glob(src + '/course-*data.js')):
    d = load(f)
    la, lo = d['origin']
    kx = 111320 * math.cos(math.radians(la))
    # コースの座標 → 緯度経度 → 街の座標
    def conv(x, z):
        lat = la - z / KZ
        lon = lo + x / kx
        return lat, lon, (lon - LON0) * KX, -(lat - LAT0) * KZ
    nm = {i: n for i, n in d['names']}
    b, i, k = d['b'], 0, 0
    while i < len(b):
        h2, n = b[i], b[i + 1]
        x, z = b[i + 2], b[i + 3]
        pts = [(x, z)]
        for j in range(n - 1):
            x += b[i + 4 + 2 * j]
            z += b[i + 5 + 2 * j]
            pts.append((x, z))
        i += 2 + 2 * n
        name = nm.get(k)
        k += 1
        cv = [conv(px / 2, pz / 2) for px, pz in pts]
        clat = sum(c[0] for c in cv) / n
        clon = sum(c[1] for c in cv) / n
        if not in_city(clat, clon):
            continue
        if any((sum(c[2] for c in cv) / n - x) ** 2 + (sum(c[3] for c in cv) / n - z) ** 2 < r * r for x, z, r in rep_xy):
            continue
        q = [(round(c[2] * 2), round(c[3] * 2)) for c in cv]
        # 同じ建物が複数のコースに入っている (間引き方が違うことがある) → 重心と高さで見分ける
        cx = sum(c[2] for c in cv) / n
        cz = sum(c[3] for c in cv) / n
        gk = (int(cx // 4), int(cz // 4))
        if any(abs(hh - h2) <= 1 and (sx - cx) ** 2 + (sz - cz) ** 2 < 4
               for ddx in (-1, 0, 1) for ddz in (-1, 0, 1)
               for sx, sz, hh in seen.get((gk[0] + ddx, gk[1] + ddz), ())):
            continue
        seen.setdefault(gk, []).append((cx, cz, h2))
        if name and not name.startswith('BLD_'):
            names.append([len(out), name])
        out.append((h2, q))
    # 首都高の線 (10m 間隔、範囲内だけ。トンネルは 1 の印)
    step = d['step']
    tun = d['tunnels']
    L = len(d['x']) if not d.get('loop') else int(d['loop'] / step) + 1
    seg = None
    for p in range(0, min(L, len(d['x'])), 2):
        lat, lon, X, Z = conv(d['x'][p], d['z'][p])
        inside = in_city(lat, lon, 0.003)
        if not inside:
            if seg and len(seg['x']) > 2:
                roads.append(seg)
            seg = None
            continue
        if seg is None:
            seg = {'x': [], 'z': [], 'h': [], 't': []}
        s = p * step
        seg['x'].append(round(X, 1))
        seg['z'].append(round(Z, 1))
        seg['h'].append(round(d['h'][p], 1))
        seg['t'].append(1 if any(a <= s <= b2 for a, b2 in tun) else 0)
    if seg and len(seg['x']) > 2:
        roads.append(seg)

# 首都高は複数コースで重なる。ほかの線と 8m 以内で重なる点が続く所は1本にする
CELL = 20
grid = {}
kept = []
for r in sorted(roads, key=lambda r: -len(r['x'])):
    dup = [any((r['x'][i] - x) ** 2 + (r['z'][i] - z) ** 2 < 64 and abs(r['h'][i] - h) < 4
               for dx in (-1, 0, 1) for dz in (-1, 0, 1)
               for x, z, h in grid.get((int(r['x'][i] // CELL + dx), int(r['z'][i] // CELL + dz)), ()))
           for i in range(len(r['x']))]
    # 重なっていない区間だけ残す
    cur = None
    for i in range(len(r['x'])):
        if not dup[i]:
            if cur is None:
                cur = {'x': [], 'z': [], 'h': [], 't': []}
                if i > 0:
                    for kk in 'xzht':
                        cur[kk].append(r[kk][i - 1])
            for kk in 'xzht':
                cur[kk].append(r[kk][i])
        elif cur is not None:
            for kk in 'xzht':
                cur[kk].append(r[kk][i])
            if len(cur['x']) > 3:
                kept.append(cur)
            cur = None
    if cur is not None and len(cur['x']) > 3:
        kept.append(cur)
    for i in range(len(r['x'])):
        grid.setdefault((int(r['x'][i] // CELL), int(r['z'][i] // CELL)), []).append((r['x'][i], r['z'][i], r['h'][i]))

# ---------- コースデータにない所を、PLATEAU のベクトルタイルで補う ----------
added = 0
# 既に入っている建物の輪郭 (重心が中に入る、高さもほぼ同じ建物は同じ建物の破片として省く)
POLY_CELL = 50
polys = {}
def add_poly(h2, q):
    xs = [p[0] / 2 for p in q]; zs = [p[1] / 2 for p in q]
    rec = (h2, [(p[0] / 2, p[1] / 2) for p in q], min(xs), max(xs), min(zs), max(zs))
    for gx in range(int(min(xs) // POLY_CELL), int(max(xs) // POLY_CELL) + 1):
        for gz in range(int(min(zs) // POLY_CELL), int(max(zs) // POLY_CELL) + 1):
            polys.setdefault((gx, gz), []).append(rec)
def pip(pts, x, z):
    c = False
    for i in range(len(pts)):
        (xi, zi), (xj, zj) = pts[i], pts[i - 1]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi:
            c = not c
    return c
def covered(cx, cz, h2):
    for h, pts, x0, x1, z0, z1 in polys.get((int(cx // POLY_CELL), int(cz // POLY_CELL)), ()):
        if abs(h - h2) <= 4 and x0 <= cx <= x1 and z0 <= cz <= z1 and pip(pts, cx, cz):
            return True
    return False
for h2, q in out:
    add_poly(h2, q)
for EXTRA, MIN_H in EXTRAS:
    # 高架の首都高にかかる建物は除く (コースデータと同じ考え方)
    deck = [(x, z) for r in kept for x, z, h, t in zip(r['x'], r['z'], r['h'], r['t']) if not t and h >= 3]
    dgrid = {}
    for x, z in deck:
        dgrid.setdefault((int(x // 20), int(z // 20)), []).append((x, z))
    def on_deck(x, z):
        return any((x - a) ** 2 + (z - b) ** 2 < 81 for dx in (-1, 0, 1) for dz in (-1, 0, 1)
                   for a, b in dgrid.get((int(x // 20) + dx, int(z // 20) + dz), ()))
    for bd in json.load(open(EXTRA, encoding='utf-8')):
        h = bd['h']
        if h < 2.5 or len(bd['r']) < 3:
            continue
        clat = sum(p[0] for p in bd['r']) / len(bd['r'])
        clon = sum(p[1] for p in bd['r']) / len(bd['r'])
        if not in_city(clat, clon):
            continue
        cv = [((lo - LON0) * KX, -(la - LAT0) * KZ) for la, lo in bd['r']]
        if len(cv) > 3 and cv[0] == cv[-1]:
            cv = cv[:-1]
        n = len(cv)
        cx = sum(c[0] for c in cv) / n
        cz = sum(c[1] for c in cv) / n
        a = abs(sum(cv[i][0] * cv[i - 1][1] - cv[i - 1][0] * cv[i][1] for i in range(n))) / 2
        if a < 20 or (h < MIN_H and a < 600):
            continue
        if any((cx - x) ** 2 + (cz - z) ** 2 < r * r for x, z, r in rep_xy):
            continue
        if any(on_deck(x, z) for x, z in cv):
            continue
        h2 = round(h * 2)
        gk = (int(cx // 4), int(cz // 4))
        if any(abs(hh - h2) <= 2 and (sx - cx) ** 2 + (sz - cz) ** 2 < 9
               for ddx in (-1, 0, 1) for ddz in (-1, 0, 1)
               for sx, sz, hh in seen.get((gk[0] + ddx, gk[1] + ddz), ())):
            continue
        if covered(cx, cz, h2):
            continue
        seen.setdefault(gk, []).append((cx, cz, h2))
        q = [(round(x * 2), round(z * 2)) for x, z in cv]
        out.append((h2, q))
        add_poly(h2, q)
        added += 1

flat = []
for h2, q in out:
    flat += [h2, len(q), q[0][0], q[0][1]]
    for (x0, z0), (x1, z1) in zip(q, q[1:]):
        flat += [x1 - x0, z1 - z0]
data = {
    'source': '© OpenStreetMap contributors (ODbL) / 国土交通省 Project PLATEAU (東京都23区 2020年度)。首都高グランプリのコースデータと plateau-tokyo23ku-building-mvt-2020 (indigo-lab) から作成',
    'origin': [LAT0, LON0],
    'box': [LAT_MIN, LAT_MAX, LON_MIN, LON_MAX],
    'count': len(out),
    'b': flat,
    'names': names,
    'roads': kept,
}
sys.stderr.write(f'buildings {len(out)} (added {added}) names {len(names)} ints {len(flat)} roads {len(kept)} pts {sum(len(r["x"]) for r in kept)}\n')
sys.stdout.write('// 自動生成 (tools/build_city.py)。' + data['source'] + '\n')
sys.stdout.write('export const CITY = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
