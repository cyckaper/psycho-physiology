// tools/verify-contacts/run.mjs — 「email 不進研究資料」（CLAUDE.md 血淚教訓十二）的合成資料實跑
// 改了 netlify/lib/contacts.mjs、data.mjs 收件與 GET 的 intake／ema 處理、或 drive-sync 的 問卷.json 與聯絡資料段落，就跑：
//   node tools/verify-contacts/run.mjs
// 做法：把 netlify/ 複製到暫存目錄，旁邊放記憶體版 @netlify/blobs，Google Drive 以 fetch 模擬；不連網、不碰真的 Blobs 與 Drive。
// 全部通過才 exit 0。新增情境時，用已知答案寫斷言，不要只印結果。
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const tmp = mkdtempSync(join(tmpdir(), "verify-contacts-"));
cpSync(join(repo, "netlify"), join(tmp, "netlify"), { recursive: true });
const mockDir = join(tmp, "node_modules", "@netlify", "blobs");
mkdirSync(mockDir, { recursive: true });
writeFileSync(join(mockDir, "package.json"), JSON.stringify({ name: "@netlify/blobs", version: "0.0.0-mock", type: "module", exports: "./index.js" }));
writeFileSync(join(mockDir, "index.js"), `// 記憶體版 @netlify/blobs：只實作 data.mjs／drive-sync.mjs／contacts.mjs 用到的部分
const all = globalThis.__BLOBS || (globalThis.__BLOBS = new Map());
export function getStore(opts) {
  const name = typeof opts === "string" ? opts : opts.name;
  if (!all.has(name)) all.set(name, new Map());
  const m = all.get(name);
  return {
    async get(key, o = {}) {
      if (!m.has(key)) return null;
      const s = m.get(key);
      return o.type === "json" ? JSON.parse(s) : s;
    },
    async setJSON(key, v) { m.set(key, JSON.stringify(v)); },
    async set(key, v) { m.set(key, String(v)); },
    async delete(key) { m.delete(key); },
    async list(o = {}) {
      const p = o.prefix || "";
      return { blobs: [...m.keys()].filter((k) => k.startsWith(p)).map((key) => ({ key, etag: "" })) };
    },
  };
}
`);
const load = (rel) => import(pathToFileURL(join(tmp, rel)).href);
const { getStore } = await load("node_modules/@netlify/blobs/index.js");

const FOLDER = "application/vnd.google-apps.folder";
const drive = new Map();
drive.set("ROOT", { id: "ROOT", name: "讀人 場域研究", parents: ["root"], mimeType: FOLDER, trashed: false });
let nextId = 1;
const calls = [];
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  const method = (init.method || "GET").toUpperCase();
  calls.push(method + " " + u.host + u.pathname);
  const ok = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { "Content-Type": "application/json" } });
  const nf = () => new Response(JSON.stringify({ error: { code: 404 } }), { status: 404 });
  if (u.host === "oauth2.googleapis.com") return ok({ access_token: "tok" });
  if (u.pathname === "/drive/v3/files" && method === "GET") {
    const q = u.searchParams.get("q");
    const m = q.match(/^name='((?:\\'|[^'])*)' and '([^']+)' in parents and mimeType='([^']+)' and trashed=false$/);
    if (!m) throw new Error("unexpected q " + q);
    const name = m[1].replace(/\\'/g, "'");
    const hit = [...drive.values()].filter((f) => f.name === name && f.parents.includes(m[2]) && f.mimeType === m[3] && !f.trashed);
    return ok({ files: hit.slice(0, 1).map((f) => ({ id: f.id })) });
  }
  if (u.pathname === "/drive/v3/files" && method === "POST") {
    const b = JSON.parse(init.body);
    const id = "F" + nextId++;
    drive.set(id, { id, name: b.name, parents: b.parents, mimeType: b.mimeType, trashed: false });
    return ok({ id });
  }
  let mm = u.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
  if (mm) {
    const f = drive.get(decodeURIComponent(mm[1]));
    if (!f) return nf();
    if (method === "GET") {
      const out = {};
      for (const k of u.searchParams.get("fields").split(",")) out[k] = f[k];
      return ok(out);
    }
    if (method === "PATCH") { const b = JSON.parse(init.body); if (b.name) f.name = b.name; return ok({ id: f.id, name: f.name }); }
  }
  if (u.pathname === "/upload/drive/v3/files" && method === "POST") {
    const boundary = init.headers["Content-Type"].split("boundary=")[1];
    const parts = init.body.split("--" + boundary);
    const meta = JSON.parse(parts[1].split("\r\n\r\n")[1]);
    const content = parts[2].split("\r\n\r\n").slice(1).join("\r\n\r\n");
    const id = "F" + nextId++;
    drive.set(id, { id, name: meta.name, parents: meta.parents, mimeType: "application/json", trashed: false, content: JSON.parse(content) });
    return ok({ id });
  }
  mm = u.pathname.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/);
  if (mm && method === "PATCH") {
    const f = drive.get(decodeURIComponent(mm[1]));
    if (!f) return nf();
    f.content = JSON.parse(init.body);
    return ok({ id: f.id });
  }
  throw new Error("unmocked fetch " + method + " " + url);
};

