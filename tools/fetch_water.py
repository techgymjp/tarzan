#!/usr/bin/env python3
"""街の水面 (皇居のお濠・庭園の池・川・運河) を、国土地理院のベクトルタイル (地理院地図Vector) の waterarea から取り出して
js/water-data.js を作る。座標は街の座標 (tools/build_city.py と同じ原点、0.5m 単位の整数)。

出典: 国土地理院 ベクトルタイル (https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/)

使い方:
  python3 tools/fetch_water.py > js/water-data.js
"""
import json, math, sys, urllib.request

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from fetch_plateau_mvt import decode, area2  # MVT の読み取りは共通

Z = 15
URL = 'https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/{z}/{x}/{y}.pbf'
LAT_MIN, LAT_MAX = 35.640, 35.726
LON_MIN, LON_MAX = 139.685, 139.808
LAT0, LON0 = 35.6740, 139.7450
KX = 111320 * math.cos(math.radians(LAT0))
KZ = 110574


def decode_layer(b, want):
    """decode() は全レイヤーをまとめて返すので、レイヤー名で絞る版"""
    from fetch_plateau_mvt import fields, value, packed, rings
    out = []
    for f, t, layer in fields(b):
        if f != 3:
            continue
        name, raw, extent = None, [], 4096
        for lf, lt, lv in fields(layer):
            if lf == 1:
                name = lv.decode('utf-8')
            elif lf == 2:
                raw.append(lv)
            elif lf == 5:
                extent = lv
        if name != want:
            continue
        for fb in raw:
            geom, gtype = [], 0
            for ff, ft, fv in fields(fb):
                if ff == 3:
                    gtype = fv
                elif ff == 4:
                    geom = packed(fv)
            if gtype == 3:
                out.append((rings(geom), extent))
    return out


def main():
    def tx(lon): return (lon + 180) / 360 * 2 ** Z
    def ty(lat):
        r = math.radians(lat)
        return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2 ** Z
    def city(x, y):
        lon = x / 2 ** Z * 360 - 180
        lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / 2 ** Z))))
        return (round((lon - LON0) * KX * 2), round(-(lat - LAT0) * KZ * 2))
    polys = []  # [外側の輪, 穴, 穴, ...]  (輪は [x0, z0, x1, z1, ...])
    for X in range(int(tx(LON_MIN)), int(tx(LON_MAX)) + 1):
        for Y in range(int(ty(LAT_MAX)), int(ty(LAT_MIN)) + 1):
            try:
                with urllib.request.urlopen(URL.format(z=Z, x=X, y=Y), timeout=30) as res:
                    feats = decode_layer(res.read(), 'waterarea')
            except Exception as e:
                sys.stderr.write(f'tile {X},{Y}: {e}\n')
                continue
            for rs, ext in feats:
                cur = None
                for r in rs:
                    if len(r) < 3:
                        continue
                    ring = []
                    for px, py in r:
                        ring += city(X + px / ext, Y + py / ext)
                    if area2(r) < 0:  # 外側の輪 (y 下向きで時計回り)
                        cur = [ring]
                        polys.append(cur)
                    elif cur is not None:
                        cur.append(ring)
            sys.stderr.write(f'tile {X},{Y}: polygons {len(polys)}\n')
    sys.stdout.write('// 自動生成 (tools/fetch_water.py)。出典: 国土地理院 ベクトルタイル (waterarea)\n')
    sys.stdout.write('export const WATER = ' + json.dumps(polys, separators=(',', ':')) + ';\n')


if __name__ == '__main__':
    main()
