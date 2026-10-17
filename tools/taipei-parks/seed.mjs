// 在「讀人」平台建立「台北市大型公園綠地」專案：先寫反應區與問卷，最後才登記專案
// （登記後手機端立刻可選，先登記會讓手機抓到空的範圍）。專案代號已存在就停止，不覆蓋。
// 用法：node seed.mjs [BASE]   BASE 預設 https://psycho-physiology.healsdesign.org
import fs from "node:fs";

const BASE = (process.argv[2] || "https://psycho-physiology.healsdesign.org").replace(/\/$/, "");
const DIR = new URL(".", import.meta.url);
const PROJECT = {
  id: "taipeiparks",
  name: "台北市大型公園綠地",
  note: "反應區：臺北市界內面積 ≥ 1 公頃的公園綠地 171 座（173 區），邊界取自 OpenStreetMap（Overture Maps 2026-09-23.1）。現場問卷：PRS-11＋PSS-10。",
  status: "active",
  trigger: { mode: "zone" },
};
const geojson = JSON.parse(fs.readFileSync(new URL("zones.geojson", DIR), "utf8"));
const survey = JSON.parse(fs.readFileSync(new URL("survey.json", DIR), "utf8"));

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method, cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* 非 JSON */ }
  return { status: res.status, data };
}
const die = (msg) => { console.error("✗ " + msg); process.exit(1); };

const pid = encodeURIComponent(PROJECT.id);
const existing = await call("GET", "/api/projects?id=" + pid);
if (existing.status === 200) die(`專案代號 ${PROJECT.id} 已存在（${existing.data.project.name}），停止，不覆蓋。`);
if (existing.status !== 404) die(`查詢專案失敗：HTTP ${existing.status}`);
for (const [what, path] of [["反應區", "/api/zones?project="], ["問卷", "/api/survey?project="]]) {
  const r = await call("GET", path + pid);
  if (r.status !== 200) die(`查詢${what}失敗：HTTP ${r.status}`);
  if (r.data.updatedAt) die(`代號 ${PROJECT.id} 雖未登記，後端已有${what}資料（可能是被移除的舊專案），停止，不覆蓋。`);
}

const z = await call("POST", "/api/zones", { project: PROJECT.id, geojson });
if (z.status !== 200 || z.data.count !== geojson.features.length)
  die(`反應區寫入異常：HTTP ${z.status} ${JSON.stringify(z.data)}`);
console.log(`✓ 反應區 ${z.data.count} 區`);

const s = await call("POST", "/api/survey", { project: PROJECT.id, ...survey });
if (s.status !== 200 || s.data.counts.ema !== survey.ema.questions.length)
  die(`問卷寫入異常：HTTP ${s.status} ${JSON.stringify(s.data)}`);
console.log(`✓ 問卷 入組 ${s.data.counts.intake} 題、現場 ${s.data.counts.ema} 題`);

const p = await call("POST", "/api/projects", PROJECT);
if (p.status !== 200) die(`專案登記失敗：HTTP ${p.status} ${JSON.stringify(p.data)}`);
console.log(`✓ 專案 ${p.data.project.id}「${p.data.project.name}」 ${p.data.project.status} 觸發=${p.data.project.trigger.mode}`);

// 回讀核對
const vz = await call("GET", "/api/zones?project=" + pid);
const vs = await call("GET", "/api/survey?project=" + pid);
const vp = await call("GET", "/api/projects?id=" + pid);
const names = vz.data.geojson.features.map((f) => f.properties.name);
const ok = vz.data.count === geojson.features.length &&
  JSON.stringify(names) === JSON.stringify(geojson.features.map((f) => f.properties.name)) &&
  vs.data.ema.questions.length === survey.ema.questions.length &&
  vs.data.ema.questions.every((q, i) => q.id === survey.ema.questions[i].id) &&
  vp.status === 200 && vp.data.project.status === "active";
if (!ok) die("回讀核對不符");
console.log(`✓ 回讀核對通過：${BASE}/project.html?id=${pid}`);
