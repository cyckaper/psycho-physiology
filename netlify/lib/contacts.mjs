// contacts.mjs — 聯絡資料（email）與研究資料分開存放
//
// 為什麼：知情同意書與 App Store 送審都寫明「電子郵件與研究資料分開存放，只用於寄送個人回饋報告，
// 寄出後或研究結束時刪除」。以前上傳包的 intake 連 email 整份存進 heals-data，再原樣封存到 Drive 的
// 問卷.json，研究資料裡就帶著直接識別資訊。現在一律先拆：
//   · 研究資料（heals-data、Drive 研究資料夾、GET /api/data）只留遮罩字樣與「有沒有留 email」（hasEmail）
//   · email 另存 heals-contacts：每個專案一個 key（p/<專案>），裡面依受測編號列出 email
//   · 專案索引 _index（單一 key，記每個專案最後更新時間）：drive-sync 據以找出要更新的聯絡資料檔，
//     不靠 list()（網站教訓二）
//   · Drive 端記帳 _drive（單一 key）：聯絡資料夾 ID 與各專案檔案 ID
// 拆的範圍是 intake 全部，加上 ema 每筆事件的作答（survey）；生理、環境、軌跡沒有受測者自己打的字，不掃。
// drive-sync 再把每個專案的聯絡資料寫成一個 JSON，放在 Drive 另一個資料夾（不在研究資料根資料夾底下）。
// 寄完報告或研究結束時，從 Drive 那個資料夾與 heals-contacts 一起刪除。
import { getStore } from "@netlify/blobs";

export const CONTACTS_STORE = "heals-contacts";
export const CONTACTS_INDEX = "_index";
export const CONTACTS_DRIVE = "_drive";
export const EMAIL_MASK = "[email 已另存]";

// 任何字串裡像 email 的片段都拆出來（不只 email 題：受測者也可能把 email 打在開放題裡）
const EMAIL_RE = /[^\s@<>()[\]"'`,;:]+@[^\s@<>()[\]"'`,;:]+\.[A-Za-z]{2,}/g;

export const contactKey = (project) => "p/" + project;

// 一次拆分用一個收集器：同一筆記錄的 intake 與 ema 找到的 email 合併去重（不分大小寫）
function collector() {
  const found = new Map();
  const add = (s) => {
    const e = String(s ?? "").trim();
    if (!e || e === EMAIL_MASK) return;   // 已經拆過的記錄（drive-sync、GET 會再拆一次）：遮罩字樣不是 email
    if (!found.has(e.toLowerCase())) found.set(e.toLowerCase(), e);
  };
  const scrub = (v) => {
    if (typeof v === "string") return v.replace(EMAIL_RE, (m) => { add(m); return EMAIL_MASK; });
    if (Array.isArray(v)) return v.map(scrub);
    if (v && typeof v === "object") {
      const o = {};
      for (const k of Object.keys(v)) o[k] = scrub(v[k]);
      // email 題的答案（SurveyAnswer type="email"）整段視為聯絡資料：選填題手機端不驗格式，
      // 打成 jake@ntu 這種不完整的也要拆出來，不能因為正則沒抓到就留在研究資料裡
      if (o.type === "email" && typeof v.textValue === "string" && v.textValue.trim()) {
        if (o.textValue === v.textValue) add(v.textValue);   // 正則沒抓到才整段收；抓到的已在上面收過
        o.textValue = EMAIL_MASK;
      }
      return o;
    }
    return v;
  };
  return { add, scrub, emails: () => [...found.values()] };
}

function scrubIntake(c, intake) {
  if (!intake || typeof intake !== "object") return intake ?? null;
  const clean = c.scrub(intake);
  // App 的 IntakeSubmission 頂層有 email 欄位：整欄拿掉，不留遮罩字樣（格式不完整的也收進聯絡資料）
  if (Object.prototype.hasOwnProperty.call(clean, "email")) {
    if (typeof intake.email === "string" && clean.email === intake.email) c.add(intake.email);
    delete clean.email;
  }
  return clean;
}

function scrubEma(c, ema) {
  if (!Array.isArray(ema)) return [];
  // 只有作答（survey）會有受測者自己打的字；生理、環境快照原樣保留
  return ema.map((ev) => (ev && typeof ev === "object" && ev.survey && typeof ev.survey === "object")
    ? { ...ev, survey: c.scrub(ev.survey) }
    : ev);
}

/**
 * 一筆上傳包或場次記錄的 intake 與 ema 一起拆。不改原物件。
 * 回傳 { intake, ema, emails }：intake／ema 是遮罩後的副本，emails 是去重後的 email。
 */
export function splitRecordContacts({ intake = null, ema = [] } = {}) {
  const c = collector();
  const cleanIntake = scrubIntake(c, intake);
  const cleanEma = scrubEma(c, ema);
  return { intake: cleanIntake, ema: cleanEma, emails: c.emails() };
}

/**
 * 把一位受測者的 email 併進該專案的聯絡資料。沒有新 email 就不寫。
 * App 每次上傳（走測中每 5 分鐘備份、結束定稿）都會帶 intake，同一專案兩人同時上傳偶爾會蓋掉對方剛寫的一筆，
 * 下一次上傳會再補回來，所以這裡不做鎖。
 */
export async function saveContact({ project, codeKey, codeRaw, emails, now = Date.now(), store = null }) {
  if (!project || !emails || !emails.length) return false;
  const st = store || getStore({ name: CONTACTS_STORE, consistency: "strong" });
  let rec = null;
  try { rec = await st.get(contactKey(project), { type: "json" }); } catch (_) { /* 首筆 */ }
  if (!rec || typeof rec !== "object" || !rec.codes || typeof rec.codes !== "object") rec = { project, codes: {} };
  const ck = codeKey || codeRaw || "NA";
  const cur = rec.codes[ck] || { code: codeRaw || ck, emails: [], firstAt: now };
  const have = new Set((cur.emails || []).map((e) => String(e).toLowerCase()));
  let added = false;
  for (const e of emails) {
    const k = String(e).toLowerCase();
    if (!have.has(k)) { (cur.emails = cur.emails || []).push(e); have.add(k); added = true; }
  }
  if (!added) return false;
  cur.code = codeRaw || cur.code;
  cur.updatedAt = now;
  rec.codes[ck] = cur;
  rec.project = project;
  rec.updatedAt = now;
  await st.setJSON(contactKey(project), rec);

  let idx = null;
  try { idx = await st.get(CONTACTS_INDEX, { type: "json" }); } catch (_) { /* 首筆 */ }
  if (!idx || typeof idx !== "object") idx = {};
  idx[project] = now;
  await st.setJSON(CONTACTS_INDEX, idx);
  return true;
}

/** drive-sync 寫進 Drive 聯絡資料夾的內容（每專案一個檔） */
export function contactsFileBody(rec) {
  const iso = (ms) => (ms ? new Date(ms).toISOString() : null);
  const participants = Object.values(rec.codes || {})
    .map((c) => ({ code: c.code, emails: c.emails || [], firstAt: iso(c.firstAt), updatedAt: iso(c.updatedAt) }))
    .sort((a, b) => String(a.code).localeCompare(String(b.code), "zh-Hant", { numeric: true }));
  return {
    說明: "聯絡資料與研究資料分開存放，只用於寄送個人回饋報告；寄出後或研究結束時，連同後端 heals-contacts 一起刪除。研究資料只以受測編號對應。",
    project: rec.project,
    updatedAt: iso(rec.updatedAt),
    participants,
  };
}