process.env.GDRIVE_FOLDER_ID = "ROOT";
process.env.GDRIVE_OAUTH_CLIENT_ID = "cid";
process.env.GDRIVE_OAUTH_CLIENT_SECRET = "sec";
process.env.GDRIVE_OAUTH_REFRESH_TOKEN = "rt";
delete process.env.GDRIVE_SA_KEY;
delete process.env.GDRIVE_CONTACTS_FOLDER_ID;

const data = (await load("netlify/functions/data.mjs")).default;
const sync = (await load("netlify/functions/drive-sync.mjs")).default;
const CFOLDER = "讀人 聯絡資料（與研究資料分開存放）";   // 與 drive-sync.mjs 的 CONTACTS_FOLDER_NAME 一致

let pass = 0, fail = 0;
const check = (cond, msg) => { if (cond) { pass++; console.log("  ✓ " + msg); } else { fail++; console.log("  ✗ " + msg); } };
const noAt = (obj) => !JSON.stringify(obj).includes("@");
const post = async (body) => (await data(new Request("https://x/api/data", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }))).json();
const runSync = async () => (await sync(new Request("https://x/api/drive-sync"))).json();
const blobs = (name) => getStore({ name, consistency: "strong" });
const filesIn = (parent) => [...drive.values()].filter((f) => f.parents.includes(parent) && !f.trashed);
const folderNamed = (name, parent) => [...drive.values()].find((f) => f.name === name && f.parents.includes(parent) && f.mimeType === FOLDER && !f.trashed);

await blobs("heals-projects").setJSON("registry", { projects: [{ id: "101", name: "台北公園" }] });

const ans = (questionID, type, extra) => ({ questionID, questionText: "Q " + questionID, value: 0, type, lang: "zh", ...extra });
const intake1 = {
  project: "101", email: "Jake@NTU.edu.tw", completedAt: 800000000,
  answers: [
    ans("email", "email", { textValue: "Jake@NTU.edu.tw" }),
    ans("note", "text", { textValue: "報告寄到 jake2@example.com，謝謝" }),
    ans("birth_year", "text", { textValue: "1975" }),
    ans("gender", "single", { choiceValue: "m" }),
  ],
};
const ema1 = [
  { eventID: "e1", participantID: "P001", triggerType: "zone_entry", triggerTimestamp: 800000100, gpsLat: 25.01, gpsLng: 121.53,
    physiology: [{ metricType: "heart_rate", value: 92, hkSourceDevice: "Jake's Apple Watch", hkUUID: "U1" }],
    survey: { surveyID: "s1", eventID: "e1", instrument: "ema_v1", startedAt: 800000101, completedAt: 800000130, durationSeconds: 29,
      answers: [ans("q1", "scale", { value: 4 }), ans("contact", "email", { textValue: "bad@ntu" })] } },
];

console.log("1. 上傳（#1，intake 與 EMA 都有 email）");
let r = await post({ project: "101", code: "#1", session: "L20261123-101500", final: true,
  physiology: [{ metricType: "heart_rate", value: 90 }], location: [{ lat: 25, lng: 121, t: 800000000 }], environment: [], ema: ema1, activity: [], altitude: [], intake: intake1 });
