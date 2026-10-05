// daily-log.mjs — 每日紀錄 /api/daily-log
// 彙整某一天（台北時間）有走測的專案：每個專案列出場次、受測編號、開始時間、時長、
// 定稿與否，以及生理／軌跡／環境／問卷／活動／高度六條流的筆數。不含作答內容與 email。
//
// GET                 → { dates:[{date, projects, sessions, builtAt}] }（只列有收集到資料的日子，新→舊）
// GET  ?date=YYYY-MM-DD → 該日紀錄；尚未彙整過、或是今天，就即時算一份（live:true，不存檔）
// POST ?date=YYYY-MM-DD → 彙整並存檔，同時在 Google Drive「每日紀錄」資料夾寫一份 CSV
//                       不帶 date＝昨天。由 daily-log-cron.mjs 每天台北 00:10 呼叫，也可手動補做。
// 儲存：store「heals-daily-log」，一天一個 key（單筆寫入）；清單另存單一 key「index」，強一致讀取。
// 場次來源：清單簿 heals-data-index/manifest。新版上傳會附摘要（sum），只讀清單簿即可；
//          舊場次沒有摘要，才回頭讀整筆記錄（只讀上傳時間落在該日之後的，數量有限）。
import { getStore } from "@netlify/blobs";
import { summarize, tpeDate, tpeDayStart, STREAMS } from "../lib/session-summary.mjs";

const DAY_MS = 24 * 3600 * 1000;
const TIME_BUDGET_MS = 8000;   // 讀舊場次的逾時保護；超過就標 partial，下次再補

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: HEADERS });

const logStore = () => getStore({ name: "heals-daily-log", consistency: "strong" });

/* ---- 彙整 ---- */

async function buildDay(date) {
  const started = Date.now();
  const dayStart = tpeDayStart(date);
  const dayEnd = dayStart + DAY_MS;

  let man = null;
  try { man = await getStore({ name: "heals-data-index", consistency: "strong" }).get("manifest", { type: "json" }); }
  catch (_) { /* 尚無清單簿 */ }
  const keys = (man && man.keys && typeof man.keys === "object") ? man.keys : {};

  let registry = [];
  try {
    const r = await getStore({ name: "heals-projects", consistency: "strong" }).get("registry", { type: "json" });
    if (r && Array.isArray(r.projects)) registry = r.projects;
  } catch (_) {}
  const nameOf = (id) => (registry.find((p) => p.id === id) || {}).name || id;

  const dataStore = getStore({ name: "heals-data", consistency: "strong" });
  const byProject = new Map();
  let partial = false;

  for (const key of Object.keys(keys)) {
    const v = keys[key];
    const t = Number(v && typeof v === "object" ? v.t : v) || 0;
    if (t < dayStart) continue;                 // 最後一次上傳早於當天 → 不可能是當天的走測
    const final = !(v && typeof v === "object" && v.final === false);

    let sum = v && typeof v === "object" ? v.sum : null;
    if (!sum) {                                 // 舊場次：回頭讀整筆算摘要
      if (Date.now() - started > TIME_BUDGET_MS) { partial = true; continue; }
      try {
        const rec = await dataStore.get(key, { type: "json" });
        if (rec) sum = summarize(rec);
      } catch (_) {}
      if (!sum) continue;
    }
    if (sum.start == null || sum.start < dayStart || sum.start >= dayEnd) continue;   // 以開始時間歸日

    const project = key.split("/")[0];
    if (!byProject.has(project)) byProject.set(project, []);
    byProject.get(project).push({
      code: sum.code,
      session: sum.session,
      start: sum.start,
      end: sum.end,
      durationMin: sum.end != null ? Math.round((sum.end - sum.start) / 60000) : null,
      final,
      counts: sum.counts,
    });
  }

  const zero = () => Object.fromEntries(STREAMS.map((k) => [k, 0]));
  const projects = [...byProject.entries()].map(([id, sessions]) => {
    sessions.sort((a, b) => a.start - b.start);
    const counts = zero();
    for (const s of sessions) for (const k of STREAMS) counts[k] += Number(s.counts && s.counts[k]) || 0;
    return {
      id, name: nameOf(id), sessions,
      totals: {
        sessions: sessions.length,
        participants: new Set(sessions.map((s) => s.code)).size,
        durationMin: sessions.reduce((a, s) => a + (s.durationMin || 0), 0),
        counts,
      },
    };
  }).sort((a, b) => a.id.localeCompare(b.id));

  const counts = zero();
  for (const p of projects) for (const k of STREAMS) counts[k] += p.totals.counts[k];
  return {
    date, tz: "Asia/Taipei", builtAt: Date.now(),
    projects,
    totals: {
      projects: projects.length,
      sessions: projects.reduce((a, p) => a + p.totals.sessions, 0),
      counts,
    },
    ...(partial ? { partial: true } : {}),
  };
}

