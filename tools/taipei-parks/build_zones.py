# 由 Overture Maps（OSM 衍生）land_use 建立「台北市大於一公頃的公園綠地」反應區
# 用法：先跑 fetch_overture.py，再 python build_zones.py → zones.geojson、zones_list.csv
import pyarrow.parquet as pq, shapely, shapely.wkb, json, warnings, collections, sys
warnings.filterwarnings("ignore")
from shapely.ops import transform, unary_union
from shapely.geometry import Polygon, MultiPolygon, mapping
from pyproj import Transformer
TO_M = Transformer.from_crs(4326, 3826, always_xy=True).transform
TO_LL = Transformer.from_crs(3826, 4326, always_xy=True).transform

MIN_HA_M2 = 10000          # 1 公頃（以落在台北市界內的面積計）
CLOSE_M = 12               # 同名公園被窄路切開時，以 ±12 m 閉合合併（縫寬 ≤ 24 m）
CLOSE_M_MAX = 16
SIMPLIFY_M = 1.5           # 頂點簡化容許誤差（遠小於 GPS 誤差）
MIN_PART_M2 = 2000         # 合併後仍分離的碎片，小於此面積略去
REPEAT_MIN = 15            # 進區即跳一次，之後在區內每 15 分鐘再跳（研究者決定，2026-10-18）

divs = pq.read_table("data/divisions.parquet").to_pylist()
tpe = transform(TO_M, shapely.wkb.loads([r for r in divs if r["subtype"]=="region" and r["region"]=="TW-TPE"][0]["geometry"]))
dists = {r["names"]["primary"]: transform(TO_M, shapely.wkb.loads(r["geometry"])) for r in divs
         if r["region"]=="TW-TPE" and r["subtype"]=="locality" and r["names"]["primary"].endswith("區") and len(r["names"]["primary"])==3}
assert len(dists)==12, sorted(dists)
villages = {r["names"]["primary"]: transform(TO_M, shapely.wkb.loads(r["geometry"])) for r in divs
            if r["region"]=="TW-TPE" and r["subtype"]=="locality" and r["names"]["primary"].endswith("里")}

# 無名多邊形：僅在多邊形內含高信度的同名公園 POI 時命名（逐一人工核對過）
NAME_FIX = {
    "w764011467": "花博公園圓山園區",   # 內含 花博公園 / Taipei Expo Park / 中山親子館 / MAJI 集食行樂
    "w375260838": "磺溪河堤環狀公園",   # 內含 POI「磺溪河堤環狀公園」(信度 0.88)
}
RENAME = {
    "w261084893": "木柵運動公園",       # OSM 名「恆光國小預定地」，內含 POI「木柵運動公園」
    "w60793441":  "花博公園圓山園區",   # OSM 名「圓山公園」，內含 POI「花博公園圓山園區」；與上面的無名塊相鄰，合為一區
}
EXCLUDE_IDS = {
    "w1258952986",   # 敦化北路苗圃：公園處苗圃，非開放綠地
}

lu = pq.read_table("data/land_use.parquet").to_pylist()
feats = []
for r in lu:
    key = (r["subtype"], r["class"])
    tags = dict(r["source_tags"] or [])
    if key == ("park","park"):
        pass
    elif key == ("horticulture","garden") and tags.get("garden:type") == "public":
        pass
    else:
        continue
    oid = r["sources"][0]["record_id"].split("@")[0]
    if oid in EXCLUDE_IDS: continue
    g = shapely.wkb.loads(r["geometry"])
    if g.geom_type not in ("Polygon","MultiPolygon"): continue
    gm = transform(TO_M, g).buffer(0)
    if not gm.intersects(tpe): continue
    nm = (r["names"] or {}).get("primary") if r["names"] else None
    nm = RENAME.get(oid) or nm or NAME_FIX.get(oid)
    if not nm: continue
    nm = nm.strip()
    if nm.endswith("廣場") or nm.startswith("臺北流行音樂中心"): continue   # 廣場類與流行音樂中心不收（研究者決定，2026-10-17）
    feats.append(dict(oid=oid, name=nm, g=gm, cls=key))

# 同名、相距 ≤ 2*CLOSE_M 的多邊形歸為同一座公園
by_name = collections.defaultdict(list)
for f in feats: by_name[f["name"]].append(f)
groups = []
for nm, fs in by_name.items():
    left = fs[:]
    while left:
        cur = [left.pop()]
        changed = True
        while changed:
            changed = False
            u = unary_union([c["g"] for c in cur]).buffer(2*CLOSE_M)
            for f in left[:]:
                if u.intersects(f["g"]):
                    cur.append(f); left.remove(f); changed = True
        groups.append(dict(name=nm, members=cur))