check(r.ok && r.key === "101/1/L20261123-101500", "回 ok，key 剔除 #");
let rec = await blobs("heals-data").get("101/1/L20261123-101500", { type: "json" });
check(noAt(rec), "存進 heals-data 的記錄裡沒有任何 @");
check(!("email" in rec.intake), "intake 頂層的 email 欄整個拿掉");
check(rec.intake.answers[0].textValue === "[email 已另存]", "email 題答案換成遮罩");
check(rec.intake.answers[1].textValue === "報告寄到 [email 已另存]，謝謝", "開放題裡的 email 片段換成遮罩、其餘文字保留");
check(rec.intake.answers[2].textValue === "1975" && rec.intake.answers[3].choiceValue === "m", "其他作答原樣");
check(rec.ema[0].survey.answers[1].textValue === "[email 已另存]", "EMA 的 email 題（格式不完整 bad@ntu）也拆掉");
check(rec.ema[0].physiology[0].hkSourceDevice === "Jake's Apple Watch" && rec.ema[0].gpsLat === 25.01, "EMA 事件的生理與座標原樣");
check(rec.hasEmail === true && rec.counts.ema === 1, "hasEmail＝true、計數不變");
let c = await blobs("heals-contacts").get("p/101", { type: "json" });
check(c && JSON.stringify(c.codes["1"].emails) === JSON.stringify(["Jake@NTU.edu.tw", "jake2@example.com", "bad@ntu"]), "heals-contacts 依受測編號記下三個 email（去重、保留原樣大小寫）");
check(c.codes["1"].code === "#1", "聯絡資料保留原樣編號 #1");
const idx1 = await blobs("heals-contacts").get("_index", { type: "json" });
check(idx1 && idx1["101"] === c.updatedAt, "_index 記下專案更新時間");
const { splitRecordContacts } = await load("netlify/lib/contacts.mjs");
const again = splitRecordContacts({ intake: rec.intake, ema: rec.ema });
check(again.emails.length === 0 && JSON.stringify(again.intake) === JSON.stringify(rec.intake) && JSON.stringify(again.ema) === JSON.stringify(rec.ema), "已拆過的記錄再拆一次：不變、也不會把遮罩當成 email");
const man = await blobs("heals-data-index").get("manifest", { type: "json" });
check(noAt(man), "清單簿沒有 email");

console.log("2. 同一場再傳一次（充電同步後補傳）：聯絡資料不重寫");
await new Promise((res) => setTimeout(res, 5));
r = await post({ project: "101", code: "#1", session: "L20261123-101500", final: true, ema: ema1, intake: intake1 });
const c2 = await blobs("heals-contacts").get("p/101", { type: "json" });
check(c2.updatedAt === c.updatedAt && c2.codes["1"].emails.length === 3, "沒有新 email 就不寫");

console.log("3. #2 沒留 email");
r = await post({ project: "101", code: "#2", session: "L20261123-111500", final: true, intake: { project: "101", email: "", completedAt: 1, answers: [ans("email", "email", { textValue: "" })] } });
rec = await blobs("heals-data").get("101/2/L20261123-111500", { type: "json" });
check(rec.hasEmail === false && !("email" in rec.intake) && rec.intake.answers[0].textValue === "", "hasEmail＝false，空的 email 題不填遮罩");
c = await blobs("heals-contacts").get("p/101", { type: "json" });
check(!c.codes["2"], "#2 不進聯絡資料");

console.log("4. 舊記錄（改版前上傳，intake 裡還有 email）");
const oldRec = { project: "101", code: "#3", session: "L20261001-090000", uploadedAt: 700000000, final: true,
  counts: { physiology: 0, location: 1, environment: 0, ema: 0, activity: 0, altitude: 0 },
  physiology: [], location: [{ lat: 25, lng: 121, t: 1 }], environment: [], ema: [], activity: [], altitude: [],
  intake: { project: "101", email: "old@lab.org", completedAt: 1, answers: [ans("email", "email", { textValue: "old@lab.org" })] } };
