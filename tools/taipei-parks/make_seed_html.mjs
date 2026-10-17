// 產生自含的 seed.html：在研究者自己的瀏覽器開啟、按一下即建立專案（流程與 seed.mjs 相同）
// POST 一律送 text/plain：本機檔案對站台是跨來源，application/json 會先發 OPTIONS 預檢，
// 而 zones.mjs／survey.mjs 的預檢回應寫成 new Response("", {status:204}) 會拋錯（204 不得帶 body）。
// text/plain 屬於免預檢的簡單請求；函式一律以 req.json() 解析，不看 Content-Type。
import fs from "node:fs";
const out = new URL("./", import.meta.url);
const gj = fs.readFileSync(new URL("zones.geojson", out), "utf8");
const sv = JSON.stringify(JSON.parse(fs.readFileSync(new URL("survey.json", out), "utf8")));
const seed = fs.readFileSync(new URL("seed.mjs", out), "utf8");
const proj = seed.match(/const PROJECT = (\{[\s\S]*?\n\});/)[1];
const html = `<!DOCTYPE html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>建立台北市大型公園綠地專案</title>
<style>
body{margin:0;background:#faf6ea;color:#33301f;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans TC","PingFang TC",sans-serif;line-height:1.7}
.wrap{max-width:640px;margin:0 auto;padding:28px 16px}
h1{font-size:22px;color:#3f5a2f;margin:0 0 6px}
p{margin:6px 0}
button{font:inherit;font-size:16px;background:#5b7a45;color:#fff;border:1px solid #3f5a2f;border-radius:8px;padding:10px 22px;cursor:pointer;margin:14px 0}
button:disabled{opacity:.45;cursor:not-allowed}
pre{background:#fffdf7;border:1px solid #e7ddc6;border-radius:10px;padding:12px;white-space:pre-wrap;font-size:14px;min-height:3em}
a{color:#2c6b5f}
</style></head><body><div class="wrap">
<h1>建立「台北市大型公園綠地」專案</h1>
<p>按下按鈕後，會在 <b id="base"></b> 依序寫入 ${JSON.parse(gj).features.length} 個反應區、現場問卷（STAI-6＋PRS-11，共 ${JSON.parse(sv).ema.questions.length} 題），最後登記專案 <code>taipeiparks</code>（進行中、範圍觸發）。</p>
<p>專案代號已存在、或後端已有同代號的範圍／問卷時會自動停止，不覆蓋任何資料；重複按也安全。</p>
<button id="go">建立專案</button>
<pre id="log"></pre>
</div>
<script>
const BASE = (new URLSearchParams(location.search).get("base") || "https://psycho-physiology.healsdesign.org").replace(/\\/$/, "");
const PROJECT = ${proj};
const geojson = ${gj};
const survey = ${sv};
const logEl = document.getElementById("log");
const log = (s) => { logEl.textContent += s + "\\n"; };
document.getElementById("base").textContent = BASE;
async function call(method, path, body) {
  const res = await fetch(BASE + path, { method, cache: "no-store",
    headers: body ? { "Content-Type": "text/plain;charset=UTF-8" } : undefined,
    body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await res.json(); } catch (e) {}
  return { status: res.status, data };
}
async function run() {
  const pid = encodeURIComponent(PROJECT.id);
  const existing = await call("GET", "/api/projects?id=" + pid);
  if (existing.status === 200) throw new Error("專案代號 " + PROJECT.id + " 已存在（" + existing.data.project.name + "），停止，不覆蓋。");
  if (existing.status !== 404) throw new Error("查詢專案失敗：HTTP " + existing.status);
  for (const [what, path] of [["反應區", "/api/zones?project="], ["問卷", "/api/survey?project="]]) {
    const r = await call("GET", path + pid);
    if (r.status !== 200) throw new Error("查詢" + what + "失敗：HTTP " + r.status);
    if (r.data.updatedAt) throw new Error("代號 " + PROJECT.id + " 雖未登記，後端已有" + what + "資料，停止，不覆蓋。");
  }
  const z = await call("POST", "/api/zones", { project: PROJECT.id, geojson });
  if (z.status !== 200 || z.data.count !== geojson.features.length) throw new Error("反應區寫入異常：HTTP " + z.status);
  log("✓ 反應區 " + z.data.count + " 區");
  const s = await call("POST", "/api/survey", Object.assign({ project: PROJECT.id }, survey));
  if (s.status !== 200 || s.data.counts.ema !== survey.ema.questions.length) throw new Error("問卷寫入異常：HTTP " + s.status);
  log("✓ 問卷：入組 " + s.data.counts.intake + " 題、現場 " + s.data.counts.ema + " 題");
  const p = await call("POST", "/api/projects", PROJECT);
  if (p.status !== 200) throw new Error("專案登記失敗：HTTP " + p.status);
  log("✓ 專案 " + p.data.project.id + "「" + p.data.project.name + "」已登記，狀態：進行中");
  const vz = await call("GET", "/api/zones?project=" + pid);
  const vs = await call("GET", "/api/survey?project=" + pid);
  if (vz.data.count !== geojson.features.length || vs.data.ema.questions.length !== survey.ema.questions.length) throw new Error("回讀核對不符");
  log("✓ 回讀核對通過");
  const a = document.createElement("a"); a.href = BASE + "/project.html?id=" + pid; a.textContent = "開啟專案頁 →";
  logEl.appendChild(a);
}
document.getElementById("go").addEventListener("click", async (e) => {
  e.target.disabled = true; logEl.textContent = "";
  try { await run(); } catch (err) { log("✗ " + err.message); e.target.disabled = false; }
});
</script></body></html>`;
fs.writeFileSync(new URL("seed.html", out), html);
console.log("seed.html bytes:", html.length);
