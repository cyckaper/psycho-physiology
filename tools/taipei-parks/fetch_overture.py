# 自 Overture Maps 公開 S3（免帳號）擷取臺北市一帶的行政界、土地使用與地點，存成 data/*.parquet
# Overture 的 land_use 由 OpenStreetMap 衍生，保留 OSM 原始標籤（source_tags）與 OSM ID。
# 用法：python fetch_overture.py   （需 pyarrow；換版本改 RELEASE）
import os, sys, pyarrow.fs as pafs, pyarrow.dataset as ds, pyarrow.compute as pc, pyarrow.parquet as pq

RELEASE = "2026-09-23.1"
X0, X1, Y0, Y1 = 121.40, 121.70, 24.90, 25.25          # 臺北市外框再放寬一點
proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
kw = dict(anonymous=True, region="us-west-2")
if proxy: kw["proxy_options"] = proxy.replace("https://", "http://")
if os.path.exists("/root/.ccr/ca-bundle.crt"): kw["tls_ca_file_path"] = "/root/.ccr/ca-bundle.crt"
s3 = pafs.S3FileSystem(**kw)
REL = f"overturemaps-us-west-2/release/{RELEASE}"
in_box = ((pc.field("bbox", "xmin") < X1) & (pc.field("bbox", "xmax") > X0) &
          (pc.field("bbox", "ymin") < Y1) & (pc.field("bbox", "ymax") > Y0))
os.makedirs("data", exist_ok=True)
JOBS = [
    ("divisions", "theme=divisions/type=division_area", in_box & (pc.field("country") == "TW"),
     ["id", "names", "subtype", "class", "region", "bbox", "geometry"]),
    ("land_use", "theme=base/type=land_use", in_box, None),
    ("places", "theme=places/type=place", in_box,
     ["id", "names", "basic_category", "taxonomy", "confidence", "geometry", "bbox"]),
]
for name, path, flt, cols in JOBS:
    tb = ds.dataset(f"{REL}/{path}/", filesystem=s3, format="parquet").to_table(filter=flt, columns=cols)
    pq.write_table(tb, f"data/{name}.parquet")
    print(name, tb.num_rows, file=sys.stderr)