await blobs("heals-data").setJSON("101/3/L20261001-090000", oldRec);   // 舊版沒有登記清單簿，靠 list() 撈到
const gres = await (await data(new Request("https://x/api/data?project=101"))).json();
check(Array.isArray(gres) && gres.length === 3, "GET 回三場");
check(noAt(gres), "GET 回傳的全部記錄沒有任何 @（含舊記錄）");
const gOld = gres.find((x) => x.session === "L20261001-090000");
check(gOld && gOld.hasEmail === true, "舊記錄回傳時補上 hasEmail＝true");
const storedOld = await blobs("heals-data").get("101/3/L20261001-090000", { type: "json" });
check(JSON.stringify(storedOld) === JSON.stringify(oldRec), "GET 不改儲存的舊記錄");

console.log("5. 第一次封存");
let s = await runSync();
check(s.ok && s.synced.length === 3, "三場都封存（" + JSON.stringify(s.synced) + "）");
check(JSON.stringify(s.contactsSynced) === JSON.stringify(["101"]), "聯絡資料同步了專案 101");
check(s.failed.length === 0, "沒有失敗（" + JSON.stringify(s.failed) + "）");
const projFolder = folderNamed("台北公園（101）", "ROOT");
check(!!projFolder, "研究資料夾：ROOT／台北公園（101）");
const qFiles = [...drive.values()].filter((f) => f.name === "問卷.json");
check(qFiles.length === 3 && qFiles.every((f) => noAt(f.content)), "三個 問卷.json 都沒有任何 @");
check(qFiles.every((f) => !("email" in f.content)), "問卷.json 不再有 email 欄");
const hasEmailBySess = Object.fromEntries(qFiles.map((f) => [f.content.session, f.content.hasEmail]));
check(hasEmailBySess["L20261123-101500"] === true && hasEmailBySess["L20261123-111500"] === false && hasEmailBySess["L20261001-090000"] === true, "hasEmail：#1 true、#2 false、舊記錄 #3 true");
const cf = folderNamed(CFOLDER, "root");
check(!!cf, "聯絡資料夾建在「我的雲端硬碟」最上層（parent＝root）");
const isUnderRoot = (id) => { let cur = drive.get(id); for (let i = 0; cur && i < 10; i++) { if (cur.id === "ROOT") return true; cur = drive.get(cur.parents[0]); } return false; };
check(cf && !isUnderRoot(cf.id), "聯絡資料夾不在研究資料根資料夾底下");
let cfiles = cf ? filesIn(cf.id) : [];
check(cfiles.length === 1 && cfiles[0].name === "聯絡資料_台北公園（101）.json", "聯絡資料夾裡一個檔：聯絡資料_台北公園（101）.json");
const codes = cfiles[0] ? cfiles[0].content.participants.map((p) => p.code + ":" + p.emails.join("|")) : [];
check(JSON.stringify(codes) === JSON.stringify(["#1:Jake@NTU.edu.tw|jake2@example.com|bad@ntu", "#3:old@lab.org"]), "檔內：#1 三個 email、舊記錄 #3 的 email 也收進來（" + JSON.stringify(codes) + "）");
check(cfiles[0] && !JSON.stringify(cfiles[0].content).includes("[email 已另存]"), "聯絡資料裡沒有遮罩字樣");
const researchFiles = [...drive.values()].filter((f) => f.mimeType !== FOLDER && isUnderRoot(f.parents[0]));
check(researchFiles.length > 0 && researchFiles.every((f) => noAt(f.content)), "研究資料根資料夾底下所有檔都沒有 @（" + researchFiles.length + " 個檔）");
const contactsFileId = cfiles[0] && cfiles[0].id;

console.log("6. 沒有新工作：不碰 Drive");
calls.length = 0;
s = await runSync();
check(s.ok && s.pending === 0 && calls.length === 0, "提早結束、沒有任何 Google 請求（" + calls.length + "）");

console.log("7. 新受測者 #4 留 email：聯絡資料檔原地更新");
await post({ project: "101", code: "#4", session: "L20261123-131500", final: true, intake: { project: "101", email: "four@ex.com", completedAt: 1, answers: [ans("email", "email", { textValue: "four@ex.com" })] } });
s = await runSync();
cfiles = filesIn(cf.id);
check(s.synced.length === 1 && JSON.stringify(s.contactsSynced) === '["101"]', "封存一場、聯絡資料同步一次");
check(cfiles.length === 1 && cfiles[0].id === contactsFileId && cfiles[0].content.participants.some((p) => p.code === "#4" && p.emails[0] === "four@ex.com"), "同一個檔原地更新、多了 #4");

