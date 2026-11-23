// netlify/functions/data.mjs
// HEALS 場域研究 — L3.3 資料端點（v2）
// v2 重點：一個「場次」只寫一筆 blob（各條流包在一起），避免連續寫多筆時
//          Netlify Blobs 的 list 只認到最後一筆、前面被漏掉的問題。
// 六條流：生理 physiology／軌跡 location／環境 environment／現場問卷 ema／
//          活動類型 activity／高度 altitude。
//          後三者舊版 App 未送 → 一律空陣列、計數為 0，不使舊裝置上傳失敗。
// 儲存：Netlify Blobs（store: "heals-data"，key = 專案/編號/場次）。
// email 與研究資料分開（../lib/contacts.mjs）：入組資料與現場作答裡的 email 先拆到 heals-contacts，
//          研究資料只留遮罩與 hasEmail；GET 回傳前再拆一次，舊記錄裡的 email 也不會跟著出去。
import { getStore } from "@netlify/blobs";
import { summarize } from "../lib/session-summary.mjs";
import { splitRecordContacts, saveContact } from "../lib/contacts.mjs";
import { inflateRawSync, inflateSync, gunzipSync } from "node:zlib";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Body-Encoding",
};
const reply = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS },
  });

// key 片段清理：僅保留字母數字與 . - _
// 「#」一律剔除——Blobs 以 URL 路徑存取鍵，# 之後會被當片段截斷，鍵會塌縮互相覆蓋
const seg = (s, fb = "NA") => {
  const v = String(s ?? "").trim().replace(/#/g, "").replace(/[^\w.-]/g, "_");
  return v.length ? v : fb;
};

// 長場次（數小時、數十公里）的上傳包會超過 Netlify 函式 6 MB 的請求上限，直接回 HTTP 413，
// 連走測中每 5 分鐘的備份也一起失敗。新版 App 先壓縮再送，以 X-Body-Encoding 標明；
// 舊版 App 照送純 JSON，兩種都收。JSON 欄位名大量重複，壓縮後通常剩十分之一以下。
async function readBody(req) {
  const enc = (req.headers.get("x-body-encoding") || "").trim().toLowerCase();
  if (!enc) return await req.json();
  const buf = Buffer.from(await req.arrayBuffer());
  let raw;
  if (enc === "deflate-raw") {
    // Apple 的 NSData.compressed(using: .zlib) 產出不帶表頭的 raw DEFLATE；萬一帶了 zlib 表頭也接得住
    try { raw = inflateRawSync(buf); } catch (_) { raw = inflateSync(buf); }
  } else if (enc === "deflate") {
    raw = inflateSync(buf);
  } else if (enc === "gzip") {
    raw = gunzipSync(buf);
  } else {
    throw new Error("unsupported encoding");
  }
  return JSON.parse(raw.toString("utf8"));
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: CORS });

  const store = getStore({ name: "heals-data", consistency: "strong" });
  const url = new URL(req.url);

  // POST /api/data
  // body: { project, code, session, final, physiology:[...], location:[...], environment:[...],
  //         ema:[...], activity:[...], altitude:[...], intake:{...} }
  if (req.method === "POST") {
    let body;
    try { body = await readBody(req); } catch { return reply({ error: "invalid json" }, 400); }
    const project = seg(body.project, "");
    if (!project) return reply({ error: "project required" }, 400);
    const code = seg(body.code);
    const session = seg(body.session);
    const codeRaw = String(body.code ?? "").trim() || code;         // 記錄內保留原樣（如 #1）
    const sessionRaw = String(body.session ?? "").trim() || session;
    const physiology  = Array.isArray(body.physiology)  ? body.physiology  : [];
    const location    = Array.isArray(body.location)    ? body.location    : [];
    const environment = Array.isArray(body.environment) ? body.environment : [];
    const emaRaw      = Array.isArray(body.ema)         ? body.ema         : [];   // 現場問卷作答（舊版 App 未送 → 空陣列）
    const activity    = Array.isArray(body.activity)    ? body.activity    : [];   // CoreMotion 實測活動類型（同上）
    const altitude    = Array.isArray(body.altitude)    ? body.altitude    : [];   // 氣壓計相對高度（同上）

    const key = `${project}/${code}/${session}`;
    const intakeRaw = (body.intake && typeof body.intake === "object") ? body.intake : null;
    // email 與研究資料分開：研究資料只留遮罩，email 另存 heals-contacts。
    // App 每次上傳都帶 intake，這裡寫失敗下一次上傳會再補，所以不擋上傳本體
    const { intake, ema, emails } = splitRecordContacts({ intake: intakeRaw, ema: emaRaw });
    if (emails.length) {
      try { await saveContact({ project, codeKey: code, codeRaw, emails }); }
      catch (_) { /* 下一次上傳再寫 */ }
    }
    const isFinal = body.final === false ? false : true;   // 走測中的定期備份標記 final:false；未帶視為定稿
    const record = {
      project, code: codeRaw, session: sessionRaw, uploadedAt: Date.now(),
      final: isFinal,
      counts: {
        physiology: physiology.length, location: location.length,
        environment: environment.length, ema: ema.length,
        activity: activity.length, altitude: altitude.length,
      },
      physiology, location, environment, ema, activity, altitude,
      intake,                                    // 受測者入組基本資料（email 已拆出；可能為 null）
      hasEmail: emails.length > 0,               // 這位受測者有沒有留 email（email 本身在 heals-contacts）
    };
    await store.setJSON(key, record);   // 單一寫入
    // 場次清單簿登記：繞開 list() 最終一致的延遲；drive-sync 以清單簿為主、list() 為輔
    try {
      const idx = getStore({ name: "heals-data-index", consistency: "strong" });
      let man = null;
      try { man = await idx.get("manifest", { type: "json" }); } catch (_) { /* 首次尚無清單簿 */ }
      if (!man || typeof man !== "object" || !man.keys || typeof man.keys !== "object") man = { keys: {} };
      // 摘要（開始／結束時間、各流筆數）順手登記，每日紀錄只讀清單簿就能彙整，不必逐筆讀整場資料
      let sum = null;
      try { sum = summarize(record); } catch (_) { /* 算不出就不登記，每日紀錄會改讀整筆 */ }
      man.keys[key] = { t: record.uploadedAt, final: isFinal, ...(sum ? { sum } : {}) };
      await idx.setJSON("manifest", man);
    } catch (_) { /* 登記失敗不影響上傳本體；drive-sync 仍可靠 list() 撈到 */ }
    return reply({ ok: true, key, counts: record.counts });
  }

  // GET /api/data?project=X  → 該專案所有場次（每筆含六條流與 counts）
  if (req.method === "GET") {
    const project = seg(url.searchParams.get("project"), "");
    if (!project) return reply({ error: "project required" }, 400);
    const { blobs } = await store.list({ prefix: `${project}/` });
    const out = [];
    for (const b of blobs) {
      const v = await store.get(b.key, { type: "json" });
      if (!v) continue;
      // 2026-11 以前上傳的記錄 intake 裡還有 email：回傳前同樣拆掉（只改回傳的副本，不動儲存的記錄）
      const sp = splitRecordContacts({ intake: v.intake || null, ema: Array.isArray(v.ema) ? v.ema : [] });
      v.intake = sp.intake;
      v.ema = sp.ema;
      if (typeof v.hasEmail !== "boolean") v.hasEmail = sp.emails.length > 0;
      out.push(v);
    }
    out.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
    return reply(out);
  }

  return reply({ error: "method not allowed" }, 405);
};

export const config = { path: "/api/data" };