/* ---- CSV（Excel 欄名中英並陳，跨檔合併時欄位鍵才唯一） ---- */

const CSV_HEAD = [
  "日期 Date", "專案 Project", "專案名稱 Project name", "受測編號 Code", "場次 Session",
  "開始 Start (Taipei)", "結束 End (Taipei)", "時長 Duration (min)", "定稿 Final",
  "生理 Physiology", "軌跡 Track", "環境 Environment", "問卷 EMA", "活動 Activity", "高度 Altitude",
];
const fmtTpe = (ms) => ms == null ? "" :
  new Date(ms).toLocaleString("sv-SE", { timeZone: "Asia/Taipei" });
function cell(v) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;          // 防 Excel 公式注入
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCSV(day) {
  const rows = [CSV_HEAD];
  for (const p of day.projects) for (const s of p.sessions) {
    rows.push([
      day.date, p.id, p.name, s.code, s.session, fmtTpe(s.start), fmtTpe(s.end), s.durationMin,
      s.final ? "Y" : "N",
      ...STREAMS.map((k) => (s.counts && s.counts[k]) || 0),
    ]);
  }
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/* ---- Google Drive（與 drive-sync 同一套 OAuth；未設定時略過，不影響存檔） ---- */

async function driveToken() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=refresh_token"
      + "&refresh_token=" + encodeURIComponent(process.env.GDRIVE_OAUTH_REFRESH_TOKEN)
      + "&client_id=" + encodeURIComponent(process.env.GDRIVE_OAUTH_CLIENT_ID)
      + "&client_secret=" + encodeURIComponent(process.env.GDRIVE_OAUTH_CLIENT_SECRET),
  });
  if (!r.ok) throw new Error("OAuth 換 token 失敗 HTTP " + r.status);
  const d = await r.json();
  if (!d.access_token) throw new Error("OAuth 回應缺 access_token");
  return d.access_token;
}
async function driveFolder(token, name, parentId) {
  const q = encodeURIComponent("name='" + name.replace(/'/g, "\\'") + "' and '" + parentId
    + "' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false");
  const auth = { Authorization: "Bearer " + token };
  const f = await fetch("https://www.googleapis.com/drive/v3/files?q=" + q + "&fields=files(id)&pageSize=1", { headers: auth });
  if (!f.ok) throw new Error("查資料夾失敗 HTTP " + f.status);
  const found = (await f.json()).files;
  if (found && found[0]) return found[0].id;
  const c = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST", headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  if (!c.ok) throw new Error("建資料夾失敗 HTTP " + c.status);
  return (await c.json()).id;
}
async function driveWriteCSV(token, name, csv, folderId, existingId) {
  const auth = { Authorization: "Bearer " + token };
  if (existingId) {                                    // 重新彙整：同一檔原地更新，不重複建檔
    const r = await fetch("https://www.googleapis.com/upload/drive/v3/files/" + existingId + "?uploadType=media&fields=id", {
      method: "PATCH", headers: { ...auth, "Content-Type": "text/csv; charset=UTF-8" }, body: csv,
    });
    if (r.ok) return (await r.json()).id;
    if (r.status !== 404) throw new Error("更新 CSV 失敗 HTTP " + r.status);
    // 404：檔案被手動刪了，改為新建
  }
  const boundary = "heals" + Date.now() + Math.random().toString(36).slice(2, 8);
  const body =
    "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"
    + JSON.stringify({ name, parents: [folderId], mimeType: "text/csv" })
    + "\r\n--" + boundary + "\r\nContent-Type: text/csv; charset=UTF-8\r\n\r\n" + csv
    + "\r\n--" + boundary + "--";
  const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST", headers: { ...auth, "Content-Type": "multipart/related; boundary=" + boundary }, body,
  });
  if (!r.ok) throw new Error("上傳 CSV 失敗 HTTP " + r.status);
  return (await r.json()).id;
}
async function syncDrive(day, prevDrive) {
  const rootId = process.env.GDRIVE_FOLDER_ID;
  const ready = rootId && process.env.GDRIVE_OAUTH_REFRESH_TOKEN
    && process.env.GDRIVE_OAUTH_CLIENT_ID && process.env.GDRIVE_OAUTH_CLIENT_SECRET;
  if (!ready) return { skipped: "Drive 未設定" };
  if (!day.totals.sessions && !(prevDrive && prevDrive.fileId)) return { skipped: "當天沒有資料" };
  const token = await driveToken();
  const folderId = (prevDrive && prevDrive.folderId) || await driveFolder(token, "每日紀錄", rootId);
  const name = "每日紀錄_" + day.date + ".csv";
  const fileId = await driveWriteCSV(token, name, toCSV(day), folderId, prevDrive && prevDrive.fileId);
  return { folderId, fileId, name };
}

