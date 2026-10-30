#!/usr/bin/env python3
"""ターザン大東京の街のデータ (js/city-data.js) を作る。

首都高グランプリ (https://github.com/techgymjp/shutoko) のコースデータ js/course-*-data.js には、
首都高に沿った PLATEAU の建物 (輪郭・高さ・名前) と OpenStreetMap の首都高の線が入っている。
これを全部読み、都心の範囲 (BOX) にある建物を1つの座標系にまとめて重複を除く。

出典:
  © OpenStreetMap contributors (ODbL)
  国土交通省 Project PLATEAU 3D都市モデル 東京都23区 (2020年度)

使い方:
  python3 tools/build_city.py <shutoko の js ディレクトリ> > js/city-data.js
"""
import glob, json, math, sys

src = sys.argv[1]
# 都心: 新宿・渋谷 〜 六本木・霞が関 〜 銀座・汐留・東京タワー、北は水道橋・後楽園 (東京ドーム) まで
LAT_MIN, LAT_MAX = 35.645, 35.712
LON_MIN, LON_MAX = 139.690, 139.785
LAT0, LON0 = 35.6740, 139.7450  # 原点 (霞が関・国会議事堂のあたり)
KX = 111320 * math.cos(math.radians(LAT0))
KZ = 110574

def load(f):
    s = open(f, encoding='utf-8').read()
    return json.loads(s[s.index('{'):s.rindex('}') + 1])

# 手作りのモデルに置き換える所 (緯度, 経度, 半径m) … ここの PLATEAU の建物は除く
REPLACE = [
    (35.70563, 139.75192, 105),  # 東京ドーム (PLATEAU では円柱の箱)
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
        if not (LAT_MIN < clat < LAT_MAX and LON_MIN < clon < LON_MAX):
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
        inside = LAT_MIN - 0.003 < lat < LAT_MAX + 0.003 and LON_MIN - 0.003 < lon < LON_MAX + 0.003
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

flat = []
for h2, q in out:
    flat += [h2, len(q), q[0][0], q[0][1]]
    for (x0, z0), (x1, z1) in zip(q, q[1:]):
        flat += [x1 - x0, z1 - z0]
data = {
    'source': '© OpenStreetMap contributors (ODbL) / 国土交通省 Project PLATEAU (東京都23区 2020年度)。首都高グランプリのコースデータから作成',
    'origin': [LAT0, LON0],
    'box': [LAT_MIN, LAT_MAX, LON_MIN, LON_MAX],
    'count': len(out),
    'b': flat,
    'names': names,
    'roads': kept,
}
sys.stderr.write(f'buildings {len(out)} names {len(names)} ints {len(flat)} roads {len(kept)} pts {sum(len(r["x"]) for r in kept)}\n')
sys.stdout.write('// 自動生成 (tools/build_city.py)。' + data['source'] + '\n')
sys.stdout.write('export const CITY = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