parks = []
for gp in groups:
    geom = unary_union([m["g"] for m in gp["members"]]).buffer(0)
    a_in = geom.intersection(tpe).area
    if a_in < MIN_HA_M2: continue
    if a_in / geom.area < 0.5: continue          # 主要在市界外者不收
    parks.append(dict(name=gp["name"], geom=geom, area=geom.area, a_in=a_in, oids=sorted(m["oid"] for m in gp["members"])))

# 子區：≥ 80% 面積落在另一座較大公園內者剔除
parks.sort(key=lambda p: -p["area"])
keep, dropped_sub = [], []
for p in parks:
    host = next((k for k in keep if p["geom"].intersection(k["geom"]).area >= 0.8*p["area"]), None)
    if host: dropped_sub.append((p["name"], host["name"])); continue
    keep.append(p)

# 每座公園轉成一或多個單一 Polygon（反應區只收 Polygon、只認外環）
def parts_of(g):
    return list(g.geoms) if g.geom_type == "MultiPolygon" else [g]
zones_raw = []
for p in keep:
    g = p["geom"]
    if g.geom_type == "MultiPolygon":
        for d in (CLOSE_M, CLOSE_M_MAX):        # 先試 12 m，仍分離再試 16 m（縫寬 ≤ 32 m 視為同一座公園）
            gc = g.buffer(d, join_style="mitre").buffer(-d, join_style="mitre")
            if len([q for q in parts_of(gc) if q.area >= MIN_PART_M2]) == 1: break
        g = gc
    parts = [pt for pt in parts_of(g) if pt.area >= MIN_PART_M2]
    holes = sum(Polygon(i).area for pt in parts for i in pt.interiors)
    for pt in parts:
        outer = Polygon(pt.exterior).simplify(SIMPLIFY_M, preserve_topology=True)
        c = outer.representative_point()
        dist = next((k for k, v in dists.items() if v.contains(c)), None) or \
               min(dists, key=lambda k: dists[k].distance(c))
        vil = next((k for k, v in villages.items() if v.contains(c)), "")
        zones_raw.append(dict(name=p["name"], poly=outer, park_area=p["a_in"], part_area=outer.area,
                              nparts=len(parts), holes=holes, dist=dist, vil=vil, oids=p["oids"], pid=id(p)))

# 不同公園同名 → 名稱後加行政區
name_parks = collections.defaultdict(dict)
for z in zones_raw: name_parks[z["name"]][z["pid"]] = z
dup = {n for n, s in name_parks.items() if len(s) > 1}
# 同名公園若落在同一行政區，改以里別區分
dup_by_vil = {n for n in dup if len({z["dist"] for z in name_parks[n].values()}) < len(name_parks[n])}
DIST_ORDER = ["中正區","大同區","中山區","松山區","大安區","萬華區","信義區","士林區","北投區","內湖區","南港區","文山區"]
for z in zones_raw:
    z["label"] = (f'{z["name"]}（{z["vil"]}）' if z["name"] in dup_by_vil
                  else f'{z["name"]}（{z["dist"]}）' if z["name"] in dup else z["name"])
zones_raw.sort(key=lambda z: (DIST_ORDER.index(z["dist"]), -z["park_area"], z["label"], -z["part_area"]))

features = []
for i, z in enumerate(zones_raw, 1):
    ring = [[round(x, 6), round(y, 6)] for x, y in transform(TO_LL, z["poly"]).exterior.coords]
    if ring[0] != ring[-1]: ring.append(ring[0][:])
    features.append({"type": "Feature",
        "geometry": {"type": "Polygon", "coordinates": [ring]},
        "properties": {"zoneId": f"tp{i:03d}", "name": z["label"], "survey": "", "repeatMinutes": REPEAT_MIN}})
gj = {"type": "FeatureCollection", "features": features}
json.dump(gj, open("zones.geojson", "w"), ensure_ascii=False, separators=(",", ":"))
meta = [dict(zoneId=f["properties"]["zoneId"], name=f["properties"]["name"], district=z["dist"],
             park_ha=round(z["park_area"]/1e4, 2), part_ha=round(z["part_area"]/1e4, 2), parts=z["nparts"],
             holes_ha=round(z["holes"]/1e4, 2), vertices=len(f["geometry"]["coordinates"][0]) - 1, osm=z["oids"])
        for f, z in zip(features, zones_raw)]
import csv
with open("zones_list.csv", "w", encoding="utf-8-sig", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["編號 zoneId", "名稱 Name", "行政區 District", "面積（公頃）Area (ha)", "此區面積（公頃，分塊時）", "OSM 來源 OSM IDs"])
    for m in meta:
        w.writerow([m["zoneId"], m["name"], m["district"], m["park_ha"], m["part_ha"] if m["parts"] > 1 else "", " ".join(m["osm"])])
print("parks:", len(keep), "zones:", len(features), "dropped sub-areas:", dropped_sub)
print("dup names:", dup)
print("vertices total:", sum(m["vertices"] for m in meta), "max:", max(m["vertices"] for m in meta))
import os; print("geojson bytes:", os.path.getsize("zones.geojson"))