/* ---- 端點 ---- */

// 來回換算一次：2026-13-40 這種日期 Date.UTC 會默默進位成別天，必須擋掉
const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "") && tpeDate(tpeDayStart(d)) === d;

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  const url = new URL(req.url);
  const store = logStore();
  const today = tpeDate(Date.now());

  if (req.method === "GET") {
    const date = url.searchParams.get("date");
    if (!date) {
      let idx = null;
      try { idx = await store.get("index", { type: "json" }); } catch (_) {}
      const dates = Object.entries((idx && idx.dates) || {})
        .map(([d, v]) => ({ date: d, ...v }))
        .sort((a, b) => b.date.localeCompare(a.date));
      return json({ dates, today });
    }
    const d = date === "today" ? today : date;
    if (!validDate(d)) return json({ error: "date 格式應為 YYYY-MM-DD" }, 400);
    if (d !== today) {
      let saved = null;
      try { saved = await store.get(d, { type: "json" }); } catch (_) {}
      if (saved) return json(saved);
    }
    return json({ ...(await buildDay(d)), live: true });   // 今天或尚未彙整：即時算，不存檔
  }

  if (req.method === "POST") {
    const d = url.searchParams.get("date") || tpeDate(Date.now() - DAY_MS);
    if (!validDate(d)) return json({ error: "date 格式應為 YYYY-MM-DD" }, 400);
    const day = await buildDay(d);

    let prev = null;
    try { prev = await store.get(d, { type: "json" }); } catch (_) {}
    try { day.drive = await syncDrive(day, prev && prev.drive); }
    catch (e) { day.drive = { error: String(e.message || e).slice(0, 200), ...(prev && prev.drive && prev.drive.fileId ? { fileId: prev.drive.fileId, folderId: prev.drive.folderId } : {}) }; }

    await store.setJSON(d, day);                         // 單筆寫入

    let idx = null;
    try { idx = await store.get("index", { type: "json" }); } catch (_) {}
    if (!idx || typeof idx !== "object" || !idx.dates) idx = { dates: {} };
    if (day.totals.sessions) {
      idx.dates[d] = { projects: day.totals.projects, sessions: day.totals.sessions, builtAt: day.builtAt };
    } else {
      delete idx.dates[d];                               // 只列有收集到資料的日子
    }
    await store.setJSON("index", idx);
    return json({ ok: true, date: d, totals: day.totals, drive: day.drive, partial: !!day.partial });
  }

  return json({ error: "method not allowed" }, 405);
};

export const config = { path: "/api/daily-log" };