console.log("8. 專案改名：聯絡資料檔跟著改名");
await blobs("heals-projects").setJSON("registry", { projects: [{ id: "101", name: "河濱公園" }] });
s = await runSync();
cfiles = filesIn(cf.id);
check(cfiles.length === 1 && cfiles[0].id === contactsFileId && cfiles[0].name === "聯絡資料_河濱公園（101）.json", "檔名改成 聯絡資料_河濱公園（101）.json（" + (cfiles[0] && cfiles[0].name) + "）");
check(!!folderNamed("河濱公園（101）", "ROOT"), "研究資料夾也跟著改名");
calls.length = 0;
s = await runSync();
check(calls.length === 0, "改完之後不再有工作");

console.log("9. 聯絡資料檔被丟進垃圾桶後又有新 email：另建新檔");
drive.get(contactsFileId).trashed = true;
await post({ project: "101", code: "#5", session: "L20261123-141500", final: true, intake: { project: "101", email: "five@ex.com", completedAt: 1, answers: [] } });
s = await runSync();
cfiles = filesIn(cf.id);
check(cfiles.length === 1 && cfiles[0].id !== contactsFileId && cfiles[0].content.participants.length === 4, "垃圾桶那個不動，新檔有 #1 #3 #4 #5");

console.log("10. GDRIVE_CONTACTS_FOLDER_ID 指到研究資料夾底下：拒寫");
const bad = "F" + nextId++;
drive.set(bad, { id: bad, name: "誤放", parents: [projFolder.id], mimeType: FOLDER, trashed: false });
process.env.GDRIVE_CONTACTS_FOLDER_ID = bad;
await post({ project: "101", code: "#6", session: "L20261123-151500", final: true, intake: { project: "101", email: "six@ex.com", completedAt: 1, answers: [] } });
s = await runSync();
check(s.failed.some((f) => f.key === "聯絡資料" && /研究資料根資料夾/.test(f.error)), "failed 列出拒寫原因");
check(filesIn(bad).length === 0, "那個資料夾裡沒有寫進任何檔");
check(s.synced.length === 1, "場次封存照常");
process.env.GDRIVE_CONTACTS_FOLDER_ID = "NOPE";
s = await runSync();
check(s.failed.some((f) => f.key === "聯絡資料" && /找不到/.test(f.error)), "指到不存在的資料夾：failed 說找不到");
delete process.env.GDRIVE_CONTACTS_FOLDER_ID;
s = await runSync();
cfiles = filesIn(cf.id);
check(s.failed.length === 0 && cfiles[0].content.participants.some((p) => p.code === "#6"), "拿掉設定後回到預設資料夾，#6 補寫進去");

console.log("11. 寄完報告刪掉 heals-contacts 那筆：不再重試，之後又有人留 email 才重建");
await blobs("heals-contacts").delete("p/101");
calls.length = 0;
s = await runSync();
check(calls.length === 0, "刪掉之後沒有工作（索引時間不比已同步的新）");
await post({ project: "101", code: "#7", session: "L20261123-161500", final: true, intake: { project: "101", email: "seven@ex.com", completedAt: 1, answers: [] } });
s = await runSync();
cfiles = filesIn(cf.id);
check(cfiles.length === 1 && cfiles[0].content.participants.length === 1 && cfiles[0].content.participants[0].code === "#7", "重建後檔內只有 #7");

console.log("12. 只有 EMA 有 email 題（intake 為 null）");
await post({ project: "202", code: "A1", session: "L20261123-171500", final: true, ema: [{ eventID: "e9", survey: { answers: [ans("mail", "email", { textValue: "ema@ex.com" })] } }] });
const c202 = await blobs("heals-contacts").get("p/202", { type: "json" });
check(c202 && c202.codes["A1"].emails[0] === "ema@ex.com", "EMA 的 email 也進聯絡資料");
const r202 = await blobs("heals-data").get("202/A1/L20261123-171500", { type: "json" });
check(noAt(r202) && r202.hasEmail === true && r202.intake === null, "研究資料沒有 @、hasEmail＝true、intake 仍是 null");

console.log("\n" + pass + " 通過，" + fail + " 失敗");
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
